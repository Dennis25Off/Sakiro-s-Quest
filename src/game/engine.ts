import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BinauralAudioEngine } from './binauralAudio';
import { SECRET_COMBOS, SECRET_COMBO_MAP } from './combos';
import { InputManager, UnifiedInput } from './input';
import { LEVELS } from './levels';
import {
  ArticulatedSamuraiRig,
  CheckpointBeaconObj,
  createCheckpointBeacon,
  createEnemySamuraiRig,
  createHeroSamuraiRig,
  createNeoToriiGate,
  createRuinedToriiGate,
} from './models';
import { createMaterialLibrary, GameMaterialLibrary } from './textures';
import {
  CombatFeedback,
  EnemyArchetype,
  EnemyHudInfo,
  EnemySpawnSpec,
  GameScreen,
  HudSnapshot,
  LevelSpec,
  QualityPreset,
  SecretComboId,
  TelegraphType,
} from './types';

// Pre-allocated math helpers for zero GC in animation loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _upAxis = new THREE.Vector3(0, 1, 0);

type AttackVariant =
  | 'light1'
  | 'light2'
  | 'light3'
  | 'light4'
  | 'heavy'
  | 'breaker'
  | 'crimson_cross'
  | 'iai_counter'
  | 'tempest_whirl'
  | 'shadow_pierce'
  | 'eclipse_judgment'
  | 'bow_shot';

interface SparkParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  colorHex: number;
}

interface ShockwaveRing {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxScale: number;
}

interface CrossSlashProjectile {
  group: THREE.Group;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  distTraveled: number;
  maxDist: number;
  speed: number;
  hitIds: Set<string>;
}

interface MagicOrb {
  group: THREE.Group;
  coreMat: THREE.MeshBasicMaterial;
  haloMat: THREE.MeshBasicMaterial;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  damage: number;
  life: number;
  reflected: boolean;
  owner: ActiveEnemy;
}

interface MeteorStrike {
  targetPos: THREE.Vector3;
  ringMesh: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  fillMesh: THREE.Mesh;
  fillMat: THREE.MeshBasicMaterial;
  beamMesh: THREE.Mesh;
  beamMat: THREE.MeshBasicMaterial;
  rockMesh: THREE.Mesh;
  rockMat: THREE.MeshStandardMaterial;
  timer: number;
  duration: number;
  radius: number;
  damage: number;
}

interface BossArrow {
  group: THREE.Group;
  coreMat: THREE.MeshBasicMaterial;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  damage: number;
  life: number;
  reflected: boolean;
  owner: ActiveEnemy;
}

interface HeroArrow {
  group: THREE.Group;
  coreMat: THREE.MeshBasicMaterial;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  damage: number;
  postureDmg: number;
  life: number;
}

interface BossBomb {
  mesh: THREE.Mesh;
  bombMat: THREE.MeshStandardMaterial;
  ringMesh: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  fillMesh: THREE.Mesh;
  fillMat: THREE.MeshBasicMaterial;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  flightTimer: number;
  flightDuration: number;
  fuseTimer: number;
  fuseDuration: number;
  radius: number;
  damage: number;
}

interface ParkourCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
}

interface ActiveEnemy {
  spec: EnemySpawnSpec;
  rig: ArticulatedSamuraiRig;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  knockbackVel: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  posture: number;
  maxPosture: number;
  currentPhase: number;
  totalPhases: number;
  state: 'idle' | 'chase' | 'windup' | 'strike' | 'recover' | 'stagger' | 'dead';
  stateTimer: number;
  windupDuration: number;
  telegraph: TelegraphType;
  hasStruckThisSwing: boolean;
  attackCooldown: number;
  magicCooldown: number;
  bowCooldown: number;
  bombCooldown: number;
  magicKind: 'none' | 'bolts' | 'meteors' | 'bow' | 'bombs';
  strafeDir: number;
  stepTimer: number;
  deadTimer: number;
  waveIndex: number;
  comboRemaining: number;
  isGuarding: boolean;
  guardTimer: number;
  dodgeCooldown: number;
  hitStreak: number;
  hitFlashTimer: number;
}

interface ActiveCheckpoint {
  index: number;
  beacon: CheckpointBeaconObj;
  pos: THREE.Vector3;
  radius: number;
  requiresWaveIndex?: number;
  activated: boolean;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onCheckpointReached: (levelIndex: number, checkpointIndex: number, hp: number) => void;
  onParryStat: () => void;
  onDefeatStat: () => void;
  onComboDiscovered: (comboId: SecretComboId) => void;
  onScreenChange: (screen: GameScreen) => void;
  onLevelComplete: (levelIndex: number) => void;
  onPlayerDefeated: () => void;
}

