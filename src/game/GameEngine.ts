import * as THREE from 'three';
import { AudioSystem } from './AudioSystem';

export interface WeaponDef {
  id: string;
  name: string;
  price: number;
  damage: number;
  fireRate: number; // ms between shots
  maxAmmo: number;
  reserveAmmo: number;
  spread: number;
  reloadTime: number;
  color: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  knife:   { id: 'knife',   name: 'Нож',      price: 0,    damage: 60,  fireRate: 600,  maxAmmo: 1,  reserveAmmo: 0,   spread: 0,    reloadTime: 0,    color: 0x888888 },
  p250:    { id: 'p250',    name: 'P250',      price: 300,  damage: 38,  fireRate: 250,  maxAmmo: 13, reserveAmmo: 52,  spread: 0.025,reloadTime: 1800, color: 0x3a3a3a },
  deagle:  { id: 'deagle',  name: 'Desert Eagle', price: 700, damage: 98, fireRate: 400, maxAmmo: 7, reserveAmmo: 35,  spread: 0.015,reloadTime: 2200, color: 0x2a2a28 },
  mp5:     { id: 'mp5',     name: 'MP5-SD',    price: 1500, damage: 27,  fireRate: 80,   maxAmmo: 30, reserveAmmo: 120, spread: 0.02, reloadTime: 2000, color: 0x1a2a1a },
  ak47:    { id: 'ak47',    name: 'AK-47',     price: 2700, damage: 36,  fireRate: 100,  maxAmmo: 30, reserveAmmo: 90,  spread: 0.018,reloadTime: 2500, color: 0x2a2a28 },
  m4a4:    { id: 'm4a4',    name: 'M4A4',      price: 3100, damage: 33,  fireRate: 90,   maxAmmo: 30, reserveAmmo: 90,  spread: 0.014,reloadTime: 2400, color: 0x1a2a3a },
  awp:     { id: 'awp',     name: 'AWP',       price: 4750, damage: 115, fireRate: 1200, maxAmmo: 10, reserveAmmo: 30,  spread: 0.002,reloadTime: 3500, color: 0x3a4a2a },
  m249:    { id: 'm249',    name: 'M249',      price: 5200, damage: 32,  fireRate: 75,   maxAmmo: 100,reserveAmmo: 200, spread: 0.03, reloadTime: 4000, color: 0x4a3a2a },
};

export interface GameState {
  ammo: number;
  maxAmmo: number;
  reserveAmmo: number;
  health: number;
  armor: number;
  money: number;
  isReloading: boolean;
  isCrouching: boolean;
  isJumping: boolean;
  isInspecting: boolean;
  isAiming: boolean;
  kills: number;
  gamePhase: 'menu' | 'buy' | 'playing' | 'dead';
  reloadProgress: number;
  muzzleFlash: boolean;
  hitMarker: boolean;
  headshot: boolean;
  enemiesAlive: number;
  currentWeapon: string;
  roundTime: number;
  damageFlash: number; // 0-1
}

export interface Enemy {
  mesh: THREE.Group;
  health: number;
  position: THREE.Vector3;
  alive: boolean;
  speed: number;
  lastShot: number;
  id: number;
  // bone refs for animation
  bones: {
    body: THREE.Mesh;
    head: THREE.Mesh;
    legL: THREE.Object3D;
    legR: THREE.Object3D;
    armL: THREE.Object3D;
    armR: THREE.Object3D;
  };
}

