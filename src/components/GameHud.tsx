import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Pause } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  onPause: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({ hud, onPause }) => {
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        setControlsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const posturePct = Math.max(0, Math.min(100, (hud.posture / hud.maxPosture) * 100));
  const staminaPct = Math.max(0, Math.min(100, (hud.stamina / hud.maxStamina) * 100));

  const enemy = hud.activeEnemy;
  const enemyHpPct = enemy ? Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100)) : 0;
  const enemyPosturePct = enemy
    ? Math.max(0, Math.min(100, (enemy.posture / enemy.maxPosture) * 100))
    : 0;

  const chronoReady = hud.timeSlowUnlocked && !hud.timeSlowActive && hud.timeSlowCooldown <= 0;
  const chronoBarPct = hud.timeSlowActive
    ? (hud.timeSlowRemaining / 3.0) * 100
    : hud.timeSlowCooldown > 0
      ? ((30 - hud.timeSlowCooldown) / 30) * 100
      : 100;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-5 lg:p-7">
      {/* Subtle Chrono Stasis screen edge tint while Time Slow is active */}
      {hud.timeSlowActive && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 95px rgba(56, 189, 248, 0.42)',
            border: '2px solid rgba(56, 189, 248, 0.38)',
          }}
        />
      )}

      {/* TOP BAR: Minimal level context left, Engaged Enemy / Boss bar center, Pause button right */}
      <div className="relative flex items-start justify-between gap-4">
        <div className="text-xs text-[#1E293B]">
          <p className="font-display font-semibold tracking-wider text-[#12161F]">
            {hud.levelTitle}
          </p>
          <p className="text-[#475569] mt-0.5">
            {hud.checkpointName}
            {hud.enemiesRemaining > 0 ? ` · ${hud.enemiesRemaining} avversari` : ''}
          </p>
        </div>

        {/* Enemy / Boss Minimal Tension Bar */}
        {enemy && (
          <div className="w-full max-w-md mx-auto bg-[#F8FAFC]/88 border border-[#D4DCE6] px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="font-display text-sm font-bold text-[#12161F] truncate">
                  {enemy.name}
                </span>
                <span className="text-[11px] text-[#64748B] truncate">{enemy.title}</span>
              </div>
              {enemy.totalPhases > 1 && (
                <span className="font-mono-nums text-[10px] font-bold tracking-wider text-[#B91C1C] whitespace-nowrap shrink-0">
                  BARRA {enemy.phase}/{enemy.totalPhases}
                </span>
              )}
              {enemy.telegraph === 'unblockable' && (
                <span className="text-[11px] font-bold tracking-wider text-[#E12D39] whitespace-nowrap shrink-0">
                  IMPARABILE · SCHIVA
                </span>
              )}
              {enemy.telegraph === 'magic' && (
                <span className="text-[11px] font-bold tracking-wider text-[#7C3AED] whitespace-nowrap shrink-0">
                  MAGIA · SCHIVA O DEVIATA
                </span>
              )}
              {enemy.telegraph === 'bow' && (
                <span className="text-[11px] font-bold tracking-wider text-[#D97706] whitespace-nowrap shrink-0">
                  ARCO · PARA O SALTA
                </span>
              )}
              {enemy.telegraph === 'bomb' && (
                <span className="text-[11px] font-bold tracking-wider text-[#EA580C] whitespace-nowrap shrink-0">
                  BOMBE · ALLONTANATI
                </span>
              )}
              {enemy.staggered && (
                <span className="text-[11px] font-bold tracking-wider text-[#0284C7] whitespace-nowrap shrink-0">
                  POSTURA SPEZZATA
                </span>
              )}
            </div>

            {/* Multi-phase HP bar rendering (supports 2-bar and 3-bar bosses) */}
            {enemy.totalPhases > 1 ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 flex-1 bg-[#DCE3EC] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-100 ${
                        enemy.phase === 1 && enemy.totalPhases >= 3
                          ? 'bg-[#D97706]'
                          : enemy.phase === 1 || (enemy.totalPhases >= 3 && enemy.phase === 2)
                            ? 'bg-[#EA580C]'
                            : 'bg-[#E12D39]'
                      }`}
                      style={{ width: `${enemyHpPct}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {Array.from({ length: enemy.totalPhases }).map((_, idx) => {
                      const barNum = idx + 1;
                      const isRemaining = barNum >= enemy.phase;
                      const isLast = barNum === enemy.totalPhases;
                      return (
                        <span
                          key={barNum}
                          className={`w-2 h-2 border border-[#12161F]/40 ${
                            !isRemaining
                              ? 'bg-[#E2E8F0]'
                              : isLast
                                ? 'bg-[#E12D39]'
                                : 'bg-[#D97706]'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
                {enemy.phase < enemy.totalPhases && (
                  <div
                    className="h-1 w-full bg-[#E12D39]/75"
                    title="Barre di vita rimanenti"
                  />
                )}
              </div>
            ) : (
              <div className="h-1.5 w-full bg-[#DCE3EC] overflow-hidden">
                <div
                  className="h-full bg-[#E12D39] transition-all duration-100"
                  style={{ width: `${enemyHpPct}%` }}
                />
              </div>
            )}

            {/* Posture gauge */}
            <div className="h-1 w-full bg-[#E2E8F0] mt-1 overflow-hidden">
              <div
                className="h-full bg-[#0284C7] transition-all duration-75"
                style={{ width: `${enemyPosturePct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pointer-events-auto">
          <span className="font-mono-nums text-[11px] text-[#475569] hidden sm:inline">
            {hud.fpsEstimate} FPS
          </span>
          <button
            type="button"
            onClick={onPause}
            aria-label="Menu Pausa"
            className="p-2 bg-[#F8FAFC]/90 border border-[#CBD5E1] text-[#12161F] hover:border-[#12161F] transition-colors cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CENTER-TOP FEEDBACK (Never covers center duel) */}
      <div className="relative flex flex-col items-center justify-start gap-2 -mt-6">
        {hud.feedback && (
          <div
            key={hud.feedback.id}
            className={`px-4 py-1.5 text-xs font-display font-bold tracking-[0.16em] border ${
              hud.feedback.kind === 'chrono'
                ? 'bg-[#0F172A]/95 text-[#38BDF8] border-[#38BDF8]'
                : hud.feedback.kind === 'parry'
                  ? 'bg-[#F8FAFC]/94 text-[#0284C7] border-[#0284C7]'
                  : hud.feedback.kind === 'break'
                    ? 'bg-[#F8FAFC]/94 text-[#D97706] border-[#D97706]'
                    : hud.feedback.kind === 'checkpoint'
                      ? 'bg-[#F8FAFC]/94 text-[#059669] border-[#059669]'
                      : 'bg-[#F8FAFC]/94 text-[#E12D39] border-[#E12D39]'
            }`}
          >
            {hud.feedback.label}
          </div>
        )}
      </div>

      {/* BOTTOM ROW: Player Vitals Left, Story Subtitles Bottom-Center, Controls Right */}
      <div className="relative flex items-end justify-between gap-4 lg:gap-6">
        {/* Player Vital Bars, Cronostasi & Minimal Combo Tracker (Bottom-Left) */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {hud.timeSlowUnlocked && (
            <div
              className={`px-3.5 py-2 border ${
                hud.timeSlowActive
                  ? 'bg-[#0F172A]/92 border-[#38BDF8] text-[#E0F2FE]'
                  : chronoReady
                    ? 'bg-[#F8FAFC]/92 border-[#0284C7] text-[#12161F]'
                    : 'bg-[#F8FAFC]/88 border-[#D4DCE6] text-[#475569]'
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="font-display font-bold tracking-wider">CRONOSTASI</span>
                <span className="font-mono-nums font-semibold">
                  {hud.timeSlowActive
                    ? `ATTIVA ${hud.timeSlowRemaining.toFixed(1)}s`
                    : chronoReady
                      ? hud.gamepadConnected
                        ? 'PRONTA · ↑ D-Pad'
                        : 'PRONTA · T'
                      : `RICARICA ${hud.timeSlowCooldown}s`}
                </span>
              </div>
              <div className="h-1 w-full bg-[#CBD5E1]/50 mt-1 overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    hud.timeSlowActive
                      ? 'bg-[#38BDF8]'
                      : chronoReady
                        ? 'bg-[#0284C7]'
                        : 'bg-[#94A3B8]'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, chronoBarPct))}%` }}
                />
              </div>
            </div>
          )}

          {(hud.comboStep > 0 || hud.counterReady || hud.comboHint || hud.combosUnlocked) && (
            <div className="bg-[#F8FAFC]/90 border border-[#D4DCE6] px-3 py-1.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                {(hud.combosUnlocked ? [1, 2, 3, 4] : [1, 2, 3]).map((step) => {
                  const active = hud.comboStep >= step;
                  const readyCross = hud.combosUnlocked && hud.comboStep === 4;
                  return (
                    <span
                      key={step}
                      className={`h-1.5 w-4 transition-colors ${
                        active
                          ? readyCross
                            ? 'bg-[#E12D39]'
                            : 'bg-[#0284C7]'
                          : 'bg-[#DCE3EC]'
                      }`}
                    />
                  );
                })}
              </div>
              <span
                className={`font-display text-[11px] font-bold tracking-wider uppercase ${
                  hud.counterReady
                    ? 'text-[#0284C7]'
                    : hud.combosUnlocked && hud.comboStep === 4
                      ? 'text-[#E12D39]'
                      : 'text-[#12161F]'
                }`}
              >
                {hud.comboHint ??
                  (hud.combosUnlocked
                    ? `ARTI ${hud.discoveredCount}/${hud.totalSecretCombos}`
                    : hud.comboStep > 0
                      ? `SERIE ${hud.comboStep}/3`
                      : '')}
              </span>
            </div>
          )}

          <div className="w-60 sm:w-64 bg-[#F8FAFC]/88 border border-[#D4DCE6] px-3.5 py-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-display font-semibold text-[#12161F]">VITALITÀ</span>
              <span className="font-mono-nums text-[#475569]">
                {hud.hp}/{hud.maxHp}
              </span>
            </div>
            <div className="h-2 w-full bg-[#DCE3EC] overflow-hidden">
              <div
                className="h-full bg-[#12161F] transition-all duration-100"
                style={{ width: `${hpPct}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <div className="flex justify-between text-[10px] text-[#64748B] mb-0.5">
                  <span>POSTURA</span>
                  <span className="font-mono-nums">{hud.posture}%</span>
                </div>
                <div className="h-1 w-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full bg-[#D97706] transition-all duration-75"
                    style={{ width: `${posturePct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-[#64748B] mb-0.5">
                  <span>ENERGIA</span>
                  <span className="font-mono-nums">{hud.stamina}%</span>
                </div>
                <div className="h-1 w-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full bg-[#0284C7] transition-all duration-75"
                    style={{ width: `${staminaPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Story Subtitles (Bottom-Center) */}
        <div className="flex-1 flex items-end justify-center px-2">
          {hud.storySubtitle && (
            <p className="max-w-xl text-center text-xs sm:text-sm font-medium text-[#12161F] bg-[#F8FAFC]/90 border border-[#DCE3EC] px-4 py-2">
              {hud.storySubtitle}
            </p>
          )}
        </div>

        {/* Controls Panel (Bottom-Right) */}
        <div className="hidden md:flex flex-col items-end gap-1.5 shrink-0">
          {(hud.isBlocking || hud.gamepadConnected) && (
            <div className="text-right text-[11px]">
              {hud.isBlocking ? (
                <span className="font-display font-semibold text-[#0284C7]">GUARDIA ATTIVA</span>
              ) : (
                <span className="text-[#475569]">Gamepad attivo</span>
              )}
            </div>
          )}

          <div className="flex flex-col items-end pointer-events-auto">
            <button
              type="button"
              onClick={() => setControlsCollapsed((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#F8FAFC]/90 border border-[#D4DCE6] text-[11px] text-[#475569] hover:text-[#12161F] cursor-pointer"
            >
              {controlsCollapsed ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>Comandi (H)</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>Nascondi Comandi (H)</span>
                </>
              )}
            </button>

            {!controlsCollapsed && (
              <div className="bg-[#F8FAFC]/90 border border-t-0 border-[#D4DCE6] px-3.5 py-2.5 text-[11px] text-[#334155] grid grid-cols-2 gap-x-4 gap-y-1">
                {hud.gamepadConnected ? (
                  <>
                    <span>Stick SX · Muovi</span>
                    <span>X · Colpo</span>
                    <span>Y · Pesante</span>
                    <span className="font-semibold text-[#0284C7]">LB · Parata</span>
                    <span>A · Salta</span>
                    <span>B · Schiva</span>
                    <span>RB · Aggancia</span>
                    {hud.timeSlowUnlocked && (
                      <span className="font-semibold text-[#0284C7]">↑ / L3 · Tempo</span>
                    )}
                  </>
                ) : (
                  <>
                    <span>WASD · Muovi</span>
                    <span>Click SX · Colpo</span>
                    <span>Q · Pesante</span>
                    <span className="font-semibold text-[#0284C7]">Click DX / F · Parata</span>
                    <span>Spazio · Salta</span>
                    <span>Shift · Schiva</span>
                    <span>Tab · Aggancia</span>
                    {hud.timeSlowUnlocked && (
                      <span className="font-semibold text-[#0284C7]">T · Tempo</span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
