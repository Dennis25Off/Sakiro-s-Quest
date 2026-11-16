import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Heart, Shield, Sparkles, Swords, Wind, X } from 'lucide-react';
import { DAIMOKU_UPGRADE_SPECS, getDaimokuUpgradeCost } from '../game/saveSystem';
import { DaimokuStatId, DaimokuUpgrades } from '../game/types';
import { useGamepadMenuNav } from '../game/useGamepadMenuNav';

interface DaimokuOverlayProps {
  energyOrbs: number;
  daimoku: DaimokuUpgrades;
  levelTitle: string;
  gamepadConnected: boolean;
  onUpgrade: (statId: DaimokuStatId) => void;
  onClose: () => void;
}

const STAT_META: Record<
  DaimokuStatId,
  { icon: React.ReactNode; accentHex: string }
> = {
  attack: {
    icon: <Swords className="w-4 h-4 text-[#FB7185]" />,
    accentHex: '#E12D39',
  },
  vitality: {
    icon: <Heart className="w-4 h-4 text-[#34D399]" />,
    accentHex: '#10B981',
  },
  stamina: {
    icon: <Wind className="w-4 h-4 text-[#38BDF8]" />,
    accentHex: '#0EA5E9',
  },
  posture: {
    icon: <Shield className="w-4 h-4 text-[#FBBF24]" />,
    accentHex: '#F59E0B',
  },
  elixir: {
    icon: <Sparkles className="w-4 h-4 text-[#E2E8F0]" />,
    accentHex: '#F8FAFC',
  },
};

function formatStatTransition(
  id: DaimokuStatId,
  level: number,
): { now: string; next: string | null } {
  const isMax = level >= 5;
  switch (id) {
    case 'attack':
      return {
        now: `${100 + level * 12}% danni`,
        next: isMax ? null : `${100 + (level + 1) * 12}% danni`,
      };
    case 'vitality':
      return {
        now: `${100 + level * 20} HP`,
        next: isMax ? null : `${100 + (level + 1) * 20} HP`,
      };
    case 'stamina':
      return {
        now: `${100 + level * 15} Energia`,
        next: isMax ? null : `${100 + (level + 1) * 15} Energia`,
      };
    case 'posture':
      return {
        now: `${100 + level * 18} Postura`,
        next: isMax ? null : `${100 + (level + 1) * 18} Postura`,
      };
    case 'elixir': {
      const healsNow = 1 + (level >= 1 ? 1 : 0) + (level >= 3 ? 1 : 0);
      const healsNext = 1 + (level + 1 >= 1 ? 1 : 0) + (level + 1 >= 3 ? 1 : 0);
      return {
        now: `${healsNow} ${healsNow === 1 ? 'Cura' : 'Cure'} · +${level * 8}% rec.`,
        next: isMax
          ? null
          : `${healsNext} ${healsNext === 1 ? 'Cura' : 'Cure'} · +${(level + 1) * 8}% rec.`,
      };
    }
  }
}

