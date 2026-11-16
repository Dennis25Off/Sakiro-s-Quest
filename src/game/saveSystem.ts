import {
  AudioSettings,
  DaimokuStatId,
  DaimokuUpgrades,
  QualityPreset,
  SaveData,
  SecretComboId,
  VideoSettings,
} from './types';

const SAVE_KEY = 'shirokaze_save_v1';
const VIDEO_SETTINGS_KEY = 'sakiro_video_settings_v1';
const AUDIO_SETTINGS_KEY = 'sakiro_audio_settings_v1';
const SAVE_VERSION = 1;
const VALID_COMBOS: SecretComboId[] = [
  'crimson_cross',
  'breaker',
  'tempest_whirl',
  'shadow_pierce',
  'eclipse_judgment',
  'moon_crescent',
  'thunder_descent',
  'dragon_fang',
];

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  qualityPreset: 'auto',
  fov: 54,
  hudScale: 1,
  shadowQuality: 'standard',
  renderScale: 'native',
  effectsDensity: 'normal',
  cameraShake: true,
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  volume: 0.85,
  muted: false,
  binauralEnabled: true,
};

export const DEFAULT_DAIMOKU_UPGRADES: DaimokuUpgrades = {
  attackLevel: 0,
  vitalityLevel: 0,
  staminaLevel: 0,
  postureLevel: 0,
  elixirLevel: 0,
};

export interface DaimokuUpgradeSpec {
  id: DaimokuStatId;
  key: keyof DaimokuUpgrades;
  name: string;
  subtitle: string;
  effectSummary: string;
  costs: readonly number[];
  maxLevel: number;
}

export const DAIMOKU_UPGRADE_SPECS: DaimokuUpgradeSpec[] = [
  {
    id: 'attack',
    key: 'attackLevel',
    name: 'Attacco',
    subtitle: 'Spada, Arti e Arco',
    effectSummary: 'Aumenta i danni inflitti con ogni attacco (+12% per grado).',
    costs: [60, 110, 175, 260, 380],
    maxLevel: 5,
  },
  {
    id: 'vitality',
    key: 'vitalityLevel',
    name: 'Salute',
    subtitle: 'Vita Massima',
    effectSummary: 'Aumenta la vita massima (+20 HP) e ti cura subito al massimo.',
    costs: [55, 105, 165, 245, 360],
    maxLevel: 5,
  },
  {
    id: 'stamina',
    key: 'staminaLevel',
    name: 'Energia',
    subtitle: 'Resistenza in Combattimento',
    effectSummary: 'Più stamina (+15) e recupero più veloce (+10% per grado).',
    costs: [50, 95, 150, 225, 330],
    maxLevel: 5,
  },
  {
    id: 'posture',
    key: 'postureLevel',
    name: 'Difesa',
    subtitle: 'Tenuta della Guardia',
    effectSummary: 'Postura più alta (+18) e meno danni quando pari (-10% per grado).',
    costs: [55, 100, 160, 235, 345],
    maxLevel: 5,
  },
  {
    id: 'elixir',
    key: 'elixirLevel',
    name: 'Cure & Stasi',
    subtitle: 'Elisir e Ricarica Abilità',
    effectSummary: '+1 Cura Totale ai gradi 1 e 3; Stasi e Arco si ricaricano prima.',
    costs: [90, 145, 220, 310, 440],
    maxLevel: 5,
  },
];

export function getDaimokuUpgradeCost(statId: DaimokuStatId, currentLevel: number): number | null {
  const spec = DAIMOKU_UPGRADE_SPECS.find((s) => s.id === statId);
  if (!spec || currentLevel >= spec.maxLevel) return null;
  return spec.costs[currentLevel] ?? null;
}