export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private audio: AudioSystem;

  // Player state
  private yaw = 0;
  private pitch = 0;
  private moveVelocity = new THREE.Vector3();
  private playerVelocityY = 0;
  private playerPos = new THREE.Vector3(0, 1.75, 35);
  private isOnGround = true;
  private isCrouching = false;
  private stepTimer = 0;

  private keys: Record<string, boolean> = {};
  private mouseButtons: Record<number, boolean> = {};

  // Weapon visuals
  private weaponGroup!: THREE.Group;
  private weaponBobTime = 0;
  private weaponInspectTime = 0;
  private reloadStartTime = 0;
  private lastFireTime = 0;
  private muzzleFlashMesh!: THREE.Mesh;
  private muzzleFlashLight!: THREE.PointLight;

  // Wall geometry for LOS raycasting (solid objects only)
  private wallMeshes: THREE.Mesh[] = [];

  private enemies: Enemy[] = [];
  private decals: THREE.Mesh[] = [];

  private clock = new THREE.Clock();
  private animFrame = 0;
  private roundStartTime = 0;

  // Current weapon def
  private weaponDef: WeaponDef = WEAPONS.ak47;

  public state: GameState = {
    ammo: 30, maxAmmo: 30, reserveAmmo: 90,
    health: 100, armor: 0, money: 3000,
    isReloading: false, isCrouching: false,
    isJumping: false, isInspecting: false, isAiming: false,
    kills: 0, gamePhase: 'menu',
    reloadProgress: 0, muzzleFlash: false, hitMarker: false, headshot: false,
    enemiesAlive: 0, currentWeapon: 'ak47', roundTime: 90, damageFlash: 0,
  };

  private onStateChange?: (state: GameState) => void;

  constructor(canvas: HTMLCanvasElement, onStateChange?: (state: GameState) => void) {
    this.canvas = canvas;
    this.onStateChange = onStateChange;
    this.audio = new AudioSystem();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.05, 800);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.fog = new THREE.FogExp2(0x8a9ba8, 0.010);
    this.scene.background = new THREE.Color(0x7a9baa);

    this.buildMap();
    this.buildWeapon();
    this.setupLights();
    this.setupEvents();
    this.loop();
  }

  // ─── MAP ────────────────────────────────────────────────────────────────────

  private buildMap() {
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xc8b88a, roughness: 0.95 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const makeBox = (w: number, h: number, d: number, x: number, y: number, z: number, color: number, rough = 0.9): THREE.Mesh => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 })
      );
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.wallMeshes.push(mesh);
      return mesh;
    };

    const W = 0xd4c49a, WD = 0xb8a882, R = 0xa09070;

    // Outer walls
    makeBox(220, 12, 2.5,  0,  6, -105, W);
    makeBox(220, 12, 2.5,  0,  6,  105, W);
    makeBox(2.5, 12, 220, -105, 6,    0, W);
    makeBox(2.5, 12, 220,  105, 6,    0, W);

    // ── A SITE ──
    makeBox(32, 0.6, 26, 35, 0.3, -30, 0xc4b480);  // platform
    makeBox(2, 5, 26, 19, 2.5, -30, W);             // A long wall
    makeBox(32, 5, 2.5, 35, 2.5, -43, W);           // back wall
    makeBox(2.5, 5, 16, 51, 2.5, -35, W);
    makeBox(9, 5, 2.5, 46, 2.5, -19, WD);
    makeBox(22, 9, 20, 57, 4.5, -41, WD);           // CT spawn A
    makeBox(22, 0.6, 20, 57, 9.3, -41, R);
    makeBox(17, 5, 9, 14, 2.5, -19, W);             // A ramp building
    makeBox(17, 0.6, 9, 14, 5.3, -19, R);
    // Palace
    makeBox(30, 7.5, 3, 30, 3.75, -56, W);
    makeBox(30, 7.5, 3, 30, 3.75, -68, W);
    makeBox(3, 7.5, 15, 16, 3.75, -62, W);
    makeBox(30, 0.6, 18, 30, 7.8, -62, R);
    makeBox(3, 2.5, 1, 28, 5, -56, 0x4a6070);      // window

    // ── B SITE ──
    makeBox(32, 0.6, 26, -35, 0.3, -30, 0xc4b480);
    makeBox(2, 5, 26, -19, 2.5, -30, W);
    makeBox(32, 5, 2.5, -35, 2.5, -43, W);
    makeBox(2.5, 5, 16, -51, 2.5, -35, W);
    makeBox(9, 5, 2.5, -46, 2.5, -19, WD);
    makeBox(22, 9, 20, -57, 4.5, -41, WD);         // CT spawn B
    makeBox(22, 0.6, 20, -57, 9.3, -41, R);
    // B apts
    makeBox(3.5, 7.5, 32, -15, 3.75, -49, W);
    makeBox(15, 7.5, 3, -22, 3.75, -64, W);
    makeBox(15, 0.6, 20, -22, 7.8, -55, R);
    // B van
    makeBox(5.5, 3.2, 9, -30, 1.6, -18, 0x5a6050);
    makeBox(4, 1.8, 4, -30, 3.6, -16, 0x3a4550);

    // ── MID ──
    makeBox(2.5, 5.5, 42, -5, 2.75, -8, W);        // mid window walls
    makeBox(2.5, 5.5, 42, 5, 2.75, -8, W);
    makeBox(13, 0.6, 42, 0, 5.6, -8, R);           // mid roof
    makeBox(19, 5.5, 3, 0, 2.75, 11, WD);          // top mid wall
    makeBox(2.5, 5.5, 19, -8, 2.75, 5, W);
    makeBox(2.5, 5.5, 19, 8, 2.75, 5, W);
    makeBox(9, 4.5, 7, 0, 2.25, 19, W);            // ticket booth
    makeBox(9, 0.6, 7, 0, 4.8, 19, R);
    makeBox(15, 6.5, 15, 21, 3.25, 5, W);          // jungle
    makeBox(15, 0.6, 15, 21, 6.6, 5, R);
    makeBox(3.5, 5.5, 22, 36, 2.75, -12, W);       // short
    makeBox(3.5, 5.5, 22, -36, 2.75, -12, W);

    // ── T SPAWN ──
    makeBox(52, 5.5, 2.5, 0, 2.75, 46, W);
    makeBox(2.5, 5.5, 32, -25, 2.75, 31, W);
    makeBox(2.5, 5.5, 32, 25, 2.75, 31, W);

    // ── COVER ──
    // A site crates
    makeBox(2.2, 1.6, 2.2, 28, 0.8, -28, 0x8a7a55);
    makeBox(2.2, 1.6, 2.2, 31, 0.8, -28, 0x8a7a55);
    makeBox(2.2, 3.2, 2.2, 29.5, 2.5, -28, 0x7a6a45);
    makeBox(2.2, 1.6, 2.2, 40, 0.8, -34, 0x8a7a55);
    // B site crates
    makeBox(2.2, 1.6, 2.2, -28, 0.8, -28, 0x8a7a55);
    makeBox(2.2, 1.6, 2.2, -31, 0.8, -28, 0x8a7a55);
    makeBox(2.2, 3.2, 2.2, -29.5, 2.5, -28, 0x7a6a45);
    // Mid barrels
    makeBox(1.3, 2.2, 1.3, -2.5, 1.1, 15, 0x5a6a3a);
    makeBox(1.3, 2.2, 1.3, 2.5, 1.1, 15, 0x5a6a3a);
    // Car
    makeBox(5.5, 2.2, 10.5, -13, 1.1, 19, 0x4a5560);
    makeBox(4, 1.6, 4, -13, 3, 21, 0x3a4550);
    // Sandbags
    makeBox(7.5, 0.9, 0.9, 33, 0.45, -22, 0x9a8a60);
    makeBox(7.5, 0.9, 0.9, -33, 0.45, -22, 0x9a8a60);
    // Arch mid
    makeBox(11, 9, 2.5, 0, 4.5, -36, W);
    makeBox(2.5, 3.5, 2.5, -4, 1.75, -36, 0x5a4a30);
    makeBox(2.5, 3.5, 2.5, 4, 1.75, -36, 0x5a4a30);
    // Pillars
    for (let i = 0; i < 4; i++) makeBox(0.6, 7.5, 0.6, 14 + i * 3, 3.75, -14, 0x887858);
  }

  // ─── WEAPON VISUAL ──────────────────────────────────────────────────────────

  private buildWeapon() {
    this.weaponGroup = new THREE.Group();
    this.updateWeaponVisual();
    this.camera.add(this.weaponGroup);
    this.scene.add(this.camera);
  }

  private updateWeaponVisual() {
    // Clear existing children
    while (this.weaponGroup.children.length) this.weaponGroup.remove(this.weaponGroup.children[0]);

    const def = this.weaponDef;
    const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.3, metalness: 0.75 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.82 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: 0.18, metalness: 0.92 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc8a882, roughness: 0.78 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.9 });

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      this.weaponGroup.add(m);
      return m;
    };

    if (def.id === 'knife') {
      add(new THREE.BoxGeometry(0.018, 0.22, 0.03), metalMat, 0, 0.02, -0.22);
      add(new THREE.BoxGeometry(0.025, 0.09, 0.025), woodMat, 0, -0.07, -0.06);
    } else if (def.id === 'awp') {
      add(new THREE.BoxGeometry(0.07, 0.07, 0.55), bodyMat, 0, 0, 0);
      add(new THREE.CylinderGeometry(0.013, 0.013, 0.65, 12), metalMat, 0, 0.01, -0.52, Math.PI / 2, 0, 0);
      add(new THREE.BoxGeometry(0.05, 0.065, 0.28), woodMat, 0, -0.01, 0.26);
      add(new THREE.BoxGeometry(0.04, 0.11, 0.06), woodMat, 0, -0.09, 0.1, 0.3, 0, 0);
      add(new THREE.BoxGeometry(0.04, 0.18, 0.07), bodyMat, 0, -0.14, 0.02, -0.15, 0, 0);
      // Scope
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 10), metalMat, 0, 0.055, -0.1, Math.PI / 2, 0, 0);
    } else {
      // Generic rifle / pistol
      const isSmg = def.id === 'mp5';
      const isPistol = def.id === 'p250' || def.id === 'deagle';
      const scale = isPistol ? 0.65 : 1;
      const zOff = isPistol ? 0.08 : 0;

      add(new THREE.BoxGeometry(0.062 * scale, 0.062 * scale, 0.38 * scale), bodyMat, 0, 0, zOff);
      add(new THREE.CylinderGeometry(0.013, 0.013, isPistol ? 0.22 : 0.42, 12), metalMat, 0, 0.01, -0.36 * scale + zOff, Math.PI / 2, 0, 0);
      if (!isPistol) add(new THREE.CylinderGeometry(0.009, 0.009, 0.22, 8), metalMat, 0, 0.026, -0.25, Math.PI / 2, 0, 0);
      add(new THREE.BoxGeometry(0.052 * scale, 0.052 * scale, isSmg ? 0.12 : 0.22 * scale), isPistol ? metalMat : woodMat, 0, -0.01, (isPistol ? 0.12 : 0.22) * scale + zOff);
      add(new THREE.BoxGeometry(0.042 * scale, 0.105 * scale, 0.056 * scale), woodMat, 0, -0.082 * scale, 0.1 * scale + zOff, 0.3, 0, 0);
      add(new THREE.BoxGeometry(0.058 * scale, 0.058 * scale, isPistol ? 0.1 : 0.18), woodMat, 0, 0, -0.18 + zOff);
      add(new THREE.BoxGeometry(0.042, isPistol ? 0.12 : 0.17, 0.065), bodyMat, 0, isPistol ? -0.1 : -0.135, 0.025 + zOff, -0.15, 0, 0);
      add(new THREE.BoxGeometry(0.022, 0.032, 0.012), metalMat, 0, 0.052, -0.47 + zOff);
      add(new THREE.BoxGeometry(0.038, 0.027, 0.022), metalMat, 0, 0.044, -0.02 + zOff);
      add(new THREE.BoxGeometry(0.026, 0.016, 0.032), metalMat, 0.042, 0.026, 0.05 + zOff);
    }

    // ── HANDS (proportional human arms) ──
    // Right hand & forearm
    const rfArm = add(new THREE.CylinderGeometry(0.028, 0.032, 0.22, 10), sleeveMat, 0.075, -0.14, 0.08, Math.PI / 2, 0, 0.18);
    const rHand = add(new THREE.BoxGeometry(0.072, 0.062, 0.11), skinMat, 0.068, -0.09, 0.1);
    // Thumb R
    add(new THREE.CylinderGeometry(0.009, 0.008, 0.045, 6), skinMat, 0.108, -0.078, 0.085, 0, 0, 0.6);
    // Fingers R
    for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.009, 0.008, 0.048, 6), skinMat, 0.048 + i * 0.014 - 0.02, -0.062, 0.062, Math.PI / 2, 0, 0);

    // Left forearm & hand (on foregrip)
    add(new THREE.CylinderGeometry(0.026, 0.030, 0.22, 10), sleeveMat, -0.055, -0.07, -0.18, Math.PI / 2, 0, -0.15);
    add(new THREE.BoxGeometry(0.066, 0.056, 0.095), skinMat, -0.048, -0.030, -0.18);
    // Thumb L
    add(new THREE.CylinderGeometry(0.009, 0.008, 0.044, 6), skinMat, -0.088, -0.020, -0.162, 0, 0, -0.6);
    // Fingers L
    for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.009, 0.008, 0.048, 6), skinMat, -0.068 + i * 0.014, -0.008, -0.198, Math.PI / 2, 0, 0);

    // Muzzle flash sphere
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0 });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), flashMat);
    this.muzzleFlashMesh.position.set(0, 0.01, -0.65);
    this.weaponGroup.add(this.muzzleFlashMesh);

    this.muzzleFlashLight = new THREE.PointLight(0xffdd66, 0, 9);
    this.muzzleFlashLight.position.set(0, 0.01, -0.65);
    this.weaponGroup.add(this.muzzleFlashLight);

    this.weaponGroup.position.set(0.18, -0.22, -0.35);

    // Suppress TS unused warning
    void rfArm; void rHand;
  }

  // ─── HUMAN ENEMY MODEL ──────────────────────────────────────────────────────
  // All proportions based on 1.8m average human
  // Units: 1 unit = 1 metre
  private createEnemy(pos: THREE.Vector3, id: number): Enemy {
    const root = new THREE.Group();

    const skinColor = [0xc09060, 0xb88050, 0xd4a870, 0xa87845][id % 4];
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.78 });
    const uniformMat = new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.88 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a2820, roughness: 0.92 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x2a3428, roughness: 0.6, metalness: 0.3 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.95 });
    const weaponMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1a, roughness: 0.25, metalness: 0.85 });

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    // ── TORSO (height 0.55, width 0.44, depth 0.22) ──
    // Positioned so feet = y=0
    const torso = add(new THREE.BoxGeometry(0.44, 0.55, 0.22), uniformMat, root, 0, 0.93, 0);

    // ── HIPS ──
    add(new THREE.BoxGeometry(0.40, 0.18, 0.20), uniformMat, root, 0, 0.62, 0);

    // ── NECK ──
    const neck = add(new THREE.CylinderGeometry(0.062, 0.072, 0.1, 8), skinMat, root, 0, 1.235, 0);

    // ── HEAD (0.22 wide, 0.25 tall, 0.22 deep) ──
    const head = add(new THREE.BoxGeometry(0.22, 0.25, 0.22), skinMat, root, 0, 1.405, 0);
    // Face details
    const eyeGeo = new THREE.BoxGeometry(0.045, 0.03, 0.02);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.065, 1.42, -0.112); root.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.065; root.add(eyeR);
    // Nose
    add(new THREE.BoxGeometry(0.025, 0.04, 0.03), skinMat, root, 0, 1.395, -0.118);

    // ── HELMET ──
    const helmet = add(new THREE.SphereGeometry(0.135, 14, 10), helmetMat, root, 0, 1.44, 0);
    // Helmet brim
    add(new THREE.CylinderGeometry(0.145, 0.145, 0.022, 14), helmetMat, root, 0, 1.33, 0);
    // Goggles
    add(new THREE.BoxGeometry(0.18, 0.04, 0.02), new THREE.MeshStandardMaterial({ color: 0x224433, roughness: 0.1, metalness: 0.6 }), root, 0, 1.425, -0.135);

    // ── VEST / BODY ARMOR ──
    add(new THREE.BoxGeometry(0.46, 0.52, 0.24), new THREE.MeshStandardMaterial({ color: 0x2a3428, roughness: 0.6, metalness: 0.15 }), root, 0, 0.94, 0);
    // Pouches
    add(new THREE.BoxGeometry(0.12, 0.12, 0.06), darkMat, root, -0.16, 0.80, -0.15);
    add(new THREE.BoxGeometry(0.12, 0.12, 0.06), darkMat, root, 0.16, 0.80, -0.15);
    add(new THREE.BoxGeometry(0.08, 0.08, 0.06), darkMat, root, 0, 0.72, -0.15);

    // ── LEFT ARM (upper + forearm + hand) ──
    // Upper arm — pivot at shoulder
    const armLGroup = new THREE.Group();
    armLGroup.position.set(-0.265, 1.14, 0);
    root.add(armLGroup);
    add(new THREE.CylinderGeometry(0.072, 0.065, 0.32, 10), uniformMat, armLGroup, 0, -0.16, 0);
    // Elbow/forearm
    const forearmLGroup = new THREE.Group();
    forearmLGroup.position.set(0, -0.32, 0);
    armLGroup.add(forearmLGroup);
    add(new THREE.CylinderGeometry(0.058, 0.05, 0.28, 10), uniformMat, forearmLGroup, 0, -0.14, 0);
    // Left hand
    add(new THREE.BoxGeometry(0.085, 0.095, 0.055), skinMat, forearmLGroup, 0, -0.32, 0);
    // Fingers L
    for (let i = 0; i < 4; i++) {
      const fg = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.009, 0.055, 6), skinMat);
      fg.position.set(-0.028 + i * 0.018, -0.378, 0);
      forearmLGroup.add(fg);
    }

    // ── RIGHT ARM ──
    const armRGroup = new THREE.Group();
    armRGroup.position.set(0.265, 1.14, 0);
    root.add(armRGroup);
    add(new THREE.CylinderGeometry(0.072, 0.065, 0.32, 10), uniformMat, armRGroup, 0, -0.16, 0);
    const forearmRGroup = new THREE.Group();
    forearmRGroup.position.set(0, -0.32, 0);
    armRGroup.add(forearmRGroup);
    add(new THREE.CylinderGeometry(0.058, 0.05, 0.28, 10), uniformMat, forearmRGroup, 0, -0.14, 0);
    add(new THREE.BoxGeometry(0.085, 0.095, 0.055), skinMat, forearmRGroup, 0, -0.32, 0);
    for (let i = 0; i < 4; i++) {
      const fg = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.009, 0.055, 6), skinMat);
      fg.position.set(-0.028 + i * 0.018, -0.378, 0);
      forearmRGroup.add(fg);
    }

    // ── LEFT LEG (thigh + shin + foot) ──
    const legLGroup = new THREE.Group();
    legLGroup.position.set(-0.115, 0.61, 0);
    root.add(legLGroup);
    add(new THREE.CylinderGeometry(0.082, 0.072, 0.42, 10), uniformMat, legLGroup, 0, -0.21, 0);
    // Shin
    const shinLGroup = new THREE.Group();
    shinLGroup.position.set(0, -0.42, 0);
    legLGroup.add(shinLGroup);
    add(new THREE.CylinderGeometry(0.062, 0.052, 0.38, 10), darkMat, shinLGroup, 0, -0.19, 0);
    // Foot
    add(new THREE.BoxGeometry(0.105, 0.062, 0.21), bootMat, shinLGroup, 0, -0.41, -0.04);

    // ── RIGHT LEG ──
    const legRGroup = new THREE.Group();
    legRGroup.position.set(0.115, 0.61, 0);
    root.add(legRGroup);
    add(new THREE.CylinderGeometry(0.082, 0.072, 0.42, 10), uniformMat, legRGroup, 0, -0.21, 0);
    const shinRGroup = new THREE.Group();
    shinRGroup.position.set(0, -0.42, 0);
    legRGroup.add(shinRGroup);
    add(new THREE.CylinderGeometry(0.062, 0.052, 0.38, 10), darkMat, shinRGroup, 0, -0.19, 0);
    add(new THREE.BoxGeometry(0.105, 0.062, 0.21), bootMat, shinRGroup, 0, -0.41, -0.04);

    // ── WEAPON (AK-47 held in arms) ──
    const weapGroup = new THREE.Group();
    weapGroup.position.set(0.28, 1.02, -0.22);
    weapGroup.rotation.x = 0.15;
    root.add(weapGroup);
    // Receiver
    const wRecv = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.38), weaponMat);
    weapGroup.add(wRecv);
    // Barrel
    const wBar = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.38, 10), weaponMat);
    wBar.rotation.x = Math.PI / 2; wBar.position.set(0, 0.01, -0.28);
    weapGroup.add(wBar);
    // Stock
    const wStk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.82 }));
    wStk.position.set(0, -0.01, 0.2); weapGroup.add(wStk);
    // Mag
    const wMag = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.14, 0.06), weaponMat);
    wMag.position.set(0, -0.12, 0.02); wMag.rotation.x = -0.15; weapGroup.add(wMag);

    // Health bar above head
    const hbBg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.045), new THREE.MeshBasicMaterial({ color: 0x333333, depthWrite: false }));
    hbBg.position.set(0, 1.72, 0);
    hbBg.renderOrder = 1;
    root.add(hbBg);
    const hbFill = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.042), new THREE.MeshBasicMaterial({ color: 0x44cc44, depthWrite: false }));
    hbFill.position.set(0, 1.72, 0.001);
    hbFill.renderOrder = 2;
    root.add(hbFill);

    root.position.copy(pos);
    this.scene.add(root);

    const enemy: Enemy = {
      mesh: root,
      health: 100,
      position: pos.clone(),
      alive: true,
      speed: 1.6 + Math.random() * 0.5,
      lastShot: 0,
      id,
      bones: {
        body: torso,
        head,
        legL: legLGroup,
        legR: legRGroup,
        armL: armLGroup,
        armR: armRGroup,
      },
    };

    // Store health bar fill ref
    (root as THREE.Group & { hbFill: THREE.Mesh }).hbFill = hbFill;

    void neck; void helmet;
    return enemy;
  }

  // ─── LIGHTS ─────────────────────────────────────────────────────────────────

  private setupLights() {
    this.scene.add(new THREE.AmbientLight(0x8090a0, 0.65));
    const sun = new THREE.DirectionalLight(0xfffce8, 2.4);
    sun.position.set(40, 90, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 320;
    sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
    sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    this.scene.add(new THREE.DirectionalLight(0xa0c8e8, 0.75).translateX(-20).translateY(35));
    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0xc8b88a, 0.5));
  }

  // ─── EVENTS ─────────────────────────────────────────────────────────────────

  private setupEvents() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (this.state.gamePhase !== 'playing') return;

      if (e.code === 'KeyR' && !this.state.isReloading && this.state.ammo < this.state.maxAmmo && this.state.reserveAmmo > 0) {
        this.startReload();
      }
      if (e.code === 'KeyF') {
        this.state.isInspecting = !this.state.isInspecting;
        if (this.state.isInspecting) this.weaponInspectTime = 0;
        this.emitState();
      }
      if (e.code === 'Space' && this.isOnGround && !this.isCrouching) {
        this.playerVelocityY = 6.8;
        this.isOnGround = false;
        this.state.isJumping = true;
        this.emitState();
      }
      // Buy menu — B key
      if (e.code === 'KeyB') {
        this.state.gamePhase = 'buy';
        document.exitPointerLock();
        this.emitState();
      }
    });

    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    document.addEventListener('mousedown', (e) => {
      this.mouseButtons[e.button] = true;
      if (e.button === 2 && this.state.gamePhase === 'playing') {
        this.state.isAiming = true;
        this.emitState();
      }
    });
    document.addEventListener('mouseup', (e) => {
      this.mouseButtons[e.button] = false;
      if (e.button === 2) {
        this.state.isAiming = false;
        this.emitState();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        const sens = 0.0015;
        this.yaw -= e.movementX * sens;
        this.pitch -= e.movementY * sens;
        this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
      }
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    });
  }

  // ─── RELOAD ─────────────────────────────────────────────────────────────────

  private startReload() {
    if (this.state.isReloading || this.state.reserveAmmo <= 0) return;
    this.state.isReloading = true;
    this.reloadStartTime = performance.now();
    this.audio.playReload();
    this.emitState();

    const dur = this.weaponDef.reloadTime;
    setTimeout(() => {
      if (this.state.gamePhase !== 'playing') return;
      const needed = this.state.maxAmmo - this.state.ammo;
      const take = Math.min(needed, this.state.reserveAmmo);
      this.state.ammo += take;
      this.state.reserveAmmo -= take;
      this.state.isReloading = false;
      this.state.reloadProgress = 0;
      this.emitState();
    }, dur);
  }

  // ─── SHOOT ──────────────────────────────────────────────────────────────────

  private shoot() {
    const now = performance.now();
    if (now - this.lastFireTime < this.weaponDef.fireRate) return;
    if (this.state.ammo <= 0) {
      this.audio.playEmpty();
      if (this.state.reserveAmmo > 0) this.startReload();
      return;
    }
    if (this.state.isReloading) return;

    this.lastFireTime = now;
    this.state.ammo--;
    this.state.muzzleFlash = true;
    this.emitState();

    this.audio.playShoot();
    this.audio.playShellDrop();

    (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 1;
    this.muzzleFlashLight.intensity = 9;
    setTimeout(() => {
      (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      this.muzzleFlashLight.intensity = 0;
      this.state.muzzleFlash = false;
      this.emitState();
    }, 55);

    // Recoil
    this.weaponGroup.position.z += 0.014;
    this.weaponGroup.rotation.x -= 0.038;

    // ── RAY with spread ──
    const spread = this.state.isAiming ? this.weaponDef.spread * 0.3 : this.weaponDef.spread;
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * spread * 2,
      (Math.random() - 0.5) * spread * 2,
      -1
    ).normalize();
    dir.applyEuler(this.camera.getWorldQuaternion(new THREE.Quaternion()).toEulerOrder('YXZ') as unknown as THREE.Euler);
    const worldDir = new THREE.Vector3();
    this.camera.getWorldDirection(worldDir);
    worldDir.add(new THREE.Vector3((Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread * 2, 0));
    worldDir.normalize();

    const raycaster = new THREE.Raycaster(this.camera.position.clone(), worldDir, 0.1, 200);

    // Check enemies first
    const enemyMeshes: THREE.Mesh[] = [];
    this.enemies.filter(e => e.alive).forEach(e => e.mesh.traverse(c => { if ((c as THREE.Mesh).isMesh) enemyMeshes.push(c as THREE.Mesh); }));

    const enemyHits = raycaster.intersectObjects(enemyMeshes, true);
    const wallHits = raycaster.intersectObjects(this.wallMeshes, false);

    // Only register hit if enemy is closer than nearest wall
    const wallDist = wallHits.length > 0 ? wallHits[0].distance : Infinity;
    const enemyHit = enemyHits.length > 0 && enemyHits[0].distance < wallDist ? enemyHits[0] : null;

    if (enemyHit) {
      const hitObj = enemyHit.object;
      const enemy = this.enemies.find(e => {
        let found = false;
        e.mesh.traverse(c => { if (c === hitObj) found = true; });
        return found && e.alive;
      });
      if (enemy) {
        const isHead = hitObj === enemy.bones.head || hitObj.parent === enemy.bones.head;
        const isHeadHeight = enemyHit.point.y > enemy.mesh.position.y + 1.28;
        const headshot = isHead || isHeadHeight;
        const dmg = headshot ? this.weaponDef.damage * 2.8 : this.weaponDef.damage;
        enemy.health -= dmg;

        this.state.hitMarker = true;
        this.state.headshot = headshot;
        if (headshot) { this.audio.playHeadshot(); } else { this.audio.playHit(); }

        setTimeout(() => { this.state.hitMarker = false; this.state.headshot = false; this.emitState(); }, 200);

        // Update health bar
        const g = enemy.mesh as THREE.Group & { hbFill: THREE.Mesh };
        if (g.hbFill) g.hbFill.scale.x = Math.max(0, enemy.health / 100);

        if (enemy.health <= 0) this.killEnemy(enemy);
        this.emitState();
      }

      // Bullet hole on first wall behind enemy
      if (wallHits.length > 0 && wallHits[0].distance < wallDist + 5) this.addDecal(wallHits[0]);
    } else if (wallHits.length > 0) {
      this.addDecal(wallHits[0]);
    }
  }

  private addDecal(hit: THREE.Intersection) {
    if (!hit.face) return;
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.88, depthWrite: false })
    );
    decal.position.copy(hit.point).add(hit.face.normal.clone().multiplyScalar(0.012));
    decal.lookAt(decal.position.clone().add(hit.face.normal));
    this.scene.add(decal);
    this.decals.push(decal);
    if (this.decals.length > 60) this.scene.remove(this.decals.shift()!);
  }

  private killEnemy(enemy: Enemy) {
    enemy.alive = false;
    this.state.kills++;
    this.state.money = Math.min(16000, this.state.money + 300);
    this.state.enemiesAlive = this.enemies.filter(e => e.alive).length;
    // Ragdoll fall
    let t = 0;
    const startY = enemy.mesh.position.y;
    const id = setInterval(() => {
      t += 0.04;
      enemy.mesh.position.y = startY - 1.5 * t * t;
      enemy.mesh.rotation.z = t * 1.8;
      if (t >= 1.2) {
        clearInterval(id);
        setTimeout(() => this.scene.remove(enemy.mesh), 8000);
      }
    }, 16);
  }

  // ─── LINE OF SIGHT CHECK ────────────────────────────────────────────────────

  private hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const dir = to.clone().sub(from).normalize();
    const dist = from.distanceTo(to);
    const ray = new THREE.Raycaster(from.clone(), dir, 0.2, dist - 0.3);
    const hits = ray.intersectObjects(this.wallMeshes, false);
    return hits.length === 0;
  }

  // ─── ENEMY AI ───────────────────────────────────────────────────────────────

  private updateEnemies(dt: number) {
    const now = performance.now();
    const playerEyePos = this.playerPos.clone().add(new THREE.Vector3(0, 0.08, 0)); // eye level

    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;

      const enemyEyePos = enemy.mesh.position.clone().add(new THREE.Vector3(0, 1.55, 0));
      const toPlayer = this.playerPos.clone().sub(enemy.mesh.position);
      const dist = toPlayer.length();
      toPlayer.normalize();

      // Move toward player if far
      if (dist > 3.5) {
        enemy.mesh.position.x += toPlayer.x * enemy.speed * dt;
        enemy.mesh.position.z += toPlayer.z * enemy.speed * dt;
      }
      enemy.position.copy(enemy.mesh.position);

      // Face player
      enemy.mesh.lookAt(this.playerPos.x, enemy.mesh.position.y, this.playerPos.z);

      // Animate limbs
      const t = now * 0.001;
      const walkSpeed = dist > 3.5 ? enemy.speed * 3.5 : 0;
      const legSwing = Math.sin(t * walkSpeed) * 0.55;
      const armSwing = Math.sin(t * walkSpeed + Math.PI) * 0.45;
      enemy.bones.legL.rotation.x = legSwing;
      enemy.bones.legR.rotation.x = -legSwing;
      enemy.bones.armL.rotation.x = armSwing * 0.6;
      enemy.bones.armR.rotation.x = -armSwing * 0.6;

      // ── SHOOT — only if has line of sight (no wall penetration) ──
      const canSee = dist < 40 && this.hasLineOfSight(enemyEyePos, playerEyePos);
      const shotCooldown = 1800 + Math.random() * 1200;

      if (canSee && now - enemy.lastShot > shotCooldown && this.state.health > 0) {
        enemy.lastShot = now;
        this.audio.playEnemyShot(dist);

        // Accuracy: miss chance increases with distance
        const hitChance = Math.max(0.15, 0.85 - dist * 0.018);
        if (Math.random() < hitChance) {
          const armorAbsorb = this.state.armor > 0 ? 0.42 : 1;
          const rawDmg = 8 + Math.random() * 14;
          const dmg = rawDmg * armorAbsorb;
          this.state.armor = Math.max(0, this.state.armor - rawDmg * 0.3);
          this.state.health = Math.max(0, this.state.health - dmg);
          this.state.damageFlash = 1;

          if (this.state.health <= 0) {
            this.state.health = 0;
            this.state.gamePhase = 'dead';
          }
          this.emitState();
        }
      }
    });
  }

  // ─── PLAYER MOVEMENT ────────────────────────────────────────────────────────

  private updateMovement(dt: number) {
    const speed = this.isCrouching ? 2.2 : (this.keys['ShiftLeft'] ? 5.8 : 4.4);
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const move = new THREE.Vector3();
    if (this.keys['KeyW'] || this.keys['ArrowUp']) move.add(forward);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) move.sub(forward);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) move.sub(right);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) move.add(right);
    if (move.length() > 0) move.normalize();

    this.moveVelocity.lerp(move.multiplyScalar(speed), 0.13);
    this.playerPos.x += this.moveVelocity.x * dt;
    this.playerPos.z += this.moveVelocity.z * dt;
    this.playerPos.x = Math.max(-103, Math.min(103, this.playerPos.x));
    this.playerPos.z = Math.max(-103, Math.min(103, this.playerPos.z));

    // Gravity
    if (!this.isOnGround) this.playerVelocityY -= 20 * dt;
    this.playerPos.y += this.playerVelocityY * dt;

    const eyeH = this.isCrouching ? 1.15 : 1.75;
    if (this.playerPos.y <= eyeH) {
      this.playerPos.y = eyeH;
      this.playerVelocityY = 0;
      this.isOnGround = true;
      if (this.state.isJumping) { this.state.isJumping = false; this.emitState(); }
    }

    // Footsteps
    const isMoving = this.isMoving();
    if (isMoving && this.isOnGround) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.audio.playStep();
        this.stepTimer = this.isCrouching ? 0.55 : (this.keys['ShiftLeft'] ? 0.28 : 0.42);
      }
    } else {
      this.stepTimer = 0;
    }

    // Crouch
    const wantCrouch = this.keys['ControlLeft'] || this.keys['KeyC'];
    if (wantCrouch !== this.isCrouching) {
      this.isCrouching = wantCrouch;
      this.state.isCrouching = wantCrouch;
      this.emitState();
    }

    this.camera.position.copy(this.playerPos);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  // ─── WEAPON BOB / ANIMATION ─────────────────────────────────────────────────

  private updateWeapon(dt: number) {
    const moving = this.isMoving();
    this.weaponBobTime += dt * (moving ? 7.5 : 2);

    const bobX = Math.sin(this.weaponBobTime * 0.5) * (moving ? 0.0075 : 0.002);
    const bobY = Math.sin(this.weaponBobTime) * (moving ? 0.005 : 0.001);

    const baseX = this.state.isAiming ? 0.04 : 0.18;
    const baseY = this.state.isAiming ? -0.165 : -0.22;
    const baseZ = this.state.isAiming ? -0.28 : -0.35;

    if (this.state.isInspecting) {
      this.weaponInspectTime += dt;
      const t = this.weaponInspectTime;
      this.weaponGroup.position.set(baseX + Math.sin(t * 1.5) * 0.09, baseY + Math.sin(t * 0.8) * 0.055, baseZ + Math.sin(t * 0.6) * 0.04);
      this.weaponGroup.rotation.set(Math.sin(t * 0.7) * 0.32, Math.sin(t * 1.2) * 0.42, Math.sin(t * 0.9) * 0.22);
    } else {
      this.weaponGroup.position.x += (baseX + bobX - this.weaponGroup.position.x) * 0.11;
      this.weaponGroup.position.y += (baseY + bobY - this.weaponGroup.position.y) * 0.11;
      this.weaponGroup.position.z += (baseZ - this.weaponGroup.position.z) * 0.11;
      this.weaponGroup.rotation.x += (0 - this.weaponGroup.rotation.x) * 0.14;
      this.weaponGroup.rotation.y += (0 - this.weaponGroup.rotation.y) * 0.14;
      this.weaponGroup.rotation.z += (0 - this.weaponGroup.rotation.z) * 0.14;
    }

    if (this.state.isReloading) {
      const elapsed = performance.now() - this.reloadStartTime;
      this.state.reloadProgress = Math.min(elapsed / this.weaponDef.reloadTime, 1);
      const t = this.state.reloadProgress;
      this.weaponGroup.rotation.x = Math.sin(t * Math.PI * 2) * 0.42;
      this.weaponGroup.position.y = baseY - Math.sin(t * Math.PI) * 0.13;
    }

    // Damage flash decay
    if (this.state.damageFlash > 0) {
      this.state.damageFlash = Math.max(0, this.state.damageFlash - dt * 3);
    }

    // Health bar faces camera
    this.enemies.forEach(e => {
      if (e.alive) {
        const hbBg = e.mesh.children.find(c => (c as THREE.Mesh).geometry?.type === 'PlaneGeometry' && (c as THREE.Mesh).position.y > 1.6);
        if (hbBg) hbBg.lookAt(this.camera.position);
        const hbFill = (e.mesh as THREE.Group & { hbFill: THREE.Mesh }).hbFill;
        if (hbFill) hbFill.lookAt(this.camera.position);
      }
    });
  }

  private isMoving(): boolean {
    return !!(this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD']);
  }

  private emitState() {
    this.onStateChange?.({ ...this.state });
  }

  // ─── PUBLIC METHODS ─────────────────────────────────────────────────────────

  start() {
    this.state.gamePhase = 'buy';
    this.emitState();
    this.spawnEnemies();
  }

  buyWeapon(weaponId: string) {
    const def = WEAPONS[weaponId];
    if (!def || def.price > this.state.money) return;
    this.state.money -= def.price;
    this.weaponDef = def;
    this.state.ammo = def.maxAmmo;
    this.state.maxAmmo = def.maxAmmo;
    this.state.reserveAmmo = def.reserveAmmo;
    this.state.currentWeapon = weaponId;
    this.updateWeaponVisual();
    this.audio.playBuy();
    this.emitState();
  }

  buyArmor() {
    if (this.state.money < 650) return;
    this.state.money -= 650;
    this.state.armor = Math.min(100, this.state.armor + 100);
    this.audio.playBuy();
    this.emitState();
  }

  closeBuyMenu() {
    this.state.gamePhase = 'playing';
    this.roundStartTime = performance.now();
    this.emitState();
    this.canvas.requestPointerLock();
  }

  private spawnEnemies() {
    const positions = [
      new THREE.Vector3(32, 0, -30),
      new THREE.Vector3(-32, 0, -30),
      new THREE.Vector3(0, 0, -38),
      new THREE.Vector3(21, 0, 14),
      new THREE.Vector3(-21, 0, 14),
    ];
    positions.forEach((pos, i) => this.enemies.push(this.createEnemy(pos, i)));
    this.state.enemiesAlive = this.enemies.length;
  }

  restart() {
    this.state.health = 100;
    this.state.armor = 0;
    this.state.money = Math.max(this.state.money, 1400); // loss bonus
    this.state.kills = 0;
    this.state.isReloading = false;
    this.playerPos.set(0, 1.75, 35);
    this.yaw = 0; this.pitch = 0;
    this.enemies.forEach(e => this.scene.remove(e.mesh));
    this.enemies = [];
    this.state.gamePhase = 'buy';
    this.spawnEnemies();
    this.emitState();
  }

  private loop() {
    this.animFrame = requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state.gamePhase === 'playing') {
      if (this.mouseButtons[0] && !this.state.isReloading) this.shoot();
      this.updateMovement(dt);
      this.updateWeapon(dt);
      this.updateEnemies(dt);

      // Round timer
      const elapsed = (performance.now() - this.roundStartTime) / 1000;
      this.state.roundTime = Math.max(0, 90 - elapsed);
      if (this.state.roundTime <= 0) {
        this.state.gamePhase = 'dead';
        this.emitState();
      }
    }

    // Always render so the scene is visible in menu/buy screens too
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this.animFrame);
    document.exitPointerLock();
    this.renderer.dispose();
    this.audio.destroy();
  }
}