export const DaimokuOverlay: React.FC<DaimokuOverlayProps> = ({
  energyOrbs,
  daimoku,
  levelTitle,
  gamepadConnected,
  onUpgrade,
  onClose,
}) => {
  const [recentStat, setRecentStat] = useState<DaimokuStatId | null>(null);

  useGamepadMenuNav({
    enabled: true,
    onBack: onClose,
    deps: [energyOrbs, daimoku],
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyU') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let prevSelect = true;
    const id = window.setInterval(() => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = pads ? Array.from(pads).find((p) => p && p.connected) : undefined;
      if (!pad) {
        prevSelect = false;
        return;
      }
      const pressed = Boolean(pad.buttons[8]?.pressed || (pad.buttons[8]?.value ?? 0) > 0.35);
      if (pressed && !prevSelect) {
        onClose();
      }
      prevSelect = pressed;
    }, 50);
    return () => window.clearInterval(id);
  }, [onClose]);

  useEffect(() => {
    if (!recentStat) return;
    const id = window.setTimeout(() => setRecentStat(null), 950);
    return () => window.clearTimeout(id);
  }, [recentStat]);

  const handleUpgrade = (statId: DaimokuStatId) => {
    onUpgrade(statId);
    setRecentStat(statId);
  };

  const totalRank =
    daimoku.attackLevel +
    daimoku.vitalityLevel +
    daimoku.staminaLevel +
    daimoku.postureLevel +
    daimoku.elixirLevel;
  const maxTotalRank = 25;
  const masteryPct = Math.round((totalRank / maxTotalRank) * 100);

  const liveHeals = 1 + (daimoku.elixirLevel >= 1 ? 1 : 0) + (daimoku.elixirLevel >= 3 ? 1 : 0);

  return (
    <div className="fixed inset-0 z-30 bg-[#050811]/82 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
      <section
        aria-label="Altare Daimoku"
        className="w-full max-w-4xl bg-[#0A0F1A] border border-[#243044] text-[#F1F5F9] shadow-[0_24px_80px_rgba(0,0,0,0.75)] max-h-[92vh] overflow-y-auto grid grid-cols-1 lg:grid-cols-[270px_1fr]"
      >
        {/* LEFT COLUMN: Spirit Sanctuary & Sakiro Current Discipline Stats */}
        <aside className="bg-[#070B14] border-b lg:border-b-0 lg:border-r border-[#1E293B] p-6 flex flex-col justify-between gap-6">
          <div>
            <p className="text-[11px] font-display font-bold tracking-[0.26em] text-[#94A3B8] uppercase">
              Santuario Interiore
            </p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-white mt-1">
              DAIMOKU
            </h2>
            <p className="text-xs text-[#64748B] mt-1">{levelTitle}</p>

            {/* Luminous White Spirit Orbs Counter */}
            <div className="mt-6 py-4 border-y border-[#1E293B] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-block w-5 h-5 shrink-0"
                  style={{
                    borderRadius: '9999px',
                    background:
                      'radial-gradient(circle at 35% 35%, #FFFFFF 0%, #E2E8F0 60%, #94A3B8 100%)',
                    boxShadow: '0 0 16px rgba(255, 255, 255, 0.75)',
                  }}
                />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#94A3B8]">
                    Sfere Bianche
                  </p>
                  <p className="text-[11px] text-[#64748B]">Da nemici e casse</p>
                </div>
              </div>
              <span className="font-mono-nums text-2xl font-extrabold text-white">
                {energyOrbs}
              </span>
            </div>

            {/* Live Sakiro Combat Profile */}
            <div className="mt-5 space-y-2.5 text-xs">
              <p className="text-[11px] font-display font-bold tracking-[0.18em] text-[#64748B] uppercase">
                Profilo di Sakiro
              </p>
              <div className="flex justify-between text-[#CBD5E1]">
                <span>Potenza Lama</span>
                <span className="font-mono-nums font-bold text-white">
                  {100 + daimoku.attackLevel * 12}%
                </span>
              </div>
              <div className="flex justify-between text-[#CBD5E1]">
                <span>Vitalità Massima</span>
                <span className="font-mono-nums font-bold text-white">
                  {100 + daimoku.vitalityLevel * 20} HP
                </span>
              </div>
              <div className="flex justify-between text-[#CBD5E1]">
                <span>Energia &amp; Recupero</span>
                <span className="font-mono-nums font-bold text-white">
                  {100 + daimoku.staminaLevel * 15}
                </span>
              </div>
              <div className="flex justify-between text-[#CBD5E1]">
                <span>Postura Guardia</span>
                <span className="font-mono-nums font-bold text-white">
                  {100 + daimoku.postureLevel * 18}
                </span>
              </div>
              <div className="flex justify-between text-[#CBD5E1]">
                <span>Cure Totali</span>
                <span className="font-mono-nums font-bold text-white">
                  {liveHeals} / Atto
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#1E293B]">
            <div className="flex items-center justify-between text-[11px] text-[#94A3B8] mb-1.5">
              <span>Maestria del Cammino</span>
              <span className="font-mono-nums font-bold text-white">
                {totalRank}/{maxTotalRank}
              </span>
            </div>
            <div className="h-1.5 w-full bg-[#162033] overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${masteryPct}%` }}
              />
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: Clean 5-Discipline Forge Rows + Direct Close */}
        <div className="p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <header className="flex items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Disciplina del Guerriero
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Scegli una via per infondere l&apos;energia delle sfere bianche
                </p>
              </div>
              <button
                type="button"
                data-gp-item
                onClick={onClose}
                className="min-h-[40px] px-4 py-2 bg-transparent border border-[#334155] text-xs font-semibold text-white hover:border-white transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2"
              >
                <X className="w-3.5 h-3.5" />
                <span>{gamepadConnected ? 'Chiudi (Select / B)' : 'Chiudi (U)'}</span>
              </button>
            </header>

            <div className="divide-y divide-[#1E293B] mt-1">
              {DAIMOKU_UPGRADE_SPECS.map((spec) => {
                const currentLevel = daimoku[spec.key];
                const cost = getDaimokuUpgradeCost(spec.id, currentLevel);
                const isMax = cost === null;
                const canAfford = cost !== null && energyOrbs >= cost;
                const missing = cost !== null ? Math.max(0, cost - energyOrbs) : 0;
                const transition = formatStatTransition(spec.id, currentLevel);
                const justUpgraded = recentStat === spec.id;
                const meta = STAT_META[spec.id];

                return (
                  <div
                    key={spec.id}
                    className={`py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      justUpgraded ? 'bg-white/[0.04] -mx-2 px-2' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        {meta.icon}
                        <h4 className="font-display text-base font-bold text-white">
                          {spec.name}
                        </h4>
                        <span className="font-mono-nums text-xs text-[#64748B]">
                          Grado {currentLevel}/{spec.maxLevel}
                        </span>
                        {justUpgraded && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#34D399]">
                            <Check className="w-3.5 h-3.5" />
                            <span>Potenziato</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#94A3B8] mt-1">{spec.effectSummary}</p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-3">
                        <div
                          className="flex items-center gap-1"
                          aria-label={`Grado ${currentLevel} su ${spec.maxLevel}`}
                        >
                          {Array.from({ length: spec.maxLevel }).map((_, idx) => (
                            <span
                              key={idx}
                              className="inline-block w-6 h-1.5 transition-colors"
                              style={{
                                backgroundColor:
                                  idx < currentLevel ? meta.accentHex : '#1E293B',
                              }}
                            />
                          ))}
                        </div>

                        <div className="font-mono-nums text-xs flex items-center gap-1.5 text-[#CBD5E1]">
                          <span>{transition.now}</span>
                          {transition.next && (
                            <>
                              <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
                              <span className="font-semibold text-white">
                                {transition.next}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col sm:items-end gap-1">
                      <button
                        type="button"
                        data-gp-item={!isMax ? true : undefined}
                        disabled={isMax || !canAfford}
                        onClick={() => handleUpgrade(spec.id)}
                        className={`min-h-[42px] min-w-[172px] px-4 py-2 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-2 ${
                          isMax
                            ? 'bg-[#111827] border-[#1E293B] text-[#64748B] cursor-default'
                            : canAfford
                              ? 'bg-[#E12D39] border-[#FB7185] text-white hover:bg-[#BE123C] cursor-pointer'
                              : 'bg-[#111827] border-[#263248] text-[#64748B] cursor-not-allowed'
                        }`}
                      >
                        {isMax ? (
                          <span>Grado Massimo</span>
                        ) : (
                          <>
                            <span>Potenzia</span>
                            <span className="font-mono-nums">· {cost}</span>
                          </>
                        )}
                      </button>
                      {!isMax && (
                        <span
                          className={`font-mono-nums text-[11px] ${
                            canAfford ? 'text-[#34D399]' : 'text-[#64748B]'
                          }`}
                        >
                          {canAfford ? 'Disponibile ora' : `Mancano ${missing} sfere`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <footer className="pt-4 mt-2 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
            <span>Rompi le casse lungo i livelli o sconfiggi i nemici per ottenere sfere.</span>
            <span className="font-mono-nums text-[#94A3B8]">
              {gamepadConnected ? 'A Potenzia · B Chiudi' : 'Clicca Potenzia · U Chiudi'}
            </span>
          </footer>
        </div>
      </section>
    </div>
  );
};
