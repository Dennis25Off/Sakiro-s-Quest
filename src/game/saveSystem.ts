import { SaveData, SecretComboId } from './types';

const SAVE_KEY = 'shirokaze_save_v1';
const SAVE_VERSION = 1;
const VALID_COMBOS: SecretComboId[] = [
  'crimson_cross',
  'breaker',
  'tempest_whirl',
  'shadow_pierce',
  'eclipse_judgment',
];

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
      Boolean(parsed.bowUnlocked) || unlockedLevel >= 5 || storyCompleted;

    return {
      version: SAVE_VERSION,
      levelIndex: clampInt(parsed.levelIndex ?? 0, 0, 9),
      checkpointIndex: clampInt(parsed.checkpointIndex ?? 0, 0, 2),
      unlockedLevel,
      playerHp: Math.max(40, Math.min(100, Number(parsed.playerHp ?? 100))),
      parriesTotal: Math.max(0, Number(parsed.parriesTotal ?? 0)),
      defeatsTotal: Math.max(0, Number(parsed.defeatsTotal ?? 0)),
      storyCompleted,
      timeSlowUnlocked,
      bowUnlocked,
      discoveredCombos: Array.from(new Set(discovered)),
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
