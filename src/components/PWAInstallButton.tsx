import { Download, Share, X } from 'lucide-react';
import React, { useState } from 'react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        data-gp-item
        data-gp-group="left"
        onClick={handleClick}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium bg-transparent border border-[#12161F]/35 text-[#12161F] hover:border-[#0284C7] hover:text-[#0284C7] hover:translate-x-1 transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0"
      >
        <span className="flex items-center gap-2.5">
          <Download className="w-4 h-4" />
          <span>Aggiungi come App</span>
        </span>
        <span className="font-mono-nums text-[10px] tracking-wider opacity-75">
          {isInstallable ? 'PRONTO' : isIOS ? 'iOS' : 'PWA'}
        </span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/55 backdrop-blur-xs p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#F7F9FC]/95 backdrop-blur-md border border-[#CBD5E1] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-[#0284C7]">
                  SAKIRO&apos;S QUEST · APP
                </p>
                <h3 className="font-display text-lg font-bold text-[#12161F] mt-0.5">
                  {isIOS ? 'Installa su iPhone / iPad' : 'Aggiungi alla Schermata Home'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Chiudi"
                className="p-1 text-[#64748B] hover:text-[#12161F] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-4 space-y-2.5 text-xs text-[#334155] leading-relaxed">
                <p className="flex items-center gap-2">
                  <Share className="w-4 h-4 text-[#0284C7] shrink-0" />
                  <span>
                    1. Tocca l&apos;icona <strong>Condividi</strong> nella barra di Safari.
                  </span>
                </p>
                <p>
                  2. Scorri verso il basso e seleziona{' '}
                  <strong>Aggiungi alla schermata Home</strong>.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2 text-xs text-[#334155] leading-relaxed">
                <p>
                  1. Apri il menu del browser (o l&apos;icona di installazione nella barra
                  degli indirizzi).
                </p>
                <p>
                  2. Seleziona <strong>Installa Sakiro&apos;s Quest</strong> oppure{' '}
                  <strong>Aggiungi a schermata Home / Crea scorciatoia</strong>.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full py-2.5 bg-[#12161F] text-white text-xs font-semibold hover:bg-[#E12D39] transition-colors cursor-pointer"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#0F172A]/90 border border-[#F59E0B] px-3.5 py-1.5 text-xs font-medium text-[#FEF3C7] shadow-lg pointer-events-none">
      <span className="h-2 w-2 rounded-full bg-[#F59E0B] animate-pulse" />
      <span>Modalità Offline — Dati in cache attivi</span>
    </div>
  );
};
