import React, { useState } from 'react';
import { SlidersHorizontal, Swords } from 'lucide-react';
import { SECRET_COMBOS } from '../game/combos';
import { videoSettingsForPreset } from '../game/saveSystem';
import { SecretComboId, VideoSettings } from '../game/types';
import { useGamepadMenuNav } from '../game/useGamepadMenuNav';

type PauseSettingsSubtab = 'video' | 'audio' | 'controls';

interface PauseOverlayProps {
  levelTitle: string;
  checkpointName: string;
  videoSettings: VideoSettings;
  audioVolume: number;
  audioMuted: boolean;
  binauralEnabled: boolean;
  showControlsGuide: boolean;
  combosUnlocked: boolean;
  discoveredCombos: SecretComboId[];
  gamepadConnected: boolean;
  onResume: () => void;
  onReloadCheckpoint: () => void;
  onExitToMenu: () => void;
  onChangeVideo: (next: VideoSettings) => void;
  onChangeVolume: (vol: number) => void;
  onToggleMute: () => void;
  onToggleBinaural: () => void;
  onToggleControlsGuide: () => void;
}

export const PauseOverlay: React.FC<PauseOverlayProps> = ({
  levelTitle,
  checkpointName,
  videoSettings,
  audioVolume,
  audioMuted,
  binauralEnabled,
  showControlsGuide,
  combosUnlocked,
  discoveredCombos,
  gamepadConnected,
  onResume,
  onReloadCheckpoint,
  onExitToMenu,
  onChangeVideo,
  onChangeVolume,
  onToggleMute,
  onToggleBinaural,
  onToggleControlsGuide,
}) => {
  const [section, setSection] = useState<'main' | 'settings'>('main');
  const [settingsSubtab, setSettingsSubtab] = useState<PauseSettingsSubtab>('video');

  useGamepadMenuNav({
    enabled: true,
    onBack: () => {
      if (section === 'settings') setSection('main');
      else onResume();
    },
    deps: [section, settingsSubtab],
  });

  return (
    <div className="fixed inset-0 z-30 bg-[#12161F]/50 backdrop-blur-xs flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#F7F9FC] border border-[#CBD5E1] p-7 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.18em] text-[#5B677A] font-medium">PAUSA</p>
            <h2 className="font-display text-2xl font-bold text-[#12161F] mt-0.5">{levelTitle}</h2>
            <p className="text-xs text-[#4A5568] mt-0.5">Ultimo checkpoint: {checkpointName}</p>
          </div>
          <div className="flex border border-[#CBD5E1] bg-white shrink-0">
            <button
              type="button"
              data-gp-item
              onClick={() => setSection('main')}
              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                section === 'main' ? 'bg-[#12161F] text-white' : 'text-[#4A5568] hover:text-[#12161F]'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Duello</span>
            </button>
            <button
              type="button"
              data-gp-item
              onClick={() => setSection('settings')}
              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                section === 'settings'
                  ? 'bg-[#12161F] text-white'
                  : 'text-[#4A5568] hover:text-[#12161F]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Impostazioni</span>
            </button>
          </div>
        </div>

        {section === 'main' ? (
          <>
            <div className="flex flex-col gap-2.5 mt-6">
              <button
                type="button"
                data-gp-item
                onClick={onResume}
                className="w-full py-3 px-4 bg-[#12161F] text-white text-sm font-semibold hover:bg-[#0284C7] transition-colors cursor-pointer"
              >
                Riprendi Combattimento
              </button>
              <button
                type="button"
                data-gp-item
                onClick={onReloadCheckpoint}
                className="w-full py-2.5 px-4 bg-white border border-[#CBD5E1] text-[#12161F] text-sm font-medium hover:border-[#12161F] transition-colors cursor-pointer"
              >
                Ricarica da Checkpoint
              </button>
              <button
                type="button"
                data-gp-item
                onClick={() => setSection('settings')}
                className="w-full py-2.5 px-4 bg-white border border-[#CBD5E1] text-[#12161F] text-sm font-medium hover:border-[#12161F] transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Menu Impostazioni</span>
              </button>
              <button
                type="button"
                data-gp-item
                onClick={onExitToMenu}
                className="w-full py-2.5 px-4 bg-white border border-[#CBD5E1] text-[#4A5568] text-sm font-medium hover:text-[#12161F] hover:border-[#12161F] transition-colors cursor-pointer"
              >
                Torna al Menu Principale
              </button>
            </div>

            {/* Arti Segrete della Lama (8 Arti sbloccabili da Atto 02) */}
            <div className="mt-6 pt-5 border-t border-[#E2E8F0]">
              <div className="flex items-center justify-between text-xs mb-2.5">
                <span className="font-display font-semibold tracking-wider text-[#12161F]">
                  ARTI SEGRETE
                </span>
                <span className="font-mono-nums text-[#5B677A]">
                  {combosUnlocked ? `${discoveredCombos.length}/${SECRET_COMBOS.length}` : 'BLOCCATE'}
                </span>
              </div>
              {!combosUnlocked ? (
                <p className="text-xs text-[#5B677A]">
                  Le combinazioni segrete si sbloccano raggiungendo l&apos;Atto 02.
                </p>
              ) : (
                <div className="space-y-1.5 text-xs">
                  {SECRET_COMBOS.map((combo) => {
                    const found = discoveredCombos.includes(combo.id);
                    return (
                      <div
                        key={combo.id}
                        className="flex items-center justify-between gap-2 py-1 border-b border-[#E2E8F0] last:border-b-0"
                      >
                        <span className={found ? 'font-semibold text-[#12161F]' : 'text-[#94A3B8]'}>
                          {found ? combo.name : '??? · Da scoprire'}
                        </span>
                        <span className="font-mono-nums text-[11px] text-[#0284C7]">
                          {found ? (gamepadConnected ? combo.sequenceGp : combo.sequencePc) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mt-5 space-y-4 text-xs">
            <div className="grid grid-cols-3 border border-[#CBD5E1] bg-white">
              {(
                [
                  ['video', 'Video & FOV'],
                  ['audio', 'Audio'],
                  ['controls', 'Comandi'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  data-gp-item
                  onClick={() => setSettingsSubtab(id)}
                  className={`py-2 text-xs font-semibold cursor-pointer transition-colors ${
                    settingsSubtab === id
                      ? 'bg-[#12161F] text-white'
                      : 'text-[#4A5568] hover:text-[#12161F]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {settingsSubtab === 'video' && (
              <div className="space-y-3">
                <div className="pb-2 border-b border-[#E2E8F0]">
                  <p className="font-semibold text-[#12161F] mb-2">Preset Qualità Grafica</p>
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
                        onClick={() =>
                          onChangeVideo(
                            videoSettingsForPreset(
                              id,
                              videoSettings.fov,
                              videoSettings.cameraShake,
                            ),
                          )
                        }
                        className={`py-1.5 border font-semibold cursor-pointer transition-colors ${
                          videoSettings.qualityPreset === id
                            ? 'bg-[#12161F] text-white border-[#12161F]'
                            : 'bg-white text-[#4A5568] border-[#CBD5E1] hover:border-[#12161F]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#E2E8F0]">
                  <span className="font-semibold text-[#12161F]">
                    Campo Visivo (FOV)
                  </span>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono-nums font-bold text-[#12161F] w-8 text-right">
                      {videoSettings.fov}°
                    </span>
                    <input
                      type="range"
                      data-gp-item
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
                      className="w-32 accent-[#12161F] cursor-pointer"
                      aria-label="Campo Visivo FOV"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 py-1.5 border-b border-[#E2E8F0]">
                  <span className="font-semibold text-[#12161F]">Ombre 3D</span>
                  <div className="grid grid-cols-3 gap-1 w-48">
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
                        onClick={() =>
                          onChangeVideo({ ...videoSettings, shadowQuality: id })
                        }
                        className={`py-1 border font-semibold cursor-pointer ${
                          videoSettings.shadowQuality === id
                            ? 'bg-[#12161F] text-white border-[#12161F]'
                            : 'bg-white text-[#4A5568] border-[#CBD5E1]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 py-1.5 border-b border-[#E2E8F0]">
                  <span className="font-semibold text-[#12161F]">Risoluzione 3D</span>
                  <div className="grid grid-cols-3 gap-1 w-48">
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
                        onClick={() =>
                          onChangeVideo({ ...videoSettings, renderScale: id })
                        }
                        className={`py-1 border font-semibold cursor-pointer ${
                          videoSettings.renderScale === id
                            ? 'bg-[#12161F] text-white border-[#12161F]'
                            : 'bg-white text-[#4A5568] border-[#CBD5E1]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 py-1.5 border-b border-[#E2E8F0]">
                  <span className="font-semibold text-[#12161F]">Particelle</span>
                  <div className="grid grid-cols-3 gap-1 w-48">
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
                        onClick={() =>
                          onChangeVideo({ ...videoSettings, effectsDensity: id })
                        }
                        className={`py-1 border font-semibold cursor-pointer ${
                          videoSettings.effectsDensity === id
                            ? 'bg-[#12161F] text-white border-[#12161F]'
                            : 'bg-white text-[#4A5568] border-[#CBD5E1]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-[#E2E8F0]">
                  <span className="font-semibold text-[#12161F]">Vibrazione Camera</span>
                  <button
                    type="button"
                    data-gp-item
                    onClick={() =>
                      onChangeVideo({
                        ...videoSettings,
                        cameraShake: !videoSettings.cameraShake,
                      })
                    }
                    className={`px-3 py-1 border font-semibold cursor-pointer ${
                      videoSettings.cameraShake
                        ? 'bg-[#12161F] text-white border-[#12161F]'
                        : 'bg-white text-[#4A5568] border-[#CBD5E1]'
                    }`}
                  >
                    {videoSettings.cameraShake ? 'Attiva' : 'Disattiva'}
                  </button>
                </div>
              </div>
            )}

            {settingsSubtab === 'audio' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 py-2 border-b border-[#E2E8F0]">
                  <span className="font-semibold text-[#12161F]">Volume Generale</span>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono-nums font-bold text-[#12161F] w-9 text-right">
                      {audioMuted ? '0%' : `${Math.round(audioVolume * 100)}%`}
                    </span>
                    <input
                      type="range"
                      data-gp-item
                      min={0}
                      max={1}
                      step={0.05}
                      value={audioMuted ? 0 : audioVolume}
                      onChange={(e) => onChangeVolume(Number(e.target.value))}
                      className="w-32 accent-[#12161F] cursor-pointer"
                      aria-label="Volume Generale"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[#E2E8F0]">
                  <span className="font-semibold text-[#12161F]">Stato Audio</span>
                  <button
                    type="button"
                    data-gp-item
                    onClick={onToggleMute}
                    className={`px-3 py-1.5 border font-semibold cursor-pointer ${
                      !audioMuted
                        ? 'bg-[#12161F] text-white border-[#12161F]'
                        : 'bg-white text-[#E12D39] border-[#E12D39]'
                    }`}
                  >
                    {audioMuted ? 'Disattivato' : 'Attivo'}
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[#E2E8F0]">
                  <span className="font-semibold text-[#12161F]">Audio Binaurale 3D</span>
                  <button
                    type="button"
                    data-gp-item
                    onClick={onToggleBinaural}
                    className="px-3 py-1.5 border border-[#CBD5E1] bg-white font-semibold text-[#12161F] cursor-pointer"
                  >
                    {binauralEnabled ? 'HRTF Attivo' : 'Stereo'}
                  </button>
                </div>
              </div>
            )}

            {settingsSubtab === 'controls' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-[#E2E8F0]">
                  <div>
                    <p className="font-semibold text-[#12161F]">Guida Comandi in Gioco</p>
                    <p className="text-[#5B677A] text-[11px]">
                      Mostra o nascondi il pannello tasti in basso a destra (Tasto H)
                    </p>
                  </div>
                  <button
                    type="button"
                    data-gp-item
                    onClick={onToggleControlsGuide}
                    className={`px-3 py-1.5 border font-semibold cursor-pointer transition-colors ${
                      showControlsGuide
                        ? 'bg-[#12161F] text-white border-[#12161F]'
                        : 'bg-white text-[#4A5568] border-[#CBD5E1]'
                    }`}
                  >
                    {showControlsGuide ? 'Visibile' : 'Nascosta'}
                  </button>
                </div>

                <div className="bg-white border border-[#E2E8F0] p-3 space-y-1.5 text-[11px] text-[#334155]">
                  <div className="flex justify-between">
                    <span>Cura Totale (1 volta per atto)</span>
                    <span className="font-mono-nums font-bold text-[#059669]">
                      X / ↓ D-Pad
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aggancia / Ri-aggancia bersaglio</span>
                    <span className="font-mono-nums font-bold text-[#12161F]">
                      Tab / R / RB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cambia bersaglio</span>
                    <span className="font-mono-nums font-bold text-[#12161F]">
                      Z / Rotella / Levetta DX
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Daimoku (solo in partita)</span>
                    <span className="font-mono-nums font-bold text-[#D97706]">
                      U / Select
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex gap-2.5">
              <button
                type="button"
                data-gp-item
                onClick={() => setSection('main')}
                className="flex-1 py-2.5 px-4 bg-white border border-[#CBD5E1] text-[#12161F] font-semibold hover:border-[#12161F] cursor-pointer"
              >
                Indietro
              </button>
              <button
                type="button"
                data-gp-item
                onClick={onResume}
                className="flex-1 py-2.5 px-4 bg-[#12161F] text-white font-semibold hover:bg-[#0284C7] cursor-pointer"
              >
                Riprendi Duello
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
