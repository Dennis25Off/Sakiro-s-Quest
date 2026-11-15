export type GameScreen = 'menu' | 'playing' | 'paused' | 'daimoku' | 'defeat' | 'victory';

export type DaimokuStatId = 'attack' | 'vitality' | 'stamina' | 'posture' | 'elixir';

export interface DaimokuUpgrades {
  attackLevel: number;
  vitalityLevel: number;
  staminaLevel: number;
  postureLevel: number;
  elixirLevel: number;
}

export type QualityPreset = 'auto' | 'low' | 'balanced' | 'high';

export type ShadowQuality = 'off' | 'standard' | 'ultra';
export type RenderScale = 'low' | 'native' | 'ultra';
export type EffectsDensity = 'low' | 'normal' | 'high';

export interface VideoSettings {
  qualityPreset: QualityPreset;
  fov: number;
  shadowQuality: ShadowQuality;
  renderScale: RenderScale;
  effectsDensity: EffectsDensity;
  cameraShake: boolean;
}

export interface AudioSettings {
  volume: number;
  muted: boolean;
  binauralEnabled: boolean;
}

export type EnemyArchetype = 'ronin' | 'shinobi' | 'enforcer' | 'boss';

export type TelegraphType = 'none' | 'normal' | 'unblockable' | 'magic' | 'bow' | 'bomb';

export type SecretComboId =
  | 'crimson_cross'
  | 'breaker'
  | 'tempest_whirl'
  | 'shadow_pierce'
  | 'eclipse_judgment'
  | 'moon_crescent'
  | 'thunder_descent'
  | 'dragon_fang';

export interface SaveData {
  version: number;
  levelIndex: number;
  checkpointIndex: number;
  unlockedLevel: number;
  playerHp: number;
  parriesTotal: number;
  defeatsTotal: number;
  storyCompleted: boolean;
  timeSlowUnlocked: boolean;
  bowUnlocked: boolean;
  discoveredCombos: SecretComboId[];
  energyOrbs: number;
  daimoku: DaimokuUpgrades;
  updatedAt: number;
}

export interface ParkourPlatformSpec {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind?: 'stone' | 'bridge' | 'pillar';
  moveAxis?: 'x' | 'y';
  moveAmp?: number;
  moveSpeed?: number;
  movePhase?: number;
}

export interface ParkourSectionSpec {
  gapZStart: number; // Closer to Z=0 (e.g. -44)
  gapZEnd: number; // Deeper along -Z (e.g. -58)
  platforms: ParkourPlatformSpec[];
}

export interface CheckpointSpec {
  id: string;
  name: string;
  subtitle: string;
  position: [number, number, number];
  triggerRadius: number;
  requiresWaveIndex?: number; // Checkpoint activates once this wave is cleared
}

export interface EnemySpawnSpec {
  id: string;
  name: string;
  title: string;
  archetype: EnemyArchetype;
  position: [number, number, number];
  maxHp: number;
  maxPosture: number;
  damage: number;
  speed: number;
  isBoss?: boolean;
  isMagicBoss?: boolean;
  canBow?: boolean;
  canBombs?: boolean;
  phases?: number;
}

export interface EnemyWaveSpec {
  id: string;
  triggerZ: number; // Triggers when player crosses this Z forward (or radius)
  arenaCenter: [number, number, number];
  arenaRadius: number;
  enemies: EnemySpawnSpec[];
  storyLine?: string;
}

export interface LevelSpec {
  index: number;
  code: string;
  title: string;
  subtitle: string;
  chapterIntro: string;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  accentColor: number;
  themeStyle:
    | 'dawn_shrine'
    | 'jade_bridge'
    | 'white_citadel'
    | 'obsidian_garden'
    | 'astral_zenith'
    | 'eclipse_abyss'
    | 'ash_gorge'
    | 'iron_bastion'
    | 'crimson_citadel'
    | 'final_sanctum';
  hiddenUntilUnlocked?: boolean;
  lengthZ: number; // Playable corridor/arena span along -Z
  widthX: number;
  spawnPos: [number, number, number];
  parkour?: ParkourSectionSpec;
  checkpoints: CheckpointSpec[];
  waves: EnemyWaveSpec[];
}

export interface EnemyHudInfo {
  id: string;
  name: string;
  title: string;
  hp: number;
  maxHp: number;
  posture: number;
  maxPosture: number;
  isBoss: boolean;
  phase: number;
  totalPhases: number;
  telegraph: TelegraphType;
  staggered: boolean;
}

export interface CombatFeedback {
  id: number;
  label: string;
  kind: 'parry' | 'break' | 'checkpoint' | 'story' | 'damage' | 'chrono' | 'special' | 'heal';
}

export interface CombatPopup {
  id: number;
  text: string;
  kind: 'hit' | 'crit' | 'damage' | 'parry' | 'break' | 'guard';
  xPct: number;
  yPct: number;
  progress: number;
}

export type DamageDirection = 'none' | 'front' | 'back' | 'left' | 'right' | 'all';

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  posture: number;
  maxPosture: number;
  stamina: number;
  maxStamina: number;
  healCharges: number;
  healMaxCharges: number;
  energyOrbs: number;
  daimoku: DaimokuUpgrades;
  isBlocking: boolean;
  isLockedOn: boolean;
  isAirborne: boolean;
  comboStep: number;
  combosUnlocked: boolean;
  discoveredCount: number;
  totalSecretCombos: number;
  counterReady: boolean;
  comboHint: string | null;
  timeSlowUnlocked: boolean;
  timeSlowActive: boolean;
  parrySlowActive?: boolean;
  timeSlowRemaining: number;
  timeSlowCooldown: number;
  bowUnlocked: boolean;
  bowCharges: number;
  bowMaxCharges: number;
  bowCooldown: number;
  levelIndex: number;
  levelTitle: string;
  checkpointIndex: number;
  checkpointName: string;
  activeEnemy: EnemyHudInfo | null;
  enemiesRemaining: number;
  gamepadConnected: boolean;
  gamepadName: string;
  pointerLocked: boolean;
  fpsEstimate: number;
  feedback: CombatFeedback | null;
  popups: CombatPopup[];
  storySubtitle: string | null;
  damageFlash: number;
  lastDamageAmount: number;
  damageSide: DamageDirection;
}
