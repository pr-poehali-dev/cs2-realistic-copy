import * as THREE from 'three';

export interface GameState {
  ammo: number;
  maxAmmo: number;
  reserveAmmo: number;
  health: number;
  isReloading: boolean;
  isCrouching: boolean;
  isJumping: boolean;
  isInspecting: boolean;
  isAiming: boolean;
  kills: number;
  gamePhase: 'menu' | 'playing' | 'dead';
  reloadProgress: number;
  muzzleFlash: boolean;
  hitMarker: boolean;
  enemiesAlive: number;
}

export interface Enemy {
  mesh: THREE.Group;
  health: number;
  position: THREE.Vector3;
  alive: boolean;
  speed: number;
  lastShot: number;
  id: number;
}

export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;

  private yaw = 0;
  private pitch = 0;
  private moveVelocity = new THREE.Vector3();
  private playerVelocityY = 0;
  private playerPos = new THREE.Vector3(0, 1.7, 0);
  private isOnGround = true;
  private isCrouching = false;

  private keys: Record<string, boolean> = {};
  private mouseButtons: Record<number, boolean> = {};

  private weaponGroup!: THREE.Group;
  private weaponBobTime = 0;
  private weaponInspectTime = 0;
  private reloadStartTime = 0;
  private lastFireTime = 0;
  private muzzleFlashMesh!: THREE.Mesh;
  private muzzleFlashLight!: THREE.PointLight;

  private enemies: Enemy[] = [];
  private bullets: THREE.Mesh[] = [];
  private enemyBullets: THREE.Mesh[] = [];
  private decals: THREE.Mesh[] = [];

  private clock = new THREE.Clock();
  private animFrame = 0;

  public state: GameState = {
    ammo: 30,
    maxAmmo: 30,
    reserveAmmo: 90,
    health: 100,
    isReloading: false,
    isCrouching: false,
    isJumping: false,
    isInspecting: false,
    isAiming: false,
    kills: 0,
    gamePhase: 'menu',
    reloadProgress: 0,
    muzzleFlash: false,
    hitMarker: false,
    enemiesAlive: 0,
  };

  private onStateChange?: (state: GameState) => void;
  private collidables: THREE.Mesh[] = [];
  private fog!: THREE.FogExp2;

  constructor(canvas: HTMLCanvasElement, onStateChange?: (state: GameState) => void) {
    this.canvas = canvas;
    this.onStateChange = onStateChange;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.05, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, shadowMap: true as unknown as boolean });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.fog = new THREE.FogExp2(0x8a9ba8, 0.012);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x6a8090);

    this.buildMap();
    this.buildWeapon();
    this.setupLights();
    this.setupEvents();
    this.spawnEnemies();
  }

  private buildMap() {
    // Ground - sandy/dusty mirage style
    const groundGeo = new THREE.PlaneGeometry(200, 200, 50, 50);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xc8b88a,
      roughness: 0.95,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.collidables.push(ground);

    // Helper to make wall
    const makeBox = (w: number, h: number, d: number, x: number, y: number, z: number, color: number, rough = 0.9) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.collidables.push(mesh);
      return mesh;
    };

    const WALL = 0xd4c49a;
    const WALL_DARK = 0xb8a882;
    const ROOF = 0xa09070;

    // ---- MIRAGE-INSPIRED LAYOUT ----

    // Outer boundary walls
    makeBox(200, 10, 2, 0, 5, -100, WALL);
    makeBox(200, 10, 2, 0, 5, 100, WALL);
    makeBox(2, 10, 200, -100, 5, 0, WALL);
    makeBox(2, 10, 200, 100, 5, 0, WALL);

    // ---- A SITE ----
    // A site platform (raised)
    makeBox(30, 0.5, 25, 35, 0.25, -30, 0xc4b480);

    // A site ramp
    const rampGeo = new THREE.BoxGeometry(8, 0.3, 12);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xb8a870, roughness: 0.9 });
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.position.set(22, 0.15, -26);
    ramp.rotation.z = -0.04;
    ramp.receiveShadow = true;
    ramp.castShadow = true;
    this.scene.add(ramp);

    // A site walls
    makeBox(2, 5, 25, 20, 2.5, -30, WALL);
    makeBox(30, 5, 2, 35, 2.5, -42, WALL);
    makeBox(2, 5, 18, 50, 2.5, -32, WALL);
    makeBox(8, 5, 2, 46, 2.5, -18, WALL_DARK);

    // CT Spawn building A
    makeBox(20, 8, 18, 55, 4, -40, WALL_DARK);
    makeBox(20, 0.5, 18, 55, 8.25, -40, ROOF);

    // A Ramp building
    makeBox(16, 5, 8, 15, 2.5, -18, WALL);
    makeBox(16, 0.5, 8, 15, 5.25, -18, ROOF);

    // Palace (A long building)
    makeBox(28, 7, 3, 30, 3.5, -55, WALL);
    makeBox(3, 7, 20, 16, 3.5, -50, WALL);
    makeBox(28, 7, 3, 30, 3.5, -67, WALL);
    makeBox(28, 0.5, 15, 30, 7.25, -61, ROOF);
    // Palace window
    makeBox(3, 2, 1, 28, 4, -55, 0x4a6070); // dark window hole

    // ---- B SITE ----
    makeBox(30, 0.5, 25, -35, 0.25, -30, 0xc4b480);

    // B site walls
    makeBox(2, 5, 25, -20, 2.5, -30, WALL);
    makeBox(30, 5, 2, -35, 2.5, -42, WALL);
    makeBox(2, 5, 18, -50, 2.5, -32, WALL);
    makeBox(8, 5, 2, -46, 2.5, -18, WALL_DARK);

    // CT spawn B
    makeBox(20, 8, 18, -55, 4, -40, WALL_DARK);
    makeBox(20, 0.5, 18, -55, 8.25, -40, ROOF);

    // B Apartments
    makeBox(3, 7, 30, -16, 3.5, -48, WALL);
    makeBox(14, 7, 3, -22, 3.5, -63, WALL);
    makeBox(14, 0.5, 18, -22, 7.25, -55, ROOF);
    // B van
    makeBox(5, 3, 9, -30, 1.5, -17, 0x5a6050);

    // ---- MID ----
    // Mid connector
    makeBox(2, 5, 40, -5, 2.5, -10, WALL);
    makeBox(2, 5, 40, 5, 2.5, -10, WALL);
    makeBox(12, 0.5, 40, 0, 5.25, -10, ROOF);

    // Top Mid / catwalk area
    makeBox(18, 5, 3, 0, 2.5, 10, WALL_DARK);
    makeBox(2, 5, 18, -8, 2.5, 5, WALL);
    makeBox(2, 5, 18, 8, 2.5, 5, WALL);

    // Ticket booth (mid building)
    makeBox(8, 4, 6, 0, 2, 18, WALL);
    makeBox(8, 0.5, 6, 0, 4.25, 18, ROOF);

    // Jungle building
    makeBox(14, 6, 14, 20, 3, 5, WALL);
    makeBox(14, 0.5, 14, 20, 6.25, 5, ROOF);

    // Short connector
    makeBox(3, 5, 20, 35, 2.5, -12, WALL);
    makeBox(3, 5, 20, -35, 2.5, -12, WALL);

    // T Spawn area
    makeBox(50, 5, 2, 0, 2.5, 45, WALL);
    makeBox(2, 5, 30, -24, 2.5, 30, WALL);
    makeBox(2, 5, 30, 24, 2.5, 30, WALL);

    // Various cover objects (crates, barrels, sandbags)
    // A site crates
    makeBox(2, 1.5, 2, 28, 0.75, -28, 0x8a7a55);
    makeBox(2, 1.5, 2, 31, 0.75, -28, 0x8a7a55);
    makeBox(2, 3, 2, 29.5, 2.25, -28, 0x7a6a45);
    makeBox(2, 1.5, 2, 40, 0.75, -32, 0x8a7a55);

    // B site crates
    makeBox(2, 1.5, 2, -28, 0.75, -28, 0x8a7a55);
    makeBox(2, 1.5, 2, -31, 0.75, -28, 0x8a7a55);
    makeBox(2, 3, 2, -29.5, 2.25, -28, 0x7a6a45);

    // Mid barrels
    makeBox(1.2, 2, 1.2, -2, 1, 15, 0x5a6a3a);
    makeBox(1.2, 2, 1.2, 2, 1, 15, 0x5a6a3a);

    // Car mid
    makeBox(5, 2, 10, -12, 1, 18, 0x4a5560);
    makeBox(4, 1.5, 4, -12, 2.75, 20, 0x3a4550);

    // Sandbags
    for (let i = 0; i < 5; i++) {
      makeBox(1.5, 0.8, 0.8, 32 + i * 0, 0.4, -22 + i * 0.2, 0x9a8a60);
    }
    makeBox(7, 0.8, 0.8, 33, 0.4, -22, 0x9a8a60);
    makeBox(7, 0.8, 0.8, -33, 0.4, -22, 0x9a8a60);

    // Pipes/pillars
    for (let i = 0; i < 4; i++) {
      makeBox(0.5, 7, 0.5, 14 + i * 3, 3.5, -15, 0x887858);
    }

    // Scaffolding
    makeBox(0.3, 10, 0.3, 18, 5, -10, 0x706050);
    makeBox(0.3, 10, 0.3, 22, 5, -10, 0x706050);
    makeBox(4, 0.3, 0.3, 20, 9, -10, 0x706050);

    // Add decorative arches (simplified)
    makeBox(10, 8, 2, 0, 4, -35, WALL);
    makeBox(2, 3, 2, -4, 1.5, -35, 0x5a4a30);
    makeBox(2, 3, 2, 4, 1.5, -35, 0x5a4a30);
  }

  private buildWeapon() {
    this.weaponGroup = new THREE.Group();

    // AK-47 body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a28,
      roughness: 0.3,
      metalness: 0.7,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x8B5E3C,
      roughness: 0.8,
      metalness: 0.0,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a38,
      roughness: 0.2,
      metalness: 0.9,
    });

    // Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.38), bodyMat);
    receiver.castShadow = true;

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 12), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.38);

    // Barrel gas tube
    const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8), metalMat);
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, 0.025, -0.25);

    // Stock (wood)
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), woodMat);
    stock.position.set(0, -0.01, 0.22);

    // Pistol grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.055), woodMat);
    grip.position.set(0, -0.08, 0.1);
    grip.rotation.x = 0.3;

    // Handguard (wood)
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.18), woodMat);
    handguard.position.set(0, 0, -0.18);

    // Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.06), bodyMat);
    mag.position.set(0, -0.13, 0.02);
    mag.rotation.x = -0.15;

    // Front sight
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.01), metalMat);
    frontSight.position.set(0, 0.05, -0.47);

    // Rear sight
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.02), metalMat);
    rearSight.position.set(0, 0.042, -0.02);

    // Charging handle
    const chargeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.015, 0.03), metalMat);
    chargeHandle.position.set(0.04, 0.025, 0.05);

    this.weaponGroup.add(receiver, barrel, gasTube, stock, grip, handguard, mag, frontSight, rearSight, chargeHandle);

    // Hands
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc8a882, roughness: 0.8, metalness: 0.0 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.9, metalness: 0.0 });

    // Right hand
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.1), skinMat);
    rightHand.position.set(0.04, -0.09, 0.1);

    // Right sleeve
    const rightSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.16, 8), sleeveMat);
    rightSleeve.position.set(0.04, -0.12, 0.1);
    rightSleeve.rotation.x = Math.PI / 2;

    // Left hand (on handguard)
    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.09), skinMat);
    leftHand.position.set(-0.03, -0.025, -0.18);

    // Left sleeve
    const leftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.16, 8), sleeveMat);
    leftSleeve.position.set(-0.03, -0.06, -0.18);
    leftSleeve.rotation.x = Math.PI / 2;

    // Fingers right
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.04, 6), skinMat);
      finger.position.set(0.025 + i * 0.012 - 0.02, -0.06, 0.06);
      finger.rotation.x = Math.PI / 2;
      this.weaponGroup.add(finger);
    }

    // Fingers left
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.04, 6), skinMat);
      finger.position.set(-0.04 + i * 0.012, -0.005, -0.21);
      finger.rotation.x = Math.PI / 2;
      this.weaponGroup.add(finger);
    }

    this.weaponGroup.add(rightHand, rightSleeve, leftHand, leftSleeve);

    // Muzzle flash
    const flashGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.set(0, 0.01, -0.62);
    this.weaponGroup.add(this.muzzleFlashMesh);

    this.muzzleFlashLight = new THREE.PointLight(0xffdd66, 0, 8);
    this.muzzleFlashLight.position.set(0, 0.01, -0.62);
    this.weaponGroup.add(this.muzzleFlashLight);

    // Position weapon in camera
    this.weaponGroup.position.set(0.18, -0.22, -0.35);
    this.camera.add(this.weaponGroup);
    this.scene.add(this.camera);
  }

  private setupLights() {
    // Sky ambiance
    const ambient = new THREE.AmbientLight(0x8090a0, 0.6);
    this.scene.add(ambient);

    // Sun
    const sun = new THREE.DirectionalLight(0xfffce8, 2.5);
    sun.position.set(40, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 4096;
    sun.shadow.mapSize.height = 4096;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    // Fill light (sky reflection)
    const sky = new THREE.DirectionalLight(0xa0c8e8, 0.8);
    sky.position.set(-20, 30, -20);
    this.scene.add(sky);

    // Hemisphere
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0xc8b88a, 0.5);
    this.scene.add(hemi);
  }

  private spawnEnemies() {
    const positions = [
      new THREE.Vector3(32, 0.9, -30),
      new THREE.Vector3(-32, 0.9, -30),
      new THREE.Vector3(0, 0.9, -38),
      new THREE.Vector3(20, 0.9, 15),
      new THREE.Vector3(-20, 0.9, 15),
    ];

    positions.forEach((pos, i) => {
      this.enemies.push(this.createEnemy(pos, i));
    });

    this.state.enemiesAlive = this.enemies.filter(e => e.alive).length;
  }

  private createEnemy(pos: THREE.Vector3, id: number): Enemy {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.8 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xc09060, roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.9 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), bodyMat);
    body.position.y = 0.7;
    body.castShadow = true;

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), headMat);
    head.position.y = 1.25;
    head.castShadow = true;

    // Helmet
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), darkMat);
    helmet.position.y = 1.32;
    helmet.castShadow = true;

    // Legs
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.2), darkMat);
    legL.position.set(-0.14, 0.27, 0);
    legL.castShadow = true;
    const legR = legL.clone();
    legR.position.x = 0.14;

    // Arms
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.2), bodyMat);
    armL.position.set(-0.32, 0.7, 0);
    armL.castShadow = true;
    const armR = armL.clone();
    armR.position.x = 0.32;

    // Weapon
    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.4), new THREE.MeshStandardMaterial({ color: 0x1a1a18, metalness: 0.8, roughness: 0.3 }));
    weapon.position.set(0.3, 0.85, -0.25);
    weapon.castShadow = true;

    group.add(body, head, helmet, legL, legR, armL, armR, weapon);
    group.position.copy(pos);
    this.scene.add(group);

    return { mesh: group, health: 100, position: pos.clone(), alive: true, speed: 1.5 + Math.random() * 0.5, lastShot: 0, id };
  }

  private setupEvents() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyR' && !this.state.isReloading && this.state.ammo < this.state.maxAmmo && this.state.reserveAmmo > 0) {
        this.startReload();
      }
      if (e.code === 'KeyF') {
        this.state.isInspecting = !this.state.isInspecting;
        if (this.state.isInspecting) this.weaponInspectTime = 0;
        this.emitState();
      }
      if (e.code === 'Space' && this.isOnGround && !this.isCrouching) {
        this.playerVelocityY = 7;
        this.isOnGround = false;
        this.state.isJumping = true;
        this.emitState();
      }
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    document.addEventListener('mousedown', (e) => {
      this.mouseButtons[e.button] = true;
      if (e.button === 2) {
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
        this.pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.pitch));
      }
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    });
  }

  private startReload() {
    if (this.state.isReloading || this.state.reserveAmmo <= 0) return;
    this.state.isReloading = true;
    this.reloadStartTime = performance.now();
    this.emitState();
    setTimeout(() => {
      const needed = this.state.maxAmmo - this.state.ammo;
      const take = Math.min(needed, this.state.reserveAmmo);
      this.state.ammo += take;
      this.state.reserveAmmo -= take;
      this.state.isReloading = false;
      this.state.reloadProgress = 0;
      this.emitState();
    }, 2500);
  }

  private shoot() {
    const now = performance.now();
    if (now - this.lastFireTime < 100) return;
    if (this.state.ammo <= 0) {
      if (this.state.reserveAmmo > 0) this.startReload();
      return;
    }
    if (this.state.isReloading) return;
    this.lastFireTime = now;
    this.state.ammo--;
    this.state.muzzleFlash = true;
    this.emitState();

    // Muzzle flash visual
    (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 1;
    this.muzzleFlashLight.intensity = 8;
    setTimeout(() => {
      (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      this.muzzleFlashLight.intensity = 0;
      this.state.muzzleFlash = false;
      this.emitState();
    }, 60);

    // Weapon recoil
    this.weaponGroup.position.z += 0.015;
    this.weaponGroup.rotation.x -= 0.04;

    // Raycast for hit detection
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const enemyMeshes = this.enemies.filter(e => e.alive).map(e => e.mesh);
    const allMeshes: THREE.Mesh[] = [];
    enemyMeshes.forEach(g => g.traverse(child => { if ((child as THREE.Mesh).isMesh) allMeshes.push(child as THREE.Mesh); }));

    const hits = raycaster.intersectObjects(allMeshes, true);
    if (hits.length > 0) {
      // Find which enemy was hit
      const hitObj = hits[0].object;
      const enemy = this.enemies.find(e => {
        let found = false;
        e.mesh.traverse(c => { if (c === hitObj) found = true; });
        return found && e.alive;
      });
      if (enemy) {
        const isHeadshot = hits[0].point.y > enemy.position.y + 1.1;
        const dmg = isHeadshot ? 100 : 35;
        enemy.health -= dmg;
        this.state.hitMarker = true;
        setTimeout(() => { this.state.hitMarker = false; this.emitState(); }, 200);
        if (enemy.health <= 0) {
          this.killEnemy(enemy);
        }
        this.emitState();
      }

      // Bullet hole decal
      const pt = hits[0].point;
      const decalGeo = new THREE.PlaneGeometry(0.15, 0.15);
      const decalMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85, depthWrite: false });
      const decal = new THREE.Mesh(decalGeo, decalMat);
      decal.position.copy(pt);
      decal.position.add(hits[0].face!.normal.multiplyScalar(0.01));
      decal.lookAt(pt.clone().add(hits[0].face!.normal));
      this.scene.add(decal);
      this.decals.push(decal);
      if (this.decals.length > 40) {
        const old = this.decals.shift()!;
        this.scene.remove(old);
      }
    }

    // Spawn bullet tracer
    const tracerGeo = new THREE.CylinderGeometry(0.005, 0.005, 1.5, 4);
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.6 });
    const tracer = new THREE.Mesh(tracerGeo, tracerMat);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const start = this.camera.position.clone();
    tracer.position.copy(start.add(dir.multiplyScalar(3)));
    tracer.lookAt(start.clone().add(dir.multiplyScalar(10)));
    tracer.rotation.x += Math.PI / 2;
    this.scene.add(tracer);
    this.bullets.push(tracer);
    setTimeout(() => {
      this.scene.remove(tracer);
      this.bullets = this.bullets.filter(b => b !== tracer);
    }, 120);
  }

  private killEnemy(enemy: Enemy) {
    enemy.alive = false;
    enemy.health = 0;
    this.state.kills++;
    this.state.enemiesAlive = this.enemies.filter(e => e.alive).length;

    // Ragdoll-like fall
    const dy = -2;
    const startY = enemy.mesh.position.y;
    let t = 0;
    const fall = setInterval(() => {
      t += 0.05;
      enemy.mesh.position.y = startY + dy * t;
      enemy.mesh.rotation.z = t * 1.5;
      if (t >= 1) {
        clearInterval(fall);
        // Remove after delay
        setTimeout(() => this.scene.remove(enemy.mesh), 5000);
      }
    }, 16);
  }

  private updateEnemies(dt: number) {
    const now = performance.now();
    this.enemies.forEach(enemy => {
      if (!enemy.alive) return;

      // Move toward player
      const toPlayer = this.playerPos.clone().sub(enemy.mesh.position);
      const dist = toPlayer.length();
      toPlayer.normalize();

      if (dist > 3) {
        enemy.mesh.position.x += toPlayer.x * enemy.speed * dt;
        enemy.mesh.position.z += toPlayer.z * enemy.speed * dt;
      }
      enemy.mesh.position.copy(enemy.mesh.position);
      enemy.position.copy(enemy.mesh.position);

      // Face player
      enemy.mesh.lookAt(this.playerPos.x, enemy.mesh.position.y, this.playerPos.z);

      // Animate legs
      const t = now / 1000;
      const children = enemy.mesh.children;
      if (children[3]) children[3].rotation.x = Math.sin(t * 5) * 0.3;
      if (children[4]) children[4].rotation.x = -Math.sin(t * 5) * 0.3;

      // Enemy shooting
      if (dist < 25 && now - enemy.lastShot > 1500 + Math.random() * 1000) {
        enemy.lastShot = now;
        if (this.state.health > 0) {
          this.state.health = Math.max(0, this.state.health - (8 + Math.random() * 12));
          if (this.state.health <= 0) {
            this.state.health = 0;
            this.state.gamePhase = 'dead';
          }
          this.emitState();
        }
      }
    });
  }

  private updateMovement(dt: number) {
    const speed = this.isCrouching ? 2.5 : (this.keys['ShiftLeft'] ? 5.5 : 4.2);
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const move = new THREE.Vector3();
    if (this.keys['KeyW'] || this.keys['ArrowUp']) move.add(forward);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) move.sub(forward);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) move.sub(right);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) move.add(right);

    if (move.length() > 0) move.normalize();
    this.moveVelocity.lerp(move.multiplyScalar(speed), 0.15);

    this.playerPos.x += this.moveVelocity.x * dt;
    this.playerPos.z += this.moveVelocity.z * dt;

    // Clamp to map
    this.playerPos.x = Math.max(-98, Math.min(98, this.playerPos.x));
    this.playerPos.z = Math.max(-98, Math.min(98, this.playerPos.z));

    // Gravity
    if (!this.isOnGround) {
      this.playerVelocityY -= 20 * dt;
    }
    this.playerPos.y += this.playerVelocityY * dt;

    // Ground check
    if (this.playerPos.y <= (this.isCrouching ? 1.1 : 1.7)) {
      this.playerPos.y = this.isCrouching ? 1.1 : 1.7;
      this.playerVelocityY = 0;
      this.isOnGround = true;
      if (this.state.isJumping) {
        this.state.isJumping = false;
        this.emitState();
      }
    }

    // Crouch
    const wantCrouch = this.keys['ControlLeft'] || this.keys['KeyC'];
    if (wantCrouch !== this.isCrouching) {
      this.isCrouching = wantCrouch;
      this.state.isCrouching = this.isCrouching;
      this.emitState();
    }

    // Apply to camera
    this.camera.position.copy(this.playerPos);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  private updateWeapon(dt: number) {
    this.weaponBobTime += dt * (this.isMoving() ? 8 : 2);

    const bobX = Math.sin(this.weaponBobTime * 0.5) * (this.isMoving() ? 0.008 : 0.002);
    const bobY = Math.sin(this.weaponBobTime) * (this.isMoving() ? 0.005 : 0.001);

    // Base position
    const baseX = this.state.isAiming ? 0.03 : 0.18;
    const baseY = this.state.isAiming ? -0.16 : -0.22;
    const baseZ = this.state.isAiming ? -0.28 : -0.35;

    if (this.state.isInspecting) {
      this.weaponInspectTime += dt;
      const t = this.weaponInspectTime;
      this.weaponGroup.position.set(
        baseX + Math.sin(t * 1.5) * 0.08,
        baseY + Math.sin(t * 0.8) * 0.05,
        baseZ + Math.sin(t * 0.6) * 0.04
      );
      this.weaponGroup.rotation.set(
        Math.sin(t * 0.7) * 0.3,
        Math.sin(t * 1.2) * 0.4,
        Math.sin(t * 0.9) * 0.2
      );
    } else {
      // Smooth return to base
      this.weaponGroup.position.x += (baseX + bobX - this.weaponGroup.position.x) * 0.12;
      this.weaponGroup.position.y += (baseY + bobY - this.weaponGroup.position.y) * 0.12;
      this.weaponGroup.position.z += (baseZ - this.weaponGroup.position.z) * 0.12;
      this.weaponGroup.rotation.x += (0 - this.weaponGroup.rotation.x) * 0.15;
      this.weaponGroup.rotation.y += (0 - this.weaponGroup.rotation.y) * 0.15;
      this.weaponGroup.rotation.z += (0 - this.weaponGroup.rotation.z) * 0.15;
    }

    // Reload progress
    if (this.state.isReloading) {
      const elapsed = performance.now() - this.reloadStartTime;
      this.state.reloadProgress = Math.min(elapsed / 2500, 1);

      // Reload animation
      const t = this.state.reloadProgress;
      this.weaponGroup.rotation.x = Math.sin(t * Math.PI * 2) * 0.4;
      this.weaponGroup.position.y = baseY - Math.sin(t * Math.PI) * 0.12;
    }
  }

  private isMoving(): boolean {
    return !!(this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD']);
  }

  private emitState() {
    this.onStateChange?.({ ...this.state });
  }

  start() {
    this.state.gamePhase = 'playing';
    this.emitState();
    this.canvas.requestPointerLock();
    this.loop();
  }

  private loop() {
    this.animFrame = requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state.gamePhase !== 'playing') return;

    // Shooting
    if (this.mouseButtons[0] && !this.state.isReloading) {
      this.shoot();
    }

    this.updateMovement(dt);
    this.updateWeapon(dt);
    this.updateEnemies(dt);

    this.renderer.render(this.scene, this.camera);
  }

  restart() {
    this.state.health = 100;
    this.state.ammo = 30;
    this.state.reserveAmmo = 90;
    this.state.kills = 0;
    this.state.isReloading = false;
    this.state.gamePhase = 'playing';
    this.playerPos.set(0, 1.7, 30);
    this.yaw = 0;
    this.pitch = 0;

    // Respawn enemies
    this.enemies.forEach(e => { this.scene.remove(e.mesh); });
    this.enemies = [];
    this.spawnEnemies();
    this.emitState();
    this.canvas.requestPointerLock();
  }

  destroy() {
    cancelAnimationFrame(this.animFrame);
    document.exitPointerLock();
    this.renderer.dispose();
  }
}
