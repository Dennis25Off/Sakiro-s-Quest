import React, { useState } from 'react';
import {
  ChevronRight,
  Gamepad2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Swords,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { LEVELS } from '../game/levels';
import { formatSaveTimestamp, hasExistingProgress } from '../game/saveSystem';
import { QualityPreset, SaveData } from '../game/types';
import { useGamepadMenuNav } from '../game/useGamepadMenuNav';

type MenuTab = 'story' | 'levels' | 'settings' | 'controls';

interface StartMenuProps {
  save: SaveData;
  gamepadConnected: boolean;
  gamepadName: string;
  qualityPreset: QualityPreset;
  audioVolume: number;
  audioMuted: boolean;
  binauralEnabled: boolean;
  introPlaying: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onStartLevel: (levelIndex: number) => void;
  onChangeQuality: (preset: QualityPreset) => void;
  onChangeAudio: (opts: { volume?: number; muted?: boolean; binaural?: boolean }) => void;
  onPreviewLevel: (levelIndex: number) => void;
}

export const StartMenu: React.FC<StartMenuProps> = ({
  save,
  gamepadConnected,
  gamepadName,
  qualityPreset,
  audioVolume,
  audioMuted,
  binauralEnabled,
  introPlaying,
  onContinue,
  onNewGame,
  onStartLevel,
  onChangeQuality,
  onChangeAudio,
  onPreviewLevel,
}) => {
  const [activeTab, setActiveTab] = useState<MenuTab>('story');
  const [selectedLevel, setSelectedLevel] = useState<number>(save.levelIndex);
  const canContinue = hasExistingProgress(save);
  const chronoUnlocked =
    save.timeSlowUnlocked || save.storyCompleted || save.unlockedLevel >= 5;
  const bowUnlocked =
    save.bowUnlocked || save.storyCompleted || save.unlockedLevel >= 5;
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
    deps: [activeTab, canContinue, save.unlockedLevel, chronoUnlocked],
  });

  const handleSelectLevelCard = (idx: number) => {
    setSelectedLevel(idx);
    onPreviewLevel(idx);
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col lg:flex-row pointer-events-none">
      {/* LEFT RAIL: Title & All Primary Menu Buttons aligned strictly on the left */}
      <aside className="pointer-events-auto w-full lg:w-[400px] xl:w-[430px] h-auto lg:h-full bg-[#F7F9FC]/94 border-b lg:border-b-0 lg:border-r border-[#DCE3EC] flex flex-col justify-between px-7 py-7 lg:px-9 lg:py-10">
        <div>
          {/* Clean Brand Title */}
          <div className="mb-8">
            <p className="text-xs font-medium tracking-[0.22em] text-[#5B677A] mb-2">
              SAKIRO&apos;S QUEST · VENDETTA
            </p>
            <h1 className="font-display text-4xl xl:text-[42px] font-bold tracking-tight text-[#12161F] leading-none">
              SAKIRO&apos;S QUEST
            </h1>
            <p className="text-sm text-[#4A5568] mt-2">
              La Vendetta del Samurai
            </p>
          </div>

          {/* Primary Action Buttons (Left-Aligned Stack) */}
          <nav className="flex flex-col gap-2.5" aria-label="Menu principale">
            {canContinue && (
              <button
                type="button"
                data-gp-item
                data-gp-group="left"
                onClick={onContinue}
                className="group w-full flex items-center justify-between px-5 py-3.5 bg-[#12161F] text-white hover:bg-[#E12D39] transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E12D39]"
              >
                <span className="flex items-center gap-3 font-medium text-sm whitespace-nowrap shrink-0">
                  <Play className="w-4 h-4" />
                  Continua da Checkpoint
                </span>
                <ChevronRight className="w-4 h-4 opacity-75 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            <button
              type="button"
              data-gp-item
              data-gp-group="left"
              onClick={onNewGame}
              className={`group w-full flex items-center justify-between px-5 py-3.5 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7] ${
                canContinue
                  ? 'bg-white text-[#12161F] border border-[#D4DCE6] hover:border-[#12161F]'
                  : 'bg-[#12161F] text-white hover:bg-[#E12D39]'
              }`}
            >
              <span className="flex items-center gap-3 font-medium text-sm whitespace-nowrap shrink-0">
                <Swords className="w-4 h-4" />
                {canContinue ? 'Nuova Storia' : 'Inizia Storia'}
              </span>
              <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <div className="h-px bg-[#E1E7EF] my-2" />

            <button
              type="button"
              data-gp-item
              data-gp-group="left"
              onClick={() => setActiveTab('story')}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'story'
                  ? 'bg-[#E9EFF6] text-[#12161F]'
                  : 'text-[#4A5568] hover:bg-[#EFF3F8] hover:text-[#12161F]'
              }`}
            >
              <span>Riepilogo Storia</span>
              <span className="font-mono-nums text-xs text-[#64748B]">
                10 Atti
              </span>
            </button>

            <button
              type="button"
              data-gp-item
              data-gp-group="left"
              onClick={() => setActiveTab('levels')}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'levels'
                  ? 'bg-[#E9EFF6] text-[#12161F]'
                  : 'text-[#4A5568] hover:bg-[#EFF3F8] hover:text-[#12161F]'
              }`}
            >
              <span>Selezione Livello</span>
              <span className="font-mono-nums text-xs text-[#64748B]">
                {Math.min(save.unlockedLevel + 1, visibleLevels.length)}/{visibleLevels.length}
              </span>
            </button>

            <button
              type="button"
              data-gp-item
              data-gp-group="left"
              onClick={() => setActiveTab('controls')}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'controls'
                  ? 'bg-[#E9EFF6] text-[#12161F]'
                  : 'text-[#4A5568] hover:bg-[#EFF3F8] hover:text-[#12161F]'
              }`}
            >
              <span>Controlli e Gamepad</span>
              <Gamepad2 className="w-4 h-4 text-[#64748B]" />
            </button>

            <button
              type="button"
              data-gp-item
              data-gp-group="left"
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-[#E9EFF6] text-[#12161F]'
                  : 'text-[#4A5568] hover:bg-[#EFF3F8] hover:text-[#12161F]'
              }`}
            >
              <span>Audio 3D e Prestazioni</span>
              <SlidersHorizontal className="w-4 h-4 text-[#64748B]" />
            </button>
          </nav>
        </div>

        {/* Bottom Left Quiet Metadata (Unboxed Text, Zero Pills) */}
        <div className="pt-6 border-t border-[#E1E7EF] text-xs text-[#5B677A] flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span>Dispositivo di input</span>
            <span className="font-medium text-[#12161F] truncate max-w-[200px]">
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
            <span className="font-mono-nums text-[#12161F]">
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
              className="flex items-center gap-1.5 font-medium text-[#12161F] hover:text-[#0284C7] transition-colors cursor-pointer"
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

      {/* RIGHT AREA: Live 3D Samurai Scene + Contextual Panel cleanly positioned on the right */}
      <main className="flex-1 h-full flex flex-col justify-between p-6 lg:p-10 pointer-events-none">
        {/* Top-Right Minimal Contextual Header */}
        <div className="flex justify-end">
          <div className="pointer-events-auto bg-[#F7F9FC]/90 border border-[#DCE3EC] px-5 py-3 text-right max-w-md">
            <p className="text-xs text-[#5B677A]">
              {currentLevelSpec.code} · {currentLevelSpec.title}
            </p>
            <p className="text-sm font-semibold text-[#12161F] mt-0.5">
              Checkpoint: {currentCpSpec.name}
            </p>
            <p className="font-mono-nums text-xs text-[#5B677A] mt-0.5">
              Parate perfette {save.parriesTotal} · Sconfitti {save.defeatsTotal}
            </p>
          </div>
        </div>

        {/* Bottom-Right Panel (Story / Levels / Controls / Audio & Performance) */}
        <div className="flex justify-end items-end">
          {activeTab === 'story' && (
            <section className="pointer-events-auto w-full max-w-lg bg-[#F7F9FC]/94 border border-[#DCE3EC] p-6">
              <p className="text-xs font-medium tracking-[0.16em] text-[#0284C7]">
                {currentLevelSpec.code} · {currentLevelSpec.subtitle}
              </p>
              <h2 className="font-display text-2xl font-bold text-[#12161F] mt-1">
                {currentLevelSpec.title}
              </h2>
              <p className="text-xs font-medium text-[#12161F] bg-[#E9EFF6] border-l-2 border-[#E12D39] px-3 py-2 mt-3">
                Trama: Il protagonista Sakiro deve vendicare la sua famiglia uccidendo tutti i suoi nemici.
              </p>
              <p className="text-sm leading-relaxed text-[#3B4657] mt-3">
                {currentLevelSpec.chapterIntro}
              </p>
              <div className="mt-5 pt-4 border-t border-[#E1E7EF] flex items-center justify-between gap-4">
                <div className="text-xs text-[#5B677A]">
                  <span>Audio binaurale HRTF attivo</span>
                  <span aria-hidden="true"> · </span>
                  <span>
                    {currentLevelSpec.checkpoints.length} Checkpoint
                    {chronoUnlocked ? ' · Cronostasi & Arco' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  data-gp-item
                  data-gp-group="right"
                  onClick={canContinue ? onContinue : onNewGame}
                  className="px-4 py-2 bg-[#12161F] text-white text-xs font-semibold hover:bg-[#0284C7] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {canContinue ? 'Riprendi Duello' : 'Avvia Capitolo'}
                </button>
              </div>
            </section>
          )}

          {activeTab === 'levels' && (
            <section className="pointer-events-auto w-full max-w-xl bg-[#F7F9FC]/94 border border-[#DCE3EC] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-[#12161F]">
                  Capitoli della Storia
                </h2>
                <span className="text-xs text-[#5B677A]">{previewSpec.subtitle}</span>
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
                      className={`p-3.5 border transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                        active
                          ? isBossArena
                            ? 'bg-white border-[#E12D39]'
                            : 'bg-white border-[#12161F]'
                          : isBossArena
                            ? 'bg-[#FDF2F4] border-[#FECDD3] hover:border-[#E12D39]'
                            : 'bg-[#F2F5F9] border-[#DCE3EC] hover:border-[#94A3B8]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p
                          className={`text-xs ${
                            isBossArena ? 'font-semibold text-[#E12D39]' : 'text-[#5B677A]'
                          }`}
                        >
                          {lvl.code} · {lvl.checkpoints.length} Checkpoint
                        </p>
                        <p className="font-display text-sm font-semibold text-[#12161F] truncate">
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
                        className={`px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          unlocked
                            ? isBossArena
                              ? 'bg-[#E12D39] text-white hover:bg-[#12161F] cursor-pointer'
                              : 'bg-[#12161F] text-white hover:bg-[#E12D39] cursor-pointer'
                            : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
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
            <section className="pointer-events-auto w-full max-w-xl bg-[#F7F9FC]/94 border border-[#DCE3EC] p-6">
              <h2 className="font-display text-lg font-bold text-[#12161F] mb-4">
                Comandi di Combattimento
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#4A5568]">Movimento</span>
                  <span className="font-mono-nums font-semibold text-[#12161F]">WASD / Stick SX</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#4A5568]">Visuale 3a Persona</span>
                  <span className="font-mono-nums font-semibold text-[#12161F]">Mouse / Stick DX</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#4A5568]">Colpo Rapido (Combo)</span>
                  <span className="font-mono-nums font-semibold text-[#12161F]">Click SX / J / X</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#4A5568]">Colpo Pesante</span>
                  <span className="font-mono-nums font-semibold text-[#12161F]">Q / K / Y</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#4A5568]">Parata & Deflessione</span>
                  <span className="font-mono-nums font-semibold text-[#0284C7]">Click DX / F / LB</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#4A5568]">Salto (Parkour)</span>
                  <span className="font-mono-nums font-semibold text-[#12161F]">Spazio / A</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#4A5568]">Schivata Rapida</span>
                  <span className="font-mono-nums font-semibold text-[#12161F]">Shift / V / B</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#4A5568]">Aggancia Bersaglio</span>
                  <span className="font-mono-nums font-semibold text-[#12161F]">Tab / R / RB</span>
                </div>
                {chronoUnlocked && (
                  <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                    <span className="text-[#0284C7] font-medium">Cronostasi (4s)</span>
                    <span className="font-mono-nums font-semibold text-[#0284C7]">T / ↑ D-Pad / L3</span>
                  </div>
                )}
                {bowUnlocked && (
                  <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                    <span className="text-[#D97706] font-medium">Arco di Sakiro (10s)</span>
                    <span className="font-mono-nums font-semibold text-[#D97706]">G / → D-Pad</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#4A5568]">Pausa</span>
                  <span className="font-mono-nums font-semibold text-[#12161F]">Esc / Start</span>
                </div>
              </div>
              <p className="text-xs text-[#5B677A] mt-4 leading-relaxed">
                Premi Parata nell&apos;istante prima dell&apos;impatto per eseguire una Parata Perfetta: azzera i danni e spezza la postura avversaria. Usa Spazio / A per superare i torrenti nei passaggi di parkour.
              </p>
            </section>
          )}

          {activeTab === 'settings' && (
            <section className="pointer-events-auto w-full max-w-lg bg-[#F7F9FC]/94 border border-[#DCE3EC] p-6">
              <h2 className="font-display text-lg font-bold text-[#12161F] mb-4">
                Audio Binaurale 3D & Grafica
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#12161F]">Audio Spaziale HRTF</p>
                    <p className="text-xs text-[#5B677A]">Posizionamento 3D di lame, passi e parate</p>
                  </div>
                  <button
                    type="button"
                    data-gp-item
                    data-gp-group="right"
                    onClick={() => onChangeAudio({ binaural: !binauralEnabled })}
                    className={`px-3.5 py-1.5 text-xs font-semibold border cursor-pointer transition-colors ${
                      binauralEnabled
                        ? 'bg-[#12161F] text-white border-[#12161F]'
                        : 'bg-white text-[#4A5568] border-[#CBD5E1]'
                    }`}
                  >
                    {binauralEnabled ? 'Attivo' : 'Stereo'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    data-gp-item
                    data-gp-group="right"
                    onClick={() => onChangeAudio({ muted: !audioMuted })}
                    className="flex items-center gap-2 text-sm font-medium text-[#12161F] cursor-pointer"
                  >
                    {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    <span>Volume Generale</span>
                  </button>
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
                    className="w-40 accent-[#12161F] cursor-pointer"
                    aria-label="Volume Generale"
                  />
                </div>

                <div className="pt-2 border-t border-[#E1E7EF]">
                  <p className="text-sm font-medium text-[#12161F] mb-2">
                    Ottimizzazione Dispositivo
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
                        onClick={() => onChangeQuality(id)}
                        className={`py-2 text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                          qualityPreset === id
                            ? 'bg-[#12161F] text-white border-[#12161F]'
                            : 'bg-white text-[#4A5568] border-[#CBD5E1] hover:border-[#12161F]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {canContinue && (
                  <div className="pt-3 border-t border-[#E1E7EF] flex justify-end">
                    <button
                      type="button"
                      data-gp-item
                      data-gp-group="right"
                      onClick={onNewGame}
                      className="flex items-center gap-2 text-xs font-medium text-[#E12D39] hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Azzera progressi salvati
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};