export function videoSettingsForPreset(
  preset: QualityPreset,
  currentFov = 54,
  cameraShake = true,
  currentHudScale = 1,
): VideoSettings {
  const hudScale = Math.max(0.75, Math.min(1.25, Number(currentHudScale.toFixed(2))));
  if (preset === 'low') {
    return {
      qualityPreset: 'low',
      fov: currentFov,
      hudScale,
      shadowQuality: 'off',
      renderScale: 'low',
      effectsDensity: 'low',
      cameraShake,
    };
  }
  if (preset === 'balanced') {
    return {
      qualityPreset: 'balanced',
      fov: currentFov,
      hudScale,
      shadowQuality: 'standard',
      renderScale: 'native',
      effectsDensity: 'normal',
      cameraShake,
    };
  }
  if (preset === 'high') {
    return {
      qualityPreset: 'high',
      fov: currentFov,
      hudScale,
      shadowQuality: 'ultra',
      renderScale: 'ultra',
      effectsDensity: 'high',
      cameraShake,
    };
  }
  return {
    qualityPreset: 'auto',
    fov: currentFov,
    hudScale,
    shadowQuality: 'standard',
    renderScale: 'native',
    effectsDensity: 'normal',
    cameraShake,
  };
}

export function loadVideoSettings(): VideoSettings {
  try {
    const raw = window.localStorage.getItem(VIDEO_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_VIDEO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<VideoSettings>;
    const preset: QualityPreset =
      parsed.qualityPreset === 'low' ||
      parsed.qualityPreset === 'balanced' ||
      parsed.qualityPreset === 'high' ||
      parsed.qualityPreset === 'auto'
        ? parsed.qualityPreset
        : 'auto';
    const fov = Math.max(46, Math.min(78, Math.round(Number(parsed.fov ?? 54))));
    const rawScale = Number(parsed.hudScale ?? 1);
    const hudScale = Number.isFinite(rawScale)
      ? Math.max(0.75, Math.min(1.25, Math.round(rawScale * 20) / 20))
      : 1;
    const shadowQuality =
      parsed.shadowQuality === 'off' ||
      parsed.shadowQuality === 'standard' ||
      parsed.shadowQuality === 'ultra'
        ? parsed.shadowQuality
        : 'standard';
    const renderScale =
      parsed.renderScale === 'low' ||
      parsed.renderScale === 'native' ||
      parsed.renderScale === 'ultra'
        ? parsed.renderScale
        : 'native';
    const effectsDensity =
      parsed.effectsDensity === 'low' ||
      parsed.effectsDensity === 'normal' ||
      parsed.effectsDensity === 'high'
        ? parsed.effectsDensity
        : 'normal';
    const cameraShake = parsed.cameraShake !== false;
    return {
      qualityPreset: preset,
      fov,
      hudScale,
      shadowQuality,
      renderScale,
      effectsDensity,
      cameraShake,
    };
  } catch {
    return { ...DEFAULT_VIDEO_SETTINGS };
  }
}

export function persistVideoSettings(settings: VideoSettings): VideoSettings {
  const clean: VideoSettings = {
    ...settings,
    fov: Math.max(46, Math.min(78, Math.round(settings.fov))),
    hudScale: Math.max(0.75, Math.min(1.25, Math.round((settings.hudScale ?? 1) * 20) / 20)),
  };
  try {
    window.localStorage.setItem(VIDEO_SETTINGS_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage errors
  }
  return clean;
}

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      volume: Math.max(0, Math.min(1, Number(parsed.volume ?? 0.85))),
      muted: Boolean(parsed.muted),
      binauralEnabled: parsed.binauralEnabled !== false,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function persistAudioSettings(settings: AudioSettings): AudioSettings {
  const clean: AudioSettings = {
    volume: Math.max(0, Math.min(1, settings.volume)),
    muted: Boolean(settings.muted),
    binauralEnabled: Boolean(settings.binauralEnabled),
  };
  try {
    window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage errors
  }
  return clean;
}

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    levelIndex: 0,
    checkpointIndex: 0,
    unlockedLevel: 0,
    playerHp: 100,
    parriesTotal: 0,
    defeatsTotal: 0,
    storyCompleted: false,
    timeSlowUnlocked: false,
    bowUnlocked: false,
    discoveredCombos: [],
    energyOrbs: 0,
    daimoku: { ...DEFAULT_DAIMOKU_UPGRADES },
    updatedAt: Date.now(),
  };
}

