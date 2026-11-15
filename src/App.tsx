/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DaimokuOverlay } from './components/DaimokuOverlay';
import { GameHud } from './components/GameHud';
import { OutcomeOverlay } from './components/OutcomeOverlay';
import { PauseOverlay } from './components/PauseOverlay';
import { OfflineIndicator } from './components/PWAInstallButton';
import { StartMenu } from './components/StartMenu';
import { StoryIntroOverlay } from './components/StoryIntroOverlay';
import { SECRET_COMBOS } from './game/combos';
import { SamuraiGameEngine } from './game/engine';
import { LEVELS } from './game/levels';
import {
  DAIMOKU_UPGRADE_SPECS,
  DEFAULT_DAIMOKU_UPGRADES,
  getDaimokuUpgradeCost,
  loadAudioSettings,
  loadSaveData,
  loadVideoSettings,
  persistAudioSettings,
  persistSaveData,
  persistVideoSettings,
  resetSaveData,
} from './game/saveSystem';
import {
  DaimokuStatId,
  GameScreen,
  HudSnapshot,
  SaveData,
  VideoSettings,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  hp: 100,
  maxHp: 100,
  posture: 0,
  maxPosture: 100,
  stamina: 100,
  maxStamina: 100,
  healCharges: 1,
  healMaxCharges: 1,
  energyOrbs: 0,
  daimoku: { ...DEFAULT_DAIMOKU_UPGRADES },
  isBlocking: false,
  isLockedOn: false,
  isAirborne: false,
  comboStep: 0,
  combosUnlocked: false,
  discoveredCount: 0,
  totalSecretCombos: SECRET_COMBOS.length,
  counterReady: false,
  comboHint: null,
  timeSlowUnlocked: false,
  timeSlowActive: false,
  timeSlowRemaining: 0,
  timeSlowCooldown: 0,
  bowUnlocked: false,
  bowCharges: 5,
  bowMaxCharges: 5,
  bowCooldown: 0,
  levelIndex: 0,
  levelTitle: LEVELS[0].title,
  checkpointIndex: 0,
  checkpointName: LEVELS[0].checkpoints[0].name,
  activeEnemy: null,
  enemiesRemaining: 0,
  gamepadConnected: false,
  gamepadName: '',
  pointerLocked: false,
  fpsEstimate: 60,
  feedback: null,
  popups: [],
  storySubtitle: null,
  damageFlash: 0,
  lastDamageAmount: 0,
  damageSide: 'none',
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SamuraiGameEngine | null>(null);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const bossTracksRef = useRef<Record<number, HTMLAudioElement>>({});

  const [screen, setScreen] = useState<GameScreen>('menu');
  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [videoSettings, setVideoSettings] = useState<VideoSettings>(() => loadVideoSettings());
  const initialAudioRef = useRef(loadAudioSettings());
  const [audioVolume, setAudioVolume] = useState(initialAudioRef.current.volume);
  const [audioMuted, setAudioMuted] = useState(initialAudioRef.current.muted);
  const [binauralEnabled, setBinauralEnabled] = useState(
    initialAudioRef.current.binauralEnabled,
  );
  const [showControlsGuide, setShowControlsGuide] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sakiro_show_controls_v1');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [introPlaying, setIntroPlaying] = useState(false);
  const [storyIntroActive, setStoryIntroActive] = useState(false);
  const [transitionVeil, setTransitionVeil] = useState<{
    active: boolean;
    code?: string;
    title?: string;
  }>({ active: false });
  const transitionTimersRef = useRef<number[]>([]);

  const saveRef = useRef<SaveData>(save);
  saveRef.current = save;
  const screenRef = useRef<GameScreen>(screen);
  screenRef.current = screen;
  const storyIntroRef = useRef<boolean>(storyIntroActive);
  storyIntroRef.current = storyIntroActive;

  const updateSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    const next = persistSaveData(updater(saveRef.current));
    saveRef.current = next;
    setSave(next);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new SamuraiGameEngine(container, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onCheckpointReached: (levelIndex, checkpointIndex, hp) => {
        updateSave((prev) => ({
          ...prev,
          levelIndex,
          checkpointIndex,
          unlockedLevel: Math.max(prev.unlockedLevel, levelIndex),
          playerHp: hp,
        }));
      },
      onParryStat: () => {
        updateSave((prev) => ({ ...prev, parriesTotal: prev.parriesTotal + 1 }));
      },
      onDefeatStat: () => {
        updateSave((prev) => ({ ...prev, defeatsTotal: prev.defeatsTotal + 1 }));
      },
      onComboDiscovered: (comboId) => {
        updateSave((prev) => {
          if (prev.discoveredCombos.includes(comboId)) return prev;
          return {
            ...prev,
            discoveredCombos: [...prev.discoveredCombos, comboId],
          };
        });
      },
      onScreenChange: (nextScreen) => {
        setScreen(nextScreen);
      },
      onLevelComplete: (completedIndex) => {
        setScreen('victory');
        updateSave((prev) => {
          const nextLevel = Math.min(LEVELS.length - 1, completedIndex + 1);
          const unlockedTimeSlow = prev.timeSlowUnlocked || completedIndex >= 4;
          const unlockedBow = prev.bowUnlocked || completedIndex >= 5;
          const finishedFullStory = completedIndex >= LEVELS.length - 1;
          return {
            ...prev,
            levelIndex: nextLevel,
            checkpointIndex: 0,
            unlockedLevel: Math.max(prev.unlockedLevel, nextLevel),
            storyCompleted: prev.storyCompleted || finishedFullStory,
            timeSlowUnlocked: unlockedTimeSlow,
            bowUnlocked: unlockedBow,
          };
        });
      },
      onPlayerDefeated: () => {
        setScreen('defeat');
      },
      onEnergyChanged: (orbs) => {
        updateSave((prev) => ({
          ...prev,
          energyOrbs: Math.max(0, Math.floor(orbs)),
        }));
      },
      onOpenDaimoku: () => {
        if (screenRef.current !== 'playing' || storyIntroRef.current) return;
        engineRef.current?.setScreenMode('daimoku');
        setScreen('daimoku');
      },
    });

    engineRef.current = engine;
    const initVideo = loadVideoSettings();
    const initAudio = initialAudioRef.current;
    engine.setVideoSettings(initVideo);
    engine.audio.setVolume(initAudio.volume);
    engine.audio.setMuted(initAudio.muted);
    engine.audio.setBinauralEnabled(initAudio.binauralEnabled);
    engine.setProgressionState(
      saveRef.current.unlockedLevel >= 1 || saveRef.current.levelIndex >= 1,
      saveRef.current.discoveredCombos,
      saveRef.current.timeSlowUnlocked || saveRef.current.storyCompleted,
      saveRef.current.bowUnlocked ||
        saveRef.current.storyCompleted ||
        saveRef.current.unlockedLevel >= 6 ||
        saveRef.current.levelIndex >= 6,
      saveRef.current.energyOrbs,
      saveRef.current.daimoku,
    );
    engine.loadLevel(saveRef.current.levelIndex, saveRef.current.checkpointIndex, true);
    engine.setScreenMode('menu');

    // Setup Start Menu Intro music from attached asset
    const intro = new Audio('/assets/aistudio/Project_46_cd633279.mp3');
    intro.loop = true;
    intro.preload = 'auto';
    intro.volume = initAudio.volume * 0.65;
    intro.muted = initAudio.muted;
    intro.addEventListener('play', () => setIntroPlaying(true));
    intro.addEventListener('pause', () => setIntroPlaying(false));
    introAudioRef.current = intro;

    // Setup Boss Fight music tracks (Atto 06 & Atto 10)
    const createBossTrack = (src: string) => {
      const track = new Audio(src);
      track.loop = true;
      track.preload = 'auto';
      track.volume = initAudio.volume * 0.48;
      track.muted = initAudio.muted;
      return track;
    };

    const bossTracks: Record<number, HTMLAudioElement> = {
      5: createBossTrack(
        '/assets/aistudio/Dark_Souls_III_OST_10_-_Vordt_of_the_Boreal_Valley_e2b8b845.mp3',
      ),
      9: createBossTrack(
        '/assets/aistudio/Elden_Ring_Main_Theme__The_Final_Battle___EPIC_VERSION_cbbc8f96.mp3',
      ),
    };
    bossTracksRef.current = bossTracks;

    return () => {
      transitionTimersRef.current.forEach((id) => clearTimeout(id));
      transitionTimersRef.current = [];
      intro.pause();
      intro.src = '';
      introAudioRef.current = null;
      Object.values(bossTracks).forEach((track) => {
        track.pause();
        track.src = '';
      });
      bossTracksRef.current = {};
      engine.dispose();
      engineRef.current = null;
    };
  }, [updateSave]);

  // Sync Intro audio playback with menu screen and audio settings
  useEffect(() => {
    const intro = introAudioRef.current;
    if (!intro) return;
    intro.volume = audioVolume * 0.65;
    intro.muted = audioMuted;

    if (screen !== 'menu') {
      intro.pause();
      intro.currentTime = 0;
      return;
    }

    let cancelled = false;
    const tryPlay = () => {
      if (cancelled || screen !== 'menu') return;
      const p = intro.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Wait for first user interaction if browser blocks autoplay
        });
      }
    };

    tryPlay();

    const onGesture = () => {
      if (!cancelled && screen === 'menu' && intro.paused) {
        tryPlay();
      }
    };
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [screen, audioVolume, audioMuted]);

  // Sync Boss Fight music (Atto 06 / index 5 & Atto 10 / index 9) with gameplay & pause state
  useEffect(() => {
    const bossTracks = bossTracksRef.current;
    const trackEntries = Object.entries(bossTracks);
    if (trackEntries.length === 0) return;

    const isGameplayActive =
      screen === 'playing' || screen === 'paused' || screen === 'daimoku';
    let activeTrack: HTMLAudioElement | null = null;

    trackEntries.forEach(([lvlStr, track]) => {
      track.volume = audioVolume * 0.48;
      track.muted = audioMuted;
      const lvlIndex = Number(lvlStr);
      if (isGameplayActive && lvlIndex === hud.levelIndex) {
        activeTrack = track;
      } else {
        track.pause();
        track.currentTime = 0;
      }
    });

    if (!activeTrack) return;
    const currentTrack: HTMLAudioElement = activeTrack;

    if (screen === 'paused' || screen === 'daimoku') {
      currentTrack.pause();
      return;
    }

    let cancelled = false;
    const activeLevel = hud.levelIndex;
    const tryPlayBoss = () => {
      if (cancelled || screen !== 'playing' || hud.levelIndex !== activeLevel) return;
      const p = currentTrack.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Wait for user gesture if autoplay blocked
        });
      }
    };

    tryPlayBoss();

    const onGesture = () => {
      if (
        !cancelled &&
        screen === 'playing' &&
        hud.levelIndex === activeLevel &&
        currentTrack.paused
      ) {
        tryPlayBoss();
      }
    };
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [screen, hud.levelIndex, audioVolume, audioMuted]);

  const unlockAudio = () => {
    engineRef.current?.audio.unlock();
  };

  const runSceneTransition = useCallback(
    (onMidpoint: () => void, meta?: { code: string; title: string }) => {
      transitionTimersRef.current.forEach((id) => clearTimeout(id));
      transitionTimersRef.current = [];

      setTransitionVeil({ active: true, code: meta?.code, title: meta?.title });
      const t1 = window.setTimeout(() => {
        onMidpoint();
        const t2 = window.setTimeout(() => {
          setTransitionVeil({ active: false });
        }, 280);
        transitionTimersRef.current.push(t2);
      }, 260);
      transitionTimersRef.current.push(t1);
    },
    [],
  );

  const handleContinue = () => {
    unlockAudio();
    const spec = LEVELS[save.levelIndex] ?? LEVELS[0];
    runSceneTransition(
      () => {
        const eng = engineRef.current;
        if (!eng) return;
        eng.setProgressionState(
          save.unlockedLevel >= 1 || save.levelIndex >= 1,
          save.discoveredCombos,
          save.timeSlowUnlocked || save.storyCompleted || save.levelIndex >= 5,
          save.bowUnlocked ||
            save.storyCompleted ||
            save.unlockedLevel >= 6 ||
            save.levelIndex >= 6,
          save.energyOrbs,
          save.daimoku,
        );
        eng.loadLevel(save.levelIndex, save.checkpointIndex, false);
        eng.setScreenMode('playing');
        setStoryIntroActive(false);
        setScreen('playing');
      },
      { code: spec.code, title: spec.title },
    );
  };

  const handleNewGame = () => {
    unlockAudio();
    const spec = LEVELS[0];
    runSceneTransition(
      () => {
        const fresh = resetSaveData();
        saveRef.current = fresh;
        setSave(fresh);
        const eng = engineRef.current;
        if (!eng) return;
        eng.setProgressionState(false, [], false, false, fresh.energyOrbs, fresh.daimoku);
        eng.loadLevel(0, 0, false);
        eng.setScreenMode('playing');
        eng.startIntroCutscene();
        setStoryIntroActive(true);
        setScreen('playing');
      },
      { code: spec.code, title: spec.title },
    );
  };

  const handleReplayIntro = () => {
    unlockAudio();
    runSceneTransition(
      () => {
        const eng = engineRef.current;
        if (!eng) return;
        eng.setProgressionState(
          saveRef.current.unlockedLevel >= 1 || saveRef.current.levelIndex >= 1,
          saveRef.current.discoveredCombos,
          saveRef.current.timeSlowUnlocked || saveRef.current.storyCompleted,
          saveRef.current.bowUnlocked ||
            saveRef.current.storyCompleted ||
            saveRef.current.unlockedLevel >= 6 ||
            saveRef.current.levelIndex >= 6,
          saveRef.current.energyOrbs,
          saveRef.current.daimoku,
        );
        eng.loadLevel(0, 0, false);
        eng.setScreenMode('playing');
        eng.startIntroCutscene();
        setStoryIntroActive(true);
        setScreen('playing');
      },
      { code: 'PROLOGO', title: 'La Vendetta di Sakiro' },
    );
  };

  const handleFinishStoryIntro = useCallback(() => {
    setStoryIntroActive(false);
    engineRef.current?.stopIntroCutscene();
  }, []);

  const handleStartLevel = (levelIndex: number) => {
    unlockAudio();
    const spec = LEVELS[levelIndex] ?? LEVELS[0];
    runSceneTransition(
      () => {
        updateSave((prev) => ({
          ...prev,
          levelIndex,
          checkpointIndex: 0,
          unlockedLevel: Math.max(prev.unlockedLevel, levelIndex),
          playerHp: 100 + prev.daimoku.vitalityLevel * 20,
        }));
        const eng = engineRef.current;
        if (!eng) return;
        eng.setProgressionState(
          saveRef.current.unlockedLevel >= 1 || levelIndex >= 1,
          saveRef.current.discoveredCombos,
          saveRef.current.timeSlowUnlocked || saveRef.current.storyCompleted || levelIndex >= 5,
          saveRef.current.bowUnlocked ||
            saveRef.current.storyCompleted ||
            saveRef.current.unlockedLevel >= 6 ||
            levelIndex >= 6,
          saveRef.current.energyOrbs,
          saveRef.current.daimoku,
        );
        eng.loadLevel(levelIndex, 0, false);
        eng.setScreenMode('playing');
        setStoryIntroActive(false);
        setScreen('playing');
      },
      { code: spec.code, title: spec.title },
    );
  };

  const handlePreviewLevel = (levelIndex: number) => {
    engineRef.current?.loadLevel(levelIndex, 0, true);
  };

  const handleChangeVideo = useCallback((next: VideoSettings) => {
    const saved = persistVideoSettings(next);
    setVideoSettings(saved);
    engineRef.current?.setVideoSettings(saved);
  }, []);

  const handleToggleControlsGuide = useCallback(() => {
    setShowControlsGuide((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sakiro_show_controls_v1', String(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  }, []);

  const handleChangeAudio = (opts: { volume?: number; muted?: boolean; binaural?: boolean }) => {
    unlockAudio();
    const eng = engineRef.current;
    const nextVol = opts.volume !== undefined ? opts.volume : audioVolume;
    const nextMuted = opts.muted !== undefined ? opts.muted : audioMuted;
    const nextBin = opts.binaural !== undefined ? opts.binaural : binauralEnabled;
    if (opts.volume !== undefined) {
      setAudioVolume(opts.volume);
      eng?.audio.setVolume(opts.volume);
    }
    if (opts.muted !== undefined) {
      setAudioMuted(opts.muted);
      eng?.audio.setMuted(opts.muted);
    }
    if (opts.binaural !== undefined) {
      setBinauralEnabled(opts.binaural);
      eng?.audio.setBinauralEnabled(opts.binaural);
    }
    persistAudioSettings({
      volume: nextVol,
      muted: nextMuted,
      binauralEnabled: nextBin,
    });
  };

  const handlePause = () => {
    if (storyIntroActive) {
      setStoryIntroActive(false);
      engineRef.current?.stopIntroCutscene();
    }
    engineRef.current?.setScreenMode('paused');
    setScreen('paused');
  };

  const handleResume = () => {
    unlockAudio();
    engineRef.current?.setScreenMode('playing');
    setScreen('playing');
  };

  const handleOpenDaimoku = useCallback(() => {
    if (screenRef.current !== 'playing' || storyIntroRef.current) return;
    unlockAudio();
    engineRef.current?.setScreenMode('daimoku');
    setScreen('daimoku');
  }, []);

  const handleCloseDaimoku = useCallback(() => {
    if (screenRef.current !== 'daimoku') return;
    unlockAudio();
    engineRef.current?.setScreenMode('playing');
    setScreen('playing');
  }, []);

  const handleUpgradeDaimoku = useCallback(
    (statId: DaimokuStatId) => {
      if (screenRef.current !== 'daimoku') return;
      const spec = DAIMOKU_UPGRADE_SPECS.find((s) => s.id === statId);
      if (!spec) return;
      const current = saveRef.current;
      const currentLevel = current.daimoku[spec.key];
      const cost = getDaimokuUpgradeCost(statId, currentLevel);
      if (cost === null || current.energyOrbs < cost) return;

      const nextDaimoku = {
        ...current.daimoku,
        [spec.key]: currentLevel + 1,
      };
      const nextOrbs = current.energyOrbs - cost;
      const nextHpBonus = statId === 'vitality' ? 20 : 0;
      const nextMaxHp = 100 + nextDaimoku.vitalityLevel * 20;

      updateSave((prev) => ({
        ...prev,
        energyOrbs: nextOrbs,
        daimoku: nextDaimoku,
        playerHp: Math.min(nextMaxHp, prev.playerHp + nextHpBonus),
      }));

      engineRef.current?.setEnergyOrbs(nextOrbs);
      engineRef.current?.applyDaimokuState(nextDaimoku, true);
    },
    [updateSave],
  );

  const handleReloadCheckpoint = () => {
    unlockAudio();
    const spec = LEVELS[save.levelIndex] ?? LEVELS[0];
    runSceneTransition(
      () => {
        const eng = engineRef.current;
        if (!eng) return;
        eng.setProgressionState(
          save.unlockedLevel >= 1 || save.levelIndex >= 1,
          save.discoveredCombos,
          save.timeSlowUnlocked || save.storyCompleted || save.levelIndex >= 5,
          save.bowUnlocked ||
            save.storyCompleted ||
            save.unlockedLevel >= 6 ||
            save.levelIndex >= 6,
          save.energyOrbs,
          save.daimoku,
        );
        eng.loadLevel(save.levelIndex, save.checkpointIndex, false);
        eng.setScreenMode('playing');
        setStoryIntroActive(false);
        setScreen('playing');
      },
      { code: spec.code, title: spec.checkpoints[save.checkpointIndex]?.name ?? spec.title },
    );
  };

  const handleExitToMenu = () => {
    setStoryIntroActive(false);
    runSceneTransition(() => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.loadLevel(save.levelIndex, save.checkpointIndex, true);
      eng.setScreenMode('menu');
      setScreen('menu');
    });
  };

  const handleNextLevel = () => {
    unlockAudio();
    const nextIdx = Math.min(LEVELS.length - 1, hud.levelIndex + 1);
    handleStartLevel(nextIdx);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#EAF0F6]">
      {/* Dedicated WebGL mount container isolated from React HUD updates */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <AnimatePresence mode="wait">
        {screen === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-10 pointer-events-auto"
          >
            <StartMenu
              save={save}
              gamepadConnected={hud.gamepadConnected}
              gamepadName={hud.gamepadName}
              videoSettings={videoSettings}
              audioVolume={audioVolume}
              audioMuted={audioMuted}
              binauralEnabled={binauralEnabled}
              showControlsGuide={showControlsGuide}
              introPlaying={introPlaying}
              onContinue={handleContinue}
              onNewGame={handleNewGame}
              onReplayIntro={handleReplayIntro}
              onStartLevel={handleStartLevel}
              onChangeVideo={handleChangeVideo}
              onChangeAudio={handleChangeAudio}
              onToggleControlsGuide={handleToggleControlsGuide}
              onPreviewLevel={handlePreviewLevel}
            />
          </motion.div>
        )}

        {screen === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-10 pointer-events-none"
          >
            {storyIntroActive ? (
              <StoryIntroOverlay
                active={storyIntroActive}
                gamepadConnected={hud.gamepadConnected}
                onFinish={handleFinishStoryIntro}
              />
            ) : (
              <GameHud
                hud={hud}
                showControlsGuide={showControlsGuide}
                onToggleControlsGuide={handleToggleControlsGuide}
                onOpenDaimoku={handleOpenDaimoku}
                onPause={handlePause}
              />
            )}
          </motion.div>
        )}

        {screen === 'daimoku' && (
          <DaimokuOverlay
            key="daimoku"
            energyOrbs={save.energyOrbs}
            daimoku={save.daimoku}
            levelTitle={hud.levelTitle}
            gamepadConnected={hud.gamepadConnected}
            onUpgrade={handleUpgradeDaimoku}
            onClose={handleCloseDaimoku}
          />
        )}

        {screen === 'paused' && (
          <PauseOverlay
            key="paused"
            levelTitle={hud.levelTitle}
            checkpointName={hud.checkpointName}
            videoSettings={videoSettings}
            audioVolume={audioVolume}
            audioMuted={audioMuted}
            binauralEnabled={binauralEnabled}
            showControlsGuide={showControlsGuide}
            combosUnlocked={save.unlockedLevel >= 1 || hud.levelIndex >= 1}
            discoveredCombos={save.discoveredCombos}
            gamepadConnected={hud.gamepadConnected}
            onResume={handleResume}
            onReloadCheckpoint={handleReloadCheckpoint}
            onExitToMenu={handleExitToMenu}
            onChangeVideo={handleChangeVideo}
            onChangeVolume={(vol) => handleChangeAudio({ volume: vol, muted: false })}
            onToggleMute={() => handleChangeAudio({ muted: !audioMuted })}
            onToggleBinaural={() => handleChangeAudio({ binaural: !binauralEnabled })}
            onToggleControlsGuide={handleToggleControlsGuide}
          />
        )}

        {(screen === 'defeat' || screen === 'victory') && (
          <OutcomeOverlay
            key={screen}
            kind={screen}
            levelIndex={hud.levelIndex}
            checkpointName={hud.checkpointName}
            onRetryCheckpoint={handleReloadCheckpoint}
            onNextLevel={handleNextLevel}
            onExitToMenu={handleExitToMenu}
          />
        )}
      </AnimatePresence>

      {/* Cinematic scene fade & katana slash transition veil */}
      <AnimatePresence>
        {transitionVeil.active && (
          <motion.div
            key="scene-transition-veil"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 bg-[#0D1119] flex flex-col items-center justify-center pointer-events-auto"
          >
            {transitionVeil.code && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="text-center px-6"
              >
                <p className="font-mono-nums text-xs tracking-[0.35em] text-[#38BDF8] uppercase">
                  {transitionVeil.code}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-wider mt-1.5">
                  {transitionVeil.title}
                </h2>
              </motion.div>
            )}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-56 h-[2px] bg-[#E12D39] mt-4 origin-center"
            />
          </motion.div>
        )}
      </AnimatePresence>
      <OfflineIndicator />
    </div>
  );
}
