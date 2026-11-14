/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { OutcomeOverlay } from './components/OutcomeOverlay';
import { PauseOverlay } from './components/PauseOverlay';
import { StartMenu } from './components/StartMenu';
import { SECRET_COMBOS } from './game/combos';
import { SamuraiGameEngine } from './game/engine';
import { LEVELS } from './game/levels';
import { loadSaveData, persistSaveData, resetSaveData } from './game/saveSystem';
import { GameScreen, HudSnapshot, QualityPreset, SaveData } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  hp: 100,
  maxHp: 100,
  posture: 0,
  maxPosture: 100,
  stamina: 100,
  maxStamina: 100,
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
  bowCharges: 2,
  bowMaxCharges: 2,
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
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SamuraiGameEngine | null>(null);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const bossTracksRef = useRef<Record<number, HTMLAudioElement>>({});

  const [screen, setScreen] = useState<GameScreen>('menu');
  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>('auto');
  const [audioVolume, setAudioVolume] = useState(0.85);
  const [audioMuted, setAudioMuted] = useState(false);
  const [binauralEnabled, setBinauralEnabled] = useState(true);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [transitionVeil, setTransitionVeil] = useState<{
    active: boolean;
    code?: string;
    title?: string;
  }>({ active: false });
  const transitionTimersRef = useRef<number[]>([]);

  const saveRef = useRef<SaveData>(save);
  saveRef.current = save;

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
          const unlockedBow = prev.bowUnlocked || completedIndex >= 4;
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
    });

    engineRef.current = engine;
    engine.setProgressionState(
      saveRef.current.unlockedLevel >= 1 || saveRef.current.levelIndex >= 1,
      saveRef.current.discoveredCombos,
      saveRef.current.timeSlowUnlocked || saveRef.current.storyCompleted,
      saveRef.current.bowUnlocked ||
        saveRef.current.storyCompleted ||
        saveRef.current.unlockedLevel >= 5 ||
        saveRef.current.levelIndex >= 5,
    );
    engine.loadLevel(saveRef.current.levelIndex, saveRef.current.checkpointIndex, true);
    engine.setScreenMode('menu');

    // Setup Start Menu Intro music from attached asset
    const intro = new Audio('/assets/aistudio/Project_46_cd633279.mp3');
    intro.loop = true;
    intro.preload = 'auto';
    intro.volume = audioVolume * 0.65;
    intro.muted = audioMuted;
    intro.addEventListener('play', () => setIntroPlaying(true));
    intro.addEventListener('pause', () => setIntroPlaying(false));
    introAudioRef.current = intro;

    // Setup Boss Fight music tracks (Atto 06 & Atto 10)
    const createBossTrack = (src: string) => {
      const track = new Audio(src);
      track.loop = true;
      track.preload = 'auto';
      track.volume = audioVolume * 0.48;
      track.muted = audioMuted;
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

    const isGameplayActive = screen === 'playing' || screen === 'paused';
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

    if (screen === 'paused') {
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
            save.unlockedLevel >= 5 ||
            save.levelIndex >= 5,
        );
        eng.loadLevel(save.levelIndex, save.checkpointIndex, false);
        eng.setScreenMode('playing');
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
        eng.setProgressionState(false, [], false, false);
        eng.loadLevel(0, 0, false);
        eng.setScreenMode('playing');
        setScreen('playing');
      },
      { code: spec.code, title: spec.title },
    );
  };

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
          playerHp: 100,
        }));
        const eng = engineRef.current;
        if (!eng) return;
        eng.setProgressionState(
          saveRef.current.unlockedLevel >= 1 || levelIndex >= 1,
          saveRef.current.discoveredCombos,
          saveRef.current.timeSlowUnlocked || saveRef.current.storyCompleted || levelIndex >= 5,
          saveRef.current.bowUnlocked ||
            saveRef.current.storyCompleted ||
            saveRef.current.unlockedLevel >= 5 ||
            levelIndex >= 5,
        );
        eng.loadLevel(levelIndex, 0, false);
        eng.setScreenMode('playing');
        setScreen('playing');
      },
      { code: spec.code, title: spec.title },
    );
  };

  const handlePreviewLevel = (levelIndex: number) => {
    engineRef.current?.loadLevel(levelIndex, 0, true);
  };

  const handleChangeQuality = (preset: QualityPreset) => {
    setQualityPreset(preset);
    engineRef.current?.setQualityPreset(preset);
  };

  const handleChangeAudio = (opts: { volume?: number; muted?: boolean; binaural?: boolean }) => {
    unlockAudio();
    const eng = engineRef.current;
    if (!eng) return;
    if (opts.volume !== undefined) {
      setAudioVolume(opts.volume);
      eng.audio.setVolume(opts.volume);
    }
    if (opts.muted !== undefined) {
      setAudioMuted(opts.muted);
      eng.audio.setMuted(opts.muted);
    }
    if (opts.binaural !== undefined) {
      setBinauralEnabled(opts.binaural);
      eng.audio.setBinauralEnabled(opts.binaural);
    }
  };

  const handlePause = () => {
    engineRef.current?.setScreenMode('paused');
    setScreen('paused');
  };

  const handleResume = () => {
    unlockAudio();
    engineRef.current?.setScreenMode('playing');
    setScreen('playing');
  };

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
            save.unlockedLevel >= 5 ||
            save.levelIndex >= 5,
        );
        eng.loadLevel(save.levelIndex, save.checkpointIndex, false);
        eng.setScreenMode('playing');
        setScreen('playing');
      },
      { code: spec.code, title: spec.checkpoints[save.checkpointIndex]?.name ?? spec.title },
    );
  };

  const handleExitToMenu = () => {
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
              qualityPreset={qualityPreset}
              audioVolume={audioVolume}
              audioMuted={audioMuted}
              binauralEnabled={binauralEnabled}
              introPlaying={introPlaying}
              onContinue={handleContinue}
              onNewGame={handleNewGame}
              onStartLevel={handleStartLevel}
              onChangeQuality={handleChangeQuality}
              onChangeAudio={handleChangeAudio}
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
            <GameHud hud={hud} onPause={handlePause} />
          </motion.div>
        )}

        {screen === 'paused' && (
          <PauseOverlay
            key="paused"
            levelTitle={hud.levelTitle}
            checkpointName={hud.checkpointName}
            qualityPreset={qualityPreset}
            audioMuted={audioMuted}
            binauralEnabled={binauralEnabled}
            combosUnlocked={save.unlockedLevel >= 1 || hud.levelIndex >= 1}
            discoveredCombos={save.discoveredCombos}
            gamepadConnected={hud.gamepadConnected}
            onResume={handleResume}
            onReloadCheckpoint={handleReloadCheckpoint}
            onExitToMenu={handleExitToMenu}
            onChangeQuality={handleChangeQuality}
            onToggleMute={() => handleChangeAudio({ muted: !audioMuted })}
            onToggleBinaural={() => handleChangeAudio({ binaural: !binauralEnabled })}
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
    </div>
  );
}