export class SamuraiGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  public audio: BinauralAudioEngine;
  public input: InputManager;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private mats!: GameMaterialLibrary;
  private isSoftwareGl = false;
  private qualityPreset: QualityPreset = 'auto';

  private levelGroup = new THREE.Group();
  private actorGroup = new THREE.Group();
  private vfxGroup = new THREE.Group();
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private infernoLight: THREE.PointLight | null = null;
  private isInfernalLevel = false;

  // Player state
  private heroRig!: ArticulatedSamuraiRig;
  private playerPos = new THREE.Vector3(0, 0, 6);
  private playerVel = new THREE.Vector3();
  private playerKnockbackVel = new THREE.Vector3();
  private playerYaw = 0; // Facing -Z into the level
  private playerHp = 100;
  private playerMaxHp = 100;
  private playerPosture = 0;
  private playerMaxPosture = 100;
  private playerStamina = 100;
  private playerMaxStamina = 100;
  private playerState: 'idle' | 'move' | 'attack' | 'block' | 'dodge' | 'stagger' | 'dead' = 'idle';
  private attackKind: 'light' | 'heavy' = 'light';
  private attackVariant: AttackVariant = 'light1';
  private comboStep = 0;
  private heavyOpenerStep = 0; // 1 = H, 2 = H->L (next L = Tempest Whirl)
  private heavyChainStage = 0; // 1 = L->H (next H = Eclipse Judgment)
  private comboResetTimer = 0;
  private postParryTimer = 0;
  private postDodgeTimer = 0;
  private combosUnlocked = false;
  private discoveredCombos = new Set<SecretComboId>();
  private timeSlowUnlocked = false;
  private timeSlowTimer = 0;
  private timeSlowCooldown = 0;
  private bowUnlocked = false;
  private bowCooldown = 0;
  private playerVelY = 0;
  private isGrounded = true;
  private lastSafePos = new THREE.Vector3(0, 0, 6);
  private parkourColliders: ParkourCollider[] = [];
  private parkourGap: { zMin: number; zMax: number } | null = null;
  private actionTimer = 0;
  private actionDuration = 0;
  private hasHitThisAttack = false;
  private attackLungeSpeed = 0;
  private bufferedAction: 'light' | 'heavy' | 'dodge' | null = null;
  private parryWindowTimer = 0;
  private invulnTimer = 0;
  private dodgeDir = new THREE.Vector3();
  private playerStepTimer = 0;

  // Sword slash ribbon VFX (dual layer)
  private slashArcMesh!: THREE.Mesh;
  private slashArcMat!: THREE.MeshBasicMaterial;
  private slashArcOuterMesh!: THREE.Mesh;
  private slashArcOuterMat!: THREE.MeshBasicMaterial;
  private slashArcTimer = 0;
  private slashArcMaxTimer = 0.24;
  private slashArcSpinDir = 1;

  // Lock-on ring + action clarity rings (parry/guard, normal windup, unblockable, magic, enemy guard)
  private lockRingMesh!: THREE.Mesh;
  private heroGuardRingMesh!: THREE.Mesh;
  private heroGuardRingMat!: THREE.MeshBasicMaterial;
  private enemyTelegraphRingMesh!: THREE.Mesh;
  private enemyTelegraphRingMat!: THREE.MeshBasicMaterial;
  private unblockableRingMesh!: THREE.Mesh;
  private unblockableRingMat!: THREE.MeshBasicMaterial;
  private enemyMagicRingMesh!: THREE.Mesh;
  private enemyMagicRingMat!: THREE.MeshBasicMaterial;
  private enemyGuardShieldMesh!: THREE.Mesh;
  private enemyGuardShieldMat!: THREE.MeshBasicMaterial;

  // Pooled shockwave rings + Cross Slash + Magic Orbs + Pre-telegraphed Meteors + Boss Bow/Bombs
  private shockwavePool: ShockwaveRing[] = [];
  private crossProjectiles: CrossSlashProjectile[] = [];
  private magicOrbs: MagicOrb[] = [];
  private meteors: MeteorStrike[] = [];
  private bossArrows: BossArrow[] = [];
  private heroArrows: HeroArrow[] = [];
  private bossBombs: BossBomb[] = [];
  private crossBladeGeo!: THREE.BoxGeometry;
  private crossCoreGeo!: THREE.BoxGeometry;
  private orbCoreGeo!: THREE.SphereGeometry;
  private orbHaloGeo!: THREE.TorusGeometry;
  private meteorRingGeo!: THREE.RingGeometry;
  private meteorFillGeo!: THREE.CircleGeometry;
  private meteorBeamGeo!: THREE.CylinderGeometry;
  private meteorRockGeo!: THREE.DodecahedronGeometry;
  private arrowShaftGeo!: THREE.BoxGeometry;
  private arrowHeadGeo!: THREE.ConeGeometry;
  private bombSphereGeo!: THREE.SphereGeometry;

  // Pooled InstancedMesh sparks + floating blossom petals
  private sparkPool: SparkParticle[] = [];
  private sparkInstanced!: THREE.InstancedMesh;
  private petalInstanced: THREE.InstancedMesh | null = null;
  private petalCount = 0;
  private petalData: Float32Array = new Float32Array(0);

  // Camera
  private camYaw = 0;
  private camPitch = 0.28;
  private camCurrentPos = new THREE.Vector3(0, 3.2, 11.5);
  private camLookCurrent = new THREE.Vector3(0, 1.3, 6);
  private camShake = 0;
  private camFov = 54;

  // Level & Combat runtime
  private currentLevelIndex = 0;
  private currentCheckpointIndex = 0;
  private screenMode: GameScreen = 'menu';
  private wavesTriggered: boolean[] = [];
  private wavesCleared: boolean[] = [];
  private enemies: ActiveEnemy[] = [];
  private checkpoints: ActiveCheckpoint[] = [];
  private lockedEnemyId: string | null = null;
  private storySubtitle: string | null = null;
  private storyTimer = 0;
  private feedback: CombatFeedback | null = null;
  private feedbackCounter = 0;
  private feedbackTimer = 0;
  private hitStopTimer = 0;

  // Loop & performance tracking
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private elapsed = 0;
  private hudEmitAccum = 0;
  private fpsSamples = 60;
  private lastInputSnap: UnifiedInput | null = null;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.audio = new BinauralAudioEngine();
    this.input = new InputManager();

    this.initRendererAndScene();
    this.loadLevel(0, 0, true);
    this.startLoop();
  }

  private detectSoftwareWebGL(): boolean {
    try {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initRendererAndScene(): void {
    this.isSoftwareGl = this.detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.applyQualitySettings(this.qualityPreset);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    this.container.appendChild(this.renderer.domElement);
    this.input.attach(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, w / h, 0.15, 220);

    // Studio PBR reflections via RoomEnvironment on all devices
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.mats = createMaterialLibrary(this.renderer);

    // Warm/cool 3-point lighting rig
    this.hemiLight = new THREE.HemisphereLight(0xf0f6ff, 0xc7d2de, 0.85);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff6e5, 1.85);
    this.dirLight.position.set(14, 24, 16);
    this.dirLight.castShadow = !this.isSoftwareGl;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 68;
    const d = 20;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.7);
    rimLight.position.set(-14, 12, -18);
    this.scene.add(rimLight);

    this.infernoLight = new THREE.PointLight(0xff4d1a, 0, 68, 1.35);
    this.infernoLight.position.set(0, 5.5, -24);
    this.scene.add(this.infernoLight);

    this.scene.add(this.levelGroup);
    this.scene.add(this.actorGroup);
    this.scene.add(this.vfxGroup);

    // Hero samurai
    this.heroRig = createHeroSamuraiRig(this.mats);
    this.actorGroup.add(this.heroRig.root);

    // Slash arc ribbon VFX (dual layer centered on -Z local forward)
    const arcGeo = new THREE.RingGeometry(1.05, 2.35, 24, 1, -Math.PI * 0.48, Math.PI * 0.96);
    arcGeo.rotateX(-Math.PI / 2);
    arcGeo.rotateY(Math.PI / 2);
    this.slashArcMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.slashArcMesh = new THREE.Mesh(arcGeo, this.slashArcMat);
    this.slashArcMesh.rotation.order = 'YXZ';
    this.slashArcMesh.visible = false;
    this.vfxGroup.add(this.slashArcMesh);

    const outerArcGeo = new THREE.RingGeometry(2.15, 2.65, 24, 1, -Math.PI * 0.42, Math.PI * 0.84);
    outerArcGeo.rotateX(-Math.PI / 2);
    outerArcGeo.rotateY(Math.PI / 2);
    this.slashArcOuterMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.slashArcOuterMesh = new THREE.Mesh(outerArcGeo, this.slashArcOuterMat);
    this.slashArcOuterMesh.rotation.order = 'YXZ';
    this.slashArcOuterMesh.visible = false;
    this.vfxGroup.add(this.slashArcOuterMesh);

    // Lock-on ring indicator
    const lockGeo = new THREE.RingGeometry(0.68, 0.78, 24);
    lockGeo.rotateX(-Math.PI / 2);
    const lockMat = new THREE.MeshBasicMaterial({
      color: 0xe12d39,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.lockRingMesh = new THREE.Mesh(lockGeo, lockMat);
    this.lockRingMesh.visible = false;
    this.vfxGroup.add(this.lockRingMesh);

    // Hero Guard / Perfect Parry clarity arc
    const heroGuardGeo = new THREE.RingGeometry(0.86, 1.08, 24, 1, -Math.PI * 0.42, Math.PI * 0.84);
    heroGuardGeo.rotateX(-Math.PI / 2);
    heroGuardGeo.rotateY(Math.PI / 2);
    this.heroGuardRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.heroGuardRingMesh = new THREE.Mesh(heroGuardGeo, this.heroGuardRingMat);
    this.heroGuardRingMesh.visible = false;
    this.vfxGroup.add(this.heroGuardRingMesh);

    // Enemy normal parry-timing shrinking ring (Amber -> White flash right before strike)
    const teleGeo = new THREE.RingGeometry(0.76, 0.94, 28);
    teleGeo.rotateX(-Math.PI / 2);
    this.enemyTelegraphRingMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    this.enemyTelegraphRingMesh = new THREE.Mesh(teleGeo, this.enemyTelegraphRingMat);
    this.enemyTelegraphRingMesh.visible = false;
    this.vfxGroup.add(this.enemyTelegraphRingMesh);

    // Unblockable enemy warning aura ring
    const unbGeo = new THREE.RingGeometry(0.82, 0.98, 24);
    unbGeo.rotateX(-Math.PI / 2);
    this.unblockableRingMat = new THREE.MeshBasicMaterial({
      color: 0xe12d39,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.unblockableRingMesh = new THREE.Mesh(unbGeo, this.unblockableRingMat);
    this.unblockableRingMesh.visible = false;
    this.vfxGroup.add(this.unblockableRingMesh);

    // Enemy Boss Magic Cast hexagonal sigil ring
    const magicSigilGeo = new THREE.RingGeometry(1.05, 1.32, 6);
    magicSigilGeo.rotateX(-Math.PI / 2);
    this.enemyMagicRingMat = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.enemyMagicRingMesh = new THREE.Mesh(magicSigilGeo, this.enemyMagicRingMat);
    this.enemyMagicRingMesh.visible = false;
    this.vfxGroup.add(this.enemyMagicRingMesh);

    // Enemy active guard shield indicator (signals to use Heavy / Guard Breaker)
    const shieldGeo = new THREE.RingGeometry(0.32, 0.48, 6);
    this.enemyGuardShieldMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    this.enemyGuardShieldMesh = new THREE.Mesh(shieldGeo, this.enemyGuardShieldMat);
    this.enemyGuardShieldMesh.visible = false;
    this.vfxGroup.add(this.enemyGuardShieldMesh);

    // Pooled Shockwave Rings (8 pre-allocated meshes)
    const shockGeo = new THREE.RingGeometry(0.55, 0.78, 28);
    shockGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(shockGeo, mat);
      mesh.visible = false;
      this.vfxGroup.add(mesh);
      this.shockwavePool.push({
        active: false,
        mesh,
        mat,
        life: 0,
        maxLife: 0.35,
        maxScale: 3.4,
      });
    }

    // Shared geometries for Crimson Cross, Arcane Orbs, and Pre-telegraphed Meteors
    this.crossBladeGeo = new THREE.BoxGeometry(0.11, 1.85, 0.32);
    this.crossCoreGeo = new THREE.BoxGeometry(0.05, 1.55, 0.44);
    this.orbCoreGeo = new THREE.SphereGeometry(0.24, 12, 10);
    this.orbHaloGeo = new THREE.TorusGeometry(0.36, 0.045, 6, 18);
    this.meteorRingGeo = new THREE.RingGeometry(0.88, 1.0, 32);
    this.meteorRingGeo.rotateX(-Math.PI / 2);
    this.meteorFillGeo = new THREE.CircleGeometry(1, 28);
    this.meteorFillGeo.rotateX(-Math.PI / 2);
    this.meteorBeamGeo = new THREE.CylinderGeometry(0.16, 0.48, 26, 12, 1, true);
    this.meteorRockGeo = new THREE.DodecahedronGeometry(0.62, 0);
    this.arrowShaftGeo = new THREE.BoxGeometry(0.055, 0.055, 1.18);
    this.arrowHeadGeo = new THREE.ConeGeometry(0.11, 0.28, 6);
    this.arrowHeadGeo.rotateX(Math.PI / 2);
    this.bombSphereGeo = new THREE.SphereGeometry(0.28, 12, 10);

    // Pooled Spark InstancedMesh (max 96 elongated directional particles)
    const sparkGeo = new THREE.OctahedronGeometry(0.055, 0);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.sparkInstanced = new THREE.InstancedMesh(sparkGeo, sparkMat, 96);
    this.sparkInstanced.frustumCulled = false;
    this.sparkInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 96; i++) {
      this.sparkPool.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.3,
        colorHex: 0xfbbf24,
      });
      _mat4.makeScale(0, 0, 0);
      this.sparkInstanced.setMatrixAt(i, _mat4);
      this.sparkInstanced.setColorAt(i, _color.setHex(0xfbbf24));
    }
    this.sparkInstanced.instanceMatrix.needsUpdate = true;
    this.vfxGroup.add(this.sparkInstanced);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
  }

  public setQualityPreset(preset: QualityPreset): void {
    this.qualityPreset = preset;
    this.applyQualitySettings(preset);
  }

  public getQualityPreset(): QualityPreset {
    return this.qualityPreset;
  }

  public isLowEndMode(): boolean {
    return this.isSoftwareGl || this.qualityPreset === 'low';
  }

  private applyQualitySettings(preset: QualityPreset): void {
    if (!this.renderer) return;
    const isLow = preset === 'low' || (preset === 'auto' && this.isSoftwareGl);
    const isHigh = preset === 'high' && !this.isSoftwareGl;

    const dpr = this.isSoftwareGl
      ? 1
      : isLow
        ? 1
        : isHigh
          ? Math.min(window.devicePixelRatio, 2)
          : Math.min(window.devicePixelRatio, 1.35);

    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && !isLow;
    this.renderer.shadowMap.type = isHigh ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

    if (this.dirLight) {
      this.dirLight.castShadow = this.renderer.shadowMap.enabled;
    }
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public setScreenMode(mode: GameScreen): void {
    this.screenMode = mode;
    this.input.isGameplayActive = mode === 'playing';
    if (mode === 'playing') {
      this.input.clearPending();
    } else {
      this.input.exitPointerLock();
    }
  }

  public setProgressionState(
    combosUnlocked: boolean,
    discoveredCombos: SecretComboId[],
    timeSlowUnlocked = false,
    bowUnlocked = false,
  ): void {
    this.combosUnlocked = combosUnlocked || this.currentLevelIndex >= 1;
    this.discoveredCombos = new Set(discoveredCombos);
    this.timeSlowUnlocked = timeSlowUnlocked || this.currentLevelIndex >= 5;
    this.bowUnlocked = bowUnlocked || this.currentLevelIndex >= 5;
    this.emitHud();
  }

  public loadLevel(levelIndex: number, checkpointIndex: number, isMenuPreview = false): void {
    const clampedLevel = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
    const spec = LEVELS[clampedLevel];
    const clampedCp = Math.max(0, Math.min(spec.checkpoints.length - 1, checkpointIndex));

    this.currentLevelIndex = clampedLevel;
    this.currentCheckpointIndex = clampedCp;
    if (clampedLevel >= 1) {
      this.combosUnlocked = true;
    }
    if (clampedLevel >= 5) {
      this.timeSlowUnlocked = true;
      this.bowUnlocked = true;
    }

    // Clear previous level objects
    this.clearLevelObjects();

    // Scene sky, fog & dynamic daylight vs infernal lighting
    this.isInfernalLevel =
      spec.themeStyle === 'eclipse_abyss' || spec.themeStyle === 'final_sanctum';
    this.scene.background = new THREE.Color(spec.skyColor);
    this.scene.fog = new THREE.FogExp2(spec.fogColor, spec.fogDensity);

    if (this.isInfernalLevel) {
      this.hemiLight.color.setHex(0x7c1d2a);
      this.hemiLight.groundColor.setHex(0x3f1208);
      this.hemiLight.intensity = 1.05;
      this.dirLight.color.setHex(0xffb494);
      this.dirLight.intensity = 1.95;
      if (this.infernoLight) {
        this.infernoLight.color.setHex(spec.index === 9 ? 0xff6b1a : 0xe12d39);
        this.infernoLight.intensity = 22;
        this.infernoLight.position.set(0, 5.5, -24);
      }
    } else {
      this.hemiLight.color.setHex(0xf0f6ff);
      this.hemiLight.groundColor.setHex(0xc7d2de);
      this.hemiLight.intensity = 0.85;
      this.dirLight.color.setHex(0xfff6e5);
      this.dirLight.intensity = 1.85;
      if (this.infernoLight) {
        this.infernoLight.intensity = 0;
      }
    }

    this.buildLevelEnvironment(spec);

    // Setup checkpoints
    this.checkpoints = spec.checkpoints.map((cp, idx) => {
      const beacon = createCheckpointBeacon(this.mats);
      beacon.group.position.set(cp.position[0] + (idx === 0 ? -3.4 : 0), cp.position[1], cp.position[2]);
      const activated = idx <= clampedCp;
      if (activated) beacon.activate();
      this.levelGroup.add(beacon.group);
      return {
        index: idx,
        beacon,
        pos: new THREE.Vector3(cp.position[0], cp.position[1], cp.position[2]),
        radius: cp.triggerRadius,
        requiresWaveIndex: cp.requiresWaveIndex,
        activated,
      };
    });

    // Mark earlier waves cleared if resuming from later checkpoint
    this.wavesTriggered = spec.waves.map((_, idx) => {
      const cpReq = spec.checkpoints[clampedCp]?.requiresWaveIndex;
      if (cpReq !== undefined && idx <= cpReq) return true;
      return clampedCp >= 2 && idx < 2;
    });
    this.wavesCleared = [...this.wavesTriggered];

    // Position player at checkpoint facing -Z forward into the level
    const cpPos = spec.checkpoints[clampedCp].position;
    this.playerPos.set(cpPos[0], cpPos[1], cpPos[2]);
    this.lastSafePos.copy(this.playerPos);
    this.playerVel.set(0, 0, 0);
    this.playerVelY = 0;
    this.isGrounded = true;
    this.playerKnockbackVel.set(0, 0, 0);
    this.playerYaw = 0;
    this.playerHp = this.playerMaxHp;
    this.playerPosture = 0;
    this.playerStamina = this.playerMaxStamina;
    this.playerState = 'idle';
    this.bufferedAction = null;
    this.comboStep = 0;
    this.heavyOpenerStep = 0;
    this.heavyChainStage = 0;
    this.comboResetTimer = 0;
    this.postParryTimer = 0;
    this.postDodgeTimer = 0;
    this.timeSlowTimer = 0;
    this.timeSlowCooldown = 0;
    this.bowCooldown = 0;
    this.lockedEnemyId = null;
    this.camYaw = 0;
    this.camPitch = 0.27;
    this.camFov = 54;

    this.heroRig.root.position.copy(this.playerPos);
    this.heroRig.root.rotation.set(0, this.playerYaw, 0);
    // Start slightly pulled back and offset to the right shoulder for a crisp entry glide
    this.camCurrentPos.set(this.playerPos.x + 0.56, this.playerPos.y + 2.85, this.playerPos.z + 5.8);
    this.camLookCurrent.set(this.playerPos.x + 0.36, this.playerPos.y + 1.38, this.playerPos.z);

    if (!isMenuPreview) {
      this.storySubtitle = spec.chapterIntro;
      this.storyTimer = 6.5;
      if (clampedLevel === 1 && clampedCp === 0) {
        this.pushFeedback('ARTI SEGRETE SBLOCCATE · SPERIMENTA NUOVE COMBO', 'story');
      }
    } else {
      this.storySubtitle = null;
      this.storyTimer = 0;
    }

    this.emitHud();
  }

  private clearLevelObjects(): void {
    while (this.levelGroup.children.length > 0) {
      const obj = this.levelGroup.children[0];
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
        }
      });
      this.levelGroup.remove(obj);
    }
    this.enemies.forEach((e) => {
      this.actorGroup.remove(e.rig.root);
    });
    this.enemies = [];
    this.checkpoints = [];
    this.parkourColliders = [];
    this.parkourGap = null;
    this.petalInstanced = null;

    for (const proj of this.crossProjectiles) {
      this.vfxGroup.remove(proj.group);
    }
    this.crossProjectiles = [];
    for (const orb of this.magicOrbs) {
      this.vfxGroup.remove(orb.group);
      orb.coreMat.dispose();
      orb.haloMat.dispose();
    }
    this.magicOrbs = [];
    for (const m of this.meteors) {
      this.vfxGroup.remove(m.ringMesh, m.fillMesh, m.beamMesh, m.rockMesh);
      m.ringMat.dispose();
      m.fillMat.dispose();
      m.beamMat.dispose();
      m.rockMat.dispose();
    }
    this.meteors = [];
    for (const arr of this.bossArrows) {
      this.vfxGroup.remove(arr.group);
      arr.coreMat.dispose();
    }
    this.bossArrows = [];
    for (const arr of this.heroArrows) {
      this.vfxGroup.remove(arr.group);
      arr.coreMat.dispose();
    }
    this.heroArrows = [];
    for (const bomb of this.bossBombs) {
      this.vfxGroup.remove(bomb.mesh, bomb.ringMesh, bomb.fillMesh);
      bomb.bombMat.dispose();
      bomb.ringMat.dispose();
      bomb.fillMat.dispose();
    }
    this.bossBombs = [];
    for (const sw of this.shockwavePool) {
      sw.active = false;
      sw.mesh.visible = false;
    }
    if (this.heroGuardRingMesh) this.heroGuardRingMesh.visible = false;
    if (this.enemyTelegraphRingMesh) this.enemyTelegraphRingMesh.visible = false;
    if (this.unblockableRingMesh) this.unblockableRingMesh.visible = false;
    if (this.enemyMagicRingMesh) this.enemyMagicRingMesh.visible = false;
    if (this.enemyGuardShieldMesh) this.enemyGuardShieldMesh.visible = false;
  }

  private buildLevelEnvironment(spec: LevelSpec): void {
    const floorMat =
      spec.themeStyle === 'dawn_shrine'
        ? this.mats.porcelainFloor
        : spec.themeStyle === 'jade_bridge'
          ? this.mats.jadeFloor
          : spec.themeStyle === 'obsidian_garden'
            ? this.mats.obsidianFloor
            : spec.themeStyle === 'astral_zenith'
              ? this.mats.astralFloor
              : spec.themeStyle === 'eclipse_abyss'
                ? this.mats.abyssFloor
                : spec.themeStyle === 'ash_gorge'
                  ? this.mats.ashFloor
                  : spec.themeStyle === 'iron_bastion'
                    ? this.mats.ironFloor
                    : spec.themeStyle === 'crimson_citadel'
                      ? this.mats.crimsonFloor
                      : spec.themeStyle === 'final_sanctum'
                        ? this.mats.sanctumFloor
                        : this.mats.citadelFloor;

    const accentMat =
      spec.themeStyle === 'white_citadel' ||
      spec.themeStyle === 'eclipse_abyss' ||
      spec.themeStyle === 'crimson_citadel'
        ? this.mats.vermilionLacquer
        : spec.themeStyle === 'jade_bridge'
          ? new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.28, metalness: 0.35 })
          : spec.themeStyle === 'obsidian_garden'
            ? new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.26, metalness: 0.45 })
            : spec.themeStyle === 'astral_zenith'
              ? new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.22, metalness: 0.55 })
              : spec.themeStyle === 'ash_gorge'
                ? new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.32, metalness: 0.42 })
                : spec.themeStyle === 'iron_bastion'
                  ? new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.24, metalness: 0.78 })
                  : spec.themeStyle === 'final_sanctum'
                    ? new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.85 })
                    : this.mats.brushedTitanium;

    const conduitColor =
      spec.themeStyle === 'white_citadel' ||
      spec.themeStyle === 'eclipse_abyss' ||
      spec.themeStyle === 'crimson_citadel' ||
      spec.themeStyle === 'iron_bastion'
        ? 0xe12d39
        : spec.themeStyle === 'jade_bridge'
          ? 0x14b8a6
          : spec.themeStyle === 'obsidian_garden'
            ? 0x6366f1
            : spec.themeStyle === 'astral_zenith'
              ? 0x8b5cf6
              : spec.themeStyle === 'ash_gorge' || spec.themeStyle === 'final_sanctum'
                ? 0xf59e0b
                : 0x0284c7;
    const conduitMat = new THREE.MeshBasicMaterial({
      color: conduitColor,
      transparent: true,
      opacity: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });

    const frontZ = 27;
    const backZ = -spec.lengthZ - 18;

    // Main walkway + courtyard floor (split into two halves if mid-level Parkour chasm is present)
    const isInfernal = spec.themeStyle === 'eclipse_abyss' || spec.themeStyle === 'final_sanctum';

    if (spec.parkour) {
      const { gapZStart, gapZEnd, platforms } = spec.parkour;
      this.parkourGap = { zMin: gapZEnd, zMax: gapZStart };

      const depthBefore = frontZ - gapZStart;
      const floorBefore = new THREE.Mesh(
        new THREE.BoxGeometry(spec.widthX, 1.2, depthBefore),
        floorMat,
      );
      floorBefore.position.set(0, -0.6, (frontZ + gapZStart) / 2);
      floorBefore.receiveShadow = true;
      this.levelGroup.add(floorBefore);

      const depthAfter = gapZEnd - backZ;
      const floorAfter = new THREE.Mesh(
        new THREE.BoxGeometry(spec.widthX, 1.2, depthAfter),
        floorMat,
      );
      floorAfter.position.set(0, -0.6, (gapZEnd + backZ) / 2);
      floorAfter.receiveShadow = true;
      this.levelGroup.add(floorAfter);

      // Stone coping along the parkour chasm edges
      [gapZStart, gapZEnd].forEach((edgeZ) => {
        const edgeBeam = new THREE.Mesh(
          new THREE.BoxGeometry(spec.widthX, 0.18, 0.75),
          this.mats.stoneTrim,
        );
        edgeBeam.position.set(0, 0.04, edgeZ);
        edgeBeam.receiveShadow = true;
        this.levelGroup.add(edgeBeam);
      });

      // Flowing stream crossing through the chasm beneath the parkour platforms!
      const chasmWaterLen = Math.abs(gapZEnd - gapZStart) + 6;
      const chasmWater = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.widthX + 46, chasmWaterLen),
        this.mats.streamWater,
      );
      chasmWater.rotation.x = -Math.PI / 2;
      chasmWater.rotation.z = Math.PI / 2;
      chasmWater.position.set(0, spec.themeStyle === 'jade_bridge' ? -3.4 : -1.55, (gapZStart + gapZEnd) / 2);
      this.levelGroup.add(chasmWater);

      // Parkour jumping pillars & suspended bridges
      platforms.forEach((p) => {
        const pMat = p.kind === 'bridge' ? this.mats.parkourBridge : this.mats.parkourStone;
        const platMesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), pMat);
        platMesh.position.set(p.x, p.y - p.h / 2, p.z);
        platMesh.castShadow = true;
        platMesh.receiveShadow = true;
        this.levelGroup.add(platMesh);

        // Support column anchoring pillars/stones into the stream below
        if (p.kind !== 'bridge' && spec.themeStyle !== 'astral_zenith') {
          const colH = 2.4;
          const col = new THREE.Mesh(
            new THREE.CylinderGeometry(Math.min(p.w, p.d) * 0.34, Math.min(p.w, p.d) * 0.42, colH, 8),
            this.mats.stoneTrim,
          );
          col.position.set(p.x, p.y - p.h - colH / 2 + 0.05, p.z);
          this.levelGroup.add(col);
        }

        // Crisp luminous rim framing jump landing target
        const rim = new THREE.Mesh(
          new THREE.BoxGeometry(p.w * 0.92, 0.06, 0.14),
          conduitMat,
        );
        rim.position.set(p.x, p.y + 0.02, p.z + p.d * 0.44);
        this.levelGroup.add(rim);

        this.parkourColliders.push({
          minX: p.x - p.w / 2,
          maxX: p.x + p.w / 2,
          minZ: p.z - p.d / 2,
          maxZ: p.z + p.d / 2,
          topY: p.y,
        });
      });

      // Walkway conduit strips split neatly around the chasm
      [-1.4, 1.4].forEach((cx) => {
        const s1 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, depthBefore - 4), conduitMat);
        s1.rotation.x = -Math.PI / 2;
        s1.position.set(cx, 0.008, (frontZ + gapZStart) / 2);
        this.levelGroup.add(s1);

        const s2 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, depthAfter - 4), conduitMat);
        s2.rotation.x = -Math.PI / 2;
        s2.position.set(cx, 0.008, (gapZEnd + backZ) / 2);
        this.levelGroup.add(s2);
      });
    } else {
      this.parkourGap = null;
      const totalDepth = frontZ - backZ;
      const mainFloor = new THREE.Mesh(
        new THREE.BoxGeometry(spec.widthX, 1.2, totalDepth),
        floorMat,
      );
      mainFloor.position.set(0, -0.6, (frontZ + backZ) / 2);
      mainFloor.receiveShadow = true;
      this.levelGroup.add(mainFloor);

      if (isInfernal) {
        // Jagged glowing magma fissures carved into the shattered arena floor
        for (let k = 0; k < 14; k++) {
          const zPos = 14 - k * 7.2;
          const xPos = ((k % 2 === 0 ? -1 : 1) * (4.5 + (k % 3) * 3.1));
          const crack = new THREE.Mesh(
            new THREE.PlaneGeometry(0.24 + (k % 3) * 0.1, 4.6 + (k % 2) * 2.2),
            this.mats.emberCrack,
          );
          crack.rotation.x = -Math.PI / 2;
          crack.rotation.z = ((k % 5) - 2) * 0.34;
          crack.position.set(xPos, 0.012, zPos);
          this.levelGroup.add(crack);
        }
      } else {
        const conduitGeo = new THREE.PlaneGeometry(0.12, totalDepth - 8);
        [-1.4, 1.4].forEach((cx) => {
          const strip = new THREE.Mesh(conduitGeo, conduitMat);
          strip.rotation.x = -Math.PI / 2;
          strip.position.set(cx, 0.008, (frontZ + backZ) / 2);
          this.levelGroup.add(strip);
        });
      }
    }

    // Outer valley terrain + scenic winding/flanking streams (ruscelli or molten lava in Levels 6 & 10)
    if (spec.themeStyle !== 'jade_bridge' && spec.themeStyle !== 'astral_zenith') {
      const darkGround =
        isInfernal || spec.themeStyle === 'crimson_citadel';
      const groundMat = darkGround
        ? new THREE.MeshStandardMaterial({
            color: isInfernal ? 0x10070a : 0x1b1929,
            roughness: 0.9,
            metalness: 0.08,
          })
        : this.mats.stoneTrim;
      const outerGround = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), groundMat);
      outerGround.rotation.x = -Math.PI / 2;
      outerGround.position.set(0, -1.9, -spec.lengthZ / 2);
      outerGround.receiveShadow = true;
      this.levelGroup.add(outerGround);
    }

    // Flanking scenic streams (molten lava rivers in Levels 6 & 10, clear water otherwise)
    const streamLen = spec.lengthZ + 68;
    const streamOffsetX = spec.widthX / 2 + 4.8;
    const streamY =
      spec.themeStyle === 'jade_bridge'
        ? -4.1
        : spec.themeStyle === 'astral_zenith'
          ? -3.0
          : -1.42;

    [-streamOffsetX, streamOffsetX].forEach((sx) => {
      const streamPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(isInfernal ? 5.2 : 4.4, streamLen),
        isInfernal ? this.mats.lavaStream : this.mats.streamWater,
      );
      streamPlane.rotation.x = -Math.PI / 2;
      streamPlane.position.set(sx, streamY, -spec.lengthZ / 2 + 6);
      this.levelGroup.add(streamPlane);

      // Riverbank stones framing each stream
      [-2.45, 2.45].forEach((bankOff) => {
        const bank = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, isInfernal ? 0.85 : 0.65, streamLen),
          isInfernal ? this.mats.charredStone : this.mats.stoneTrim,
        );
        bank.position.set(sx + bankOff, streamY - 0.1, -spec.lengthZ / 2 + 6);
        bank.receiveShadow = true;
        this.levelGroup.add(bank);
      });
    });

    // Architectural stone balustrades (shattered/broken segments in infernal Levels 6 & 10)
    if (spec.parkour) {
      const { gapZStart, gapZEnd } = spec.parkour;
      const seg1Len = frontZ - gapZStart - 2;
      const seg2Len = gapZEnd - backZ - 2;
      [-spec.widthX / 2 + 0.35, spec.widthX / 2 - 0.35].forEach((x) => {
        const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.72, seg1Len), this.mats.stoneTrim);
        r1.position.set(x, 0.36, (frontZ + gapZStart) / 2);
        r1.castShadow = true;
        r1.receiveShadow = true;
        this.levelGroup.add(r1);

        const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.72, seg2Len), this.mats.stoneTrim);
        r2.position.set(x, 0.36, (gapZEnd + backZ) / 2);
        r2.castShadow = true;
        r2.receiveShadow = true;
        this.levelGroup.add(r2);
      });
    } else if (isInfernal) {
      // Broken, tilted, gapped perimeter wall fragments + scorched rubble chunks
      [-spec.widthX / 2 + 0.4, spec.widthX / 2 - 0.4].forEach((edgeX, sideIdx) => {
        for (let s = 0; s < 10; s++) {
          if ((s + sideIdx) % 3 === 1) continue; // Wide blown-out gaps in the walls
          const zSeg = 18 - s * 10.6;
          const segLen = 4.2 + ((s * 3) % 3) * 1.4;
          const segH = 0.45 + ((s + sideIdx) % 3) * 0.28;
          const wallFrag = new THREE.Mesh(
            new THREE.BoxGeometry(0.75, segH, segLen),
            this.mats.charredStone,
          );
          wallFrag.position.set(edgeX + (sideIdx === 0 ? -0.1 : 0.1), segH / 2 - 0.04, zSeg);
          wallFrag.rotation.z = (sideIdx === 0 ? 1 : -1) * (((s % 3) - 1) * 0.14);
          wallFrag.rotation.y = ((s % 2 === 0 ? 1 : -1) * 0.08);
          wallFrag.castShadow = true;
          wallFrag.receiveShadow = true;
          this.levelGroup.add(wallFrag);
        }
      });
    } else {
      const railGeo = new THREE.BoxGeometry(0.65, 0.72, frontZ - backZ - 4);
      [-spec.widthX / 2 + 0.35, spec.widthX / 2 - 0.35].forEach((x) => {
        const rail = new THREE.Mesh(railGeo, this.mats.stoneTrim);
        rail.position.set(x, 0.36, (frontZ + backZ) / 2);
        rail.castShadow = true;
        rail.receiveShadow = true;
        this.levelGroup.add(rail);
      });
    }

    // Ceremonial Arena Energy Ring around final Boss threshold
    const isBossArenaOnly = spec.index === 5 || spec.index === 9;
    const bossRingZ = isBossArenaOnly ? -26 : -spec.lengthZ + 18;
    const bossRingGeo = new THREE.RingGeometry(isBossArenaOnly ? 8.2 : 5.8, isBossArenaOnly ? 8.6 : 6.1, 42);
    bossRingGeo.rotateX(-Math.PI / 2);
    const bossRing = new THREE.Mesh(bossRingGeo, isInfernal ? this.mats.emberCrack : conduitMat);
    bossRing.position.set(0, 0.015, bossRingZ);
    this.levelGroup.add(bossRing);

    // Overhead Halo: shattered burning eclipse arcs in infernal Levels 6 & 10, intact halo in Act 5 & Act 9
    if (isInfernal) {
      const shardMat = new THREE.MeshBasicMaterial({
        color: spec.themeStyle === 'final_sanctum' ? 0xf97316 : 0xe12d39,
        transparent: true,
        opacity: 0.84,
      });
      [
        { arc: Math.PI * 0.62, rotZ: 0.25, tiltX: Math.PI / 2 - 0.28, y: 8.6 },
        { arc: Math.PI * 0.48, rotZ: 2.35, tiltX: Math.PI / 2 + 0.14, y: 7.5 },
        { arc: Math.PI * 0.42, rotZ: 4.35, tiltX: Math.PI / 2 - 0.42, y: 9.2 },
      ].forEach((s) => {
        const shard = new THREE.Mesh(
          new THREE.TorusGeometry(9.8, 0.22, 8, 22, s.arc),
          shardMat,
        );
        shard.position.set(0, s.y, bossRingZ);
        shard.rotation.set(s.tiltX, 0.18, s.rotZ);
        this.levelGroup.add(shard);
      });
    } else if (
      spec.themeStyle === 'astral_zenith' ||
      spec.themeStyle === 'crimson_citadel'
    ) {
      const skyHalo = new THREE.Mesh(
        new THREE.TorusGeometry(6.8, 0.16, 12, 48),
        new THREE.MeshBasicMaterial({
          color: spec.themeStyle === 'crimson_citadel' ? 0xe12d39 : 0x8b5cf6,
          transparent: true,
          opacity: 0.74,
        }),
      );
      skyHalo.position.set(0, 8.2, bossRingZ);
      skyHalo.rotation.x = Math.PI / 2 - 0.18;
      this.levelGroup.add(skyHalo);
    }

    // Neo-Torii Gates (shattered & ruined in infernal Levels 6 & 10)
    const toriiZs = isBossArenaOnly ? [2, -spec.lengthZ + 6] : [2, -36, -78, -spec.lengthZ + 6];
    toriiZs.forEach((z, i) => {
      const torii = isInfernal
        ? createRuinedToriiGate(this.mats, i === toriiZs.length - 1 ? 1.28 : 1.04, i)
        : createNeoToriiGate(this.mats, i === toriiZs.length - 1 ? 1.25 : 1.0, accentMat);
      torii.position.set(0, 0, z);
      this.levelGroup.add(torii);
    });

    // Architectural Pillars (shattered stumps + fallen broken drums & glowing craters in Levels 6 & 10)
    if (isInfernal) {
      const stumpCount = 16;
      const stumpGeo = new THREE.CylinderGeometry(0.28, 0.36, 2.2, 7);
      const stumpInst = new THREE.InstancedMesh(stumpGeo, this.mats.charredStone, stumpCount);
      stumpInst.castShadow = true;
      stumpInst.receiveShadow = true;

      const debrisCount = 26;
      const debrisGeo = new THREE.DodecahedronGeometry(0.65, 0);
      const debrisInst = new THREE.InstancedMesh(debrisGeo, this.mats.charredStone, debrisCount);
      debrisInst.castShadow = true;
      debrisInst.receiveShadow = true;

      let sIdx = 0;
      for (let i = 0; i < stumpCount / 2; i++) {
        const z = 6 - i * 11.2;
        [-spec.widthX / 2 + 1.8, spec.widthX / 2 - 1.8].forEach((x, side) => {
          const hScale = 0.48 + ((i * 5 + side * 3) % 5) * 0.22;
          _targetPos.set(x, hScale * 1.0, z);
          _euler.set(((i % 3) - 1) * 0.12, i * 0.8, (side === 0 ? -1 : 1) * (0.08 + (i % 2) * 0.1));
          _quat.setFromEuler(_euler);
          _scale.set(1.05, hScale, 1.05);
          _mat4.compose(_targetPos, _quat, _scale);
          stumpInst.setMatrixAt(sIdx++, _mat4);
        });
      }
      stumpInst.instanceMatrix.needsUpdate = true;
      stumpInst.computeBoundingSphere();
      this.levelGroup.add(stumpInst);

      // Fallen shattered rocks & rubble lining the devastated battlefield edges
      for (let i = 0; i < debrisCount; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const dx = side * (spec.widthX / 2 - 2.3 + ((i * 7) % 4) * 0.75);
        const dz = 10 - i * 3.4;
        const sc = 0.55 + ((i * 11) % 7) * 0.14;
        _targetPos.set(dx, sc * 0.32, dz);
        _euler.set(i * 0.7, i * 1.1, i * 0.5);
        _quat.setFromEuler(_euler);
        _scale.set(sc * 1.25, sc * 0.75, sc);
        _mat4.compose(_targetPos, _quat, _scale);
        debrisInst.setMatrixAt(i, _mat4);
      }
      debrisInst.instanceMatrix.needsUpdate = true;
      debrisInst.computeBoundingSphere();
      this.levelGroup.add(debrisInst);

      // Scorch blast craters with glowing magma centers along arena flanks
      const craterRingGeo = new THREE.RingGeometry(1.15, 1.75, 14);
      craterRingGeo.rotateX(-Math.PI / 2);
      const craterCoreGeo = new THREE.CircleGeometry(1.15, 12);
      craterCoreGeo.rotateX(-Math.PI / 2);
      [
        [-11.5, -10],
        [11.8, -18],
        [-12.2, -34],
        [11.5, -44],
        [-10.8, -56],
        [12.0, -62],
      ].forEach(([cx, cz]) => {
        const rim = new THREE.Mesh(craterRingGeo, this.mats.charredStone);
        rim.position.set(cx, 0.03, cz);
        this.levelGroup.add(rim);

        const core = new THREE.Mesh(craterCoreGeo, this.mats.emberCrack);
        core.position.set(cx, 0.02, cz);
        this.levelGroup.add(core);
      });
    } else {
      const pillarCount = 24;
      const pillarGeo = new THREE.CylinderGeometry(0.24, 0.32, 3.2, 8);
      const pillarInst = new THREE.InstancedMesh(pillarGeo, this.mats.brushedTitanium, pillarCount);
      pillarInst.castShadow = true;
      pillarInst.receiveShadow = true;
      let pIdx = 0;
      for (let i = 0; i < pillarCount / 2; i++) {
        const z = 4 - i * 11.5;
        [-spec.widthX / 2 + 1.5, spec.widthX / 2 - 1.5].forEach((x) => {
          _targetPos.set(x, 1.6, z);
          _quat.identity();
          const s = 0.92 + ((i * 7) % 5) * 0.04;
          _scale.set(s, s, s);
          _mat4.compose(_targetPos, _quat, _scale);
          pillarInst.setMatrixAt(pIdx++, _mat4);
        });
      }
      pillarInst.instanceMatrix.needsUpdate = true;
      pillarInst.computeBoundingSphere();
      this.levelGroup.add(pillarInst);
    }

    // Instanced Distant Mountain Peaks (jagged volcanic spires in Levels 6 & 10)
    const darkHorizon =
      isInfernal || spec.themeStyle === 'crimson_citadel';
    const peakCount = 28;
    const peakGeo = new THREE.ConeGeometry(isInfernal ? 15 : 18, isInfernal ? 50 : 44, isInfernal ? 5 : 6);
    const peakMat = new THREE.MeshStandardMaterial({
      color: isInfernal ? 0x260b10 : darkHorizon ? 0x2d2747 : 0xd1dce8,
      roughness: 0.92,
      metalness: 0.02,
    });
    const peakInst = new THREE.InstancedMesh(peakGeo, peakMat, peakCount);
    for (let i = 0; i < peakCount; i++) {
      const angle = (i / peakCount) * Math.PI * 2;
      const dist = 96 + (i % 4) * 24;
      _targetPos.set(
        Math.cos(angle) * dist,
        10 - (i % 3) * 4,
        -spec.lengthZ * 0.45 + Math.sin(angle) * dist,
      );
      _quat.setFromAxisAngle(_v1.set(0, 1, 0), i * 0.9);
      const sx = 0.8 + (i % 5) * 0.25;
      const sy = 0.7 + (i % 4) * 0.35;
      _scale.set(sx, sy, sx);
      _mat4.compose(_targetPos, _quat, _scale);
      peakInst.setMatrixAt(i, _mat4);
      const pColor = isInfernal
        ? i % 2 === 0
          ? 0x2f0e14
          : 0x1b070b
        : darkHorizon
          ? i % 2 === 0
            ? 0x312b4d
            : 0x241f3a
          : i % 2 === 0
            ? 0xd2dde8
            : 0xc6d4e3;
      _color.setHex(pColor);
      peakInst.setColorAt(i, _color);
    }
    peakInst.instanceMatrix.needsUpdate = true;
    peakInst.computeBoundingSphere();
    if (peakInst.instanceColor) peakInst.instanceColor.needsUpdate = true;
    this.levelGroup.add(peakInst);

    // Instanced Distant Trees (Dead charred skeletal trees in Levels 6 & 10, living trees elsewhere)
    if (isInfernal) {
      const deadTreeCount = this.isLowEndMode() ? 36 : 60;
      const deadTrunkGeo = new THREE.CylinderGeometry(0.16, 0.42, 4.6, 5);
      const deadBranchGeo = new THREE.CylinderGeometry(0.06, 0.14, 2.2, 5);
      const deadTrunkInst = new THREE.InstancedMesh(deadTrunkGeo, this.mats.charredStone, deadTreeCount);
      const deadBranchInst = new THREE.InstancedMesh(deadBranchGeo, this.mats.charredStone, deadTreeCount);
      for (let i = 0; i < deadTreeCount; i++) {
        let tx = 0;
        let tz = 0;
        if (i < deadTreeCount - 12) {
          const side = i % 2 === 0 ? -1 : 1;
          const lane = (i % 5) * 7.6;
          tx = side * (spec.widthX / 2 + 10.5 + lane + ((i * 11) % 5));
          tz = 16 - Math.floor(i / 2) * 5.2;
        } else {
          const j = i - (deadTreeCount - 12);
          tx = (j - 5.5) * 8.4;
          tz = -spec.lengthZ - 18 - (j % 4) * 7.5;
        }
        const sc = 0.8 + ((i * 13) % 8) * 0.11;
        _targetPos.set(tx, -1.85 + 2.0 * sc, tz);
        _euler.set(((i % 3) - 1) * 0.12, i * 1.1, ((i % 2 === 0 ? 1 : -1) * 0.14));
        _quat.setFromEuler(_euler);
        _scale.set(sc, sc, sc);
        _mat4.compose(_targetPos, _quat, _scale);
        deadTrunkInst.setMatrixAt(i, _mat4);

        _targetPos.set(tx + (i % 2 === 0 ? 0.45 : -0.45) * sc, -1.85 + 3.8 * sc, tz);
        _euler.set(0.35, i * 1.7, (i % 2 === 0 ? -0.75 : 0.75));
        _quat.setFromEuler(_euler);
        _scale.set(sc, sc, sc);
        _mat4.compose(_targetPos, _quat, _scale);
        deadBranchInst.setMatrixAt(i, _mat4);
      }
      deadTrunkInst.instanceMatrix.needsUpdate = true;
      deadTrunkInst.computeBoundingSphere();
      deadBranchInst.instanceMatrix.needsUpdate = true;
      deadBranchInst.computeBoundingSphere();
      this.levelGroup.add(deadTrunkInst, deadBranchInst);
    } else {
      const treeCount = this.isLowEndMode() ? 48 : 80;
      const trunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 4.4, 6);
      const canopyGeo = new THREE.DodecahedronGeometry(2.35, 0);
      const trunkInst = new THREE.InstancedMesh(trunkGeo, this.mats.treeBark, treeCount);
      const canopyInst = new THREE.InstancedMesh(canopyGeo, this.mats.treeCanopy, treeCount);
      for (let i = 0; i < treeCount; i++) {
        let tx = 0;
        let tz = 0;
        if (i < treeCount - 14) {
          const side = i % 2 === 0 ? -1 : 1;
          const lane = (i % 6) * 7.8;
          tx = side * (spec.widthX / 2 + 10.5 + lane + ((i * 13) % 5));
          tz = 18 - Math.floor(i / 2) * 5.8;
        } else {
          // Grove behind the boss temple horizon
          const j = i - (treeCount - 14);
          tx = (j - 6.5) * 8.5;
          tz = -spec.lengthZ - 22 - (j % 4) * 8.5;
        }
        const baseY =
          spec.themeStyle === 'jade_bridge'
            ? -3.8
            : spec.themeStyle === 'astral_zenith'
              ? -2.8
              : -1.85;
        const scale = 0.85 + ((i * 17) % 10) * 0.085;
        const yaw = (i * 1.17) % (Math.PI * 2);

        _targetPos.set(tx, baseY + 2.1 * scale, tz);
        _quat.setFromAxisAngle(_upAxis, yaw);
        _scale.set(scale, scale, scale);
        _mat4.compose(_targetPos, _quat, _scale);
        trunkInst.setMatrixAt(i, _mat4);

        _targetPos.set(tx, baseY + 4.9 * scale, tz);
        _scale.set(scale * 1.15, scale * 0.92, scale * 1.15);
        _mat4.compose(_targetPos, _quat, _scale);
        canopyInst.setMatrixAt(i, _mat4);

        let canopyHex = 0x5d9b79;
        if (spec.themeStyle === 'dawn_shrine') {
          canopyHex = i % 3 === 0 ? 0xf9a8d4 : i % 2 === 0 ? 0x6ba683 : 0x4f8a69;
        } else if (spec.themeStyle === 'jade_bridge') {
          canopyHex = i % 2 === 0 ? 0x2dd4bf : 0x0f766e;
        } else if (spec.themeStyle === 'white_citadel') {
          canopyHex = i % 3 === 0 ? 0xfda4af : i % 2 === 0 ? 0xf43f5e : 0x64748b;
        } else if (spec.themeStyle === 'obsidian_garden') {
          canopyHex = i % 2 === 0 ? 0x6366f1 : 0x4338ca;
        } else if (spec.themeStyle === 'astral_zenith') {
          canopyHex = i % 2 === 0 ? 0xa78bfa : 0x7c3aed;
        } else if (spec.themeStyle === 'crimson_citadel') {
          canopyHex = i % 2 === 0 ? 0xbe123c : 0x4c1d95;
        } else if (spec.themeStyle === 'ash_gorge') {
          canopyHex = i % 2 === 0 ? 0xd97706 : 0x78716c;
        } else if (spec.themeStyle === 'iron_bastion') {
          canopyHex = i % 2 === 0 ? 0x64748b : 0x334155;
        }
        _color.setHex(canopyHex);
        canopyInst.setColorAt(i, _color);
      }
      trunkInst.instanceMatrix.needsUpdate = true;
      trunkInst.computeBoundingSphere();
      canopyInst.instanceMatrix.needsUpdate = true;
      canopyInst.computeBoundingSphere();
      if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
      this.levelGroup.add(trunkInst, canopyInst);

      // Instanced Bamboo / Blossom Groves near the flanking stream banks
      if (spec.themeStyle !== 'jade_bridge' && spec.themeStyle !== 'astral_zenith') {
        const bambooCount = 44;
        const bambooGeo = new THREE.CylinderGeometry(0.11, 0.14, 7.5, 6);
        const bambooInst = new THREE.InstancedMesh(bambooGeo, this.mats.bambooStalk, bambooCount);
        for (let i = 0; i < bambooCount; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          const x = side * (spec.widthX / 2 + 8.6 + (i % 4) * 1.9);
          const z = 10 - Math.floor(i / 2) * 6.4;
          _targetPos.set(x, 2.2, z);
          _quat.setFromAxisAngle(_v1.set(0, 0, 1), side * 0.04 * ((i % 3) - 1));
          const sc = 0.85 + (i % 4) * 0.12;
          _scale.set(sc, sc, sc);
          _mat4.compose(_targetPos, _quat, _scale);
          bambooInst.setMatrixAt(i, _mat4);
          const cHex =
            spec.themeStyle === 'crimson_citadel'
              ? 0x4c1d95
              : spec.themeStyle === 'ash_gorge'
                ? 0x78716c
                : spec.themeStyle === 'obsidian_garden' || spec.themeStyle === 'iron_bastion'
                  ? i % 3 === 0
                    ? 0x6366f1
                    : 0x475569
                  : i % 3 === 0
                    ? 0x76b093
                    : 0x629b7e;
          _color.setHex(cHex);
          bambooInst.setColorAt(i, _color);
        }
        bambooInst.instanceMatrix.needsUpdate = true;
        bambooInst.computeBoundingSphere();
        this.levelGroup.add(bambooInst);
      }
    }

    // Floating Wind / Blossom Petals OR Rising Volcanic Embers in Infernal Levels
    this.petalCount = this.isLowEndMode() ? 36 : 72;
    const petalGeo = new THREE.PlaneGeometry(isInfernal ? 0.13 : 0.14, isInfernal ? 0.13 : 0.09);
    const petalColor =
      isInfernal
        ? spec.themeStyle === 'final_sanctum'
          ? 0xfb923c
          : 0xf43f5e
        : spec.themeStyle === 'white_citadel' || spec.themeStyle === 'crimson_citadel'
          ? 0xfda4af
          : spec.themeStyle === 'ash_gorge'
            ? 0xfcd34d
            : spec.themeStyle === 'obsidian_garden'
              ? 0xc7d2fe
              : spec.themeStyle === 'astral_zenith'
                ? 0xddd6fe
                : 0xffffff;
    const petalMat = new THREE.MeshBasicMaterial({
      color: petalColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: isInfernal ? 0.9 : 0.75,
    });
    this.petalInstanced = new THREE.InstancedMesh(petalGeo, petalMat, this.petalCount);
    this.petalInstanced.frustumCulled = false;
    this.petalData = new Float32Array(this.petalCount * 4);
    for (let i = 0; i < this.petalCount; i++) {
      this.petalData[i * 4 + 0] = (Math.random() - 0.5) * spec.widthX;
      this.petalData[i * 4 + 1] = 0.4 + Math.random() * 6.8;
      this.petalData[i * 4 + 2] = 10 - Math.random() * spec.lengthZ;
      this.petalData[i * 4 + 3] = Math.random() * Math.PI * 2;
    }
    this.levelGroup.add(this.petalInstanced);
  }

  private spawnWave(waveIndex: number): void {
    const spec = LEVELS[this.currentLevelIndex];
    const wave = spec.waves[waveIndex];
    if (!wave || this.wavesTriggered[waveIndex]) return;

    this.wavesTriggered[waveIndex] = true;
    if (wave.storyLine) {
      this.storySubtitle = wave.storyLine;
      this.storyTimer = 5.5;
    }

    wave.enemies.forEach((eSpec) => {
      const rig = createEnemySamuraiRig(this.mats, eSpec.archetype, Boolean(eSpec.isBoss));
      const isUltimateBoss = (eSpec.phases ?? 1) >= 3;
      if (isUltimateBoss) {
        rig.root.scale.setScalar(1.16);
      }
      const pos = new THREE.Vector3(eSpec.position[0], eSpec.position[1], eSpec.position[2]);
      rig.root.position.copy(pos);
      this.actorGroup.add(rig.root);

      this.enemies.push({
        spec: eSpec,
        rig,
        pos,
        vel: new THREE.Vector3(),
        knockbackVel: new THREE.Vector3(),
        yaw: 0,
        hp: eSpec.maxHp,
        maxHp: eSpec.maxHp,
        posture: 0,
        maxPosture: eSpec.maxPosture,
        currentPhase: 1,
        totalPhases: eSpec.phases ?? 1,
        state: 'chase',
        stateTimer: 0.32,
        windupDuration: 0.45,
        telegraph: 'none',
        hasStruckThisSwing: false,
        attackCooldown: isUltimateBoss ? 0.35 : 0.55 + Math.random() * 0.45,
        magicCooldown: eSpec.isMagicBoss ? (isUltimateBoss ? 1.6 : 2.4) : 999,
        bowCooldown: eSpec.canBow ? (isUltimateBoss ? 1.4 : 2.2) : 999,
        bombCooldown: eSpec.canBombs ? (isUltimateBoss ? 2.2 : 3.8) : 999,
        magicKind: 'none',
        strafeDir: Math.random() < 0.5 ? 1 : -1,
        stepTimer: 0,
        deadTimer: 0,
        waveIndex,
        comboRemaining: 0,
        isGuarding: false,
        guardTimer: 0,
        dodgeCooldown: 0,
        hitStreak: 0,
        hitFlashTimer: 0,
      });
    });

    // Auto lock-on to first enemy if none locked
    if (!this.lockedEnemyId && this.enemies.length > 0) {
      this.lockedEnemyId = this.enemies[0].spec.id;
    }
  }

  private pushFeedback(label: string, kind: CombatFeedback['kind']): void {
    this.feedbackCounter += 1;
    this.feedback = { id: this.feedbackCounter, label, kind };
    this.feedbackTimer = 1.65;
  }

  private spawnSparks(origin: THREE.Vector3, count: number, colorHex: number): void {
    let spawned = 0;
    for (let i = 0; i < this.sparkPool.length && spawned < count; i++) {
      const p = this.sparkPool[i];
      if (!p.active) {
        p.active = true;
        p.pos.copy(origin);
        p.vel.set(
          (Math.random() - 0.5) * 11,
          2.6 + Math.random() * 6.5,
          (Math.random() - 0.5) * 11,
        );
        p.maxLife = 0.22 + Math.random() * 0.18;
        p.life = p.maxLife;
        p.colorHex = colorHex;
        spawned++;
      }
    }
  }

  private spawnShockwave(origin: THREE.Vector3, colorHex: number, maxScale = 3.2, maxLife = 0.32): void {
    for (let i = 0; i < this.shockwavePool.length; i++) {
      const sw = this.shockwavePool[i];
      if (!sw.active) {
        sw.active = true;
        sw.life = maxLife;
        sw.maxLife = maxLife;
        sw.maxScale = maxScale;
        sw.mat.color.setHex(colorHex);
        sw.mat.opacity = 0.85;
        sw.mesh.position.set(origin.x, Math.max(0.06, origin.y), origin.z);
        sw.mesh.scale.setScalar(0.55);
        sw.mesh.visible = true;
        return;
      }
    }
  }

  private spawnCrossSlashProjectile(): void {
    const group = new THREE.Group();
    const crimsonMat = new THREE.MeshBasicMaterial({
      color: 0xe12d39,
      transparent: true,
      opacity: 0.92,
    });
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });

    const bladeA = new THREE.Mesh(this.crossBladeGeo, crimsonMat);
    bladeA.rotation.z = Math.PI / 4;
    const coreA = new THREE.Mesh(this.crossCoreGeo, coreMat);
    coreA.rotation.z = Math.PI / 4;

    const bladeB = new THREE.Mesh(this.crossBladeGeo, crimsonMat);
    bladeB.rotation.z = -Math.PI / 4;
    const coreB = new THREE.Mesh(this.crossCoreGeo, coreMat);
    coreB.rotation.z = -Math.PI / 4;

    group.add(bladeA, coreA, bladeB, coreB);

    const fwdX = -Math.sin(this.playerYaw);
    const fwdZ = -Math.cos(this.playerYaw);
    const startPos = new THREE.Vector3(
      this.playerPos.x + fwdX * 0.65,
      1.18,
      this.playerPos.z + fwdZ * 0.65,
    );
    group.position.copy(startPos);
    group.rotation.y = this.playerYaw;
    this.vfxGroup.add(group);

    this.crossProjectiles.push({
      group,
      pos: startPos,
      dir: new THREE.Vector3(fwdX, 0, fwdZ).normalize(),
      distTraveled: 0,
      maxDist: 5.5,
      speed: 19.0,
      hitIds: new Set<string>(),
    });

    _v2.set(startPos.x, 0.1, startPos.z);
    this.spawnShockwave(_v2, 0xe12d39, 4.4, 0.38);
    this.audio.playSpatial('cross_slash', startPos, 1.2);
    this.camShake = Math.max(this.camShake, 0.22);
    this.camFov = 58.5;
  }

  private spawnMagicBolts(owner: ActiveEnemy): void {
    const baseDx = this.playerPos.x - owner.pos.x;
    const baseDz = this.playerPos.z - owner.pos.z;
    const baseYaw = Math.atan2(baseDx, baseDz);
    const isUltimateBoss = owner.totalPhases >= 3;
    const angles =
      isUltimateBoss && owner.currentPhase >= 2
        ? [-0.46, -0.23, 0, 0.23, 0.46]
        : [-0.26, 0, 0.26];

    for (const offset of angles) {
      const ang = baseYaw + offset;
      const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)).normalize();
      const pos = new THREE.Vector3(
        owner.pos.x + dir.x * 0.9,
        1.25,
        owner.pos.z + dir.z * 0.9,
      );

      const coreMat = new THREE.MeshBasicMaterial({ color: 0xddd6fe });
      const haloMat = new THREE.MeshBasicMaterial({
        color: isUltimateBoss ? 0xe12d39 : 0x8b5cf6,
        transparent: true,
        opacity: 0.85,
      });
      const group = new THREE.Group();
      const coreMesh = new THREE.Mesh(this.orbCoreGeo, coreMat);
      const haloMesh = new THREE.Mesh(this.orbHaloGeo, haloMat);
      group.add(coreMesh, haloMesh);
      group.position.copy(pos);
      this.vfxGroup.add(group);

      this.magicOrbs.push({
        group,
        coreMat,
        haloMat,
        pos,
        dir,
        speed: isUltimateBoss ? 13.4 : 11.4,
        damage: isUltimateBoss ? 26 : 22,
        life: 3.5,
        reflected: false,
        owner,
      });
    }

    _v2.copy(owner.pos).setY(1.25);
    this.spawnSparks(_v2, 14, isUltimateBoss ? 0xe12d39 : 0x8b5cf6);
    this.spawnShockwave(owner.pos, isUltimateBoss ? 0xe12d39 : 0x8b5cf6, 2.8, 0.28);
    this.pushFeedback('SFERE ARCANE · PARATA PERFETTA PER DEVIARE!', 'story');
  }

  private spawnMeteorShower(owner: ActiveEnemy): void {
    const spec = LEVELS[this.currentLevelIndex];
    const halfW = spec.widthX / 2 - 1.5;
    const minZ = -spec.lengthZ + 8;
    const maxZ = 10;
    const isUltimateBoss = owner.totalPhases >= 3;

    // 1 meteor directly on player + surrounding tactical cluster (denser on Level 10 boss)
    const offsets: [number, number][] = [
      [0, 0],
      [3.8, -3.2],
      [-3.8, -3.0],
      [3.4, 3.6],
      [-3.6, 3.4],
    ];
    if (isUltimateBoss) {
      offsets.push([0, -5.2], [5.2, 0.4]);
      if (owner.currentPhase >= 3) {
        offsets.push([-5.2, 0.2]);
      }
    }

    for (let i = 0; i < offsets.length; i++) {
      const [ox, oz] = offsets[i];
      const tx = THREE.MathUtils.clamp(
        this.playerPos.x + ox + (i === 0 ? 0 : (Math.random() - 0.5) * 1.8),
        -halfW,
        halfW,
      );
      const tz = THREE.MathUtils.clamp(
        this.playerPos.z + oz + (i === 0 ? 0 : (Math.random() - 0.5) * 1.8),
        minZ,
        maxZ,
      );
      const targetPos = new THREE.Vector3(tx, 0, tz);
      const radius = isUltimateBoss ? 2.65 : 2.4;

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(this.meteorRingGeo, ringMat);
      ringMesh.position.set(tx, 0.055, tz);
      ringMesh.scale.setScalar(radius);

      const fillMat = new THREE.MeshBasicMaterial({
        color: 0xe12d39,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      });
      const fillMesh = new THREE.Mesh(this.meteorFillGeo, fillMat);
      fillMesh.position.set(tx, 0.038, tz);
      fillMesh.scale.setScalar(0.15);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const beamMesh = new THREE.Mesh(this.meteorBeamGeo, beamMat);
      beamMesh.position.set(tx, 13, tz);

      const rockMat = new THREE.MeshStandardMaterial({
        color: 0x451a03,
        emissive: 0xea580c,
        emissiveIntensity: 1.8,
        roughness: 0.5,
      });
      const rockMesh = new THREE.Mesh(this.meteorRockGeo, rockMat);
      rockMesh.position.set(tx, 26, tz);

      this.vfxGroup.add(ringMesh, fillMesh, beamMesh, rockMesh);
      const fallDur = isUltimateBoss && owner.currentPhase >= 2 ? 1.45 : 1.65;
      this.meteors.push({
        targetPos,
        ringMesh,
        ringMat,
        fillMesh,
        fillMat,
        beamMesh,
        beamMat,
        rockMesh,
        rockMat,
        timer: fallDur,
        duration: fallDur,
        radius,
        damage: isUltimateBoss ? 38 : 32,
      });
    }

    this.audio.playSpatial('meteor_whistle', this.playerPos, 1.2);
    this.spawnShockwave(owner.pos, 0xf97316, 3.6, 0.35);
    this.pushFeedback('PIOGGIA DI METEORE · ESCI DAI CERCHI ROSSI!', 'story');
  }

  private spawnBossBowVolley(owner: ActiveEnemy): void {
    const baseDx = this.playerPos.x - owner.pos.x;
    const baseDz = this.playerPos.z - owner.pos.z;
    const baseYaw = Math.atan2(baseDx, baseDz);
    const isUltimateBoss = owner.totalPhases >= 3;
    const offsets = isUltimateBoss
      ? owner.currentPhase >= 2
        ? [-0.28, -0.14, 0, 0.14, 0.28]
        : [-0.2, 0, 0.2]
      : owner.currentPhase >= 2
        ? [-0.2, 0, 0.2]
        : [-0.1, 0.1];

    for (const offset of offsets) {
      const ang = baseYaw + offset;
      const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)).normalize();
      const pos = new THREE.Vector3(
        owner.pos.x + dir.x * 1.0,
        owner.pos.y + 1.28,
        owner.pos.z + dir.z * 1.0,
      );

      const coreMat = new THREE.MeshBasicMaterial({
        color: isUltimateBoss || owner.currentPhase >= 2 ? 0xf43f5e : 0xfbbf24,
      });
      const group = new THREE.Group();
      const shaft = new THREE.Mesh(this.arrowShaftGeo, coreMat);
      const head = new THREE.Mesh(this.arrowHeadGeo, coreMat);
      head.position.z = 0.65;
      group.add(shaft, head);
      group.position.copy(pos);
      group.rotation.y = ang;
      this.vfxGroup.add(group);

      this.bossArrows.push({
        group,
        coreMat,
        pos,
        dir,
        speed: isUltimateBoss ? 25.0 : 22.0,
        damage: isUltimateBoss ? 28 : 24,
        life: 2.8,
        reflected: false,
        owner,
      });
    }

    _v2.copy(owner.pos).setY(1.3);
    this.spawnSparks(_v2, 12, 0xfbbf24);
    this.audio.playSpatial('bow_shot', owner.pos, 1.2);
    this.pushFeedback(
      isUltimateBoss ? 'RAFFICA DELL\'OMBRA · PARA O SALTA!' : 'ARCO DELL\'ECLISSI · PARA O SALTA!',
      'story',
    );
  }

  private spawnBossBombs(owner: ActiveEnemy): void {
    const spec = LEVELS[this.currentLevelIndex];
    const halfW = spec.widthX / 2 - 1.8;
    const minZ = -spec.lengthZ + 8;
    const maxZ = 10;
    const isUltimateBoss = owner.totalPhases >= 3;

    const count = isUltimateBoss
      ? owner.currentPhase >= 2
        ? 6
        : 5
      : owner.currentPhase >= 2
        ? 4
        : 3;
    for (let i = 0; i < count; i++) {
      const spreadX = i === 0 ? 0 : (Math.random() - 0.5) * 9.5;
      const spreadZ = i === 0 ? 0 : (Math.random() - 0.5) * 9.5;
      const tx = THREE.MathUtils.clamp(this.playerPos.x + spreadX, -halfW, halfW);
      const tz = THREE.MathUtils.clamp(this.playerPos.z + spreadZ, minZ, maxZ);

      const startPos = new THREE.Vector3(owner.pos.x, owner.pos.y + 1.45, owner.pos.z);
      const targetPos = new THREE.Vector3(tx, 0, tz);
      const radius = isUltimateBoss ? 2.95 : 2.65;

      const bombMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: 0xe12d39,
        emissiveIntensity: 1.4,
        roughness: 0.3,
        metalness: 0.7,
      });
      const mesh = new THREE.Mesh(this.bombSphereGeo, bombMat);
      mesh.position.copy(startPos);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(this.meteorRingGeo, ringMat);
      ringMesh.position.set(tx, 0.055, tz);
      ringMesh.scale.setScalar(radius);

      const fillMat = new THREE.MeshBasicMaterial({
        color: 0xe12d39,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      });
      const fillMesh = new THREE.Mesh(this.meteorFillGeo, fillMat);
      fillMesh.position.set(tx, 0.04, tz);
      fillMesh.scale.setScalar(0.15);

      this.vfxGroup.add(mesh, ringMesh, fillMesh);
      const fuseDur = isUltimateBoss && owner.currentPhase >= 2 ? 1.1 : 1.25;
      this.bossBombs.push({
        mesh,
        bombMat,
        ringMesh,
        ringMat,
        fillMesh,
        fillMat,
        startPos,
        targetPos,
        flightTimer: 0,
        flightDuration: 0.62,
        fuseTimer: fuseDur,
        fuseDuration: fuseDur,
        radius,
        damage: isUltimateBoss ? 36 : 30,
      });
    }

    this.audio.playSpatial('bomb_throw', owner.pos, 1.1);
    this.pushFeedback('BOMBE ESPLOSIVE · ALLONTANATI DALL\'AREA!', 'story');
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      if (rawDt > 0.001) {
        this.fpsSamples = THREE.MathUtils.lerp(this.fpsSamples, 1 / rawDt, 0.12);
      }

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number): void {
    this.elapsed += dt;
    // Animate flowing streams & molten lava cleanly
    this.mats.streamWaterTex.offset.y -= dt * 0.45;
    this.mats.lavaStreamTex.offset.y -= dt * 0.28;
    if (this.isInfernalLevel && this.infernoLight) {
      this.infernoLight.intensity = 20 + Math.sin(this.elapsed * 5.2) * 3.5;
    }

    const inp = this.input.poll(dt);
    this.lastInputSnap = inp;

    if (inp.pausePressed) {
      if (this.screenMode === 'playing') {
        this.setScreenMode('paused');
        this.callbacks.onScreenChange('paused');
      } else if (this.screenMode === 'paused') {
        this.setScreenMode('playing');
        this.callbacks.onScreenChange('playing');
      }
    }

    if (this.screenMode === 'menu') {
      this.updateMenuCamera(dt);
      this.animateSamuraiIdle(this.heroRig, this.elapsed);
      this.animateCheckpoints(dt);
      this.updatePetals(dt);
      this.audio.updateListener(this.camera);
      this.hudEmitAccum += dt;
      if (this.hudEmitAccum > 0.25) {
        this.hudEmitAccum = 0;
        this.emitHud();
      }
      return;
    }

    if (this.screenMode === 'defeat') {
      // Keep dramatic samurai collapse, falling sparks/petals, and camera settle active during Game Over fade
      this.animateHeroRig(dt);
      this.updateSparks(dt);
      this.animateCheckpoints(dt);
      this.updatePetals(dt);
      this.updateCamera(dt, inp);
      return;
    }

    if (this.screenMode !== 'playing') {
      this.animateCheckpoints(dt);
      this.updatePetals(dt);
      return;
    }

    // Brief tactile hit-stop on perfect parries & finishers
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      this.updateSparks(dt);
      this.updateCamera(dt, inp);
      return;
    }

    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) this.feedback = null;
    }
    if (this.storyTimer > 0) {
      this.storyTimer -= dt;
      if (this.storyTimer <= 0) this.storySubtitle = null;
    }

    // Time Slow ability (4s duration, 30s cooldown)
    if (this.timeSlowTimer > 0) {
      this.timeSlowTimer = Math.max(0, this.timeSlowTimer - dt);
    }
    if (this.timeSlowCooldown > 0) {
      this.timeSlowCooldown = Math.max(0, this.timeSlowCooldown - dt);
    }
    if (
      inp.timeSlowPressed &&
      this.timeSlowUnlocked &&
      this.timeSlowTimer <= 0 &&
      this.timeSlowCooldown <= 0
    ) {
      this.timeSlowTimer = 4.0;
      this.timeSlowCooldown = 30.0;
      this.audio.playSpatial('time_slow', this.playerPos);
      this.spawnShockwave(this.playerPos, 0x38bdf8, 6.4, 0.42);
      this.camFov = 51.2;
      this.pushFeedback('CRONOSTASI ATTIVA · TEMPO RALLENTATO (4s)', 'chrono');
    }

    const worldDt = this.timeSlowTimer > 0 ? dt * 0.25 : dt;

    this.updatePlayer(dt, inp);
    this.updateWavesAndCheckpoints();
    this.animateCheckpoints(dt);
    this.updateEnemies(worldDt);
    this.updateVfx(worldDt, dt);
    this.updatePetals(worldDt);
    this.updateCamera(dt, inp);
    this.audio.updateListener(this.camera);

    // Keep shadow frustum tight around player
    this.dirLight.position.set(this.playerPos.x + 14, 24, this.playerPos.z + 12);
    this.dirLight.target.position.copy(this.playerPos);

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.065) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateMenuCamera(dt: number): void {
    const angle = this.elapsed * 0.22;
    const radius = 4.2;
    // Offset look-at slightly left of the Samurai so Samurai renders cleanly on the right side of the Start Menu!
    _lookTarget.set(this.playerPos.x - 1.15, 1.28, this.playerPos.z);
    _targetPos.set(
      this.playerPos.x - 0.65 + Math.sin(angle) * radius * 0.35,
      1.85 + Math.sin(this.elapsed * 0.5) * 0.08,
      this.playerPos.z - 3.6,
    );
    this.camCurrentPos.x = THREE.MathUtils.damp(this.camCurrentPos.x, _targetPos.x, 4, dt);
    this.camCurrentPos.y = THREE.MathUtils.damp(this.camCurrentPos.y, _targetPos.y, 4, dt);
    this.camCurrentPos.z = THREE.MathUtils.damp(this.camCurrentPos.z, _targetPos.z, 4, dt);
    this.camLookCurrent.lerp(_lookTarget, 1 - Math.exp(-5 * dt));

    this.camera.position.copy(this.camCurrentPos);
    this.camera.lookAt(this.camLookCurrent);
  }

  private updatePlayer(dt: number, inp: UnifiedInput): void {
    const spec = LEVELS[this.currentLevelIndex];

    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.parryWindowTimer > 0) this.parryWindowTimer -= dt;
    if (this.postParryTimer > 0) this.postParryTimer -= dt;
    if (this.postDodgeTimer > 0) this.postDodgeTimer -= dt;
    if (this.bowCooldown > 0) this.bowCooldown = Math.max(0, this.bowCooldown - dt);
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) {
        this.comboStep = 0;
        this.heavyOpenerStep = 0;
        this.heavyChainStage = 0;
      }
    }

    // Passive stamina & posture recovery when not blocking/attacking
    if (this.playerState === 'idle' || this.playerState === 'move') {
      this.playerStamina = Math.min(this.playerMaxStamina, this.playerStamina + 28 * dt);
      this.playerPosture = Math.max(0, this.playerPosture - 16 * dt);
    } else if (this.playerState === 'block') {
      this.playerPosture = Math.max(0, this.playerPosture - 5 * dt);
    }

    // Lock-on toggle
    if (inp.lockOnPressed) {
      this.toggleLockOn();
    }

    // Validate locked enemy
    const lockedEnemy = this.getLockedEnemy();
    if (this.lockedEnemyId && !lockedEnemy) {
      this.lockedEnemyId = null;
    }

    // Handle action timers & buffering
    if (this.playerState === 'attack') {
      this.actionTimer += dt;
      const tNorm = this.actionTimer / this.actionDuration;

      // Smooth forward strike lunge during initial swing
      if (tNorm < 0.45 && this.attackLungeSpeed > 0) {
        _v1.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
        this.playerPos.addScaledVector(_v1, this.attackLungeSpeed * dt);
      }

      // Active hit window (or straight arrow release if bow_shot)
      if (!this.hasHitThisAttack && tNorm >= 0.24 && tNorm <= 0.65) {
        this.hasHitThisAttack = true;
        if (this.attackVariant === 'bow_shot') {
          this.spawnHeroArrow();
        } else {
          this.performPlayerStrikeHitbox();
        }
      }

      // Buffer next combo / dodge input during active/recovery phase
      if (tNorm >= 0.3 && this.attackVariant !== 'bow_shot') {
        if (inp.dodgePressed) this.bufferedAction = 'dodge';
        else if (inp.heavyAttackPressed) this.bufferedAction = 'heavy';
        else if (inp.lightAttackPressed) this.bufferedAction = 'light';
      }

      // Responsive recovery cancel into Block/Parry or buffered Dodge/Combo
      if (tNorm >= 0.6 && inp.blockHeld && inp.parryJustPressed) {
        this.bufferedAction = null;
        this.parryWindowTimer = 0.24;
        this.playerState = 'block';
      } else if (tNorm >= 0.72 && this.bufferedAction) {
        const next = this.bufferedAction;
        this.bufferedAction = null;
        if (next === 'dodge' && this.playerStamina >= 18) {
          this.startPlayerDodge(inp);
        } else if (next === 'heavy' && this.playerStamina >= 22) {
          this.startPlayerAttack('heavy', inp);
        } else if (next === 'light') {
          this.startPlayerAttack('light', inp);
        }
      } else if (this.actionTimer >= this.actionDuration) {
        this.playerState = 'idle';
        this.bufferedAction = null;
      }
    } else if (this.playerState === 'dodge') {
      this.actionTimer += dt;
      this.playerPos.addScaledVector(this.dodgeDir, 11.8 * dt);
      if (this.actionTimer >= this.actionDuration) {
        this.playerState = 'idle';
      }
    } else if (this.playerState === 'stagger') {
      this.actionTimer += dt;
      if (this.actionTimer >= this.actionDuration) {
        this.playerState = 'idle';
        this.playerPosture = 35;
      }
    }

    // Transitions from neutral/block states (and mid-air steering/attacks!)
    const canAct =
      this.playerState === 'idle' ||
      this.playerState === 'move' ||
      this.playerState === 'block';

    // Jump trigger (works while grounded in neutral/move/block)
    if (inp.jumpPressed && this.isGrounded && this.playerState !== 'dead' && this.playerState !== 'stagger') {
      this.playerVelY = 9.75;
      this.isGrounded = false;
      if (this.playerState === 'block') this.playerState = 'move';
      this.audio.playSpatial('jump', this.playerPos);
      _v2.set(this.playerPos.x, this.playerPos.y + 0.08, this.playerPos.z);
      this.spawnShockwave(_v2, 0x94a3b8, 1.8, 0.2);
    }

    if (canAct) {
      if (inp.bowPressed && this.bowUnlocked && this.bowCooldown <= 0) {
        this.startHeroBowShot(inp);
      } else if (inp.dodgePressed && this.playerStamina >= 18) {
        this.startPlayerDodge(inp);
      } else if (inp.heavyAttackPressed && this.playerStamina >= 22) {
        this.startPlayerAttack('heavy', inp);
      } else if (inp.lightAttackPressed) {
        this.startPlayerAttack('light', inp);
      } else if (inp.blockHeld && this.isGrounded) {
        if (this.playerState !== 'block' || inp.parryJustPressed) {
          this.parryWindowTimer = 0.24; // Crisp 240ms deflect window
        }
        this.playerState = 'block';
      } else {
        // Camera-relative movement (works on ground and mid-air during parkour jumps!)
        const moveMag = Math.hypot(inp.moveX, inp.moveY);
        if (moveMag > 0.08) {
          this.playerState = 'move';
          this.computeMoveWorldDir(inp, _v1);

          const moveSpeed = this.isGrounded ? 7.0 : 6.5;
          this.playerPos.addScaledVector(_v1, moveSpeed * dt);

          const targetYaw = Math.atan2(-_v1.x, -_v1.z);
          this.playerYaw = this.dampAngle(this.playerYaw, targetYaw, 16, dt);

          if (this.isGrounded) {
            this.playerStepTimer -= dt;
            if (this.playerStepTimer <= 0) {
              this.playerStepTimer = 0.34;
              this.audio.playSpatial('footstep', this.playerPos, 0.8);
            }
          }
        } else {
          this.playerState = 'idle';
        }
      }
    }

    // Face locked enemy smoothly when blocking or attacking
    if (lockedEnemy && (this.playerState === 'block' || this.playerState === 'attack')) {
      _v2.subVectors(lockedEnemy.pos, this.playerPos);
      const faceYaw = Math.atan2(-_v2.x, -_v2.z);
      this.playerYaw = this.dampAngle(this.playerYaw, faceYaw, 20, dt);
    }

    // Soft actor-to-actor separation so player and enemies never overlap inside each other
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      _v2.subVectors(this.playerPos, enemy.pos);
      _v2.y = 0;
      const d = _v2.length();
      const minSep = enemy.spec.isBoss ? 1.25 : 1.05;
      if (d > 0.001 && d < minSep && Math.abs(this.playerPos.y - enemy.pos.y) < 1.6) {
        _v2.multiplyScalar((minSep - d) / d);
        this.playerPos.addScaledVector(_v2, 0.65);
        enemy.pos.addScaledVector(_v2, -0.35);
      }
    }

    // Apply decaying physical knockback impulse on player
    if (this.playerKnockbackVel.lengthSq() > 0.002) {
      this.playerPos.addScaledVector(this.playerKnockbackVel, dt);
      this.playerKnockbackVel.multiplyScalar(Math.exp(-9.5 * dt));
    } else {
      this.playerKnockbackVel.set(0, 0, 0);
    }

    // Clamp player within level X/Z bounds before vertical collision check
    const halfW = spec.widthX / 2 - 1.3;
    this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -halfW, halfW);
    this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, -spec.lengthZ + 6, 12);

    // Vertical physics: gravity + parkour platform landings + stream chasm recovery
    const prevY = this.playerPos.y;
    this.playerVelY -= 23.8 * dt;
    this.playerPos.y += this.playerVelY * dt;

    const supportY = this.getSupportHeightAt(this.playerPos.x, this.playerPos.z, prevY);
    if (supportY !== null && this.playerPos.y <= supportY && this.playerVelY <= 0) {
      if (!this.isGrounded && this.playerVelY < -4.5) {
        this.audio.playSpatial('land', this.playerPos, 0.9);
      }
      this.playerPos.y = supportY;
      this.playerVelY = 0;
      this.isGrounded = true;

      // Save safe solid floor position away from chasm lips so falls always respawn safely
      if (
        Math.abs(supportY) < 0.05 &&
        (!this.parkourGap ||
          this.playerPos.z > this.parkourGap.zMax + 1.2 ||
          this.playerPos.z < this.parkourGap.zMin - 1.2)
      ) {
        this.lastSafePos.copy(this.playerPos);
      }
    } else if (supportY === null || this.playerPos.y > supportY + 0.05) {
      this.isGrounded = false;
    }

    // Recover gracefully if fallen into stream/chasm beneath parkour
    if (this.playerPos.y < -3.4) {
      this.playerPos.copy(this.lastSafePos);
      this.playerVelY = 0;
      this.isGrounded = true;
      this.playerKnockbackVel.set(0, 0, 0);
      this.playerHp = Math.max(0, this.playerHp - 10);
      this.audio.playSpatial('hit_flesh', this.playerPos, 0.8);
      this.pushFeedback('CADUTA NEL TORRENTE · -10 HP', 'damage');
      if (this.playerHp <= 0) {
        this.handlePlayerDeath();
      }
    }

    // Sync hero rig transform & pose
    this.heroRig.root.position.copy(this.playerPos);
    this.heroRig.root.rotation.y = this.playerYaw;
    this.animateHeroRig(dt);
  }

  private getSupportHeightAt(x: number, z: number, prevY: number): number | null {
    let bestY: number | null = null;

    // Main floor segments (outside mid-level parkour chasm)
    const inGap =
      this.parkourGap !== null && z <= this.parkourGap.zMax && z >= this.parkourGap.zMin;
    if (!inGap) {
      bestY = 0;
    }

    // Elevated parkour platforms & bridges
    for (let i = 0; i < this.parkourColliders.length; i++) {
      const p = this.parkourColliders[i];
      if (
        x >= p.minX - 0.28 &&
        x <= p.maxX + 0.28 &&
        z >= p.minZ - 0.28 &&
        z <= p.maxZ + 0.28 &&
        prevY >= p.topY - 0.42
      ) {
        if (bestY === null || p.topY > bestY) {
          bestY = p.topY;
        }
      }
    }

    return bestY;
  }

  private computeMoveWorldDir(inp: UnifiedInput, out: THREE.Vector3): void {
    this.camera.getWorldDirection(_camFwd);
    _camFwd.y = 0;
    if (_camFwd.lengthSq() < 0.001) _camFwd.set(0, 0, -1);
    _camFwd.normalize();
    _camRight.set(-_camFwd.z, 0, _camFwd.x);

    out
      .set(0, 0, 0)
      .addScaledVector(_camRight, inp.moveX)
      .addScaledVector(_camFwd, -inp.moveY)
      .normalize();
  }

  private startPlayerAttack(kind: 'light' | 'heavy', inp: UnifiedInput): void {
    this.playerState = 'attack';
    this.attackKind = kind;
    this.actionTimer = 0;
    this.hasHitThisAttack = false;
    this.bufferedAction = null;

    // Determine exact strike direction:
    // 1) Locked enemy -> face enemy
    // 2) Active directional input -> turn to strike in movement direction
    // 3) Standing neutral -> soft-assist toward closest enemy in camera front, else camera forward
    const locked = this.getLockedEnemy();
    const moveMag = Math.hypot(inp.moveX, inp.moveY);

    if (locked) {
      _v1.subVectors(locked.pos, this.playerPos);
      _v1.y = 0;
      if (_v1.lengthSq() > 0.001) {
        this.playerYaw = Math.atan2(-_v1.x, -_v1.z);
      }
    } else if (moveMag > 0.12) {
      this.computeMoveWorldDir(inp, _v1);
      this.playerYaw = Math.atan2(-_v1.x, -_v1.z);
    } else {
      const camFwdX = -Math.sin(this.camYaw);
      const camFwdZ = -Math.cos(this.camYaw);
      let assistTarget: ActiveEnemy | null = null;
      let assistDist = 4.4;
      for (const e of this.enemies) {
        if (e.state === 'dead') continue;
        _v1.subVectors(e.pos, this.playerPos);
        _v1.y = 0;
        const d = _v1.length();
        if (d > assistDist || d < 0.01) continue;
        const dot = (_v1.x / d) * camFwdX + (_v1.z / d) * camFwdZ;
        if (dot > 0.25) {
          assistDist = d;
          assistTarget = e;
        }
      }
      if (assistTarget) {
        _v1.subVectors(assistTarget.pos, this.playerPos);
        this.playerYaw = Math.atan2(-_v1.x, -_v1.z);
      } else {
        this.playerYaw = this.camYaw;
      }
    }

    if (kind === 'light') {
      this.heavyChainStage = 0;
      if (this.postParryTimer > 0 && this.comboStep === 0 && this.heavyOpenerStep === 0) {
        this.postParryTimer = 0;
        this.attackVariant = 'iai_counter';
        this.comboStep = 1;
        this.comboResetTimer = 1.35;
        this.actionDuration = 0.34;
        this.attackLungeSpeed = 9.2;
        this.audio.playSpatial('iai_counter', this.playerPos, 1.15);
        this.pushFeedback('CONTRATTACCO LAMPO', 'parry');
        this.camFov = 57.0;
      } else if (this.combosUnlocked && this.heavyOpenerStep === 2) {
        // H -> L -> L = Turbine d'Acciaio (360° AoE Spin!)
        this.heavyOpenerStep = 0;
        this.comboStep = 0;
        this.comboResetTimer = 0;
        this.attackVariant = 'tempest_whirl';
        this.actionDuration = 0.48;
        this.attackLungeSpeed = 3.2;
        this.audio.playSpatial('tempest_whirl', this.playerPos, 1.15);
        this.camFov = 57.4;
        this.registerSecretComboDiscovery('tempest_whirl');
      } else if (this.combosUnlocked && this.heavyOpenerStep === 1) {
        // H -> L (sets up Turbine d'Acciaio)
        this.heavyOpenerStep = 2;
        this.comboStep = 0;
        this.comboResetTimer = 1.3;
        this.attackVariant = 'light2';
        this.actionDuration = 0.3;
        this.attackLungeSpeed = 4.2;
        this.audio.playSpatial('slash_light', this.playerPos);
      } else {
        const maxChain = this.combosUnlocked ? 4 : 3;
        this.heavyOpenerStep = 0;
        this.comboStep = (this.comboStep % maxChain) + 1;
        this.comboResetTimer = 1.35;
        this.attackVariant = (`light${this.comboStep}` as AttackVariant);
        this.actionDuration = this.comboStep === 4 ? 0.42 : 0.31;
        this.attackLungeSpeed = this.comboStep === 4 ? 5.0 : 2.8;
        this.audio.playSpatial('slash_light', this.playerPos);
      }
    } else {
      this.playerStamina = Math.max(0, this.playerStamina - 22);
      this.heavyOpenerStep = 0;

      if (this.combosUnlocked && this.comboStep === 4) {
        // L-L-L-L-H = Croce Cremisi (5.5m projectile)
        this.attackVariant = 'crimson_cross';
        this.actionDuration = 0.58;
        this.attackLungeSpeed = 4.5;
        this.comboStep = 0;
        this.heavyChainStage = 0;
        this.comboResetTimer = 0;
        this.audio.playSpatial('slash_heavy', this.playerPos);
        this.registerSecretComboDiscovery('crimson_cross');
      } else if (this.combosUnlocked && (this.comboStep === 2 || this.comboStep === 3)) {
        // L-L-H / L-L-L-H = Spezzaguardia
        this.attackVariant = 'breaker';
        this.actionDuration = 0.5;
        this.attackLungeSpeed = 6.2;
        this.comboStep = 0;
        this.heavyChainStage = 0;
        this.comboResetTimer = 0;
        this.audio.playSpatial('slash_heavy', this.playerPos);
        this.registerSecretComboDiscovery('breaker');
      } else if (this.combosUnlocked && this.heavyChainStage === 1) {
        // L-H-H = Giudizio dell'Eclissi
        this.attackVariant = 'eclipse_judgment';
        this.actionDuration = 0.6;
        this.attackLungeSpeed = 6.8;
        this.comboStep = 0;
        this.heavyChainStage = 0;
        this.comboResetTimer = 0;
        this.audio.playSpatial('eclipse_slam', this.playerPos, 1.2);
        this.camFov = 58.2;
        this.registerSecretComboDiscovery('eclipse_judgment');
      } else if (this.combosUnlocked && this.postDodgeTimer > 0 && this.comboStep === 0) {
        // Schiva -> H = Lampo del Vuoto
        this.postDodgeTimer = 0;
        this.attackVariant = 'shadow_pierce';
        this.actionDuration = 0.4;
        this.attackLungeSpeed = 14.2;
        this.comboStep = 0;
        this.heavyChainStage = 0;
        this.comboResetTimer = 0;
        this.audio.playSpatial('iai_counter', this.playerPos, 1.2);
        this.camFov = 57.6;
        this.registerSecretComboDiscovery('shadow_pierce');
      } else if (this.postParryTimer > 0) {
        this.postParryTimer = 0;
        this.attackVariant = 'iai_counter';
        this.actionDuration = 0.38;
        this.attackLungeSpeed = 9.5;
        this.comboStep = 0;
        this.heavyChainStage = 0;
        this.audio.playSpatial('iai_counter', this.playerPos, 1.15);
        this.pushFeedback('CONTRATTACCO LAMPO', 'parry');
        this.camFov = 57.2;
      } else if (this.combosUnlocked && this.comboStep === 1) {
        // L -> H sets up L-H-H (Giudizio dell'Eclissi)
        this.attackVariant = 'heavy';
        this.actionDuration = 0.44;
        this.attackLungeSpeed = 5.2;
        this.comboStep = 0;
        this.heavyChainStage = 1;
        this.comboResetTimer = 1.25;
        this.audio.playSpatial('slash_heavy', this.playerPos);
      } else {
        // Neutral Heavy (if unlocked, sets up H-L-L Turbine d'Acciaio)
        this.attackVariant = 'heavy';
        this.actionDuration = 0.48;
        this.attackLungeSpeed = 5.4;
        this.comboStep = 0;
        this.heavyChainStage = 0;
        if (this.combosUnlocked) {
          this.heavyOpenerStep = 1;
          this.comboResetTimer = 1.25;
        } else {
          this.comboResetTimer = 0;
        }
        this.audio.playSpatial('slash_heavy', this.playerPos);
      }
    }

    // Trigger dual-layer blade slash ribbon aligned with -Z local forward + playerYaw
    const isCrimson =
      this.attackVariant === 'crimson_cross' ||
      this.attackVariant === 'heavy' ||
      this.attackVariant === 'breaker' ||
      this.attackVariant === 'eclipse_judgment';
    const isIai =
      this.attackVariant === 'iai_counter' ||
      this.attackVariant === 'shadow_pierce' ||
      this.attackVariant === 'tempest_whirl';
    this.slashArcMaxTimer = isCrimson ? 0.28 : 0.22;
    this.slashArcTimer = this.slashArcMaxTimer;
    this.slashArcSpinDir = this.comboStep === 2 ? -1 : 1;

    this.slashArcMesh.visible = true;
    this.slashArcOuterMesh.visible = true;
    this.slashArcMesh.position.set(this.playerPos.x, this.playerPos.y + 1.22, this.playerPos.z);
    this.slashArcOuterMesh.position.set(this.playerPos.x, this.playerPos.y + 1.22, this.playerPos.z);

    this.slashArcMesh.rotation.y = this.playerYaw;
    this.slashArcOuterMesh.rotation.y = this.playerYaw;
    const tiltX =
      this.attackVariant === 'breaker' || this.attackVariant === 'eclipse_judgment'
        ? 0.58
        : isCrimson
          ? 0.14
          : 0;
    const tiltZ =
      this.attackVariant === 'crimson_cross'
        ? 0.45
        : this.comboStep === 2
          ? -0.34
          : this.comboStep === 4 || this.attackVariant === 'tempest_whirl'
            ? 0.08
            : 0.26;
    this.slashArcMesh.rotation.x = tiltX;
    this.slashArcOuterMesh.rotation.x = tiltX;
    this.slashArcMesh.rotation.z = tiltZ;
    this.slashArcOuterMesh.rotation.z = tiltZ;

    this.slashArcMat.color.setHex(
      this.attackVariant === 'crimson_cross' || this.attackVariant === 'eclipse_judgment'
        ? 0xe12d39
        : isIai
          ? 0x0ea5e9
          : isCrimson
            ? 0xf43f5e
            : 0x38bdf8,
    );
    this.slashArcOuterMat.color.setHex(
      this.attackVariant === 'crimson_cross' || this.attackVariant === 'eclipse_judgment'
        ? 0xfda4af
        : 0xffffff,
    );
  }

  private registerSecretComboDiscovery(comboId: SecretComboId): void {
    const meta = SECRET_COMBO_MAP[comboId];
    if (!this.discoveredCombos.has(comboId)) {
      this.discoveredCombos.add(comboId);
      this.callbacks.onComboDiscovered(comboId);
      this.pushFeedback(
        `TECNICA SCOPERTA · ${meta.name.toUpperCase()} (${this.discoveredCombos.size}/${SECRET_COMBOS.length})`,
        'break',
      );
    } else {
      this.pushFeedback(meta.name.toUpperCase(), 'break');
    }
  }

  private startPlayerDodge(inp: UnifiedInput): void {
    this.playerState = 'dodge';
    this.actionTimer = 0;
    this.actionDuration = 0.25;
    this.invulnTimer = 0.28;
    this.postDodgeTimer = 0.72;
    this.bufferedAction = null;
    this.playerStamina = Math.max(0, this.playerStamina - 18);

    const moveMag = Math.hypot(inp.moveX, inp.moveY);
    if (moveMag > 0.1) {
      this.computeMoveWorldDir(inp, this.dodgeDir);
    } else {
      this.dodgeDir.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    }
    this.playerYaw = Math.atan2(-this.dodgeDir.x, -this.dodgeDir.z);
    this.audio.playSpatial('dash', this.playerPos);
    _v2.set(this.playerPos.x, 0.12, this.playerPos.z);
    this.spawnShockwave(_v2, 0x94a3b8, 2.2, 0.22);
  }

  private startHeroBowShot(inp: UnifiedInput): void {
    this.playerState = 'attack';
    this.attackKind = 'light';
    this.attackVariant = 'bow_shot';
    this.actionTimer = 0;
    this.actionDuration = 0.34;
    this.attackLungeSpeed = 0;
    this.hasHitThisAttack = false;
    this.bufferedAction = null;
    this.bowCooldown = 10.0;

    // Face locked enemy if locked, else movement direction or straight forward along camera yaw
    const locked = this.getLockedEnemy();
    const moveMag = Math.hypot(inp.moveX, inp.moveY);
    if (locked) {
      _v1.subVectors(locked.pos, this.playerPos);
      _v1.y = 0;
      if (_v1.lengthSq() > 0.001) {
        this.playerYaw = Math.atan2(-_v1.x, -_v1.z);
      }
    } else if (moveMag > 0.12) {
      this.computeMoveWorldDir(inp, _v1);
      this.playerYaw = Math.atan2(-_v1.x, -_v1.z);
    } else {
      this.playerYaw = this.camYaw;
    }

    this.camFov = 52.5;
  }

  private spawnHeroArrow(): void {
    const dir = new THREE.Vector3(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw)).normalize();
    const pos = new THREE.Vector3(
      this.playerPos.x + dir.x * 0.95,
      this.playerPos.y + 1.24,
      this.playerPos.z + dir.z * 0.95,
    );

    const coreMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(this.arrowShaftGeo, coreMat);
    const head = new THREE.Mesh(this.arrowHeadGeo, coreMat);
    head.position.z = 0.65;
    group.add(shaft, head);
    group.position.copy(pos);
    group.rotation.y = Math.atan2(dir.x, dir.z);
    this.vfxGroup.add(group);

    this.heroArrows.push({
      group,
      coreMat,
      pos,
      dir,
      speed: 34.0,
      damage: 64,
      postureDmg: 48,
      life: 1.45,
    });

    this.spawnSparks(pos, 12, 0x38bdf8);
    this.spawnShockwave(this.playerPos, 0x38bdf8, 2.2, 0.22);
    this.audio.playSpatial('bow_shot', this.playerPos, 1.2);
    this.pushFeedback('FRECCIA DI SAKIRO!', 'parry');
  }

  private performPlayerStrikeHitbox(): void {
    // Crimson Cross launches a 5.5m slicing energy X-projectile!
    if (this.attackVariant === 'crimson_cross') {
      this.spawnCrossSlashProjectile();
      return;
    }

    const fwdX = -Math.sin(this.playerYaw);
    const fwdZ = -Math.cos(this.playerYaw);

    const is360AoE =
      this.attackVariant === 'tempest_whirl' || this.attackVariant === 'eclipse_judgment';
    const reach =
      this.attackVariant === 'shadow_pierce'
        ? 4.6
        : this.attackVariant === 'eclipse_judgment'
          ? 4.25
          : this.attackVariant === 'iai_counter'
            ? 3.85
            : this.attackVariant === 'tempest_whirl'
              ? 3.6
              : this.attackVariant === 'breaker' || this.attackVariant === 'heavy'
                ? 3.4
                : this.attackVariant === 'light4'
                  ? 3.2
                  : 2.85;
    const minDot = is360AoE
      ? -1.0
      : this.attackVariant === 'light4'
        ? -0.35
        : this.attackKind === 'heavy'
          ? 0.2
          : -0.08;

    if (
      this.attackVariant === 'breaker' ||
      this.attackVariant === 'light4' ||
      this.attackVariant === 'iai_counter' ||
      this.attackVariant === 'tempest_whirl' ||
      this.attackVariant === 'shadow_pierce' ||
      this.attackVariant === 'eclipse_judgment'
    ) {
      const originOffset = is360AoE ? 0.2 : 1.4;
      _v2.set(this.playerPos.x + fwdX * originOffset, 0.1, this.playerPos.z + fwdZ * originOffset);
      const swColor =
        this.attackVariant === 'eclipse_judgment'
          ? 0xe12d39
          : this.attackVariant === 'tempest_whirl' ||
              this.attackVariant === 'iai_counter' ||
              this.attackVariant === 'shadow_pierce'
            ? 0x0284c7
            : 0xf59e0b;
      const swScale =
        this.attackVariant === 'eclipse_judgment'
          ? 5.2
          : this.attackVariant === 'tempest_whirl'
            ? 4.4
            : 3.0;
      this.spawnShockwave(_v2, swColor, swScale, 0.34);
      if (this.attackVariant === 'eclipse_judgment') {
        this.camShake = Math.max(this.camShake, 0.26);
      }
    }

    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      _v1.subVectors(enemy.pos, this.playerPos);
      _v1.y = 0;
      const dist = _v1.length();
      if (dist > reach) continue;

      if (dist > 0.001) _v1.divideScalar(dist);
      const dot = _v1.x * fwdX + _v1.z * fwdZ;
      if (!is360AoE && dot < minDot && dist > 1.25) continue;

      // Enemy Guard check (Ronin can guard light attacks from the front!)
      const breaksGuard =
        this.attackVariant === 'breaker' ||
        this.attackVariant === 'heavy' ||
        this.attackVariant === 'iai_counter' ||
        this.attackVariant === 'shadow_pierce' ||
        this.attackVariant === 'eclipse_judgment';
      if (enemy.isGuarding && !breaksGuard) {
        _v2.copy(enemy.pos).setY(1.3);
        this.spawnSparks(_v2, 10, 0xfbbf24);
        this.audio.playSpatial('block_clang', enemy.pos);
        enemy.posture = Math.min(enemy.maxPosture, enemy.posture + 14);
        enemy.knockbackVel.set(_v1.x * 4.5, 0, _v1.z * 4.5);
        this.pushFeedback('PARATA NEMICA · USA PESANTE', 'story');
        continue;
      }

      if (enemy.isGuarding && breaksGuard) {
        enemy.isGuarding = false;
        enemy.guardTimer = 0;
      }

      const isCritical = enemy.state === 'stagger';
      const baseDmg =
        this.attackVariant === 'eclipse_judgment'
          ? 58
          : this.attackVariant === 'shadow_pierce'
            ? 46
            : this.attackVariant === 'iai_counter'
              ? 44
              : this.attackVariant === 'breaker'
                ? 42
                : this.attackVariant === 'tempest_whirl'
                  ? 38
                  : this.attackVariant === 'heavy'
                    ? 36
                    : this.attackVariant === 'light4'
                      ? 29
                      : this.attackVariant === 'light3'
                        ? 25
                        : 19;
      const dmg = isCritical ? Math.round(baseDmg * 1.7) : baseDmg;
      const postureDmg =
        this.attackVariant === 'eclipse_judgment'
          ? 60
          : this.attackVariant === 'breaker'
            ? 52
            : this.attackVariant === 'shadow_pierce'
              ? 42
              : this.attackVariant === 'iai_counter'
                ? 38
                : this.attackVariant === 'tempest_whirl'
                  ? 34
                  : this.attackKind === 'heavy'
                    ? 36
                    : this.attackVariant === 'light4'
                      ? 24
                      : 18;

      const knockAmt =
        this.attackVariant === 'eclipse_judgment' || this.attackVariant === 'tempest_whirl'
          ? 20.0
          : this.attackKind === 'heavy' ||
              this.attackVariant === 'iai_counter' ||
              this.attackVariant === 'shadow_pierce'
            ? 17.5
            : this.attackVariant === 'light4'
              ? 14.5
              : 9.5;

      this.applyHitToEnemy(
        enemy,
        dmg,
        postureDmg,
        _v1,
        knockAmt,
        isCritical,
        breaksGuard || this.attackVariant === 'light4' || this.attackVariant === 'tempest_whirl',
      );
    }
  }

  private applyHitToEnemy(
    enemy: ActiveEnemy,
    dmg: number,
    postureDmg: number,
    dir: THREE.Vector3,
    baseKnock: number,
    isCritical: boolean,
    canInterrupt: boolean,
  ): void {
    if (canInterrupt && enemy.state === 'windup' && enemy.telegraph === 'normal') {
      enemy.state = 'recover';
      enemy.stateTimer = 0.45;
      enemy.telegraph = 'none';
    }

    enemy.hp = Math.max(0, enemy.hp - dmg);
    enemy.posture = Math.min(enemy.maxPosture, enemy.posture + postureDmg);
    enemy.hitFlashTimer = 0.14;
    enemy.hitStreak += 1;

    // Ronin tactical guard reaction after absorbing 2 consecutive hits
    if (
      enemy.spec.archetype === 'ronin' &&
      !enemy.spec.isBoss &&
      enemy.hitStreak >= 2 &&
      enemy.state !== 'stagger' &&
      enemy.hp > 0 &&
      !canInterrupt
    ) {
      enemy.isGuarding = true;
      enemy.guardTimer = 1.15;
      enemy.hitStreak = 0;
    }

    _v2.copy(enemy.pos).setY(1.25);
    const sparkColor = isCritical || canInterrupt ? 0xe12d39 : 0xfbbf24;
    this.spawnSparks(_v2, isCritical ? 18 : 11, sparkColor);
    this.audio.playSpatial('hit_flesh', enemy.pos);
    this.camShake = Math.max(this.camShake, isCritical ? 0.18 : 0.09);

    const heavyWeightScale =
      enemy.spec.isBoss || enemy.spec.archetype === 'enforcer' ? 0.72 : 1.0;
    const knockSpeed = (baseKnock + (isCritical ? 4.0 : 0)) * heavyWeightScale;
    enemy.knockbackVel.set(dir.x * knockSpeed, 0, dir.z * knockSpeed);

    if (enemy.hp <= 0) {
      if (enemy.currentPhase < enemy.totalPhases) {
        // Multi-bar Boss Phase Transition!
        enemy.currentPhase += 1;
        enemy.hp = enemy.maxHp;
        enemy.posture = 0;
        enemy.state = 'recover';
        enemy.stateTimer = 0.65;
        enemy.telegraph = 'none';
        enemy.isGuarding = false;
        enemy.attackCooldown = enemy.totalPhases >= 3 ? 0.38 : 0.55;
        enemy.magicCooldown = enemy.totalPhases >= 3 ? 0.9 : 1.4;
        enemy.bowCooldown = enemy.totalPhases >= 3 ? 0.75 : 1.1;
        enemy.bombCooldown = enemy.totalPhases >= 3 ? 1.25 : 1.8;
        this.spawnShockwave(enemy.pos, enemy.currentPhase >= 3 ? 0xf59e0b : 0xe12d39, 6.8, 0.48);
        _v2.copy(enemy.pos).setY(1.3);
        this.spawnSparks(_v2, 26, enemy.currentPhase >= 3 ? 0xf59e0b : 0xe12d39);
        this.audio.playSpatial('phase_shift', enemy.pos, 1.25);
        this.camShake = Math.max(this.camShake, 0.34);
        const phaseLabel =
          enemy.totalPhases >= 3
            ? enemy.currentPhase >= 3
              ? 'FASE 3 · APOTEOSI SUPREMA DI KUROGANE!'
              : 'FASE 2 · FURIA DI KUROGANE!'
            : `FASE ${enemy.currentPhase} · FURIA DELL'IMMORTALE!`;
        this.pushFeedback(phaseLabel, 'story');

        // Gentle shockwave pushback if player is right on top of the boss
        _v3.subVectors(this.playerPos, enemy.pos);
        _v3.y = 0;
        if (_v3.length() < 4.5 && _v3.lengthSq() > 0.001) {
          _v3.normalize();
          this.playerKnockbackVel.set(_v3.x * 9.0, 0, _v3.z * 9.0);
        }
      } else {
        this.killEnemy(enemy);
      }
    } else if (enemy.posture >= enemy.maxPosture && enemy.state !== 'stagger') {
      enemy.state = 'stagger';
      enemy.stateTimer = 1.95;
      enemy.telegraph = 'none';
      enemy.isGuarding = false;
      enemy.posture = enemy.maxPosture;
      this.spawnShockwave(enemy.pos, 0xd97706, 3.2, 0.3);
      this.audio.playSpatial('guard_break', enemy.pos);
      this.pushFeedback('POSTURA SPEZZATA', 'break');
    }
  }

  private killEnemy(enemy: ActiveEnemy): void {
    enemy.state = 'dead';
    enemy.deadTimer = 0;
    enemy.telegraph = 'none';
    this.callbacks.onDefeatStat();

    if (this.lockedEnemyId === enemy.spec.id) {
      this.lockedEnemyId = null;
      // Auto-shift lock to next living enemy
      const next = this.enemies.find((e) => e.state !== 'dead');
      if (next) this.lockedEnemyId = next.spec.id;
    }

    // Check if wave cleared
    const wIdx = enemy.waveIndex;
    const anyLeftInWave = this.enemies.some((e) => e.waveIndex === wIdx && e.state !== 'dead');
    if (!anyLeftInWave) {
      this.wavesCleared[wIdx] = true;
      // Heal slightly on wave clear
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 20);

      // If final boss wave of the level cleared -> Level Complete!
      const spec = LEVELS[this.currentLevelIndex];
      if (wIdx === spec.waves.length - 1) {
        window.setTimeout(() => {
          if (this.disposed || this.screenMode !== 'playing') return;
          this.setScreenMode('victory');
          this.callbacks.onLevelComplete(this.currentLevelIndex);
        }, 900);
      }
    }
  }

  private updateWavesAndCheckpoints(): void {
    const spec = LEVELS[this.currentLevelIndex];

    // Trigger enemy waves as player advances along -Z
    spec.waves.forEach((wave, idx) => {
      if (!this.wavesTriggered[idx] && this.playerPos.z <= wave.triggerZ) {
        this.spawnWave(idx);
      }
    });

    // Frequent automatic Checkpoint saves
    this.checkpoints.forEach((cp) => {
      if (cp.activated) return;
      const waveReady =
        cp.requiresWaveIndex === undefined || Boolean(this.wavesCleared[cp.requiresWaveIndex]);
      if (!waveReady) return;

      const dist = this.playerPos.distanceTo(cp.pos);
      if (dist <= cp.radius) {
        cp.activated = true;
        cp.beacon.activate();
        this.currentCheckpointIndex = cp.index;
        this.playerHp = this.playerMaxHp;
        this.playerPosture = 0;
        this.audio.playSpatial('checkpoint', cp.pos);
        this.pushFeedback(`CHECKPOINT · ${spec.checkpoints[cp.index].name.toUpperCase()}`, 'checkpoint');
        this.callbacks.onCheckpointReached(this.currentLevelIndex, cp.index, this.playerHp);
      }
    });
  }

  private animateCheckpoints(dt: number): void {
    for (const cp of this.checkpoints) {
      cp.beacon.crystal.rotation.y += dt * (cp.activated ? 1.8 : 0.9);
      cp.beacon.crystal.position.y = 1.15 + Math.sin(this.elapsed * 2.2 + cp.index) * 0.06;
      cp.beacon.ring.rotation.z -= dt * (cp.activated ? 2.1 : 1.0);
    }
  }

  private updateEnemies(dt: number): void {
    let windupTarget: ActiveEnemy | null = null;
    let unblockableTarget: ActiveEnemy | null = null;
    let magicTarget: ActiveEnemy | null = null;
    let guardTarget: ActiveEnemy | null = null;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.state === 'dead') {
        e.deadTimer += dt;
        // Collapse animation
        e.rig.root.rotation.x = THREE.MathUtils.damp(e.rig.root.rotation.x, -Math.PI / 2, 7, dt);
        e.rig.root.position.y = THREE.MathUtils.damp(e.rig.root.position.y, -0.18, 7, dt);
        if (e.deadTimer > 2.2) {
          this.actorGroup.remove(e.rig.root);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      if (e.hitFlashTimer > 0) e.hitFlashTimer -= dt;
      if (e.dodgeCooldown > 0) e.dodgeCooldown -= dt;
      if (e.guardTimer > 0) {
        e.guardTimer -= dt;
        if (e.guardTimer <= 0) e.isGuarding = false;
      }
      if (e.isGuarding && !guardTarget) {
        guardTarget = e;
      }

      // Passive posture recovery when not staggered
      if (e.state !== 'stagger') {
        e.posture = Math.max(0, e.posture - 5 * dt);
      }

      _v1.subVectors(this.playerPos, e.pos);
      _v1.y = 0;
      const dist = _v1.length();
      if (dist > 0.001) _v1.divideScalar(dist);

      const targetYaw = Math.atan2(-_v1.x, -_v1.z);

      if (e.attackCooldown > 0) e.attackCooldown -= dt;
      if (e.spec.isMagicBoss && e.magicCooldown > 0) e.magicCooldown -= dt;
      if (e.spec.canBow && e.bowCooldown > 0) e.bowCooldown -= dt;
      if (e.spec.canBombs && e.bombCooldown > 0) e.bombCooldown -= dt;

      if (e.state === 'stagger') {
        e.stateTimer -= dt;
        e.isGuarding = false;
        e.comboRemaining = 0;
        e.magicKind = 'none';
        e.rig.bladeGlowMesh.visible = false;
        if (e.stateTimer <= 0) {
          e.state = 'chase';
          e.posture = e.maxPosture * 0.35;
        }
      } else if (e.state === 'windup') {
        e.yaw = this.dampAngle(e.yaw, targetYaw, 10, dt);
        e.stateTimer -= dt;
        // Glow blade during windup so player can read timing visually + binaural cue
        e.rig.bladeGlowMesh.visible = true;
        const glowMat = e.rig.bladeGlowMesh.material as THREE.MeshBasicMaterial;
        glowMat.color.setHex(
          e.telegraph === 'unblockable'
            ? 0xe12d39
            : e.telegraph === 'magic'
              ? 0x8b5cf6
              : e.telegraph === 'bow'
                ? 0xfbbf24
                : e.telegraph === 'bomb'
                  ? 0xf97316
                  : 0xf59e0b,
        );

        if (e.telegraph === 'unblockable') {
          unblockableTarget = e;
        } else if (
          e.telegraph === 'magic' ||
          e.telegraph === 'bow' ||
          e.telegraph === 'bomb'
        ) {
          magicTarget = e;
        } else {
          windupTarget = e;
        }

        if (e.stateTimer <= 0) {
          if (
            e.telegraph === 'magic' ||
            e.telegraph === 'bow' ||
            e.telegraph === 'bomb'
          ) {
            if (e.magicKind === 'bolts') {
              this.spawnMagicBolts(e);
            } else if (e.magicKind === 'meteors') {
              this.spawnMeteorShower(e);
            } else if (e.magicKind === 'bow') {
              this.spawnBossBowVolley(e);
            } else if (e.magicKind === 'bombs') {
              this.spawnBossBombs(e);
            }
            e.magicKind = 'none';
            e.telegraph = 'none';
            e.rig.bladeGlowMesh.visible = false;
            e.state = 'recover';
            e.stateTimer = e.currentPhase >= 2 ? 0.38 : 0.55;
          } else {
            e.state = 'strike';
            e.stateTimer = 0.24;
            e.hasStruckThisSwing = false;
            this.audio.playSpatial('slash_heavy', e.pos, 0.9);
            // Step into strike (Boss lunge covers extra distance)
            e.pos.addScaledVector(_v1, e.spec.isBoss ? 1.15 : 0.78);
          }
        }
      } else if (e.state === 'strike') {
        e.stateTimer -= dt;
        if (!e.hasStruckThisSwing && e.stateTimer <= 0.16) {
          e.hasStruckThisSwing = true;
          this.resolveEnemyHit(e, dist);
        }
        if (e.stateTimer <= 0) {
          if (e.comboRemaining > 0 && this.playerState !== 'dead' && dist < 3.6) {
            // Chain rapid follow-up combo swing!
            e.comboRemaining -= 1;
            e.state = 'windup';
            e.telegraph = e.spec.isBoss && e.comboRemaining === 0 && Math.random() < 0.45 ? 'unblockable' : 'normal';
            e.windupDuration = e.telegraph === 'unblockable' ? 0.54 : 0.34;
            e.stateTimer = e.windupDuration;
            this.audio.playSpatial(
              e.telegraph === 'unblockable' ? 'telegraph_unblockable' : 'telegraph_normal',
              e.pos,
            );
          } else {
            e.state = 'recover';
            e.stateTimer = e.spec.isBoss ? (e.currentPhase >= 2 ? 0.36 : 0.46) : 0.64;
            e.telegraph = 'none';
            e.rig.bladeGlowMesh.visible = false;
          }
        }
      } else if (e.state === 'recover') {
        e.stateTimer -= dt;
        e.yaw = this.dampAngle(e.yaw, targetYaw, 6, dt);
        if (e.stateTimer <= 0) {
          e.state = 'chase';
          e.attackCooldown = e.spec.isBoss
            ? (e.currentPhase >= 2 ? 0.28 : 0.4) + Math.random() * 0.26
            : 0.62 + Math.random() * 0.48;
        }
      } else {
        // Chase / Circle strafe / Shinobi tactical sidestep / Boss Ranged Bow, Bombs & Magic
        e.yaw = this.dampAngle(e.yaw, targetYaw, 9, dt);
        const engageRange = e.spec.isBoss ? 3.05 : 2.4;

        // Kagetsu Bow Shot (fast high-velocity arrows)
        if (e.spec.canBow && e.bowCooldown <= 0 && dist > 3.2 && dist < 26 && this.playerState !== 'dead') {
          e.state = 'windup';
          e.telegraph = 'bow';
          e.magicKind = 'bow';
          e.windupDuration = e.currentPhase >= 2 ? 0.48 : 0.58;
          e.stateTimer = e.windupDuration;
          e.comboRemaining = 0;
          e.isGuarding = false;
              e.bowCooldown =
                e.totalPhases >= 3
                  ? e.currentPhase >= 3
                    ? 2.2
                    : 2.7
                  : e.currentPhase >= 2
                    ? 3.2
                    : 4.2;
          this.audio.playSpatial('telegraph_normal', e.pos, 1.1);
        } else if (
          e.spec.canBombs &&
          e.bombCooldown <= 0 &&
          this.bossBombs.length === 0 &&
          dist < 24 &&
          this.playerState !== 'dead'
        ) {
          e.state = 'windup';
          e.telegraph = 'bomb';
          e.magicKind = 'bombs';
          e.windupDuration = e.totalPhases >= 3 ? 0.52 : 0.62;
          e.stateTimer = e.windupDuration;
          e.comboRemaining = 0;
          e.isGuarding = false;
          e.bombCooldown =
            e.totalPhases >= 3
              ? e.currentPhase >= 3
                ? 3.4
                : 4.1
              : e.currentPhase >= 2
                ? 4.8
                : 6.2;
          this.audio.playSpatial('bomb_throw', e.pos, 1.0);
        } else if (e.spec.isMagicBoss && e.magicCooldown <= 0 && dist < 24 && this.playerState !== 'dead') {
          // Magic Boss casts Arcane Bolts or Pre-telegraphed Meteor Shower
          const allowMeteors = !e.spec.canBow || e.currentPhase >= 2 || e.totalPhases >= 3 || Math.random() < 0.35;
          const castKind: 'bolts' | 'meteors' =
            allowMeteors && this.meteors.length === 0 && Math.random() < 0.5 ? 'meteors' : 'bolts';
          e.state = 'windup';
          e.telegraph = 'magic';
          e.magicKind = castKind;
          e.windupDuration = castKind === 'meteors' ? (e.totalPhases >= 3 ? 0.78 : 0.92) : 0.68;
          e.stateTimer = e.windupDuration;
          e.comboRemaining = 0;
          e.isGuarding = false;
          e.magicCooldown =
            e.totalPhases >= 3
              ? (e.currentPhase >= 3 ? 2.6 : 3.1) + Math.random() * 0.8
              : (e.currentPhase >= 2 ? 3.6 : 4.6) + Math.random() * 1.2;
          this.audio.playSpatial('magic_cast', e.pos, 1.15);
        } else {
          // Shinobi agile sidestep dash when player attacks nearby
          if (
            e.spec.archetype === 'shinobi' &&
            !e.spec.isBoss &&
            e.dodgeCooldown <= 0 &&
            this.playerState === 'attack' &&
            dist < 3.4
          ) {
            e.dodgeCooldown = 3.2;
            e.strafeDir *= -1;
            _v2.set(-_v1.z * e.strafeDir, 0, _v1.x * e.strafeDir);
            e.knockbackVel.set(_v2.x * 11.0, 0, _v2.z * 11.0);
            this.spawnShockwave(e.pos, 0x38bdf8, 1.8, 0.22);
            this.audio.playSpatial('dash', e.pos, 0.7);
          }

          if (dist > engageRange) {
            e.pos.addScaledVector(_v1, e.spec.speed * dt);
            e.stepTimer -= dt;
            if (e.stepTimer <= 0) {
              e.stepTimer = 0.42;
              this.audio.playSpatial('footstep', e.pos, 0.55);
            }

            // Boss gap-closing crimson lunge if player stays at mid-range
            if (e.spec.isBoss && dist < 5.6 && e.attackCooldown <= 0 && Math.random() < 0.04) {
              e.state = 'windup';
              e.comboRemaining = e.totalPhases >= 3 ? 2 : 1;
              e.telegraph = 'normal';
              e.windupDuration = 0.46;
              e.stateTimer = e.windupDuration;
              e.isGuarding = false;
              this.audio.playSpatial('telegraph_normal', e.pos);
            }
          } else {
            // Slight circling tension
            _v2.set(-_v1.z * e.strafeDir, 0, _v1.x * e.strafeDir);
            e.pos.addScaledVector(_v2, e.spec.speed * 0.35 * dt);

            if (e.attackCooldown <= 0 && !e.isGuarding && this.playerState !== 'dead') {
              e.state = 'windup';
              e.hitStreak = 0;
              const canUnblockable =
                e.spec.archetype === 'enforcer' || e.spec.isBoss;
              const isUnblockable = canUnblockable && Math.random() < (e.spec.isBoss ? 0.35 : 0.42);
              e.telegraph = isUnblockable ? 'unblockable' : 'normal';
              e.windupDuration = isUnblockable
                ? e.totalPhases >= 3
                  ? 0.52
                  : 0.6
                : e.spec.archetype === 'shinobi'
                  ? 0.4
                  : e.totalPhases >= 3
                    ? 0.42
                    : 0.5;
              e.stateTimer = e.windupDuration;

              // Multi-hit combo chains for Bosses and Shinobi
              if (!isUnblockable && e.spec.isBoss) {
                e.comboRemaining =
                  e.totalPhases >= 3
                    ? e.currentPhase >= 2
                      ? 3
                      : 2
                    : Math.random() < 0.7
                      ? 2
                      : 1;
              } else if (!isUnblockable && e.spec.archetype === 'shinobi') {
                e.comboRemaining = Math.random() < 0.6 ? 1 : 0;
              } else {
                e.comboRemaining = 0;
              }

              this.audio.playSpatial(
                isUnblockable ? 'telegraph_unblockable' : 'telegraph_normal',
                e.pos,
              );
            }
          }
        }
      }

      // Apply decaying knockback impulse on enemy
      if (e.knockbackVel.lengthSq() > 0.002) {
        e.pos.addScaledVector(e.knockbackVel, dt);
        e.knockbackVel.multiplyScalar(Math.exp(-8.5 * dt));
      } else {
        e.knockbackVel.set(0, 0, 0);
      }

      // Clamp enemy inside arena bounds
      const spec = LEVELS[this.currentLevelIndex];
      const halfW = spec.widthX / 2 - 1.4;
      e.pos.x = THREE.MathUtils.clamp(e.pos.x, -halfW, halfW);
      e.pos.z = THREE.MathUtils.clamp(e.pos.z, -spec.lengthZ + 7, 11);

      e.rig.root.position.copy(e.pos);
      e.rig.root.rotation.y = e.yaw;
      this.animateEnemyRig(e, dt);
    }

    // Clearer visual enemy telegraphs
    if (windupTarget) {
      this.enemyTelegraphRingMesh.visible = true;
      this.enemyTelegraphRingMesh.position.set(windupTarget.pos.x, 0.06, windupTarget.pos.z);
      const ratio = Math.max(0, Math.min(1, windupTarget.stateTimer / Math.max(0.1, windupTarget.windupDuration)));
      this.enemyTelegraphRingMesh.scale.setScalar(0.62 + ratio * 1.25);
      this.enemyTelegraphRingMat.color.setHex(ratio < 0.28 ? 0xffffff : 0xf59e0b);
    } else {
      this.enemyTelegraphRingMesh.visible = false;
    }

    if (unblockableTarget) {
      this.unblockableRingMesh.visible = true;
      this.unblockableRingMesh.position.set(unblockableTarget.pos.x, 0.08, unblockableTarget.pos.z);
      const pulse = 1 + Math.sin(this.elapsed * 22) * 0.22;
      this.unblockableRingMesh.scale.setScalar(pulse);
    } else {
      this.unblockableRingMesh.visible = false;
    }

    if (magicTarget) {
      this.enemyMagicRingMesh.visible = true;
      this.enemyMagicRingMesh.position.set(magicTarget.pos.x, 0.1, magicTarget.pos.z);
      this.enemyMagicRingMesh.rotation.y += dt * 3.5;
      this.enemyMagicRingMat.color.setHex(
        magicTarget.telegraph === 'bow'
          ? 0xfbbf24
          : magicTarget.telegraph === 'bomb'
            ? 0xf97316
            : 0x8b5cf6,
      );
      const pulse = 1.05 + Math.sin(this.elapsed * 14) * 0.16;
      this.enemyMagicRingMesh.scale.setScalar(pulse);
    } else {
      this.enemyMagicRingMesh.visible = false;
    }

    if (guardTarget) {
      const fx = -Math.sin(guardTarget.yaw);
      const fz = -Math.cos(guardTarget.yaw);
      this.enemyGuardShieldMesh.visible = true;
      this.enemyGuardShieldMesh.position.set(guardTarget.pos.x + fx * 0.72, 1.28, guardTarget.pos.z + fz * 0.72);
      this.enemyGuardShieldMesh.rotation.y = guardTarget.yaw;
    } else {
      this.enemyGuardShieldMesh.visible = false;
    }
  }

  private resolveEnemyHit(enemy: ActiveEnemy, distToPlayer: number): void {
    const reach = enemy.spec.isBoss ? 3.1 : 2.65;
    if (distToPlayer > reach) return;
    if (Math.abs(this.playerPos.y - enemy.pos.y) > 1.35) return;
    if (this.invulnTimer > 0) return;

    // Direction away from attacker for knockback
    _v3.subVectors(this.playerPos, enemy.pos);
    _v3.y = 0;
    if (_v3.lengthSq() > 0.001) _v3.normalize();
    else _v3.set(0, 0, 1);

    // Check facing/blocking
    if (this.playerState === 'block' && enemy.telegraph !== 'unblockable') {
      if (this.parryWindowTimer > 0) {
        // PERFECT PARRY!
        this.hitStopTimer = 0.048;
        this.camShake = 0.16;
        this.camFov = 57.5;
        this.postParryTimer = 0.85;
        this.playerPosture = Math.max(0, this.playerPosture - 18);
        this.playerStamina = Math.min(this.playerMaxStamina, this.playerStamina + 18);

        const parryPostureDmg = enemy.spec.isBoss ? 38 : 44;
        enemy.posture = Math.min(enemy.maxPosture, enemy.posture + parryPostureDmg);
        enemy.hp = Math.max(1, enemy.hp - 6);
        enemy.knockbackVel.set(-_v3.x * 8.5, 0, -_v3.z * 8.5);
        enemy.comboRemaining = 0;

        _v1.lerpVectors(this.playerPos, enemy.pos, 0.5).setY(1.3);
        this.spawnSparks(_v1, 20, 0x38bdf8);
        this.spawnShockwave(_v1.setY(0.1), 0x0284c7, 3.0, 0.28);
        this.audio.playSpatial('parry_perfect', _v1, 1.15);
        this.callbacks.onParryStat();
        this.pushFeedback('PARATA PERFETTA · CONTRATTACCO!', 'parry');

        if (enemy.posture >= enemy.maxPosture) {
          enemy.state = 'stagger';
          enemy.stateTimer = 2.0;
          enemy.telegraph = 'none';
          this.spawnShockwave(enemy.pos, 0xd97706, 3.4, 0.32);
          this.audio.playSpatial('guard_break', enemy.pos);
          this.pushFeedback('POSTURA SPEZZATA', 'break');
        } else {
          enemy.state = 'recover';
          enemy.stateTimer = 0.65;
          enemy.telegraph = 'none';
        }
        return;
      }

      // Standard Guard Block
      _v1.lerpVectors(this.playerPos, enemy.pos, 0.5).setY(1.3);
      this.spawnSparks(_v1, 8, 0xfbbf24);
      this.audio.playSpatial('block_clang', _v1);
      this.playerPosture += 28;
      this.playerHp = Math.max(0, this.playerHp - Math.round(enemy.spec.damage * 0.18));
      this.playerKnockbackVel.set(_v3.x * 6.5, 0, _v3.z * 6.5);
      enemy.knockbackVel.set(-_v3.x * 3.2, 0, -_v3.z * 3.2);

      if (this.playerPosture >= this.playerMaxPosture) {
        this.playerState = 'stagger';
        this.actionTimer = 0;
        this.actionDuration = 0.85;
        this.audio.playSpatial('guard_break', this.playerPos);
        this.pushFeedback('GUARDIA SPEZZATA', 'damage');
      }
      if (this.playerHp <= 0) this.handlePlayerDeath();
      return;
    }

    // Direct Hit on Player
    this.playerHp = Math.max(0, this.playerHp - enemy.spec.damage);
    this.playerKnockbackVel.set(_v3.x * 11.5, 0, _v3.z * 11.5);
    this.camShake = 0.18;
    this.comboStep = 0;
    this.postParryTimer = 0;
    _v1.copy(this.playerPos).setY(1.2);
    this.spawnSparks(_v1, 12, 0xe12d39);
    this.audio.playSpatial('hit_flesh', this.playerPos);
    this.pushFeedback(`-${enemy.spec.damage} HP`, 'damage');

    if (this.playerHp <= 0) {
      this.handlePlayerDeath();
    } else {
      this.playerState = 'stagger';
      this.actionTimer = 0;
      this.actionDuration = 0.3;
    }
  }

  private handlePlayerDeath(): void {
    this.playerState = 'dead';
    this.setScreenMode('defeat');
    this.callbacks.onPlayerDefeated();
  }

  private toggleLockOn(): void {
    if (this.lockedEnemyId) {
      this.lockedEnemyId = null;
      return;
    }
    let best: ActiveEnemy | null = null;
    let bestDist = 18;
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      const d = e.pos.distanceTo(this.playerPos);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    if (best) this.lockedEnemyId = best.spec.id;
  }

  private getLockedEnemy(): ActiveEnemy | null {
    if (!this.lockedEnemyId) return null;
    return this.enemies.find((e) => e.spec.id === this.lockedEnemyId && e.state !== 'dead') ?? null;
  }

  private animateHeroRig(dt: number): void {
    const r = this.heroRig;
    const t = this.elapsed;

    // Default martial chudan-no-kamae ready stance (character faces -Z)
    let hipY = 0.88;
    let hipYaw = 0;
    let torsoPitch = -0.08; // negative X leans forward toward -Z
    let torsoYaw = 0;
    let torsoRoll = 0;
    let headPitch = 0.05;
    let headYaw = 0;
    let rShoulderX = 0.62; // positive X reaches arm forward toward -Z
    let rShoulderZ = -0.14; // negative Z brings right arm inward
    let rForearmX = 0.78; // positive X bends elbow naturally forward/up
    let lShoulderX = 0.56;
    let lShoulderZ = 0.22; // positive Z brings left arm inward
    let lForearmX = 0.86;
    let legSwing = 0;
    let haoriPitch = -0.18;
    let weaponRotX = -Math.PI / 2 + 0.28;
    let weaponRotY = 0;
    let weaponRotZ = 0;
    let rootCollapseX = 0;

    if (!this.isGrounded && this.playerState !== 'attack' && this.playerState !== 'dead') {
      // Crisp airborne parkour leap silhouette
      hipY = 0.92;
      torsoPitch = -0.2;
      headPitch = 0.14;
      rShoulderX = 0.85;
      rShoulderZ = -0.2;
      rForearmX = 0.85;
      lShoulderX = 0.95;
      lShoulderZ = 0.35;
      lForearmX = 0.85;
      legSwing = 0.42;
      haoriPitch = -0.68;
      weaponRotX = -Math.PI / 2 + 0.35;
    } else if (this.playerState === 'idle') {
      const breath = Math.sin(t * 2.4);
      hipY = 0.88 + breath * 0.014;
      torsoPitch = -0.08 + breath * 0.018;
      torsoYaw = -0.12 + Math.sin(t * 1.1) * 0.03;
      headYaw = 0.1 + Math.sin(t * 0.85) * 0.05;
      rShoulderX = 0.62 + breath * 0.035;
      rForearmX = 0.78 - breath * 0.03;
      lShoulderX = 0.56 + breath * 0.025;
      lForearmX = 0.88;
      haoriPitch = -0.18 + Math.sin(t * 2.9) * 0.05;
    } else if (this.playerState === 'move') {
      const stride = Math.sin(t * 13.5);
      const strideCos = Math.cos(t * 13.5);
      hipY = 0.86 + Math.abs(stride) * 0.055;
      hipYaw = stride * 0.14;
      torsoPitch = -0.26;
      torsoYaw = -stride * 0.18;
      torsoRoll = stride * 0.04;
      headPitch = 0.18;
      legSwing = stride * 0.62;
      // Right arm holds katana swept back/low at side during sprint; left arm pumps forward
      rShoulderX = -0.35 + strideCos * 0.18;
      rShoulderZ = 0.18;
      rForearmX = 0.85;
      weaponRotX = -Math.PI / 2 - 0.18;
      lShoulderX = 0.35 - strideCos * 0.45;
      lShoulderZ = -0.08;
      lForearmX = 0.95 + Math.max(0, -strideCos) * 0.25;
      haoriPitch = -0.58 + Math.sin(t * 11) * 0.12;
    } else if (this.playerState === 'block') {
      const isParryFlash = this.parryWindowTimer > 0;
      hipY = 0.83;
      torsoPitch = -0.14;
      torsoYaw = 0.28;
      headYaw = -0.22;
      rShoulderX = isParryFlash ? 1.18 : 1.02;
      rShoulderZ = -0.28;
      rForearmX = isParryFlash ? 0.98 : 0.88;
      lShoulderX = isParryFlash ? 1.1 : 0.94;
      lShoulderZ = 0.44;
      lForearmX = 1.05;
      weaponRotX = -Math.PI / 2 + 0.42;
      weaponRotZ = isParryFlash ? 1.02 : 0.86;
      haoriPitch = -0.28;
    } else if (this.playerState === 'attack') {
      const p = Math.min(1, this.actionTimer / Math.max(0.05, this.actionDuration));
      // Ease-out snap for strikes so impacts feel crisp and weighty
      const snap = 1 - Math.pow(1 - p, 2.6);
      const swingCurve = Math.sin(p * Math.PI);
      haoriPitch = -0.45 - swingCurve * 0.28;

      if (this.attackVariant === 'crimson_cross') {
        hipY = 0.84 - swingCurve * 0.08;
        hipYaw = (0.5 - snap) * 0.65;
        torsoPitch = -0.22 - swingCurve * 0.26;
        torsoYaw = (0.5 - snap) * 2.1;
        torsoRoll = (snap - 0.5) * 0.36;
        rShoulderX = 1.65 - snap * 1.45;
        rShoulderZ = -0.65 + snap * 1.35;
        rForearmX = 0.35 + swingCurve * 0.3;
        lShoulderX = 1.35 - snap * 1.1;
        lShoulderZ = 0.6 - snap * 0.9;
        lForearmX = 0.5;
        weaponRotX = -Math.PI / 2 + 0.12;
        weaponRotZ = -0.45 + snap * 0.9;
        legSwing = 0.38;
      } else if (this.attackVariant === 'eclipse_judgment') {
        const rise = p < 0.36 ? p / 0.36 : 1 - (p - 0.36) / 0.64;
        hipY = 0.88 + rise * 0.24 - (p > 0.45 ? 0.14 : 0);
        torsoPitch = p < 0.35 ? 0.16 : -0.48 * Math.min(1, (p - 0.35) * 2.2);
        torsoYaw = Math.sin(p * Math.PI) * 0.25;
        rShoulderX = p < 0.35 ? 2.45 : 2.45 - Math.min(1, (p - 0.35) / 0.45) * 2.35;
        rShoulderZ = -0.18;
        rForearmX = p < 0.35 ? 0.65 : 0.2;
        lShoulderX = rShoulderX - 0.15;
        lShoulderZ = 0.32;
        lForearmX = rForearmX + 0.15;
        weaponRotX = -Math.PI / 2 - 0.15;
        legSwing = p > 0.35 ? 0.45 : -0.25;
      } else if (this.attackVariant === 'tempest_whirl') {
        hipY = 0.82;
        torsoPitch = -0.22;
        torsoYaw = snap * Math.PI * 2.4;
        torsoRoll = 0.14;
        rShoulderX = 1.25;
        rShoulderZ = 0.72;
        rForearmX = 0.25;
        lShoulderX = 0.9;
        lShoulderZ = -0.55;
        lForearmX = 0.65;
        weaponRotZ = 1.35;
        legSwing = Math.sin(p * Math.PI * 2) * 0.35;
      } else if (this.attackVariant === 'shadow_pierce' || this.attackVariant === 'iai_counter') {
        hipY = 0.75;
        torsoPitch = -0.44;
        torsoYaw = this.attackVariant === 'shadow_pierce' ? 0.35 : (0.5 - snap) * 1.4;
        headPitch = 0.28;
        rShoulderX = 1.48;
        rShoulderZ = this.attackVariant === 'shadow_pierce' ? -0.05 : -0.8 + snap * 1.6;
        rForearmX = 0.15;
        lShoulderX = -0.45;
        lForearmX = 0.75;
        weaponRotX = -Math.PI / 2 - 0.08;
        weaponRotZ = this.attackVariant === 'shadow_pierce' ? 0 : 1.1;
        legSwing = 0.55;
      } else if (this.attackVariant === 'breaker' || this.attackKind === 'heavy') {
        const wind = Math.min(1, p / 0.32);
        const drop = Math.max(0, Math.min(1, (p - 0.32) / 0.42));
        hipY = 0.88 - drop * 0.11;
        torsoPitch = 0.14 * wind - 0.46 * drop;
        torsoYaw = -0.22 * wind + 0.35 * drop;
        rShoulderX = 0.7 + 1.75 * wind - 2.25 * drop;
        rShoulderZ = -0.15;
        rForearmX = 0.75 * wind - 0.55 * drop;
        lShoulderX = rShoulderX - 0.2;
        lShoulderZ = 0.35;
        lForearmX = rForearmX + 0.2;
        weaponRotX = -Math.PI / 2 + 0.1;
        legSwing = drop * 0.42;
      } else if (this.attackVariant === 'light1') {
        hipY = 0.85;
        torsoPitch = -0.2;
        torsoYaw = -0.55 + snap * 1.25;
        torsoRoll = -0.12 + snap * 0.24;
        rShoulderX = 1.28;
        rShoulderZ = 0.82 - snap * 1.65;
        rForearmX = 0.35;
        lShoulderX = 0.45;
        lForearmX = 0.9;
        weaponRotZ = 0.95;
        legSwing = 0.28;
      } else if (this.attackVariant === 'light2') {
        hipY = 0.85;
        torsoPitch = -0.18;
        torsoYaw = 0.65 - snap * 1.3;
        torsoRoll = 0.14 - snap * 0.26;
        rShoulderX = 1.18 + swingCurve * 0.3;
        rShoulderZ = -0.78 + snap * 1.65;
        rForearmX = 0.32;
        lShoulderX = 0.55;
        lForearmX = 0.85;
        weaponRotZ = -0.88;
        legSwing = -0.26;
      } else if (this.attackVariant === 'light3') {
        hipY = 0.83;
        torsoPitch = -0.28;
        torsoYaw = -0.35 + snap * 0.85;
        rShoulderX = 2.0 - snap * 1.85;
        rShoulderZ = 0.28 - snap * 0.7;
        rForearmX = 0.28;
        lShoulderX = 0.7;
        lForearmX = 0.85;
        weaponRotZ = 0.35;
        legSwing = 0.35;
      } else if (this.attackVariant === 'bow_shot') {
        // Archer draw pose: left arm extended straight ahead with bow, right hand pulling bowstring
        hipY = 0.87;
        torsoPitch = -0.06;
        torsoYaw = -0.58;
        headYaw = 0.52;
        rShoulderX = 1.15;
        rShoulderZ = 0.35;
        rForearmX = 1.25;
        lShoulderX = 1.52;
        lShoulderZ = -0.08;
        lForearmX = 0.12;
        weaponRotX = -Math.PI / 2 - 0.8;
        legSwing = 0.22;
      } else {
        // light4 full horizontal spin cleave
        hipY = 0.82;
        torsoPitch = -0.25;
        torsoYaw = snap * Math.PI * 1.95;
        rShoulderX = 1.35;
        rShoulderZ = 0.55;
        rForearmX = 0.22;
        lShoulderX = 0.55;
        lShoulderZ = -0.45;
        weaponRotZ = 1.32;
        legSwing = 0.32;
      }
    } else if (this.playerState === 'dodge') {
      hipY = 0.68;
      torsoPitch = -0.48;
      headPitch = 0.32;
      rShoulderX = -0.55;
      rShoulderZ = 0.28;
      rForearmX = 0.7;
      lShoulderX = -0.45;
      lShoulderZ = -0.28;
      lForearmX = 0.8;
      legSwing = 0.45;
      haoriPitch = -0.78;
    } else if (this.playerState === 'stagger') {
      hipY = 0.84;
      torsoPitch = 0.28;
      torsoRoll = 0.14;
      headPitch = -0.22;
      rShoulderX = -0.15;
      rShoulderZ = 0.52;
      rForearmX = 0.4;
      lShoulderX = -0.1;
      lShoulderZ = -0.52;
      lForearmX = 0.4;
      haoriPitch = -0.05;
    } else if (this.playerState === 'dead') {
      // Dramatic kneel-and-collapse animation
      hipY = 0.24;
      torsoPitch = -0.52;
      headPitch = -0.35;
      rShoulderX = 0.15;
      rShoulderZ = 0.42;
      rForearmX = 0.25;
      lShoulderX = 0.2;
      lShoulderZ = -0.42;
      lForearmX = 0.35;
      legSwing = -0.35;
      haoriPitch = -0.15;
      rootCollapseX = -Math.PI * 0.46;
    }

    r.root.rotation.x = THREE.MathUtils.damp(r.root.rotation.x, rootCollapseX, 6.5, dt);
    r.hips.position.y = THREE.MathUtils.damp(r.hips.position.y, hipY, 16, dt);
    r.hips.rotation.y = THREE.MathUtils.damp(r.hips.rotation.y, hipYaw, 16, dt);
    r.torso.rotation.x = THREE.MathUtils.damp(r.torso.rotation.x, torsoPitch, 18, dt);
    r.torso.rotation.y = THREE.MathUtils.damp(r.torso.rotation.y, torsoYaw, 20, dt);
    r.torso.rotation.z = THREE.MathUtils.damp(r.torso.rotation.z, torsoRoll, 18, dt);
    r.head.rotation.x = THREE.MathUtils.damp(r.head.rotation.x, headPitch, 14, dt);
    r.head.rotation.y = THREE.MathUtils.damp(r.head.rotation.y, headYaw, 14, dt);
    r.rightShoulder.rotation.x = THREE.MathUtils.damp(r.rightShoulder.rotation.x, rShoulderX, 22, dt);
    r.rightShoulder.rotation.z = THREE.MathUtils.damp(r.rightShoulder.rotation.z, rShoulderZ, 22, dt);
    r.rightForearm.rotation.x = THREE.MathUtils.damp(r.rightForearm.rotation.x, rForearmX, 22, dt);
    r.leftShoulder.rotation.x = THREE.MathUtils.damp(r.leftShoulder.rotation.x, lShoulderX, 18, dt);
    r.leftShoulder.rotation.z = THREE.MathUtils.damp(r.leftShoulder.rotation.z, lShoulderZ, 18, dt);
    r.leftForearm.rotation.x = THREE.MathUtils.damp(r.leftForearm.rotation.x, lForearmX, 18, dt);
    r.leftLeg.rotation.x = THREE.MathUtils.damp(r.leftLeg.rotation.x, legSwing, 16, dt);
    r.rightLeg.rotation.x = THREE.MathUtils.damp(r.rightLeg.rotation.x, -legSwing, 16, dt);
    r.haori.rotation.x = THREE.MathUtils.damp(r.haori.rotation.x, haoriPitch, 12, dt);
    r.weaponPivot.rotation.x = THREE.MathUtils.damp(r.weaponPivot.rotation.x, weaponRotX, 20, dt);
    r.weaponPivot.rotation.y = THREE.MathUtils.damp(r.weaponPivot.rotation.y, weaponRotY, 20, dt);
    r.weaponPivot.rotation.z = THREE.MathUtils.damp(r.weaponPivot.rotation.z, weaponRotZ, 20, dt);

    // Hero Katana active blade glow & Bow equip visibility
    const isBowPose = this.playerState === 'attack' && this.attackVariant === 'bow_shot';
    if (r.backBow) r.backBow.visible = this.bowUnlocked && !isBowPose;
    if (r.drawnBow) r.drawnBow.visible = this.bowUnlocked && isBowPose;

    if (this.playerState === 'attack' && !isBowPose) {
      r.bladeGlowMesh.visible = true;
      const gMat = r.bladeGlowMesh.material as THREE.MeshBasicMaterial;
      if (this.attackVariant === 'crimson_cross' || this.attackVariant === 'eclipse_judgment') {
        gMat.color.setHex(0xe12d39);
      } else if (this.attackVariant === 'breaker' || this.attackVariant === 'heavy') {
        gMat.color.setHex(0xf59e0b);
      } else {
        gMat.color.setHex(0x38bdf8);
      }
    } else {
      r.bladeGlowMesh.visible = false;
    }
  }

  private animateSamuraiIdle(rig: ArticulatedSamuraiRig, t: number): void {
    const breath = Math.sin(t * 2.0);
    if (rig.backBow) rig.backBow.visible = this.bowUnlocked;
    if (rig.drawnBow) rig.drawnBow.visible = false;
    rig.root.rotation.x = 0;
    rig.hips.position.y = 0.88 + breath * 0.014;
    rig.torso.rotation.x = -0.08 + breath * 0.015;
    rig.torso.rotation.y = -0.1 + Math.sin(t * 0.85) * 0.04;
    rig.torso.rotation.z = 0;
    rig.head.rotation.y = 0.08 + Math.sin(t * 0.7) * 0.04;
    rig.rightShoulder.rotation.x = 0.62 + breath * 0.04;
    rig.rightShoulder.rotation.z = -0.14;
    rig.rightForearm.rotation.x = 0.78;
    rig.leftShoulder.rotation.x = 0.54;
    rig.leftShoulder.rotation.z = 0.22;
    rig.leftForearm.rotation.x = 0.86;
    rig.weaponPivot.rotation.set(-Math.PI / 2 + 0.28, 0, 0);
    rig.haori.rotation.x = -0.18 + Math.sin(t * 2.7) * 0.05;
  }

  private animateEnemyRig(e: ActiveEnemy, dt: number): void {
    const r = e.rig;
    const t = this.elapsed;
    let hipY = 0.88;
    let hipYaw = 0;
    let torsoPitch = -0.08;
    let torsoYaw = 0;
    let torsoRoll = 0;
    let rShoulderX = 0.55;
    let rShoulderZ = -0.12;
    let rForearmX = 0.75;
    let lShoulderX = 0.45;
    let lShoulderZ = 0.16;
    let lForearmX = 0.8;
    let legSwing = 0;
    let weaponRotZ = 0;
    let haoriPitch = -0.18;

    if (e.isGuarding) {
      hipY = 0.84;
      torsoPitch = -0.12;
      torsoYaw = 0.24;
      rShoulderX = 1.05;
      rShoulderZ = -0.28;
      rForearmX = 0.92;
      lShoulderX = 0.92;
      lShoulderZ = 0.4;
      lForearmX = 1.02;
      weaponRotZ = 0.92;
    } else if (e.state === 'chase') {
      const stride = Math.sin(t * 10.5 + e.pos.x);
      hipY = 0.87 + Math.abs(stride) * 0.04;
      hipYaw = stride * 0.12;
      torsoPitch = -0.2;
      torsoYaw = -stride * 0.14;
      legSwing = stride * 0.48;
      rShoulderX = 0.32 + Math.cos(t * 10.5) * 0.22;
      rForearmX = 0.82;
      lShoulderX = 0.48 - Math.cos(t * 10.5) * 0.28;
      lForearmX = 0.88;
      haoriPitch = -0.45 + Math.sin(t * 9) * 0.08;
    } else if (e.state === 'windup') {
      if (e.telegraph === 'magic') {
        // Boss arcane ritual levitation pose
        hipY = 0.98 + Math.sin(t * 14) * 0.03;
        torsoPitch = 0.18;
        rShoulderX = 2.05;
        rShoulderZ = 0.55;
        rForearmX = 0.35;
        lShoulderX = 2.05;
        lShoulderZ = -0.55;
        lForearmX = 0.35;
        haoriPitch = -0.55;
      } else if (e.telegraph === 'bow') {
        // Archer draw stance: left arm extended forward, right arm drawn back
        hipY = 0.85;
        torsoYaw = -0.65;
        rShoulderX = 1.15;
        rShoulderZ = 0.45;
        rForearmX = 1.15;
        lShoulderX = 1.48;
        lShoulderZ = -0.1;
        lForearmX = 0.15;
        haoriPitch = -0.3;
      } else if (e.telegraph === 'bomb') {
        // Overhead bomb-lob preparation
        hipY = 0.9;
        torsoPitch = 0.22;
        rShoulderX = 2.4;
        rShoulderZ = -0.2;
        rForearmX = 0.55;
        lShoulderX = 1.85;
        lShoulderZ = 0.3;
        lForearmX = 0.55;
        haoriPitch = -0.4;
      } else {
        hipY = 0.85;
        torsoPitch = 0.14;
        torsoYaw = -0.35;
        rShoulderX = 2.15;
        rShoulderZ = 0.28;
        rForearmX = 0.55;
        lShoulderX = 0.85;
        lShoulderZ = 0.25;
        lForearmX = 0.95;
        haoriPitch = -0.1;
      }
    } else if (e.state === 'strike') {
      hipY = 0.82;
      torsoPitch = -0.36;
      torsoYaw = 0.48;
      torsoRoll = 0.12;
      rShoulderX = 0.35;
      rShoulderZ = -0.58;
      rForearmX = 0.2;
      lShoulderX = e.spec.archetype === 'shinobi' ? 1.15 : 0.2;
      lShoulderZ = e.spec.archetype === 'shinobi' ? 0.35 : -0.2;
      lForearmX = 0.45;
      legSwing = 0.38;
      weaponRotZ = 0.45;
      haoriPitch = -0.6;
    } else if (e.state === 'stagger') {
      hipY = 0.82;
      torsoPitch = 0.32;
      torsoRoll = -0.14;
      rShoulderX = -0.25;
      rShoulderZ = 0.55;
      rForearmX = 0.35;
      lShoulderX = -0.2;
      lShoulderZ = -0.55;
      lForearmX = 0.35;
    }

    if (e.hitFlashTimer > 0 && e.state !== 'windup') {
      r.bladeGlowMesh.visible = true;
      (r.bladeGlowMesh.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
    } else if (e.state !== 'windup') {
      r.bladeGlowMesh.visible = false;
    }

    r.hips.position.y = THREE.MathUtils.damp(r.hips.position.y, hipY, 14, dt);
    r.hips.rotation.y = THREE.MathUtils.damp(r.hips.rotation.y, hipYaw, 14, dt);
    r.torso.rotation.x = THREE.MathUtils.damp(r.torso.rotation.x, torsoPitch, 16, dt);
    r.torso.rotation.y = THREE.MathUtils.damp(r.torso.rotation.y, torsoYaw, 16, dt);
    r.torso.rotation.z = THREE.MathUtils.damp(r.torso.rotation.z, torsoRoll, 16, dt);
    r.rightShoulder.rotation.x = THREE.MathUtils.damp(r.rightShoulder.rotation.x, rShoulderX, 18, dt);
    r.rightShoulder.rotation.z = THREE.MathUtils.damp(r.rightShoulder.rotation.z, rShoulderZ, 18, dt);
    r.rightForearm.rotation.x = THREE.MathUtils.damp(r.rightForearm.rotation.x, rForearmX, 18, dt);
    r.leftShoulder.rotation.x = THREE.MathUtils.damp(r.leftShoulder.rotation.x, lShoulderX, 16, dt);
    r.leftShoulder.rotation.z = THREE.MathUtils.damp(r.leftShoulder.rotation.z, lShoulderZ, 16, dt);
    r.leftForearm.rotation.x = THREE.MathUtils.damp(r.leftForearm.rotation.x, lForearmX, 16, dt);
    r.leftLeg.rotation.x = THREE.MathUtils.damp(r.leftLeg.rotation.x, legSwing, 14, dt);
    r.rightLeg.rotation.x = THREE.MathUtils.damp(r.rightLeg.rotation.x, -legSwing, 14, dt);
    r.weaponPivot.rotation.z = THREE.MathUtils.damp(r.weaponPivot.rotation.z, weaponRotZ, 18, dt);
    r.haori.rotation.x = THREE.MathUtils.damp(r.haori.rotation.x, haoriPitch, 12, dt);
  }

  private updateVfx(worldDt: number, heroDt: number): void {
    // Dual-layer sweeping slash ribbon (runs at full heroDt even during Cronostasi!)
    if (this.slashArcTimer > 0) {
      this.slashArcTimer -= heroDt;
      const tProg = 1 - Math.max(0, this.slashArcTimer / this.slashArcMaxTimer);
      const alpha = Math.max(0, this.slashArcTimer / this.slashArcMaxTimer);
      this.slashArcMesh.position.set(this.playerPos.x, this.playerPos.y + 1.22, this.playerPos.z);
      this.slashArcOuterMesh.position.set(this.playerPos.x, this.playerPos.y + 1.22, this.playerPos.z);

      const sweepYaw = this.playerYaw + (tProg - 0.5) * 0.7 * this.slashArcSpinDir;
      this.slashArcMesh.rotation.y = sweepYaw;
      this.slashArcOuterMesh.rotation.y = sweepYaw;

      this.slashArcMat.opacity = alpha * 0.88;
      this.slashArcOuterMat.opacity = alpha * 0.55;
      const sc = 1 + tProg * 0.34;
      this.slashArcMesh.scale.setScalar(sc);
      this.slashArcOuterMesh.scale.setScalar(sc * 1.06);

      if (this.slashArcTimer <= 0) {
        this.slashArcMesh.visible = false;
        this.slashArcOuterMesh.visible = false;
      }
    }

    // Pooled Shockwave Rings
    for (let i = 0; i < this.shockwavePool.length; i++) {
      const sw = this.shockwavePool[i];
      if (!sw.active) continue;
      sw.life -= heroDt;
      if (sw.life <= 0) {
        sw.active = false;
        sw.mesh.visible = false;
      } else {
        const prog = 1 - sw.life / sw.maxLife;
        sw.mesh.scale.setScalar(0.55 + prog * sw.maxScale);
        sw.mat.opacity = (1 - prog) * 0.82;
      }
    }

    const dt = worldDt;

    // Crimson Cross 5.5m Slicing Energy Projectiles
    for (let i = this.crossProjectiles.length - 1; i >= 0; i--) {
      const proj = this.crossProjectiles[i];
      const step = proj.speed * dt;
      proj.pos.addScaledVector(proj.dir, step);
      proj.distTraveled += step;
      proj.group.position.copy(proj.pos);

      const remainNorm = Math.max(0, 1 - proj.distTraveled / proj.maxDist);
      proj.group.scale.set(1 + (1 - remainNorm) * 0.55, 1 + (1 - remainNorm) * 0.25, 1);

      // Trail sparks along the slicing cross path
      if (Math.random() < 0.75) {
        _v2.set(
          proj.pos.x + (Math.random() - 0.5) * 1.1,
          0.35 + Math.random() * 1.3,
          proj.pos.z + (Math.random() - 0.5) * 1.1,
        );
        this.spawnSparks(_v2, 2, 0xe12d39);
      }

      // Slice every enemy along the 5.5m path
      for (const enemy of this.enemies) {
        if (enemy.state === 'dead' || proj.hitIds.has(enemy.spec.id)) continue;
        const dx = enemy.pos.x - proj.pos.x;
        const dz = enemy.pos.z - proj.pos.z;
        const dSq = dx * dx + dz * dz;
        if (dSq <= 1.65 * 1.65) {
          proj.hitIds.add(enemy.spec.id);
          enemy.isGuarding = false;
          enemy.guardTimer = 0;
          const isCritical = enemy.state === 'stagger';
          _v2.copy(proj.dir);
          this.applyHitToEnemy(
            enemy,
            isCritical ? 78 : 54,
            52,
            _v2,
            19.5,
            isCritical,
            true,
          );
          _v3.copy(enemy.pos).setY(1.25);
          this.spawnSparks(_v3, 18, 0xe12d39);
          this.spawnShockwave(enemy.pos, 0xe12d39, 3.0, 0.28);
        }
      }

      if (proj.distTraveled >= proj.maxDist) {
        this.vfxGroup.remove(proj.group);
        proj.group.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material as THREE.Material;
            mat?.dispose();
          }
        });
        this.crossProjectiles.splice(i, 1);
      }
    }

    // Hero Guard / Perfect Parry directional arc indicator
    if (this.playerState === 'block') {
      this.heroGuardRingMesh.visible = true;
      this.heroGuardRingMesh.position.set(this.playerPos.x, 0.14, this.playerPos.z);
      this.heroGuardRingMesh.rotation.y = this.playerYaw;
      if (this.parryWindowTimer > 0) {
        this.heroGuardRingMat.color.setHex(0x38bdf8);
        this.heroGuardRingMat.opacity = 0.92;
        this.heroGuardRingMesh.scale.setScalar(1.18);
      } else {
        this.heroGuardRingMat.color.setHex(0x1d4ed8);
        this.heroGuardRingMat.opacity = 0.48;
        this.heroGuardRingMesh.scale.setScalar(0.95);
      }
    } else {
      this.heroGuardRingMesh.visible = false;
    }

    // Magic Orbs (Boss bolts — dodge or Perfect Parry to reflect!)
    for (let i = this.magicOrbs.length - 1; i >= 0; i--) {
      const orb = this.magicOrbs[i];
      orb.life -= dt;
      orb.pos.addScaledVector(orb.dir, orb.speed * dt);
      orb.group.position.copy(orb.pos);
      orb.group.rotation.y += dt * 5.0;
      orb.group.rotation.x += dt * 3.5;

      let consumed = orb.life <= 0;

      if (!consumed && !orb.reflected) {
        const dx = this.playerPos.x - orb.pos.x;
        const dz = this.playerPos.z - orb.pos.z;
        if (dx * dx + dz * dz < 0.95 * 0.95) {
          if (this.playerState === 'block' && this.parryWindowTimer > 0) {
            // Perfect Parry reflects the arcane orb back at the Boss!
            orb.reflected = true;
            orb.speed = 20.5;
            orb.life = 2.6;
            const target = orb.owner.state !== 'dead' ? orb.owner : this.enemies.find((e) => e.state !== 'dead');
            if (target) {
              orb.dir.subVectors(target.pos, orb.pos);
              orb.dir.y = 0;
              if (orb.dir.lengthSq() > 0.001) orb.dir.normalize();
            } else {
              orb.dir.negate();
            }
            orb.coreMat.color.setHex(0xffffff);
            orb.haloMat.color.setHex(0x38bdf8);
            this.hitStopTimer = 0.04;
            this.camShake = Math.max(this.camShake, 0.14);
            this.spawnSparks(orb.pos, 18, 0x38bdf8);
            this.spawnShockwave(orb.pos, 0x38bdf8, 2.6, 0.25);
            this.audio.playSpatial('parry_perfect', orb.pos, 1.15);
            this.callbacks.onParryStat();
            this.pushFeedback('MAGIA DEVIATA!', 'parry');
          } else if (this.playerState === 'block') {
            this.playerPosture += 22;
            this.playerHp = Math.max(0, this.playerHp - 5);
            this.spawnSparks(orb.pos, 8, 0x8b5cf6);
            this.audio.playSpatial('block_clang', orb.pos);
            consumed = true;
            if (this.playerHp <= 0) this.handlePlayerDeath();
          } else if (this.invulnTimer <= 0) {
            this.playerHp = Math.max(0, this.playerHp - orb.damage);
            this.playerKnockbackVel.set(orb.dir.x * 8.5, 0, orb.dir.z * 8.5);
            this.camShake = Math.max(this.camShake, 0.16);
            this.spawnSparks(orb.pos, 12, 0x8b5cf6);
            this.audio.playSpatial('hit_flesh', this.playerPos);
            this.pushFeedback(`-${orb.damage} HP`, 'damage');
            consumed = true;
            if (this.playerHp <= 0) this.handlePlayerDeath();
          }
        }
      } else if (!consumed && orb.reflected) {
        for (const enemy of this.enemies) {
          if (enemy.state === 'dead') continue;
          const dx = enemy.pos.x - orb.pos.x;
          const dz = enemy.pos.z - orb.pos.z;
          if (dx * dx + dz * dz < 1.38 * 1.38) {
            _v2.copy(orb.dir);
            this.applyHitToEnemy(enemy, 42, 46, _v2, 12.0, true, true);
            this.spawnSparks(orb.pos, 18, 0x38bdf8);
            this.spawnShockwave(enemy.pos, 0x38bdf8, 3.0, 0.28);
            consumed = true;
            break;
          }
        }
      }

      if (consumed) {
        this.vfxGroup.remove(orb.group);
        orb.coreMat.dispose();
        orb.haloMat.dispose();
        this.magicOrbs.splice(i, 1);
      }
    }

    // Pre-telegraphed Falling Meteors (ground warning fill + visible descending magma rock)
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.timer -= dt;
      const prog = Math.max(0, Math.min(1, 1 - m.timer / m.duration));

      // Fill grows from center out to exact impact radius so player sees exact impact moment
      m.fillMesh.scale.setScalar(0.14 + prog * (m.radius - 0.14));
      m.fillMat.opacity = 0.24 + prog * 0.38;
      m.ringMat.opacity = 0.72 + Math.sin(this.elapsed * 20) * 0.22;

      // Meteor visibly descends from sky (y=26) down to ground (y=0.45) BEFORE impact!
      m.rockMesh.position.y = 26 * (1 - prog * prog) + 0.45;
      m.rockMesh.rotation.x += dt * 4.2;
      m.rockMesh.rotation.y += dt * 3.1;
      m.beamMat.opacity = (1 - prog * 0.5) * 0.24;

      if (m.timer <= 0) {
        _v2.set(m.targetPos.x, 0.12, m.targetPos.z);
        this.spawnShockwave(_v2, 0xf97316, 4.6, 0.42);
        _v2.setY(0.5);
        this.spawnSparks(_v2, 20, 0xf97316);
        this.audio.playSpatial('meteor_impact', m.targetPos, 1.2);
        this.camShake = Math.max(this.camShake, 0.24);

        const dx = this.playerPos.x - m.targetPos.x;
        const dz = this.playerPos.z - m.targetPos.z;
        if (dx * dx + dz * dz <= m.radius * m.radius && this.invulnTimer <= 0 && this.playerState !== 'dead') {
          this.playerHp = Math.max(0, this.playerHp - m.damage);
          _v3.set(dx, 0, dz);
          if (_v3.lengthSq() > 0.001) _v3.normalize();
          else _v3.set(0, 0, 1);
          this.playerKnockbackVel.set(_v3.x * 12.5, 0, _v3.z * 12.5);
          this.audio.playSpatial('hit_flesh', this.playerPos);
          this.pushFeedback(`-${m.damage} HP · IMPATTO METEORICO`, 'damage');
          if (this.playerHp <= 0) {
            this.handlePlayerDeath();
          } else {
            this.playerState = 'stagger';
            this.actionTimer = 0;
            this.actionDuration = 0.34;
          }
        }

        this.vfxGroup.remove(m.ringMesh, m.fillMesh, m.beamMesh, m.rockMesh);
        m.ringMat.dispose();
        m.fillMat.dispose();
        m.beamMat.dispose();
        m.rockMat.dispose();
        this.meteors.splice(i, 1);
      }
    }

    // Boss Energy Bow Arrows (dodge, jump over, or Perfect Parry to deflect!)
    for (let i = this.bossArrows.length - 1; i >= 0; i--) {
      const arr = this.bossArrows[i];
      arr.life -= dt;
      arr.pos.addScaledVector(arr.dir, arr.speed * dt);
      arr.group.position.copy(arr.pos);

      let consumed = arr.life <= 0;
      if (!consumed && !arr.reflected) {
        const dx = this.playerPos.x - arr.pos.x;
        const dz = this.playerPos.z - arr.pos.z;
        const dy = Math.abs(this.playerPos.y + 1.05 - arr.pos.y);
        if (dx * dx + dz * dz < 0.85 * 0.85 && dy < 0.9) {
          if (this.playerState === 'block' && this.parryWindowTimer > 0) {
            arr.reflected = true;
            arr.speed = 26.0;
            arr.life = 1.8;
            arr.dir.negate();
            arr.group.rotation.y += Math.PI;
            arr.coreMat.color.setHex(0x38bdf8);
            this.hitStopTimer = 0.032;
            this.spawnSparks(arr.pos, 14, 0x38bdf8);
            this.audio.playSpatial('parry_perfect', arr.pos, 1.1);
            this.callbacks.onParryStat();
            this.pushFeedback('FRECCIA DEVIATA!', 'parry');
          } else if (this.playerState === 'block') {
            this.playerPosture += 20;
            this.playerHp = Math.max(0, this.playerHp - 5);
            this.spawnSparks(arr.pos, 8, 0xfbbf24);
            this.audio.playSpatial('block_clang', arr.pos);
            consumed = true;
            if (this.playerHp <= 0) this.handlePlayerDeath();
          } else if (this.invulnTimer <= 0) {
            this.playerHp = Math.max(0, this.playerHp - arr.damage);
            this.playerKnockbackVel.set(arr.dir.x * 7.5, 0, arr.dir.z * 7.5);
            this.camShake = Math.max(this.camShake, 0.14);
            this.spawnSparks(arr.pos, 12, 0xf43f5e);
            this.audio.playSpatial('hit_flesh', this.playerPos);
            this.pushFeedback(`-${arr.damage} HP · FRECCIA`, 'damage');
            consumed = true;
            if (this.playerHp <= 0) this.handlePlayerDeath();
          }
        }
      } else if (!consumed && arr.reflected) {
        for (const enemy of this.enemies) {
          if (enemy.state === 'dead') continue;
          const dx = enemy.pos.x - arr.pos.x;
          const dz = enemy.pos.z - arr.pos.z;
          if (dx * dx + dz * dz < 1.3 * 1.3) {
            _v2.copy(arr.dir);
            this.applyHitToEnemy(enemy, 38, 36, _v2, 9.0, true, false);
            this.spawnSparks(arr.pos, 16, 0x38bdf8);
            consumed = true;
            break;
          }
        }
      }

      if (consumed) {
        this.vfxGroup.remove(arr.group);
        arr.coreMat.dispose();
        this.bossArrows.splice(i, 1);
      }
    }

    // Sakiro Straight Hero Arrows (run at full heroDt even during Cronostasi!)
    for (let i = this.heroArrows.length - 1; i >= 0; i--) {
      const arr = this.heroArrows[i];
      arr.life -= heroDt;
      arr.pos.addScaledVector(arr.dir, arr.speed * heroDt);
      arr.group.position.copy(arr.pos);

      if (Math.random() < 0.65) {
        this.spawnSparks(arr.pos, 1, 0x38bdf8);
      }

      let consumed = arr.life <= 0;
      if (!consumed) {
        for (const enemy of this.enemies) {
          if (enemy.state === 'dead') continue;
          const dx = enemy.pos.x - arr.pos.x;
          const dz = enemy.pos.z - arr.pos.z;
          const dy = Math.abs(enemy.pos.y + 1.15 - arr.pos.y);
          if (dx * dx + dz * dz < 1.28 * 1.28 && dy < 1.45) {
            enemy.isGuarding = false;
            enemy.guardTimer = 0;
            const isCritical = enemy.state === 'stagger';
            _v2.copy(arr.dir);
            this.applyHitToEnemy(
              enemy,
              isCritical ? Math.round(arr.damage * 1.45) : arr.damage,
              arr.postureDmg,
              _v2,
              11.5,
              isCritical,
              true,
            );
            this.spawnSparks(arr.pos, 18, 0x38bdf8);
            this.spawnShockwave(enemy.pos, 0x38bdf8, 2.8, 0.26);
            consumed = true;
            break;
          }
        }
      }

      if (consumed) {
        this.vfxGroup.remove(arr.group);
        arr.coreMat.dispose();
        this.heroArrows.splice(i, 1);
      }
    }

    // Boss Parabolic Explosive Bombs (visible landing zone + countdown fill before blast!)
    for (let i = this.bossBombs.length - 1; i >= 0; i--) {
      const b = this.bossBombs[i];
      if (b.flightTimer < b.flightDuration) {
        b.flightTimer = Math.min(b.flightDuration, b.flightTimer + dt);
        const u = b.flightTimer / b.flightDuration;
        b.mesh.position.lerpVectors(b.startPos, b.targetPos, u);
        b.mesh.position.y += Math.sin(u * Math.PI) * 4.2 + 0.28 * (1 - u);
        b.mesh.rotation.x += dt * 7;
        b.mesh.rotation.z += dt * 5;
      } else {
        b.fuseTimer -= dt;
        const fuseProg = 1 - Math.max(0, b.fuseTimer / b.fuseDuration);
        b.fillMesh.scale.setScalar(0.15 + fuseProg * (b.radius - 0.15));
        b.fillMat.opacity = 0.22 + fuseProg * 0.42;
        b.bombMat.emissiveIntensity = 1.4 + Math.sin(this.elapsed * 28) * 1.1;

        if (b.fuseTimer <= 0) {
          _v2.set(b.targetPos.x, 0.12, b.targetPos.z);
          this.spawnShockwave(_v2, 0xf97316, 4.8, 0.4);
          _v2.setY(0.55);
          this.spawnSparks(_v2, 22, 0xf97316);
          this.audio.playSpatial('bomb_explode', b.targetPos, 1.2);
          this.camShake = Math.max(this.camShake, 0.24);

          const dx = this.playerPos.x - b.targetPos.x;
          const dz = this.playerPos.z - b.targetPos.z;
          if (
            dx * dx + dz * dz <= b.radius * b.radius &&
            this.playerPos.y < 1.8 &&
            this.invulnTimer <= 0 &&
            this.playerState !== 'dead'
          ) {
            this.playerHp = Math.max(0, this.playerHp - b.damage);
            _v3.set(dx, 0, dz);
            if (_v3.lengthSq() > 0.001) _v3.normalize();
            else _v3.set(0, 0, 1);
            this.playerKnockbackVel.set(_v3.x * 13.0, 0, _v3.z * 13.0);
            this.audio.playSpatial('hit_flesh', this.playerPos);
            this.pushFeedback(`-${b.damage} HP · ESPLOSIONE`, 'damage');
            if (this.playerHp <= 0) {
              this.handlePlayerDeath();
            } else {
              this.playerState = 'stagger';
              this.actionTimer = 0;
              this.actionDuration = 0.32;
            }
          }

          this.vfxGroup.remove(b.mesh, b.ringMesh, b.fillMesh);
          b.bombMat.dispose();
          b.ringMat.dispose();
          b.fillMat.dispose();
          this.bossBombs.splice(i, 1);
        }
      }
    }

    const locked = this.getLockedEnemy();
    if (locked) {
      this.lockRingMesh.visible = true;
      this.lockRingMesh.position.set(locked.pos.x, locked.pos.y + 0.04, locked.pos.z);
      this.lockRingMesh.rotation.y += dt * 2.2;
    } else {
      this.lockRingMesh.visible = false;
    }

    this.updateSparks(heroDt);
  }

  private updateSparks(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.sparkPool.length; i++) {
      const p = this.sparkPool[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.sparkInstanced.setMatrixAt(i, _mat4);
      } else {
        p.vel.y -= 15 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const s = (p.life / p.maxLife) * 1.25;
        _v1.copy(p.vel);
        if (_v1.lengthSq() > 0.001) {
          _v1.normalize();
          _quat.setFromUnitVectors(_upAxis, _v1);
        } else {
          _quat.identity();
        }
        _scale.set(s * 0.45, s * 2.4, s * 0.45);
        _mat4.compose(p.pos, _quat, _scale);
        this.sparkInstanced.setMatrixAt(i, _mat4);
        _color.setHex(p.colorHex);
        this.sparkInstanced.setColorAt(i, _color);
      }
    }
    if (anyChanged) {
      this.sparkInstanced.instanceMatrix.needsUpdate = true;
      if (this.sparkInstanced.instanceColor) {
        this.sparkInstanced.instanceColor.needsUpdate = true;
      }
    }
  }

  private updatePetals(dt: number): void {
    if (!this.petalInstanced || this.petalCount === 0) return;
    const spec = LEVELS[this.currentLevelIndex];
    for (let i = 0; i < this.petalCount; i++) {
      const idx = i * 4;
      let x = this.petalData[idx + 0];
      let y = this.petalData[idx + 1];
      let z = this.petalData[idx + 2];
      let phase = this.petalData[idx + 3];

      phase += dt * (this.isInfernalLevel ? 2.2 : 1.4);
      x += Math.sin(phase) * (this.isInfernalLevel ? 0.95 : 0.65) * dt;
      y += (this.isInfernalLevel ? 1.15 : -0.45) * dt;
      z += (this.isInfernalLevel ? 0.15 : 0.35) * dt;

      if (this.isInfernalLevel && y > 8.5) {
        y = 0.25 + Math.random() * 0.8;
        x = (Math.random() - 0.5) * (spec.widthX + 6);
        z = this.playerPos.z - 28 + Math.random() * 40;
      } else if (!this.isInfernalLevel && y < 0.1) {
        y = 5.5 + Math.random() * 2;
        x = (Math.random() - 0.5) * spec.widthX;
        z = this.playerPos.z - 22 + Math.random() * 34;
      }

      this.petalData[idx + 0] = x;
      this.petalData[idx + 1] = y;
      this.petalData[idx + 2] = z;
      this.petalData[idx + 3] = phase;

      _targetPos.set(x, y, z);
      _euler.set(phase * 0.7, phase * 1.1, phase * 0.5);
      _quat.setFromEuler(_euler);
      _scale.set(1, 1, 1);
      _mat4.compose(_targetPos, _quat, _scale);
      this.petalInstanced.setMatrixAt(i, _mat4);
    }
    this.petalInstanced.instanceMatrix.needsUpdate = true;
  }

  private updateCamera(dt: number, inp: UnifiedInput): void {
    const locked = this.getLockedEnemy();

    if (locked) {
      // Smoothly orient camera behind player looking toward locked enemy
      _v1.subVectors(locked.pos, this.playerPos);
      const desiredYaw = Math.atan2(-_v1.x, -_v1.z);
      this.camYaw = this.dampAngle(this.camYaw, desiredYaw, 6.5, dt);
      this.camPitch = THREE.MathUtils.damp(this.camPitch, 0.25, 6, dt);
    } else {
      this.camYaw -= inp.camDeltaX;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + inp.camDeltaY, 0.08, 0.85);
    }

    const camDist = locked ? 5.15 : 4.65;
    const horizDist = camDist * Math.cos(this.camPitch);
    const vertDist = camDist * Math.sin(this.camPitch) + 1.48;

    // Slight right-shoulder camera framing (+right vector = (cos(camYaw), 0, -sin(camYaw)))
    const rightX = Math.cos(this.camYaw);
    const rightZ = -Math.sin(this.camYaw);
    const shoulderOffset = locked ? 0.65 : 0.56;
    const lookRightOffset = locked ? 0.3 : 0.38;

    _targetPos.set(
      this.playerPos.x + Math.sin(this.camYaw) * horizDist + rightX * shoulderOffset,
      this.playerPos.y + vertDist,
      this.playerPos.z + Math.cos(this.camYaw) * horizDist + rightZ * shoulderOffset,
    );

    if (locked) {
      _lookTarget.lerpVectors(this.playerPos, locked.pos, 0.35);
      _lookTarget.x += rightX * lookRightOffset;
      _lookTarget.z += rightZ * lookRightOffset;
      _lookTarget.y += 1.25;
    } else {
      _lookTarget.set(
        this.playerPos.x + rightX * lookRightOffset,
        this.playerPos.y + 1.36,
        this.playerPos.z + rightZ * lookRightOffset,
      );
    }

    if (this.camShake > 0.001) {
      _targetPos.x += (Math.random() - 0.5) * this.camShake;
      _targetPos.y += (Math.random() - 0.5) * this.camShake;
      this.camShake = THREE.MathUtils.damp(this.camShake, 0, 14, dt);
    }

    // Dynamic FOV punch recovery
    if (Math.abs(this.camFov - 54) > 0.05) {
      this.camFov = THREE.MathUtils.damp(this.camFov, 54, 10, dt);
      this.camera.fov = this.camFov;
      this.camera.updateProjectionMatrix();
    }

    this.camCurrentPos.x = THREE.MathUtils.damp(this.camCurrentPos.x, _targetPos.x, 12, dt);
    this.camCurrentPos.y = THREE.MathUtils.damp(this.camCurrentPos.y, _targetPos.y, 12, dt);
    this.camCurrentPos.z = THREE.MathUtils.damp(this.camCurrentPos.z, _targetPos.z, 12, dt);
    this.camLookCurrent.lerp(_lookTarget, 1 - Math.exp(-14 * dt));

    this.camera.position.copy(this.camCurrentPos);
    this.camera.lookAt(this.camLookCurrent);
  }

  private dampAngle(current: number, target: number, lambda: number, dt: number): number {
    let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * (1 - Math.exp(-lambda * dt));
  }

  private emitHud(): void {
    const spec = LEVELS[this.currentLevelIndex];
    const cp = spec.checkpoints[this.currentCheckpointIndex];

    const targetEnemy =
      this.getLockedEnemy() ??
      this.enemies.find((e) => e.state !== 'dead' && e.spec.isBoss) ??
      this.enemies.find((e) => e.state !== 'dead') ??
      null;

    const activeEnemy: EnemyHudInfo | null = targetEnemy
      ? {
          id: targetEnemy.spec.id,
          name: targetEnemy.spec.name,
          title: targetEnemy.spec.title,
          hp: targetEnemy.hp,
          maxHp: targetEnemy.maxHp,
          posture: targetEnemy.posture,
          maxPosture: targetEnemy.maxPosture,
          isBoss: Boolean(targetEnemy.spec.isBoss),
          phase: targetEnemy.currentPhase,
          totalPhases: targetEnemy.totalPhases,
          telegraph: targetEnemy.telegraph,
          staggered: targetEnemy.state === 'stagger',
        }
      : null;

    const gp = this.lastInputSnap?.gamepadConnected ?? false;
    const heavyKey = gp ? 'Y' : 'Q';
    const lightKey = gp ? 'X' : 'Click SX';
    let comboHint: string | null = null;

    // Never spoil undiscovered secret combos! Only show hint if already discovered.
    if (this.postParryTimer > 0) {
      comboHint = 'Contrattacco Lampo pronto';
    } else if (this.combosUnlocked) {
      if (this.comboStep === 4 && this.discoveredCombos.has('crimson_cross')) {
        comboHint = `[${heavyKey}] Croce Cremisi`;
      } else if (
        (this.comboStep === 2 || this.comboStep === 3) &&
        this.discoveredCombos.has('breaker')
      ) {
        comboHint = `[${heavyKey}] Spezzaguardia`;
      } else if (this.heavyChainStage === 1 && this.discoveredCombos.has('eclipse_judgment')) {
        comboHint = `[${heavyKey}] Giudizio dell'Eclissi`;
      } else if (this.heavyOpenerStep === 2 && this.discoveredCombos.has('tempest_whirl')) {
        comboHint = `[${lightKey}] Turbine d'Acciaio`;
      } else if (this.postDodgeTimer > 0 && this.discoveredCombos.has('shadow_pierce')) {
        comboHint = `[${heavyKey}] Lampo del Vuoto`;
      }
    }

    this.callbacks.onHudUpdate({
      hp: Math.round(this.playerHp),
      maxHp: this.playerMaxHp,
      posture: Math.round(this.playerPosture),
      maxPosture: this.playerMaxPosture,
      stamina: Math.round(this.playerStamina),
      maxStamina: this.playerMaxStamina,
      isBlocking: this.playerState === 'block',
      isLockedOn: Boolean(this.lockedEnemyId),
      isAirborne: !this.isGrounded,
      comboStep: this.comboStep,
      combosUnlocked: this.combosUnlocked,
      discoveredCount: this.discoveredCombos.size,
      totalSecretCombos: SECRET_COMBOS.length,
      counterReady: this.postParryTimer > 0,
      comboHint,
      timeSlowUnlocked: this.timeSlowUnlocked,
      timeSlowActive: this.timeSlowTimer > 0,
      timeSlowRemaining: Number(this.timeSlowTimer.toFixed(1)),
      timeSlowCooldown: Math.ceil(this.timeSlowCooldown),
      bowUnlocked: this.bowUnlocked,
      bowCooldown: Math.ceil(this.bowCooldown),
      levelIndex: this.currentLevelIndex,
      levelTitle: spec.title,
      checkpointIndex: this.currentCheckpointIndex,
      checkpointName: cp.name,
      activeEnemy,
      enemiesRemaining: this.enemies.filter((e) => e.state !== 'dead').length,
      gamepadConnected: gp,
      gamepadName: this.lastInputSnap?.gamepadName ?? '',
      pointerLocked: this.input.pointerLocked,
      fpsEstimate: Math.round(this.fpsSamples),
      feedback: this.feedback,
      storySubtitle: this.storySubtitle,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.clearLevelObjects();
    this.crossBladeGeo?.dispose();
    this.crossCoreGeo?.dispose();
    this.orbCoreGeo?.dispose();
    this.orbHaloGeo?.dispose();
    this.meteorRingGeo?.dispose();
    this.meteorFillGeo?.dispose();
    this.meteorBeamGeo?.dispose();
    this.meteorRockGeo?.dispose();
    this.arrowShaftGeo?.dispose();
    this.arrowHeadGeo?.dispose();
    this.bombSphereGeo?.dispose();
    this.vfxGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    this.input.detach();
    this.audio.dispose();
    this.mats.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
