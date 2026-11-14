import { motion } from 'motion/react';
import React from 'react';
import { LEVELS } from '../game/levels';
import { useGamepadMenuNav } from '../game/useGamepadMenuNav';

interface OutcomeOverlayProps {
  kind: 'defeat' | 'victory';
  levelIndex: number;
  checkpointName: string;
  onRetryCheckpoint: () => void;
  onNextLevel: () => void;
  onExitToMenu: () => void;
}

export const OutcomeOverlay: React.FC<OutcomeOverlayProps> = ({
  kind,
  levelIndex,
  checkpointName,
  onRetryCheckpoint,
  onNextLevel,
  onExitToMenu,
}) => {
  const isFifthAct = levelIndex === 4;
  const isFinalAct = levelIndex >= LEVELS.length - 1;
  const spec = LEVELS[levelIndex];
  const isDefeat = kind === 'defeat';

  useGamepadMenuNav({
    enabled: true,
    onBack: onExitToMenu,
    deps: [kind, levelIndex],
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: isDefeat ? 0.72 : 0.45, ease: 'easeOut' }}
      className="fixed inset-0 z-30 flex items-center justify-center p-6"
      style={{
        background: isDefeat
          ? 'radial-gradient(circle at center, rgba(18, 22, 31, 0.58) 0%, rgba(120, 14, 26, 0.78) 100%)'
          : 'radial-gradient(circle at center, rgba(15, 23, 42, 0.45) 0%, rgba(15, 23, 42, 0.72) 100%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{
          duration: 0.42,
          delay: isDefeat ? 0.28 : 0.14,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="w-full max-w-md bg-[#F7F9FC] border border-[#CBD5E1] shadow-2xl overflow-hidden"
      >
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.48, delay: isDefeat ? 0.38 : 0.2, ease: 'easeOut' }}
          className={`h-1 w-full origin-left ${
            isDefeat ? 'bg-[#E12D39]' : isFifthAct || isFinalAct ? 'bg-[#F59E0B]' : 'bg-[#0284C7]'
          }`}
        />

        <div className="p-8">
          {isDefeat ? (
            <>
              <p className="text-xs font-semibold tracking-[0.2em] text-[#E12D39]">
                LAMA SPEZZATA
              </p>
              <h2 className="font-display text-3xl font-bold text-[#12161F] mt-1">
                Sei caduto in duello
              </h2>
              <p className="text-sm text-[#4A5568] mt-3 leading-relaxed">
                Il salvataggio automatico ti riporterà all&apos;ultimo santuario attivato: <strong className="text-[#12161F]">{checkpointName}</strong>.
              </p>
              <div className="flex flex-col gap-2.5 mt-7">
                <button
                  type="button"
                  data-gp-item
                  onClick={onRetryCheckpoint}
                  className="w-full py-3 px-4 bg-[#12161F] text-white text-sm font-semibold hover:bg-[#E12D39] transition-colors cursor-pointer"
                >
                  Rinasci al Checkpoint
                </button>
                <button
                  type="button"
                  data-gp-item
                  onClick={onExitToMenu}
                  className="w-full py-2.5 px-4 bg-white border border-[#CBD5E1] text-[#4A5568] text-sm font-medium hover:text-[#12161F] cursor-pointer"
                >
                  Torna al Menu
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold tracking-[0.2em] text-[#0284C7]">
                {spec.code} COMPLETATO
              </p>
              <h2 className="font-display text-3xl font-bold text-[#12161F] mt-1">
                {isFinalAct
                  ? 'Vendetta Compiuta'
                  : isFifthAct
                    ? 'Cronostasi e Arco Sbloccati'
                    : `${spec.title} Liberato`}
              </h2>
              <p className="text-sm text-[#4A5568] mt-3 leading-relaxed">
                {isFinalAct
                  ? 'Sakiro ha abbattuto Shogun Kurogane e tutti i responsabili. La sua famiglia è finalmente vendicata.'
                  : isFifthAct
                    ? 'Lord Tenmei è caduto! Hai sbloccato la Cronostasi ([T] / [↑ D-Pad]: rallenta il tempo per 4s, ricarica 30s) e l\'Arco di Sakiro ([G] / [→ D-Pad]: 2 frecce dritte in 10s). La marcia continua nell\'Atto 06.'
                    : 'Il comandante nemico è caduto. Il progresso è stato salvato automaticamente per il prossimo atto.'}
              </p>
              <div className="flex flex-col gap-2.5 mt-7">
                {!isFinalAct ? (
                  <button
                    type="button"
                    data-gp-item
                    onClick={onNextLevel}
                    className={`w-full py-3 px-4 text-white text-sm font-semibold transition-colors cursor-pointer ${
                      isFifthAct
                        ? 'bg-[#E12D39] hover:bg-[#12161F]'
                        : 'bg-[#12161F] hover:bg-[#0284C7]'
                    }`}
                  >
                    {`Prosegui a ${LEVELS[levelIndex + 1].code}`}
                  </button>
                ) : (
                  <button
                    type="button"
                    data-gp-item
                    onClick={onExitToMenu}
                    className="w-full py-3 px-4 bg-[#12161F] text-white text-sm font-semibold hover:bg-[#0284C7] transition-colors cursor-pointer"
                  >
                    Torna al Menu Principale
                  </button>
                )}
                {!isFinalAct && (
                  <button
                    type="button"
                    data-gp-item
                    onClick={onExitToMenu}
                    className="w-full py-2.5 px-4 bg-white border border-[#CBD5E1] text-[#4A5568] text-sm font-medium hover:text-[#12161F] cursor-pointer"
                  >
                    Menu Principale
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
