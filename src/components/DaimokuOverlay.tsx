import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Flame, Heart, Shield, Sparkles, Swords, Wind, X } from 'lucide-react';
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

const STAT_ICONS: Record<DaimokuStatId, React.ReactNode> = {
  attack: <Swords className="w-5 h-5 text-[#FB7185]" />,
  vitality: <Heart className="w-5 h-5 text-[#34D399]" />,
  stamina: <Wind className="w-5 h-5 text-[#38BDF8]" />,
  posture: <Shield className="w-5 h-5 text-[#FBBF24]" />,
  elixir: <Sparkles className="w-5 h-5 text-[#C084FC]" />,
};

function formatStatTransition(id: DaimokuStatId, level: number): { now: string; next: string | null } {
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
        next: isMax ? null : `${healsNext} ${healsNext === 1 ? 'Cura' : 'Cure'} · +${(level + 1) * 8}% rec.`,
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

  return (
    <div className="fixed inset-0 z-30 bg-[#050811]/78 flex items-center justify-center p-4 sm:p-6">
      <section
        aria-label="Menu potenziamenti Daimoku"
        className="w-full max-w-2xl bg-[#0B101B] border border-[#263248] text-[#F1F5F9] shadow-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6"
      >
        {/* Simple Header with Available Spheres */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Daimoku</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Potenzia Sakiro con le sfere dei nemici · {levelTitle}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-3.5 py-2 bg-[#11192B] border border-[#263248] text-right">
              <p className="text-[11px] text-[#94A3B8]">Sfere disponibili</p>
              <p className="font-mono-nums text-lg font-bold text-[#38BDF8] flex items-center justify-end gap-1.5">
                <Flame className="w-4 h-4 text-[#FBBF24]" />
                <span>{energyOrbs}</span>
              </p>
            </div>

            <button
              type="button"
              data-gp-item
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 bg-[#162033] border border-[#334155] text-xs font-semibold text-white hover:border-[#38BDF8] hover:text-[#38BDF8] transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2"
            >
              <X className="w-3.5 h-3.5" />
              <span>{gamepadConnected ? 'Chiudi (Select / B)' : 'Chiudi (U)'}</span>
            </button>
          </div>
        </header>

        {/* Clean 5-Row Upgrade List with Direct Before -> After Preview */}
        <div className="divide-y divide-[#1E293B] mt-1">
          {DAIMOKU_UPGRADE_SPECS.map((spec) => {
            const currentLevel = daimoku[spec.key];
            const cost = getDaimokuUpgradeCost(spec.id, currentLevel);
            const isMax = cost === null;
            const canAfford = cost !== null && energyOrbs >= cost;
            const missing = cost !== null ? Math.max(0, cost - energyOrbs) : 0;
            const transition = formatStatTransition(spec.id, currentLevel);
            const justUpgraded = recentStat === spec.id;

            return (
              <div
                key={spec.id}
                className={`py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  justUpgraded ? 'bg-[#0F1E33]/55 -mx-2 px-2' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {STAT_ICONS[spec.id]}
                    <h3 className="font-display text-lg font-bold text-white">{spec.name}</h3>
                    <span className="font-mono-nums text-xs text-[#94A3B8]">
                      Lv. {currentLevel}/{spec.maxLevel}
                    </span>
                    {justUpgraded && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#34D399]">
                        <Check className="w-3.5 h-3.5" />
                        <span>Potenziato!</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#94A3B8] mt-1">{spec.effectSummary}</p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1" aria-label={`Livello ${currentLevel} su ${spec.maxLevel}`}>
                      {Array.from({ length: spec.maxLevel }).map((_, idx) => (
                        <span
                          key={idx}
                          className={`inline-block w-6 h-1.5 ${
                            idx < currentLevel ? 'bg-[#38BDF8]' : 'bg-[#1E293B]'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="font-mono-nums text-xs flex items-center gap-1.5 text-[#CBD5E1]">
                      <span>{transition.now}</span>
                      {transition.next && (
                        <>
                          <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
                          <span className="font-semibold text-[#34D399]">{transition.next}</span>
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
                    className={`min-h-[42px] min-w-[162px] px-4 py-2 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
                      isMax
                        ? 'bg-[#111827] border-[#1E293B] text-[#64748B] cursor-default'
                        : canAfford
                          ? 'bg-[#E12D39] border-[#FB7185] text-white hover:bg-[#BE123C] cursor-pointer'
                          : 'bg-[#111827] border-[#263248] text-[#64748B] cursor-not-allowed'
                    }`}
                  >
                    {isMax ? 'Al Massimo' : `Potenzia · ${cost} Sfere`}
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

        <footer className="pt-4 mt-2 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
          <span>Ogni sfera raccolta resta salvata nei progressi.</span>
          <span className="font-mono-nums text-[#CBD5E1]">
            {gamepadConnected ? 'A Potenzia · B Chiudi' : 'Clicca Potenzia · U per chiudere'}
          </span>
        </footer>
      </section>
    </div>
  );
};
