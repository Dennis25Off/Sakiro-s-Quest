import React, { useState } from 'react';
import {
  ChevronRight,
  Film,
  Gamepad2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Swords,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { LEVELS } from '../game/levels';
import {
  formatSaveTimestamp,
  hasExistingProgress,
  videoSettingsForPreset,
} from '../game/saveSystem';
import { SaveData, VideoSettings } from '../game/types';
import { useGamepadMenuNav } from '../game/useGamepadMenuNav';
import { PWAInstallButton } from './PWAInstallButton';

type MenuTab = 'story' | 'levels' | 'settings' | 'controls';
type SettingsSubtab = 'video' | 'audio' | 'gameplay';

interface StartMenuProps {
  save: SaveData;
  gamepadConnected: boolean;
  gamepadName: string;
  videoSettings: VideoSettings;
  audioVolume: number;
  audioMuted: boolean;
  binauralEnabled: boolean;
  showControlsGuide: boolean;
  introPlaying: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onReplayIntro: () => void;
  onStartLevel: (levelIndex: number) => void;
  onChangeVideo: (next: VideoSettings) => void;
  onChangeAudio: (opts: { volume?: number; muted?: boolean; binaural?: boolean }) => void;
  onToggleControlsGuide: () => void;
  onPreviewLevel: (levelIndex: number) => void;
}

export const StartMenu: React.FC<StartMenuProps> = ({
  save,
  gamepadConnected,
  gamepadName,
  videoSettings,
  audioVolume,
  audioMuted,
  binauralEnabled,
  showControlsGuide,
  introPlaying,
  onContinue,
  onNewGame,
  onReplayIntro,
  onStartLevel,
  onChangeVideo,
  onChangeAudio,
  onToggleControlsGuide,
  onPreviewLevel,
}) => {
  const [activeTab, setActiveTab] = useState<MenuTab>('story');
  const [settingsSubtab, setSettingsSubtab] = useState<SettingsSubtab>('video');
  const [selectedLevel, setSelectedLevel] = useState<number>(save.levelIndex);
  const canContinue = hasExistingProgress(save);
  const chronoUnlocked =
    save.timeSlowUnlocked || save.storyCompleted || save.unlockedLevel >= 5;
  const bowUnlocked =
    save.bowUnlocked || save.storyCompleted || save.unlockedLevel >= 6;
  const visibleLevels = LEVELS;

  const safeLevelIndex = Math.min(save.levelIndex, LEVELS.length - 1);
  const currentLevelSpec = LEVELS[safeLevelIndex];
  const currentCpSpec =
    currentLevelSpec.checkpoints[
      Math.min(save.checkpointIndex, currentLevelSpec.checkpoints.length - 1)
    ];
  const previewSpec = LEVELS[Math.min(selectedLevel, LEVELS.length - 1)];

  useGamepadMenuNav({
    enabled: true,
    onBack: () => setActiveTab('story'),
    deps: [
      activeTab,
      settingsSubtab,
      canContinue,
      save.unlockedLevel,
      chronoUnlocked,
      bowUnlocked,
    ],
  });

  const handleSelectLevelCard = (idx: number) => {
    setSelectedLevel(idx);
    onPreviewLevel(idx);
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col lg:flex-row pointer-events-none">
      {/* LEFT RAIL: Soft Frosted Translucent Glass + Background-less Calligraphic Buttons */}
      <aside className="pointer-events-auto w-full lg:w-[400px] xl:w-[430px] h-auto lg:h-full bg-white/62 backdrop-blur-xl border-b lg:border-b-0 lg:border-r border-white/75 shadow-[0_8px_32px_rgba(15,23,42,0.1)] flex flex-col justify-between px-7 py-7 lg:px-9 lg:py-10">
        <div>
          {/* Clean Brand Title */}
          <div className="mb-8">
            <p className="text-xs font-medium tracking-[0.22em] text-[#334155] mb-2">
              SAKIRO&apos;S QUEST · VENDETTA
            </p>
            <h1 className="font-display text-4xl xl:text-[42px] font-bold tracking-tight text-[#0F172A] leading-none">
              SAKIRO&apos;S QUEST
            </h1>
            <p className="text-sm text-[#334155] mt-2">
              La Vendetta del Samurai
            </p>
          </div>

          {/* Primary Action Buttons (Background-less Blade-Edge Design) */}
          <nav className="flex flex-col gap-2.5" aria-label="Menu principale">
            {canContinue && (
              <button
                type="button"
                data-gp-item
                data-gp-group="left"
                onClick={onContinue}
                className="group w-full flex items-center justify-between px-5 py-3.5 bg-transparent border border-[#12161F]/40 border-l-4 border-l-[#E12D39] text-[#0F172A] hover:border-[#E12D39] hover:text-[#E12D39] hover:translate-x-1 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E12D39]"
              >
                <span className="flex items-center gap-3 font-semibold text-sm whitespace-nowrap shrink-0">
                  <Play className="w-4 h-4 text-[#E12D39]" />
                  Continua da Checkpoint
                </span>
                <ChevronRight className="w-4 h-4 opacity-75 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            <button
              type="button"
              data-gp-item
              data-gp-group="left"
              onClick={onNewGame}
              className={`group w-full flex items-center justify-between px-5 py-3.5 bg-transparent border border-[#12161F]/40 transition-all duration-150 cursor-pointer hover:translate-x-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7] ${
                canContinue
                  ? 'border-l-4 border-l-[#12161F]/65 text-[#0F172A] hover:border-[#0284C7] hover:border-l-[#0284C7] hover:text-[#0284C7]'
                  : 'border-l-4 border-l-[#E12D39] text-[#0F172A] hover:border-[#E12D39] hover:text-[#E12D39]'
              }`}
            >
              <span className="flex items-center gap-3 font-semibold text-sm whitespace-nowrap shrink-0">
                <Swords className="w-4 h-4" />
                {canContinue ? 'Nuova Storia' : 'Inizia Storia'}
              </span>
              <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="h-px bg-[#0F172A]/15 my-2" />

            <button
              type="button"
              data-gp-item
              data-gp-group="left"
              onClick={() => setActiveTab('story')}
              className={`w-full flex items-center justify-between px-4 py-2.5 bg-transparent border-l-2 text-sm transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'story'
                  ? 'border-l-[#E12D39] border-b border-b-[#0F172A]/20 text-[#0F172A] font-semibold'
                  : 'border-l-transparent text-[#334155] font-medium hover:border-l-[#0284C7] hover:text-[#0F172A] hover:pl-5'
              }`}
            >
              <span>Riepilogo Storia</span>
              <span className="font-mono-nums text-xs text-[#475569]">
                10 Atti
              </span>
            </button>

            <button
              type="button"
              data-gp-item
              data-gp-group="left"
              onClick={() => setActiveTab('levels')}
              className={`w-full flex items-center justify-between px-4 py-2.5 bg-transparent border-l-2 text-sm transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'levels'
                  ? 'border-l-[#E12D39] border-b border-b-[#0F172A]/20 text-[#0F172A] font-semibold'
                  : 'border-l-transparent text-[#334155] font-medium hover:border-l-[#0284C7] hover:text-[#0F172A] hover:pl-5'
              }`}
            >
              <span>Selezione Livello</span>
              <span className="font-mono-nums text-xs text-[#475569]">
                {Math.min(save.unlockedLevel + 1, visibleLevels.length)}/{visibleLevels.length}
              </span>
            </button>

            <button
              type="button"
              data-gp-item
              data-gp-group="left"
              onClick={() => setActiveTab('controls')}
              className={`w-full flex items-center justify-between px-4 py-2.5 bg-transparent border-l-2 text-sm transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'controls'
                  ? 'border-l-[#E12D39] border-b border-b-[#0F172A]/20 text-[#0F172A] font-semibold'
                  : 'border-l-transparent text-[#334155] font-medium hover:border-l-[#0284C7] hover:text-[#0F172A] hover:pl-5'
              }`}
            >
              <span>Controlli e Gamepad</span>
              <Gamepad2 className="w-4 h-4 text-[#475569]" />
            </button>

            <button
              type="button"
              data-gp-item
              data-gp-group="left"
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between px-4 py-2.5 bg-transparent border-l-2 text-sm transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'settings'
                  ? 'border-l-[#E12D39] border-b border-b-[#0F172A]/20 text-[#0F172A] font-semibold'
                  : 'border-l-transparent text-[#334155] font-medium hover:border-l-[#0284C7] hover:text-[#0F172A] hover:pl-5'
              }`}
            >
              <span>Impostazioni</span>
              <SlidersHorizontal className="w-4 h-4 text-[#475569]" />
            </button>

            <div className="pt-2">
              <PWAInstallButton />
            </div>
          </nav>
        </div>

        {/* Bottom Left Quiet Metadata (Unboxed Text) */}
        <div className="pt-6 border-t border-[#0F172A]/15 text-xs text-[#475569] flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span>Dispositivo di input</span>
            <span className="font-medium text-[#0F172A] truncate max-w-[200px]">
              {gamepadConnected ? gamepadName || 'Gamepad connesso' : 'Tastiera & Mouse'}
            </span>
          </div>
          {gamepadConnected && (
            <div className="flex items-center justify-between text-[#0284C7]">
              <span>Navigazione menu</span>
              <span>D-Pad · A Conferma · B Indietro</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>Salvataggio automatico</span>
            <span className="font-mono-nums text-[#0F172A]">
              {canContinue ? formatSaveTimestamp(save.updatedAt) : 'Pronto'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Tema Intro</span>
            <button
              type="button"
              data-gp-item
              data-gp-group="left"
              onClick={() => onChangeAudio({ muted: !audioMuted })}
              className="flex items-center gap-1.5 bg-transparent font-medium text-[#0F172A] hover:text-[#E12D39] transition-colors cursor-pointer"
            >
              {audioMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Disattivato</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{introPlaying ? 'In riproduzione' : 'Tocca per avviare'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT AREA: Live 3D Samurai Scene + Contextual Frosted Panels */}
      <main className="flex-1 h-full flex flex-col justify-between p-6 lg:p-10 pointer-events-none">
        {/* Top-Right Minimal Contextual Header */}
        <div className="flex justify-end">
          <div className="pointer-events-auto bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_8px_32px_rgba(15,23,42,0.1)] px-5 py-3 text-right max-w-md">
            <p className="text-xs text-[#475569]">
              {currentLevelSpec.code} · {currentLevelSpec.title}
            </p>
            <p className="text-sm font-semibold text-[#0F172A] mt-0.5">
              Checkpoint: {currentCpSpec.name}
            </p>
            <p className="font-mono-nums text-xs text-[#475569] mt-0.5">
              Parate perfette {save.parriesTotal} · Sconfitti {save.defeatsTotal}
            </p>
          </div>
        </div>

        {/* Bottom-Right Panel (Story / Levels / Controls / Impostazioni) */}
        <div className="flex justify-end items-end">
          {activeTab === 'story' && (
            <section className="pointer-events-auto w-full max-w-lg bg-white/62 backdrop-blur-xl border border-white/75 shadow-[0_8px_32px_rgba(15,23,42,0.1)] p-6">
              <p className="text-xs font-medium tracking-[0.16em] text-[#0284C7]">
                {currentLevelSpec.code} · {currentLevelSpec.subtitle}
              </p>
              <h2 className="font-display text-2xl font-bold text-[#0F172A] mt-1">
                {currentLevelSpec.title}
              </h2>
              <p className="text-xs font-medium text-[#0F172A] bg-white/50 backdrop-blur-sm border-l-2 border-[#E12D39] px-3 py-2 mt-3">
                Trama: Il protagonista Sakiro deve vendicare la sua famiglia uccidendo tutti i suoi nemici.
              </p>
              <p className="text-sm leading-relaxed text-[#1E293B] mt-3">
                {currentLevelSpec.chapterIntro}
              </p>
              <div className="mt-5 pt-4 border-t border-[#0F172A]/15 flex items-center justify-between gap-4">
                <div className="text-xs text-[#475569]">
                  <span>Audio binaurale HRTF attivo</span>
                  <span aria-hidden="true"> · </span>
                  <span>
                    {currentLevelSpec.checkpoints.length} Checkpoint
                    {chronoUnlocked ? ' · Cronostasi (3.5s)' : ''}
                    {bowUnlocked ? ' · Arco' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  data-gp-item
                  data-gp-group="right"
                  onClick={canContinue ? onContinue : onNewGame}
                  className="px-4 py-2 bg-transparent border border-[#0F172A]/70 border-l-4 border-l-[#E12D39] text-[#0F172A] text-xs font-bold tracking-wide hover:border-[#E12D39] hover:text-[#E12D39] hover:translate-x-0.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  {canContinue ? 'Riprendi Duello' : 'Avvia Capitolo'}
                </button>
              </div>
            </section>
          )}

          {activeTab === 'levels' && (
            <section className="pointer-events-auto w-full max-w-xl bg-white/62 backdrop-blur-xl border border-white/75 shadow-[0_8px_32px_rgba(15,23,42,0.1)] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-[#0F172A]">
                  Capitoli della Storia
                </h2>
                <span className="text-xs text-[#475569]">{previewSpec.subtitle}</span>
              </div>

              <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
                {visibleLevels.map((lvl) => {
                  const unlocked =
                    lvl.index <= save.unlockedLevel || save.storyCompleted;
                  const active = selectedLevel === lvl.index;
                  const isBossArena = lvl.index === 5 || lvl.index === 9;
                  return (
                    <div
                      key={lvl.code}
                      onClick={() => handleSelectLevelCard(lvl.index)}
                      className={`p-3.5 border backdrop-blur-sm transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                        active
                          ? isBossArena
                            ? 'bg-white/65 border-[#E12D39]'
                            : 'bg-white/65 border-[#0F172A]'
                          : isBossArena
                            ? 'bg-rose-50/55 border-rose-500/45 hover:border-[#E12D39]'
                            : 'bg-white/42 border-white/65 hover:border-[#0F172A]/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p
                          className={`text-xs ${
                            isBossArena ? 'font-semibold text-[#E12D39]' : 'text-[#475569]'
                          }`}
                        >
                          {lvl.code} · {lvl.checkpoints.length} Checkpoint
                        </p>
                        <p className="font-display text-sm font-semibold text-[#0F172A] truncate">
                          {lvl.title}
                        </p>
                      </div>
                      <button
                        type="button"
                        data-gp-item={unlocked ? true : undefined}
                        data-gp-group="right"
                        disabled={!unlocked}
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartLevel(lvl.index);
                        }}
                        className={`px-3.5 py-1.5 text-xs font-bold bg-transparent border transition-all whitespace-nowrap shrink-0 ${
                          unlocked
                            ? isBossArena
                              ? 'border-[#E12D39] text-[#B91C1C] hover:border-[#0F172A] hover:text-[#0F172A] cursor-pointer'
                              : 'border-[#0F172A]/65 text-[#0F172A] hover:border-[#E12D39] hover:text-[#E12D39] cursor-pointer'
                            : 'border-[#94A3B8]/40 text-[#64748B] cursor-not-allowed'
                        }`}
                      >
                        {unlocked ? 'Gioca Atto' : 'Bloccato'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === 'controls' && (
            <section className="pointer-events-auto w-full max-w-xl bg-white/62 backdrop-blur-xl border border-white/75 shadow-[0_8px_32px_rgba(15,23,42,0.1)] p-6">
              <h2 className="font-display text-lg font-bold text-[#0F172A] mb-4">
                Comandi di Combattimento
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#334155]">Movimento</span>
                  <span className="font-mono-nums font-semibold text-[#0F172A]">WASD / Stick SX</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#334155]">Visuale 3a Persona</span>
                  <span className="font-mono-nums font-semibold text-[#0F172A]">Mouse / Stick DX</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#334155]">Colpo Rapido (Combo)</span>
                  <span className="font-mono-nums font-semibold text-[#0F172A]">Click SX / J / X</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#334155]">Colpo Pesante</span>
                  <span className="font-mono-nums font-semibold text-[#0F172A]">Q / K / Y</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#334155]">Parata & Deflessione</span>
                  <span className="font-mono-nums font-semibold text-[#0284C7]">Click DX / F / LB</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#334155]">Salto (Parkour)</span>
                  <span className="font-mono-nums font-semibold text-[#0F172A]">Spazio / A</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#334155]">Schivata Rapida</span>
                  <span className="font-mono-nums font-semibold text-[#0F172A]">Shift / V / B</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#334155]">Aggancia / Ri-aggancia</span>
                  <span className="font-mono-nums font-semibold text-[#0F172A]">Tab / R / RB</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#334155]">Cambia Bersaglio</span>
                  <span className="font-mono-nums font-semibold text-[#0F172A]">Z / Rotella / Levetta DX</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#059669] font-medium">Cura Totale (1/livello)</span>
                  <span className="font-mono-nums font-semibold text-[#059669]">X / ↓ D-Pad</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#334155]">Mostra / Nascondi Guida</span>
                  <span className="font-mono-nums font-semibold text-[#0F172A]">H / Impostazioni</span>
                </div>
                {chronoUnlocked && (
                  <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                    <span className="text-[#0284C7] font-medium">Cronostasi (3.5s)</span>
                    <span className="font-mono-nums font-semibold text-[#0284C7]">T / ↑ D-Pad / L3</span>
                  </div>
                )}
                {bowUnlocked && (
                  <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                    <span className="text-[#D97706] font-medium">Arco di Sakiro (5 frecce / 10s)</span>
                    <span className="font-mono-nums font-semibold text-[#D97706]">G / → D-Pad</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#D97706] font-medium">Daimoku (solo in partita)</span>
                  <span className="font-mono-nums font-semibold text-[#D97706]">U / Select</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#0F172A]/12">
                  <span className="text-[#334155]">Pausa</span>
                  <span className="font-mono-nums font-semibold text-[#0F172A]">Esc / Start</span>
                </div>
              </div>
              <p className="text-xs text-[#475569] mt-4 leading-relaxed">
                Premi Parata nell&apos;istante prima dell&apos;impatto per eseguire una Parata Perfetta: azzera i danni e spezza la postura avversaria. Muovi la Levetta Destra (o usa Z / rotella) per cambiare bersaglio durante l&apos;aggancio.
              </p>
            </section>
          )}

          {activeTab === 'settings' && (
            <section className="pointer-events-auto w-full max-w-xl bg-white/62 backdrop-blur-xl border border-white/75 shadow-[0_8px_32px_rgba(15,23,42,0.1)] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[#0F172A]/15">
                <h2 className="font-display text-lg font-bold text-[#0F172A]">
                  Impostazioni
                </h2>
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      ['video', 'Video & FOV'],
                      ['audio', 'Audio'],
                      ['gameplay', 'Comandi & Dati'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      data-gp-item
                      data-gp-group="right"
                      onClick={() => setSettingsSubtab(id)}
                      className={`px-3 py-1.5 text-xs bg-transparent border transition-all cursor-pointer whitespace-nowrap ${
                        settingsSubtab === id
                          ? 'border-[#E12D39] border-b-2 text-[#E12D39] font-bold'
                          : 'border-[#0F172A]/25 text-[#334155] font-medium hover:border-[#0F172A] hover:text-[#0F172A]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {settingsSubtab === 'video' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-[#334155] uppercase mb-2">
                      Preset Qualità Grafica
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          ['auto', 'Auto'],
                          ['low', 'Leggera'],
                          ['balanced', 'Fluida'],
                          ['high', 'Alta'],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          data-gp-item
                          data-gp-group="right"
                          onClick={() =>
                            onChangeVideo(
                              videoSettingsForPreset(
                                id,
                                videoSettings.fov,
                                videoSettings.cameraShake,
                              ),
                            )
                          }
                          className={`py-2 text-xs bg-transparent border transition-all cursor-pointer whitespace-nowrap ${
                            videoSettings.qualityPreset === id
                              ? 'border-[#E12D39] border-b-2 text-[#E12D39] font-bold'
                              : 'border-[#0F172A]/30 text-[#334155] font-medium hover:border-[#0F172A] hover:text-[#0F172A]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#0F172A]/12 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">
                        Campo Visivo (FOV)
                      </p>
                      <p className="text-xs text-[#475569]">
                        Ampiezza dell&apos;inquadratura 3D (46° – 78°)
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono-nums text-xs font-bold text-[#0F172A] w-9 text-right">
                        {videoSettings.fov}°
                      </span>
                      <input
                        type="range"
                        data-gp-item
                        data-gp-group="right"
                        min={46}
                        max={78}
                        step={1}
                        value={videoSettings.fov}
                        onChange={(e) =>
                          onChangeVideo({
                            ...videoSettings,
                            fov: Number(e.target.value),
                          })
                        }
                        className="w-36 accent-[#E12D39] cursor-pointer"
                        aria-label="Campo Visivo FOV"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#0F172A]/12 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-[#0F172A]">
                      Ombre Dinamiche
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 w-60">
                      {(
                        [
                          ['off', 'Off'],
                          ['standard', 'Medie'],
                          ['ultra', 'Ultra'],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          data-gp-item
                          data-gp-group="right"
                          onClick={() =>
                            onChangeVideo({ ...videoSettings, shadowQuality: id })
                          }
                          className={`py-1.5 text-xs bg-transparent border cursor-pointer transition-all ${
                            videoSettings.shadowQuality === id
                              ? 'border-[#0284C7] text-[#0284C7] font-bold'
                              : 'border-[#0F172A]/30 text-[#334155] hover:border-[#0F172A]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#0F172A]/12 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-[#0F172A]">
                      Risoluzione 3D
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 w-60">
                      {(
                        [
                          ['low', 'Veloce'],
                          ['native', 'Nativa'],
                          ['ultra', 'Nitida'],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          data-gp-item
                          data-gp-group="right"
                          onClick={() =>
                            onChangeVideo({ ...videoSettings, renderScale: id })
                          }
                          className={`py-1.5 text-xs bg-transparent border cursor-pointer transition-all ${
                            videoSettings.renderScale === id
                              ? 'border-[#0284C7] text-[#0284C7] font-bold'
                              : 'border-[#0F172A]/30 text-[#334155] hover:border-[#0F172A]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#0F172A]/12 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-[#0F172A]">
                      Particelle &amp; Petali
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 w-60">
                      {(
                        [
                          ['low', 'Ridotte'],
                          ['normal', 'Normali'],
                          ['high', 'Dense'],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          data-gp-item
                          data-gp-group="right"
                          onClick={() =>
                            onChangeVideo({ ...videoSettings, effectsDensity: id })
                          }
                          className={`py-1.5 text-xs bg-transparent border cursor-pointer transition-all ${
                            videoSettings.effectsDensity === id
                              ? 'border-[#0284C7] text-[#0284C7] font-bold'
                              : 'border-[#0F172A]/30 text-[#334155] hover:border-[#0F172A]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#0F172A]/12 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">
                        Vibrazione Camera negli Impatti
                      </p>
                      <p className="text-xs text-[#475569]">
                        Scosse dinamiche su parate perfette e colpi pesanti
                      </p>
                    </div>
                    <button
                      type="button"
                      data-gp-item
                      data-gp-group="right"
                      onClick={() =>
                        onChangeVideo({
                          ...videoSettings,
                          cameraShake: !videoSettings.cameraShake,
                        })
                      }
                      className={`px-3.5 py-1.5 text-xs font-bold bg-transparent border cursor-pointer transition-all ${
                        videoSettings.cameraShake
                          ? 'border-[#E12D39] text-[#E12D39]'
                          : 'border-[#0F172A]/35 text-[#334155] hover:border-[#0F172A]'
                      }`}
                    >
                      {videoSettings.cameraShake ? 'Attiva' : 'Disattiva'}
                    </button>
                  </div>
                </div>
              )}

              {settingsSubtab === 'audio' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      data-gp-item
                      data-gp-group="right"
                      onClick={() => onChangeAudio({ muted: !audioMuted })}
                      className="flex items-center gap-2 bg-transparent text-sm font-medium text-[#0F172A] hover:text-[#E12D39] cursor-pointer transition-colors"
                    >
                      {audioMuted ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                      <span>Volume Generale</span>
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="font-mono-nums text-xs font-semibold text-[#0F172A] w-10 text-right">
                        {audioMuted ? '0%' : `${Math.round(audioVolume * 100)}%`}
                      </span>
                      <input
                        type="range"
                        data-gp-item
                        data-gp-group="right"
                        min={0}
                        max={1}
                        step={0.05}
                        value={audioMuted ? 0 : audioVolume}
                        onChange={(e) =>
                          onChangeAudio({ volume: Number(e.target.value), muted: false })
                        }
                        className="w-40 accent-[#E12D39] cursor-pointer"
                        aria-label="Volume Generale"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#0F172A]/15">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">Stato Audio</p>
                      <p className="text-xs text-[#475569]">
                        Attiva o silenzia musica ed effetti sonori
                      </p>
                    </div>
                    <button
                      type="button"
                      data-gp-item
                      data-gp-group="right"
                      onClick={() => onChangeAudio({ muted: !audioMuted })}
                      className={`px-3.5 py-1.5 text-xs font-bold bg-transparent border cursor-pointer transition-all ${
                        !audioMuted
                          ? 'border-[#0284C7] text-[#0284C7]'
                          : 'border-[#E12D39] text-[#E12D39]'
                      }`}
                    >
                      {audioMuted ? 'Disattivato' : 'Attivo'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#0F172A]/15">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">Audio Spaziale HRTF</p>
                      <p className="text-xs text-[#475569]">
                        Posizionamento 3D di lame, passi e parate
                      </p>
                    </div>
                    <button
                      type="button"
                      data-gp-item
                      data-gp-group="right"
                      onClick={() => onChangeAudio({ binaural: !binauralEnabled })}
                      className={`px-3.5 py-1.5 text-xs font-bold bg-transparent border cursor-pointer transition-all ${
                        binauralEnabled
                          ? 'border-[#0284C7] text-[#0284C7]'
                          : 'border-[#0F172A]/35 text-[#334155] hover:border-[#0F172A]'
                      }`}
                    >
                      {binauralEnabled ? 'HRTF Attivo' : 'Stereo'}
                    </button>
                  </div>
                </div>
              )}

              {settingsSubtab === 'gameplay' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">
                        Guida Comandi in Gioco
                      </p>
                      <p className="text-xs text-[#475569]">
                        Mostra o nascondi l&apos;elenco tasti durante i duelli (Tasto H)
                      </p>
                    </div>
                    <button
                      type="button"
                      data-gp-item
                      data-gp-group="right"
                      onClick={onToggleControlsGuide}
                      className={`px-3.5 py-1.5 text-xs font-bold bg-transparent border cursor-pointer transition-all ${
                        showControlsGuide
                          ? 'border-[#E12D39] text-[#E12D39]'
                          : 'border-[#0F172A]/35 text-[#334155] hover:border-[#0F172A]'
                      }`}
                    >
                      {showControlsGuide ? 'Visibile' : 'Nascosta'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#0F172A]/15">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">
                        Animazione Prologo Storia
                      </p>
                      <p className="text-xs text-[#475569]">
                        Rivedi la scena iniziale sulle origini della vendetta di Sakiro
                      </p>
                    </div>
                    <button
                      type="button"
                      data-gp-item
                      data-gp-group="right"
                      onClick={onReplayIntro}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-transparent border border-[#0F172A]/50 text-[#0F172A] hover:border-[#E12D39] hover:text-[#E12D39] cursor-pointer transition-all"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Rivedi Intro</span>
                    </button>
                  </div>

                  {canContinue && (
                    <div className="flex items-center justify-between pt-3 border-t border-[#0F172A]/15">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">
                          Salvataggio Partita
                        </p>
                        <p className="text-xs text-[#475569]">
                          Ripristina tutti i capitoli e ricomincia dall&apos;Atto 01
                        </p>
                      </div>
                      <button
                        type="button"
                        data-gp-item
                        data-gp-group="right"
                        onClick={onNewGame}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-transparent border border-[#E12D39]/65 text-xs font-bold text-[#E12D39] hover:border-[#E12D39] cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Azzera Progressi</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
};
