import React from 'react';
import { SECRET_COMBOS } from '../game/combos';
import { QualityPreset, SecretComboId } from '../game/types';
import { useGamepadMenuNav } from '../game/useGamepadMenuNav';

interface PauseOverlayProps {
  levelTitle: string;
  checkpointName: string;
  qualityPreset: QualityPreset;
  audioMuted: boolean;
  binauralEnabled: boolean;
  combosUnlocked: boolean;
  discoveredCombos: SecretComboId[];
  gamepadConnected: boolean;
  onResume: () => void;
  onReloadCheckpoint: () => void;
  onExitToMenu: () => void;
  onChangeQuality: (preset: QualityPreset) => void;
  onToggleMute: () => void;
  onToggleBinaural: () => void;
}

export const PauseOverlay: React.FC<PauseOverlayProps> = ({
  levelTitle,
  checkpointName,
  qualityPreset,
  audioMuted,
  binauralEnabled,
  combosUnlocked,
  discoveredCombos,
  gamepadConnected,
  onResume,
  onReloadCheckpoint,
  onExitToMenu,
  onChangeQuality,
  onToggleMute,
  onToggleBinaural,
}) => {
  useGamepadMenuNav({
    enabled: true,
    onBack: onResume,
  });

  return (
    <div className="fixed inset-0 z-30 bg-[#12161F]/45 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#F7F9FC] border border-[#CBD5E1] p-7 max-h-[90vh] overflow-y-auto">
        <p className="text-xs tracking-[0.18em] text-[#5B677A] font-medium">PAUSA</p>
        <h2 className="font-display text-2xl font-bold text-[#12161F] mt-1">{levelTitle}</h2>
        <p className="text-xs text-[#4A5568] mt-1">Ultimo checkpoint: {checkpointName}</p>

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
            onClick={onExitToMenu}
            className="w-full py-2.5 px-4 bg-white border border-[#CBD5E1] text-[#4A5568] text-sm font-medium hover:text-[#12161F] hover:border-[#12161F] transition-colors cursor-pointer"
          >
            Torna al Menu Principale
          </button>
        </div>

        {/* Arti Segrete della Lama (Unlockable from Level 2, Discovered by Experimenting) */}
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

        <div className="mt-5 pt-5 border-t border-[#E2E8F0] space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#4A5568]">Audio Binaurale 3D</span>
            <button
              type="button"
              data-gp-item
              onClick={onToggleBinaural}
              className="px-3 py-1 border border-[#CBD5E1] bg-white font-semibold text-[#12161F] cursor-pointer"
            >
              {binauralEnabled ? 'HRTF Attivo' : 'Stereo'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#4A5568]">Suono</span>
            <button
              type="button"
              data-gp-item
              onClick={onToggleMute}
              className="px-3 py-1 border border-[#CBD5E1] bg-white font-semibold text-[#12161F] cursor-pointer"
            >
              {audioMuted ? 'Disattivato' : 'Attivo'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#4A5568]">Qualità Grafica</span>
            <select
              data-gp-item
              value={qualityPreset}
              onChange={(e) => onChangeQuality(e.target.value as QualityPreset)}
              className="px-2.5 py-1 border border-[#CBD5E1] bg-white font-semibold text-[#12161F] cursor-pointer"
              aria-label="Qualità Grafica"
            >
              <option value="auto">Auto</option>
              <option value="low">Leggera</option>
              <option value="balanced">Fluida</option>
              <option value="high">Alta</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
