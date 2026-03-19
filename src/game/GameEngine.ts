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
    while (this.weaponGroup.children.length) this.weaponGroup.remove(this.weaponGroup.children[0]);

    const id = this.weaponDef.id;

    // ── SHARED MATERIALS ──
    const mk = (color: number, rough: number, metal = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

    const MAT = {
      black:     mk(0x1a1a18, 0.25, 0.85),
      darkSteel: mk(0x2e2e2c, 0.20, 0.90),
      steel:     mk(0x4a4a48, 0.18, 0.92),
      lightSteel:mk(0x6a6a68, 0.22, 0.88),
      gunmetal:  mk(0x28282a, 0.30, 0.80),
      wood:      mk(0x8B5E3C, 0.82, 0.00),
      darkWood:  mk(0x5a3a20, 0.88, 0.00),
      walnut:    mk(0x6b3a22, 0.85, 0.00),
      tan:       mk(0xc8a87a, 0.75, 0.00),
      olive:     mk(0x4a5230, 0.85, 0.00),
      rubber:    mk(0x1e1e1e, 0.95, 0.00),
      chrome:    mk(0xc0c0c0, 0.05, 1.00),
      gold:      mk(0xb8860b, 0.15, 0.90),
      brass:     mk(0x8B6914, 0.25, 0.75),
      skin:      mk(0xc8a882, 0.78, 0.00),
      sleeve:    mk(0x2a3a2a, 0.90, 0.00),
    };

    const add = (
      geo: THREE.BufferGeometry, mat: THREE.Material,
      x: number, y: number, z: number,
      rx = 0, ry = 0, rz = 0
    ): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      this.weaponGroup.add(m);
      return m;
    };

    const cyl = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
    const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
    const PI2 = Math.PI / 2;

    // muzzle flash Z position (set per weapon)
    let muzzleZ = -0.65;

    // ════════════════════════════════════════════════
    if (id === 'knife') {
      // ── BAYONET KNIFE ──
      // Blade — tapered using scaled box
      const blade = new THREE.Mesh(box(0.016, 0.008, 0.26), MAT.chrome);
      blade.position.set(0, 0.004, -0.18); blade.castShadow = true;
      this.weaponGroup.add(blade);
      // Blade edge bevel
      add(box(0.004, 0.016, 0.26), MAT.steel,      0.009, -0.002, -0.18);
      // False edge (top clip)
      add(box(0.012, 0.004, 0.10), MAT.chrome,     0, 0.008, -0.26);
      // Blood groove
      add(box(0.002, 0.003, 0.20), MAT.darkSteel,  0, 0.001, -0.16);
      // Crossguard
      add(box(0.008, 0.055, 0.012), MAT.steel,     0, 0, -0.045);
      // Ricasso
      add(box(0.020, 0.014, 0.028), MAT.darkSteel, 0, 0, -0.058);
      // Handle — wrapped grip
      add(box(0.024, 0.030, 0.115), MAT.rubber,    0, -0.002, 0.025);
      // Grip grooves
      for (let i = 0; i < 5; i++) add(box(0.026, 0.003, 0.006), MAT.black, 0, -0.002, -0.028 + i * 0.018);
      // Pommel
      add(box(0.022, 0.026, 0.022), MAT.steel,     0, 0, 0.088);
      add(cyl(0.010, 0.013, 0.012, 8), MAT.darkSteel, 0, 0, 0.100, 0, 0, 0);
      muzzleZ = -0.32;

    // ════════════════════════════════════════════════
    } else if (id === 'p250') {
      // ── P250 PISTOL ──
      // Slide (top)
      add(box(0.050, 0.038, 0.195), MAT.darkSteel, 0, 0.012, -0.062);
      // Serrations on slide
      for (let i = 0; i < 6; i++) add(box(0.052, 0.038, 0.003), MAT.black, 0, 0.012, 0.04 + i * 0.010);
      // Barrel
      add(cyl(0.011, 0.011, 0.185, 12), MAT.steel, 0, 0.014, -0.148, PI2, 0, 0);
      // Muzzle crown
      add(cyl(0.014, 0.011, 0.010, 12), MAT.steel, 0, 0.014, -0.243, PI2, 0, 0);
      // Frame (lower)
      add(box(0.046, 0.030, 0.185), MAT.black,    0, -0.012, -0.062);
      // Trigger guard
      add(box(0.044, 0.006, 0.058), MAT.black,    0, -0.032, -0.010);
      add(cyl(0.003, 0.003, 0.044, 8), MAT.black, 0, -0.030, -0.039, PI2, 0, 0);
      // Trigger
      add(box(0.006, 0.020, 0.008), MAT.steel,    0, -0.038, -0.010);
      // Grip
      add(box(0.048, 0.095, 0.088), MAT.rubber,   0, -0.080, 0.058);
      // Grip texture lines
      for (let i = 0; i < 8; i++) add(box(0.050, 0.003, 0.090), MAT.black, 0, -0.044 - i * 0.011, 0.058);
      // Backstrap
      add(box(0.008, 0.090, 0.010), MAT.darkSteel, 0, -0.080, 0.015);
      // Magazine base
      add(box(0.042, 0.010, 0.082), MAT.steel,    0, -0.131, 0.058);
      // Front sight
      add(box(0.008, 0.010, 0.005), MAT.steel,    0, 0.034, -0.238);
      // Rear sight
      add(box(0.038, 0.010, 0.008), MAT.steel,    0, 0.034, 0.040);
      add(box(0.006, 0.010, 0.008), MAT.steel,   -0.018, 0.034, 0.040);
      add(box(0.006, 0.010, 0.008), MAT.steel,    0.018, 0.034, 0.040);
      // Rail under barrel
      add(box(0.046, 0.008, 0.060), MAT.darkSteel, 0, -0.006, -0.100);
      muzzleZ = -0.25;

    // ════════════════════════════════════════════════
    } else if (id === 'deagle') {
      // ── DESERT EAGLE ──
      // Large slide
      add(box(0.058, 0.050, 0.235), MAT.gunmetal,  0, 0.016, -0.068);
      // Barrel (exposed, longer)
      add(cyl(0.013, 0.013, 0.260, 12), MAT.steel,  0, 0.020, -0.155, PI2, 0, 0);
      // Muzzle brake
      add(cyl(0.018, 0.016, 0.018, 12), MAT.steel,  0, 0.020, -0.278, PI2, 0, 0);
      add(box(0.036, 0.006, 0.018), MAT.steel,       0, 0.026, -0.278); // top port
      // Gas piston tube (DEs are gas-operated)
      add(cyl(0.008, 0.008, 0.190, 8), MAT.darkSteel, 0, 0.040, -0.110, PI2, 0, 0);
      // Frame
      add(box(0.054, 0.036, 0.235), MAT.gunmetal,   0, -0.016, -0.068);
      // Trigger guard (large, angular)
      add(box(0.052, 0.008, 0.075), MAT.gunmetal,   0, -0.040, -0.006);
      add(box(0.052, 0.028, 0.006), MAT.gunmetal,   0, -0.026, -0.044);
      // Trigger
      add(box(0.007, 0.026, 0.009), MAT.steel,      0, -0.048, -0.006);
      // Grip — angular, ergonomic
      add(box(0.052, 0.115, 0.098), MAT.rubber,     0, -0.098, 0.072);
      // Grip checkering
      for (let i = 0; i < 9; i++) add(box(0.054, 0.004, 0.100), MAT.black, 0, -0.048 - i * 0.012, 0.072);
      // Magazine (large, double-stack)
      add(box(0.048, 0.015, 0.092), MAT.steel,      0, -0.166, 0.072);
      // Sights (prominent)
      add(box(0.012, 0.016, 0.006), MAT.steel,      0, 0.043, -0.290); // front
      add(box(0.048, 0.014, 0.010), MAT.steel,      0, 0.043, 0.042);  // rear
      // Hammer (exposed)
      add(box(0.018, 0.028, 0.016), MAT.steel,      0, 0.042, 0.086, 0.5, 0, 0);
      muzzleZ = -0.29;

    // ════════════════════════════════════════════════
    } else if (id === 'mp5') {
      // ── MP5-SD (integrally suppressed SMG) ──
      // Receiver
      add(box(0.056, 0.056, 0.310), MAT.black,       0, 0, 0);
      // Integrated suppressor (fat barrel housing)
      add(cyl(0.028, 0.028, 0.340, 16), MAT.darkSteel, 0, 0.004, -0.270, PI2, 0, 0);
      // Suppressor end cap
      add(cyl(0.026, 0.030, 0.012, 16), MAT.steel,   0, 0.004, -0.442, PI2, 0, 0);
      // Suppressor vent holes (decorative rings)
      for (let i = 0; i < 6; i++) add(cyl(0.030, 0.030, 0.003, 12), MAT.black, 0, 0.004, -0.190 - i * 0.036, PI2, 0, 0);
      // Cocking handle slot
      add(box(0.008, 0.012, 0.045), MAT.black,       0.032, 0.014, 0.055);
      // Cocking handle
      add(box(0.018, 0.012, 0.020), MAT.steel,       0.042, 0.014, 0.055);
      // Charging handle track
      add(box(0.004, 0.008, 0.060), MAT.darkSteel,   0.028, 0.010, 0.055);
      // Fixed stock (retracted, MP5A3-style)
      add(box(0.048, 0.028, 0.190), MAT.black,       0, -0.010, 0.240);
      add(box(0.012, 0.055, 0.012), MAT.steel,       0.020, 0.010, 0.335);
      add(box(0.012, 0.055, 0.012), MAT.steel,      -0.020, 0.010, 0.335);
      add(box(0.052, 0.018, 0.012), MAT.rubber,      0, -0.018, 0.335);
      // Pistol grip
      add(box(0.044, 0.110, 0.060), MAT.rubber,      0, -0.090, 0.110, 0.2, 0, 0);
      // Grip grooves
      for (let i = 0; i < 8; i++) add(box(0.046, 0.003, 0.062), MAT.black, 0, -0.048 - i * 0.012, 0.110, 0.2, 0, 0);
      // Curved magazine (30-round)
      add(box(0.038, 0.148, 0.070), MAT.darkSteel,   0, -0.113, 0.020, -0.18, 0, 0);
      // Magazine curve detail
      add(box(0.036, 0.010, 0.070), MAT.steel,       0, -0.188, -0.003, -0.18, 0, 0);
      // Trigger guard
      add(box(0.050, 0.007, 0.065), MAT.black,       0, -0.042, 0.060);
      // Trigger
      add(box(0.007, 0.022, 0.009), MAT.steel,       0, -0.052, 0.065);
      // Handguard (polymer with slots)
      add(box(0.058, 0.044, 0.135), MAT.olive,       0, 0.005, -0.112);
      for (let i = 0; i < 4; i++) add(box(0.060, 0.010, 0.012), MAT.black, 0, 0.010, -0.058 - i * 0.030);
      // Front sight post
      add(box(0.008, 0.024, 0.008), MAT.steel,       0, 0.040, -0.268);
      // Rear diopter sight
      add(box(0.040, 0.022, 0.012), MAT.steel,       0, 0.038, 0.100);
      add(cyl(0.006, 0.006, 0.014, 8), MAT.black,    0, 0.038, 0.106, PI2, 0, 0);
      muzzleZ = -0.45;

    // ════════════════════════════════════════════════
    } else if (id === 'ak47') {
      // ── AK-47 ──
      // Upper receiver
      add(box(0.062, 0.052, 0.360), MAT.black,        0, 0.004, 0);
      // Lower receiver
      add(box(0.058, 0.038, 0.280), MAT.darkSteel,    0, -0.018, 0.030);
      // Barrel (chrome-lined)
      add(cyl(0.013, 0.013, 0.418, 12), MAT.steel,    0, 0.010, -0.368, PI2, 0, 0);
      // Muzzle nut
      add(cyl(0.016, 0.013, 0.022, 12), MAT.steel,    0, 0.010, -0.579, PI2, 0, 0);
      // Gas tube above barrel
      add(cyl(0.007, 0.007, 0.220, 8), MAT.darkSteel, 0, 0.030, -0.250, PI2, 0, 0);
      // Gas block
      add(box(0.024, 0.022, 0.028), MAT.steel,        0, 0.020, -0.258);
      // Gas piston (peek)
      add(cyl(0.006, 0.006, 0.080, 8), MAT.steel,     0, 0.030, -0.168, PI2, 0, 0);
      // Front trunnion
      add(box(0.064, 0.048, 0.028), MAT.darkSteel,    0, 0.002, -0.166);
      // Handguard — laminated wood, two-piece
      add(box(0.060, 0.048, 0.180), MAT.wood,         0, 0.000, -0.170);
      add(box(0.056, 0.022, 0.180), MAT.darkWood,     0, -0.018, -0.170);
      // Handguard retainer
      add(box(0.064, 0.010, 0.010), MAT.steel,        0, 0.014, -0.088);
      // Pistol grip (ergonomic, wood)
      add(box(0.040, 0.120, 0.058), MAT.walnut,       0, -0.092, 0.108, 0.28, 0, 0);
      // Grip cap
      add(box(0.038, 0.012, 0.060), MAT.steel,        0, -0.155, 0.120, 0.28, 0, 0);
      // Trigger guard (steel)
      add(box(0.055, 0.007, 0.068), MAT.darkSteel,    0, -0.040, 0.056);
      add(box(0.055, 0.030, 0.007), MAT.darkSteel,    0, -0.025, 0.022);
      // Trigger
      add(box(0.007, 0.026, 0.010), MAT.steel,        0, -0.052, 0.056);
      // Selector lever (right side)
      add(box(0.005, 0.020, 0.042), MAT.steel,        0.032, -0.004, 0.098);
      // Dust cover
      add(box(0.060, 0.018, 0.180), MAT.black,        0, 0.032, 0.048);
      // Charging handle (right side)
      add(box(0.028, 0.014, 0.034), MAT.steel,        0.034, 0.022, 0.050);
      // Curved 30-round magazine
      add(box(0.042, 0.175, 0.074), MAT.darkSteel,    0, -0.132, 0.018, -0.16, 0, 0);
      // Magazine catch
      add(box(0.044, 0.010, 0.022), MAT.steel,        0, -0.042, -0.020);
      // AK stock — underfolding style
      add(box(0.050, 0.042, 0.220), MAT.walnut,       0, -0.008, 0.248);
      add(box(0.048, 0.028, 0.016), MAT.steel,        0, -0.006, 0.358);
      // Stock rod
      add(cyl(0.006, 0.006, 0.220, 8), MAT.darkSteel, 0.018, -0.005, 0.248, PI2, 0, 0);
      add(cyl(0.006, 0.006, 0.220, 8), MAT.darkSteel, -0.018, -0.005, 0.248, PI2, 0, 0);
      // Front sight post (tall AK-style)
      add(box(0.022, 0.044, 0.022), MAT.steel,        0, 0.050, -0.462);
      add(cyl(0.004, 0.004, 0.024, 8), MAT.steel,     0, 0.064, -0.462);
      // Rear tangent sight
      add(box(0.040, 0.028, 0.022), MAT.steel,        0, 0.042, 0.055);
      add(box(0.008, 0.028, 0.022), MAT.steel,        0, 0.042, 0.068);
      muzzleZ = -0.59;

    // ════════════════════════════════════════════════
    } else if (id === 'm4a4') {
      // ── M4A4 (AR-15 platform) ──
      // Upper receiver (flat-top)
      add(box(0.058, 0.050, 0.340), MAT.gunmetal,     0, 0.004, 0);
      // Picatinny top rail
      add(box(0.036, 0.012, 0.340), MAT.darkSteel,    0, 0.032, 0.000);
      for (let i = 0; i < 14; i++) add(box(0.038, 0.004, 0.006), MAT.black, 0, 0.040, -0.140 + i * 0.022);
      // Barrel (government profile, 14.5")
      add(cyl(0.014, 0.014, 0.365, 12), MAT.steel,    0, 0.008, -0.342, PI2, 0, 0);
      // Barrel thin section
      add(cyl(0.010, 0.010, 0.120, 12), MAT.steel,    0, 0.008, -0.444, PI2, 0, 0);
      // Pinned flash hider (birdcage)
      add(cyl(0.014, 0.012, 0.055, 6), MAT.darkSteel, 0, 0.008, -0.530, PI2, 0, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(box(0.003, 0.040, 0.003), MAT.black, Math.cos(a) * 0.014, 0.008 + Math.sin(a) * 0.014, -0.530);
      }
      // Delta ring / barrel nut
      add(cyl(0.022, 0.020, 0.025, 12), MAT.steel,    0, 0.008, -0.162, PI2, 0, 0);
      // M4 handguard (double heat shield)
      add(box(0.058, 0.052, 0.178), MAT.olive,        0, 0.004, -0.247);
      // Handguard vents
      for (let i = 0; i < 5; i++) add(box(0.060, 0.008, 0.018), MAT.black, 0, 0.028, -0.172 - i * 0.034);
      for (let i = 0; i < 5; i++) add(box(0.060, 0.008, 0.018), MAT.black, 0, -0.018, -0.172 - i * 0.034);
      // Lower receiver
      add(box(0.054, 0.044, 0.262), MAT.gunmetal,     0, -0.016, 0.026);
      // Pistol grip (A2-style)
      add(box(0.038, 0.118, 0.055), MAT.rubber,       0, -0.096, 0.116, 0.22, 0, 0);
      // Grip fins
      for (let i = 0; i < 8; i++) add(box(0.040, 0.003, 0.057), MAT.black, 0, -0.060 - i * 0.013, 0.116, 0.22, 0, 0);
      // Trigger guard (M4 curved)
      add(box(0.052, 0.007, 0.072), MAT.gunmetal,     0, -0.036, 0.060);
      add(box(0.052, 0.024, 0.007), MAT.gunmetal,     0, -0.024, 0.026);
      // Trigger
      add(box(0.007, 0.025, 0.010), MAT.steel,        0, -0.050, 0.058);
      // STANAG 30-round magazine (straight-ish)
      add(box(0.040, 0.168, 0.068), MAT.olive,        0, -0.128, 0.014, -0.08, 0, 0);
      add(box(0.038, 0.010, 0.068), MAT.steel,        0, -0.211, 0.021, -0.08, 0, 0);
      // Bolt catch
      add(box(0.006, 0.018, 0.014), MAT.steel,       -0.030, -0.020, -0.010);
      // Mag release
      add(cyl(0.007, 0.007, 0.010, 8), MAT.steel,    0.030, -0.034, -0.005, 0, 0, PI2);
      // Buffer tube (collapsible stock)
      add(cyl(0.020, 0.022, 0.195, 10), MAT.darkSteel, 0, -0.006, 0.255, PI2, 0, 0);
      // Stock (M4 6-position)
      add(box(0.058, 0.055, 0.135), MAT.olive,        0, -0.010, 0.342);
      add(box(0.052, 0.018, 0.135), MAT.rubber,       0, -0.040, 0.342);
      // Stock release button
      add(box(0.060, 0.008, 0.016), MAT.steel,        0, -0.019, 0.285);
      // Forward assist
      add(box(0.010, 0.014, 0.018), MAT.steel,        0.032, 0.012, -0.020);
      // Ejection port cover
      add(box(0.010, 0.020, 0.072), MAT.darkSteel,    0.030, 0.002, 0.062);
      // Rear BUIS sight
      add(box(0.038, 0.030, 0.014), MAT.steel,        0, 0.040, 0.115);
      add(box(0.008, 0.030, 0.014), MAT.black,        0, 0.040, 0.122);
      // Front sight (folded, on barrel)
      add(box(0.028, 0.022, 0.014), MAT.steel,        0, 0.034, -0.350);
      add(box(0.006, 0.018, 0.014), MAT.black,        0, 0.038, -0.358);
      muzzleZ = -0.58;

    // ════════════════════════════════════════════════
    } else if (id === 'awp') {
      // ── AWP (L115A3 / Arctic Warfare) ──
      // Receiver body (long, bolt-action)
      add(box(0.066, 0.065, 0.420), MAT.gunmetal,     0, 0.005, 0);
      // Heavy barrel (fluted)
      add(cyl(0.016, 0.016, 0.580, 12), MAT.steel,    0, 0.012, -0.440, PI2, 0, 0);
      // Fluting on barrel
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(cyl(0.004, 0.004, 0.300, 6), MAT.darkSteel, Math.cos(a)*0.016, 0.012 + Math.sin(a)*0.016, -0.380, PI2, 0, a);
      }
      // Muzzle brake (large, prominent)
      add(cyl(0.024, 0.022, 0.048, 12), MAT.steel,    0, 0.012, -0.752, PI2, 0, 0);
      add(box(0.048, 0.012, 0.048), MAT.steel,        0, 0.020, -0.752); // top port
      add(box(0.048, 0.008, 0.048), MAT.steel,        0, 0.004, -0.752); // lower port
      // Bolt body
      add(box(0.028, 0.028, 0.095), MAT.steel,        0, 0.005, 0.135);
      // Bolt handle (90° rotated)
      add(cyl(0.007, 0.007, 0.065, 8), MAT.steel,     0.032, 0.010, 0.135, 0, 0, PI2);
      // Bolt handle ball
      add(cyl(0.014, 0.014, 0.014, 10), MAT.chrome,   0.068, 0.010, 0.135);
      // Ejection port
      add(box(0.068, 0.022, 0.060), MAT.black,        0, 0.018, 0.060);
      // Chassis / stock (folding, green)
      add(box(0.068, 0.058, 0.295), MAT.olive,        0, -0.014, 0.278);
      // Cheekpiece
      add(box(0.062, 0.038, 0.120), MAT.olive,        0, 0.034, 0.290);
      add(box(0.060, 0.012, 0.120), MAT.rubber,       0, 0.052, 0.290);
      // Adjustable butt pad
      add(box(0.065, 0.075, 0.020), MAT.rubber,       0, 0.000, 0.428);
      add(box(0.063, 0.070, 0.010), MAT.steel,        0, 0.000, 0.438);
      // Pistol grip
      add(box(0.044, 0.118, 0.060), MAT.olive,        0, -0.092, 0.120, 0.18, 0, 0);
      add(box(0.042, 0.118, 0.062), MAT.rubber,       0, -0.092, 0.122, 0.18, 0, 0);
      // Trigger guard
      add(box(0.060, 0.007, 0.075), MAT.steel,        0, -0.040, 0.062);
      // Trigger
      add(box(0.007, 0.028, 0.010), MAT.steel,        0, -0.055, 0.062);
      // Detachable box magazine (5-round)
      add(box(0.046, 0.100, 0.080), MAT.steel,        0, -0.102, 0.014);
      add(box(0.044, 0.010, 0.078), MAT.darkSteel,    0, -0.156, 0.014);
      // Schmidt & Bender scope (large)
      add(cyl(0.030, 0.030, 0.255, 14), MAT.black,    0, 0.068, -0.080, PI2, 0, 0);
      // Scope objective bell
      add(cyl(0.038, 0.030, 0.038, 14), MAT.black,    0, 0.068, -0.220, PI2, 0, 0);
      // Scope eyepiece bell
      add(cyl(0.034, 0.030, 0.030, 14), MAT.black,    0, 0.068, 0.072, PI2, 0, 0);
      // Turrets (elevation/windage)
      add(cyl(0.012, 0.012, 0.030, 8), MAT.steel,     0, 0.102, -0.070, 0, 0, 0);
      add(cyl(0.012, 0.012, 0.030, 8), MAT.steel,     0.042, 0.068, -0.070, 0, 0, PI2);
      // Scope mounts (rings)
      add(cyl(0.034, 0.034, 0.018, 12), MAT.steel,    0, 0.068, -0.018, PI2, 0, 0);
      add(cyl(0.034, 0.034, 0.018, 12), MAT.steel,    0, 0.068, -0.142, PI2, 0, 0);
      // Harris bipod legs
      add(cyl(0.005, 0.005, 0.090, 6), MAT.darkSteel, -0.022, -0.050, -0.310, 0.4, 0, 0);
      add(cyl(0.005, 0.005, 0.090, 6), MAT.darkSteel,  0.022, -0.050, -0.310, 0.4, 0, 0);
      add(box(0.058, 0.010, 0.016), MAT.steel,         0, -0.014, -0.300);
      muzzleZ = -0.78;

    // ════════════════════════════════════════════════
    } else if (id === 'm249') {
      // ── M249 SAW (belt-fed LMG) ──
      // Heavy receiver
      add(box(0.076, 0.068, 0.420), MAT.olive,        0, 0.006, 0);
      // Heavy barrel (quick-detach, bipod visible)
      add(cyl(0.018, 0.018, 0.500, 12), MAT.steel,    0, 0.012, -0.380, PI2, 0, 0);
      // Barrel flare
      add(cyl(0.022, 0.018, 0.020, 12), MAT.steel,    0, 0.012, -0.630, PI2, 0, 0);
      // Flash hider
      add(cyl(0.018, 0.015, 0.042, 8), MAT.darkSteel, 0, 0.012, -0.662, PI2, 0, 0);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        add(box(0.004, 0.030, 0.004), MAT.black, Math.cos(a)*0.018, 0.012+Math.sin(a)*0.018, -0.662);
      }
      // Gas tube
      add(cyl(0.009, 0.009, 0.280, 8), MAT.steel,     0, 0.038, -0.280, PI2, 0, 0);
      // Gas block / regulator
      add(box(0.030, 0.030, 0.032), MAT.steel,        0, 0.025, -0.332);
      // Heat shield
      add(box(0.080, 0.015, 0.280), MAT.olive,        0, 0.040, -0.220);
      // Polymer handguard
      add(box(0.074, 0.058, 0.220), MAT.olive,        0, 0.006, -0.230);
      for (let i = 0; i < 6; i++) add(box(0.076, 0.010, 0.016), MAT.black, 0, 0.030, -0.136 - i * 0.034);
      // Bipod (deployed, iconic LMG look)
      add(box(0.072, 0.010, 0.018), MAT.darkSteel,    0, -0.012, -0.330);
      add(cyl(0.006, 0.006, 0.140, 6), MAT.steel,    -0.030, -0.082, -0.330, 0.15, 0, 0);
      add(cyl(0.006, 0.006, 0.140, 6), MAT.steel,     0.030, -0.082, -0.330, 0.15, 0, 0);
      add(box(0.020, 0.008, 0.040), MAT.rubber,      -0.030, -0.153, -0.322);
      add(box(0.020, 0.008, 0.040), MAT.rubber,       0.030, -0.153, -0.322);
      // Pistol grip
      add(box(0.044, 0.125, 0.060), MAT.rubber,       0, -0.100, 0.120, 0.22, 0, 0);
      for (let i = 0; i < 9; i++) add(box(0.046, 0.003, 0.062), MAT.black, 0, -0.055 - i * 0.013, 0.120, 0.22, 0, 0);
      // Trigger guard
      add(box(0.072, 0.008, 0.078), MAT.olive,        0, -0.040, 0.062);
      // Trigger
      add(box(0.008, 0.028, 0.010), MAT.steel,        0, -0.055, 0.065);
      // SAW dust cover / feed tray
      add(box(0.078, 0.020, 0.200), MAT.olive,        0, 0.042, 0.065);
      // Box magazine (200-round plastic)
      add(box(0.076, 0.095, 0.160), MAT.tan,          0, -0.088, -0.030);
      add(box(0.074, 0.010, 0.158), MAT.olive,        0, -0.040, -0.030);
      // Belt feed chute
      add(box(0.032, 0.020, 0.090), MAT.steel,        0.044, 0.018, -0.080, 0, 0, 0.3);
      // Para stock (folded)
      add(box(0.068, 0.055, 0.210), MAT.olive,        0, -0.012, 0.278);
      add(box(0.066, 0.055, 0.020), MAT.rubber,       0, -0.012, 0.383);
      // Charging handle (top)
      add(box(0.018, 0.016, 0.040), MAT.steel,        0.042, 0.030, 0.060);
      // Rear sight
      add(box(0.030, 0.030, 0.016), MAT.steel,        0, 0.050, 0.120);
      muzzleZ = -0.69;
    }

    // ── HANDS (same for all weapons, adapted position) ──
    const isPistol = id === 'p250' || id === 'deagle';
    const isKnife  = id === 'knife';

    // Right forearm
    add(cyl(0.028, 0.033, 0.230, 10), MAT.sleeve,
      isPistol ? 0.060 : 0.075,
      isPistol ? -0.130 : -0.145,
      isPistol ? 0.090 : 0.075,
      PI2, 0, isPistol ? 0.10 : 0.18);
    // Right hand
    add(box(0.074, 0.065, 0.115), MAT.skin,
      isPistol ? 0.052 : 0.068,
      isPistol ? -0.088 : -0.090,
      isPistol ? 0.085 : 0.100);
    // Thumb R
    add(cyl(0.009, 0.008, 0.046, 6), MAT.skin,
      isPistol ? 0.092 : 0.108,
      isPistol ? -0.076 : -0.078,
      isPistol ? 0.068 : 0.085, 0, 0, 0.6);
    // Fingers R
    for (let i = 0; i < 4; i++) add(cyl(0.009, 0.008, 0.048, 6), MAT.skin,
      (isPistol ? 0.030 : 0.048) + i * 0.014 - 0.02,
      isPistol ? -0.060 : -0.062,
      isPistol ? 0.052 : 0.062, PI2, 0, 0);

    // Left forearm & hand (only for two-handed weapons)
    if (!isPistol && !isKnife) {
      const lz = id === 'awp' ? -0.260 : id === 'm249' ? -0.230 : -0.180;
      add(cyl(0.026, 0.031, 0.220, 10), MAT.sleeve, -0.055, -0.070, lz, PI2, 0, -0.15);
      add(box(0.068, 0.058, 0.098), MAT.skin,        -0.048, -0.030, lz);
      add(cyl(0.009, 0.008, 0.044, 6), MAT.skin,    -0.088, -0.020, lz - 0.018, 0, 0, -0.6);
      for (let i = 0; i < 4; i++) add(cyl(0.009, 0.008, 0.048, 6), MAT.skin,
        -0.068 + i * 0.014, -0.008, lz - 0.018, PI2, 0, 0);
    } else if (isKnife) {
      // Right hand wraps handle
      add(box(0.030, 0.075, 0.100), MAT.skin,        0.005, -0.020, 0.020);
      add(cyl(0.009, 0.008, 0.044, 6), MAT.skin,     0.038, -0.012, -0.008, 0, 0, -0.5);
      for (let i = 0; i < 4; i++) add(cyl(0.009, 0.008, 0.048, 6), MAT.skin,
        -0.002 + i * 0.012, -0.052, 0.015, PI2, 0, 0);
    }

    // ── MUZZLE FLASH ──
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0 });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), flashMat);
    this.muzzleFlashMesh.position.set(0, 0.010, muzzleZ);
    this.weaponGroup.add(this.muzzleFlashMesh);

    this.muzzleFlashLight = new THREE.PointLight(0xffdd66, 0, 9);
    this.muzzleFlashLight.position.set(0, 0.010, muzzleZ);
    this.weaponGroup.add(this.muzzleFlashLight);

    this.weaponGroup.position.set(0.18, -0.22, -0.35);
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
    const worldDir = new THREE.Vector3();
    this.camera.getWorldDirection(worldDir);
    // Apply spread by rotating in camera-local space
    const camQuat = new THREE.Quaternion();
    this.camera.getWorldQuaternion(camQuat);
    const spreadVec = new THREE.Vector3(
      (Math.random() - 0.5) * spread * 2,
      (Math.random() - 0.5) * spread * 2,
      0
    ).applyQuaternion(camQuat);
    worldDir.add(spreadVec).normalize();

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