export function loadSaveData(): SaveData {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== SAVE_VERSION) return createDefaultSave();
    const discovered = Array.isArray(parsed.discoveredCombos)
      ? parsed.discoveredCombos.filter((id): id is SecretComboId =>
          VALID_COMBOS.includes(id as SecretComboId),
        )
      : [];
    const unlockedLevel = clampInt(parsed.unlockedLevel ?? 0, 0, 9);
    const storyCompleted = Boolean(parsed.storyCompleted);
    const timeSlowUnlocked =
      Boolean(parsed.timeSlowUnlocked) || unlockedLevel >= 5 || storyCompleted;
    const bowUnlocked =
      Boolean(parsed.bowUnlocked) || unlockedLevel >= 6 || storyCompleted;
    const rawDaimoku = (parsed.daimoku ?? {}) as Partial<DaimokuUpgrades>;
    const daimoku: DaimokuUpgrades = {
      attackLevel: clampInt(rawDaimoku.attackLevel ?? 0, 0, 5),
      vitalityLevel: clampInt(rawDaimoku.vitalityLevel ?? 0, 0, 5),
      staminaLevel: clampInt(rawDaimoku.staminaLevel ?? 0, 0, 5),
      postureLevel: clampInt(rawDaimoku.postureLevel ?? 0, 0, 5),
      elixirLevel: clampInt(rawDaimoku.elixirLevel ?? 0, 0, 5),
    };
    const maxAllowedHp = 100 + daimoku.vitalityLevel * 20;

    return {
      version: SAVE_VERSION,
      levelIndex: clampInt(parsed.levelIndex ?? 0, 0, 9),
      checkpointIndex: clampInt(parsed.checkpointIndex ?? 0, 0, 2),
      unlockedLevel,
      playerHp: Math.max(40, Math.min(maxAllowedHp, Number(parsed.playerHp ?? 100))),
      parriesTotal: Math.max(0, Number(parsed.parriesTotal ?? 0)),
      defeatsTotal: Math.max(0, Number(parsed.defeatsTotal ?? 0)),
      storyCompleted,
      timeSlowUnlocked,
      bowUnlocked,
      discoveredCombos: Array.from(new Set(discovered)),
      energyOrbs: Math.max(0, Math.floor(Number(parsed.energyOrbs ?? 0))),
      daimoku,
      updatedAt: Number(parsed.updatedAt ?? Date.now()),
    };
  } catch {
    return createDefaultSave();
  }
}

export function persistSaveData(data: SaveData): SaveData {
  const clean: SaveData = {
    ...data,
    version: SAVE_VERSION,
    updatedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota errors gracefully
  }
  return clean;
}

export function resetSaveData(): SaveData {
  const fresh = createDefaultSave();
  return persistSaveData(fresh);
}

export function hasExistingProgress(save: SaveData): boolean {
  return (
    save.levelIndex > 0 ||
    save.checkpointIndex > 0 ||
    save.parriesTotal > 0 ||
    save.defeatsTotal > 0 ||
    save.energyOrbs > 0 ||
    save.daimoku.attackLevel > 0 ||
    save.daimoku.vitalityLevel > 0 ||
    save.daimoku.staminaLevel > 0 ||
    save.daimoku.postureLevel > 0 ||
    save.daimoku.elixirLevel > 0 ||
    save.storyCompleted ||
    save.timeSlowUnlocked ||
    save.bowUnlocked
  );
}

export function formatSaveTimestamp(ts: number): string {
  try {
    return new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    }).format(new Date(ts));
  } catch {
    return 'Recente';
  }
}

function clampInt(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(val)));
}
