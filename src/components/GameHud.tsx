import React, { useEffect, useState } from 'react';
import { EyeOff, Flame, Pause } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  showControlsGuide: boolean;
  onToggleControlsGuide: () => void;
  onOpenDaimoku: () => void;
  onPause: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  showControlsGuide,
  onToggleControlsGuide,
  onOpenDaimoku,
  onPause,
}) => {
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const [trailHpPct, setTrailHpPct] = useState(hpPct);

  useEffect(() => {
    if (hpPct >= trailHpPct) {
      setTrailHpPct(hpPct);
      return;
    }
    const timer = window.setTimeout(() => {
      setTrailHpPct(hpPct);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [hpPct, trailHpPct]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        onToggleControlsGuide();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onToggleControlsGuide]);

  const posturePct = Math.max(0, Math.min(100, (hud.posture / hud.maxPosture) * 100));
  const staminaPct = Math.max(0, Math.min(100, (hud.stamina / hud.maxStamina) * 100));
  const isCriticalHp = hud.hp > 0 && hpPct <= 28;
  const dmgFlash = Math.max(0, Math.min(1, hud.damageFlash ?? 0));
  const isHitFlash = dmgFlash > 0.14;

  const enemy = hud.activeEnemy;
  const enemyHpPct = enemy ? Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100)) : 0;
  const enemyPosturePct = enemy
    ? Math.max(0, Math.min(100, (enemy.posture / enemy.maxPosture) * 100))
    : 0;

  const rechargeScale = 1 + hud.daimoku.elixirLevel * 0.08;
  const chronoMaxCd = 30 / rechargeScale;
  const bowMaxInterval = 2.0 / rechargeScale;
  const chronoReady = hud.timeSlowUnlocked && !hud.timeSlowActive && hud.timeSlowCooldown <= 0;
  const chronoBarPct = hud.timeSlowActive
    ? (hud.timeSlowRemaining / 3.5) * 100
    : hud.timeSlowCooldown > 0
      ? ((chronoMaxCd - Math.min(chronoMaxCd, hud.timeSlowCooldown)) / chronoMaxCd) * 100
      : 100;

  const bowHasCharge = hud.bowUnlocked && hud.bowCharges > 0;
  const bowFull = hud.bowUnlocked && hud.bowCharges >= hud.bowMaxCharges;
  const bowSegmentPct = bowFull
    ? 100
    : ((bowMaxInterval - Math.min(bowMaxInterval, hud.bowCooldown)) / bowMaxInterval) * 100;

  const isCenteredCallout =
    hud.feedback?.kind === 'special' || hud.feedback?.kind === 'checkpoint';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-5 lg:p-7">
      {/* Unmistakable Crimson Damage Vignette + Directional Edge Indicator */}
      {dmgFlash > 0 && (
        <div
          className="fixed inset-0 pointer-events-none z-10"
          style={{
            opacity: dmgFlash,
            background:
              'radial-gradient(ellipse at center, rgba(225, 45, 57, 0) 48%, rgba(185, 28, 28, 0.34) 84%, rgba(225, 45, 57, 0.58) 100%)',
            boxShadow: `inset 0 0 130px rgba(225, 45, 57, ${0.72 * dmgFlash})`,
            border: `2px solid rgba(251, 113, 133, ${0.55 * dmgFlash})`,
          }}
        >
          {(hud.damageSide === 'left' || hud.damageSide === 'all') && (
            <div
              className="absolute inset-y-0 left-0 w-24 sm:w-36"
              style={{
                background:
                  'linear-gradient(90deg, rgba(225, 45, 57, 0.72) 0%, rgba(225, 45, 57, 0) 100%)',
              }}
            />
          )}
          {(hud.damageSide === 'right' || hud.damageSide === 'all') && (
            <div
              className="absolute inset-y-0 right-0 w-24 sm:w-36"
              style={{
                background:
                  'linear-gradient(270deg, rgba(225, 45, 57, 0.72) 0%, rgba(225, 45, 57, 0) 100%)',
              }}
            />
          )}
          {(hud.damageSide === 'front' || hud.damageSide === 'all') && (
            <div
              className="absolute inset-x-0 top-0 h-20 sm:h-28"
              style={{
                background:
                  'linear-gradient(180deg, rgba(225, 45, 57, 0.7) 0%, rgba(225, 45, 57, 0) 100%)',
              }}
            />
          )}
          {(hud.damageSide === 'back' || hud.damageSide === 'all') && (
            <div
              className="absolute inset-x-0 bottom-0 h-24 sm:h-32"
              style={{
                background:
                  'linear-gradient(0deg, rgba(225, 45, 57, 0.76) 0%, rgba(225, 45, 57, 0) 100%)',
              }}
            />
          )}
        </div>
      )}

      {/* Critical Low-HP Persistent Edge Warning */}
      {isCriticalHp && (
        <div
          className="fixed inset-0 pointer-events-none z-[9]"
          style={{
            boxShadow: 'inset 0 0 92px rgba(153, 27, 27, 0.44)',
            border: '1px solid rgba(225, 45, 57, 0.34)',
          }}
        />
      )}

      {/* Subtle Chrono Stasis / Perfect Parry Slow-Mo screen edge tint */}
      {(hud.timeSlowActive || hud.parrySlowActive) && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: hud.timeSlowActive
              ? 'inset 0 0 95px rgba(56, 189, 248, 0.42)'
              : 'inset 0 0 72px rgba(56, 189, 248, 0.30)',
            border: hud.timeSlowActive
              ? '2px solid rgba(56, 189, 248, 0.38)'
              : '1px solid rgba(56, 189, 248, 0.28)',
          }}
        />
      )}

      {/* Floating 3D-projected Combat Pop-Ups (transparent, non-blocking damage & hit indicators) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-20">
        {hud.popups.map((p) => {
          const opacity =
            p.progress < 0.58 ? 1 : Math.max(0, 1 - (p.progress - 0.58) / 0.42);
          const scale = p.progress < 0.14 ? 1.18 - p.progress * 1.2 : 1;
          const driftY = p.progress * 28;
          const colorClass =
            p.kind === 'damage'
              ? 'text-[#FF4757] text-sm sm:text-base'
              : p.kind === 'crit'
                ? 'text-[#FB923C] text-base sm:text-lg'
                : p.kind === 'parry'
                  ? 'text-[#38BDF8] text-xs sm:text-sm'
                  : p.kind === 'break'
                    ? 'text-[#FBBF24] text-sm sm:text-base'
                    : p.kind === 'guard'
                      ? 'text-[#CBD5E1] text-xs'
                      : 'text-[#FEF08A] text-sm sm:text-base';
          return (
            <div
              key={p.id}
              className={`absolute font-display font-extrabold tracking-wider whitespace-nowrap select-none transition-[left,top,opacity] duration-75 ease-linear ${colorClass}`}
              style={{
                left: `${p.xPct}%`,
                top: `${p.yPct}%`,
                opacity,
                transform: `translate(-50%, calc(-50% - ${driftY}px)) scale(${scale})`,
                textShadow:
                  '0 2px 6px rgba(0, 0, 0, 0.92), 0 0 2px rgba(0, 0, 0, 0.95)',
              }}
            >
              {p.text}
            </div>
          );
        })}
      </div>

      {/* Special Move & Checkpoint Callouts: Strictly Centered, Completely Invisible Background, Slight Transparency */}
      {isCenteredCallout && hud.feedback && (
        <div
          key={hud.feedback.id}
          className="fixed inset-x-0 top-[24%] z-20 flex justify-center pointer-events-none px-4"
        >
          <p
            className="bg-transparent border-0 font-display text-lg sm:text-2xl font-extrabold tracking-[0.22em] text-white opacity-75 uppercase text-center select-none"
            style={{
              textShadow:
                hud.feedback.kind === 'checkpoint'
                  ? '0 2px 14px rgba(0, 0, 0, 0.88), 0 0 18px rgba(16, 185, 129, 0.6)'
                  : '0 2px 14px rgba(0, 0, 0, 0.88), 0 0 18px rgba(245, 158, 11, 0.55)',
            }}
          >
            {hud.feedback.label}
          </p>
        </div>
      )}

      {/* TOP BAR: Grid locks Checkpoint & Enemy/Boss bar strictly in the horizontal center */}
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-4 w-full">
        <div className="justify-self-start flex flex-col items-start gap-2 min-w-0">
          <div className="text-xs text-[#1E293B]">
            <p className="font-display font-semibold tracking-wider text-[#12161F] truncate">
              {hud.levelTitle}
            </p>
            {hud.enemiesRemaining > 0 && (
              <p className="text-[#475569] mt-0.5 truncate">
                {hud.enemiesRemaining} avversari
              </p>
            )}
          </div>

          {hud.feedback && !isCenteredCallout && (
            <div
              key={hud.feedback.id}
              className={`px-3 py-1 text-[11px] font-display font-bold tracking-[0.14em] border ${
                hud.feedback.kind === 'chrono'
                  ? 'bg-[#0F172A]/90 text-[#38BDF8] border-[#38BDF8]'
                  : hud.feedback.kind === 'parry'
                    ? 'bg-[#F8FAFC]/88 text-[#0284C7] border-[#0284C7]'
                    : hud.feedback.kind === 'break'
                      ? 'bg-[#F8FAFC]/88 text-[#D97706] border-[#D97706]'
                      : hud.feedback.kind === 'heal'
                        ? 'bg-[#064E3B]/90 text-[#6EE7B7] border-[#10B981]'
                        : 'bg-[#F8FAFC]/88 text-[#E12D39] border-[#E12D39]'
              }`}
            >
              {hud.feedback.label}
            </div>
          )}
        </div>

        {/* Top-Center: Arti-Style Transparent Checkpoint Label + Centered Enemy / Boss Health Bar */}
        <div className="justify-self-center flex flex-col items-center gap-2 w-[250px] sm:w-[410px] lg:w-[470px]">
          <p
            className="bg-transparent border-0 font-display text-[11px] sm:text-xs font-extrabold tracking-[0.22em] text-white opacity-75 uppercase text-center select-none whitespace-nowrap"
            style={{
              textShadow:
                '0 2px 10px rgba(0, 0, 0, 0.9), 0 0 14px rgba(16, 185, 129, 0.45)',
            }}
          >
            {hud.checkpointName}
          </p>

          {enemy && (
            <div
              className={`w-full px-3.5 sm:px-4 py-2.5 shadow-md ${
                enemy.totalPhases > 1
                  ? 'bg-[#0B101B]/90 border border-[#334155]/90 backdrop-blur-md text-white'
                  : 'bg-[#F8FAFC]/88 border border-[#D4DCE6]'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span
                    className={`font-display text-xs sm:text-sm font-bold truncate ${
                      enemy.totalPhases > 1 ? 'text-white' : 'text-[#12161F]'
                    }`}
                  >
                    {enemy.name}
                  </span>
                  <span
                    className={`text-[11px] truncate hidden sm:inline ${
                      enemy.totalPhases > 1 ? 'text-slate-400' : 'text-[#64748B]'
                    }`}
                  >
                    {enemy.title}
                  </span>
                </div>
                {enemy.telegraph === 'unblockable' && (
                  <span className="text-[11px] font-bold tracking-wider text-[#FB7185] whitespace-nowrap shrink-0">
                    IMPARABILE · SCHIVA
                  </span>
                )}
                {enemy.telegraph === 'magic' && (
                  <span className="text-[11px] font-bold tracking-wider text-[#A78BFA] whitespace-nowrap shrink-0">
                    MAGIA · DEVIATA
                  </span>
                )}
                {enemy.telegraph === 'bow' && (
                  <span className="text-[11px] font-bold tracking-wider text-[#FBBF24] whitespace-nowrap shrink-0">
                    ARCO · PARA
                  </span>
                )}
                {enemy.telegraph === 'bomb' && (
                  <span className="text-[11px] font-bold tracking-wider text-[#FB923C] whitespace-nowrap shrink-0">
                    BOMBE · SCAPPA
                  </span>
                )}
                {enemy.staggered && (
                  <span className="text-[11px] font-bold tracking-wider text-[#38BDF8] whitespace-nowrap shrink-0">
                    POSTURA SPEZZATA
                  </span>
                )}
              </div>

              {/* Multi-phase Layered Boss Vitality Design (supports 2-bar & 3-bar Bosses) */}
              {enemy.totalPhases > 1 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono-nums tracking-wider">
                    <div className="flex items-center gap-2">
                      {Array.from({ length: enemy.totalPhases }).map((_, idx) => {
                        const barNum = idx + 1;
                        const remaining = barNum >= enemy.phase;
                        const isActive = barNum === enemy.phase;
                        const sealColor = !remaining
                          ? 'bg-slate-800 border-slate-600'
                          : isActive
                            ? enemy.phase === enemy.totalPhases
                              ? 'bg-[#E12D39] border-[#FDA4AF]'
                              : 'bg-[#F59E0B] border-[#FDE68A]'
                            : 'bg-[#B91C1C] border-[#F87171]/80';
                        return (
                          <span
                            key={barNum}
                            className={`inline-block w-2.5 h-2.5 rotate-45 border transition-colors ${sealColor}`}
                          />
                        );
                      })}
                      <span className="text-slate-300 font-semibold ml-0.5">
                        FASE {enemy.phase}/{enemy.totalPhases}
                      </span>
                    </div>
                    <span className="text-slate-400">
                      {enemy.phase < enemy.totalPhases
                        ? `${enemy.totalPhases - enemy.phase} ${
                            enemy.totalPhases - enemy.phase === 1 ? 'barra di riserva' : 'barre di riserva'
                          }`
                        : 'Fase Finale'}
                    </span>
                  </div>

                  {/* Layered Blade-Edge HP Gauge: active phase drains cleanly over the underlying reserve bar */}
                  <div className="relative h-3 w-full bg-[#1E293B] border border-[#475569]/70 overflow-hidden">
                    {/* Underlying reserve bar color (visible as active layer drains down!) */}
                    {enemy.phase < enemy.totalPhases && (
                      <div
                        className={`absolute inset-0 ${
                          enemy.phase + 1 === enemy.totalPhases
                            ? 'bg-gradient-to-r from-[#7F1D1D] via-[#B91C1C] to-[#DC2626]'
                            : 'bg-gradient-to-r from-[#9A3412] via-[#C2410C] to-[#EA580C]'
                        } opacity-70`}
                      />
                    )}

                    {/* Active phase HP fill */}
                    <div
                      className={`relative h-full transition-all duration-100 ${
                        enemy.phase === 1 && enemy.totalPhases >= 3
                          ? 'bg-gradient-to-r from-[#B45309] via-[#F59E0B] to-[#FCD34D]'
                          : enemy.phase < enemy.totalPhases
                            ? 'bg-gradient-to-r from-[#C2410C] via-[#F97316] to-[#FBBF24]'
                            : 'bg-gradient-to-r from-[#991B1B] via-[#E12D39] to-[#FB7185]'
                      }`}
                      style={{ width: `${enemyHpPct}%` }}
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white/85" />
                    </div>

                    {/* Subtle tactical quarter-notches */}
                    <div className="absolute inset-0 grid grid-cols-4 pointer-events-none">
                      <div className="border-r border-black/30" />
                      <div className="border-r border-black/30" />
                      <div className="border-r border-black/30" />
                      <div />
                    </div>
                  </div>

                  {/* Posture gauge */}
                  <div className="h-1 w-full bg-[#1E293B] overflow-hidden">
                    <div
                      className="h-full bg-[#38BDF8] transition-all duration-75"
                      style={{ width: `${enemyPosturePct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="h-1.5 w-full bg-[#DCE3EC] overflow-hidden">
                    <div
                      className="h-full bg-[#E12D39] transition-all duration-100"
                      style={{ width: `${enemyHpPct}%` }}
                    />
                  </div>

                  {/* Posture gauge */}
                  <div className="h-1 w-full bg-[#E2E8F0] mt-1 overflow-hidden">
                    <div
                      className="h-full bg-[#0284C7] transition-all duration-75"
                      style={{ width: `${enemyPosturePct}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="justify-self-end flex items-center gap-2 sm:gap-3 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenDaimoku}
            aria-label="Apri menu potenziamento Daimoku"
            className="px-3 py-1.5 bg-[#0B101B]/90 border border-[#334155] text-white hover:border-[#38BDF8] transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Flame className="w-3.5 h-3.5 text-[#FBBF24]" />
            <span className="font-mono-nums text-xs font-bold text-[#38BDF8]">
              {hud.energyOrbs}
            </span>
            <span className="text-[10px] font-display font-bold tracking-wider text-slate-200 uppercase">
              Daimoku ({hud.gamepadConnected ? 'Select' : 'U'})
            </span>
          </button>
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

      {/* BOTTOM ROW: Sculpted Katana HUD Left, Story Subtitles Bottom-Center, Controls Right */}
      <div className="relative flex items-end justify-between gap-4 lg:gap-6">
        {/* KATANA HUD (Bottom-Left): Vita nella lama, Postura & Energia nel fodero, Arco/Cronostasi/Arti sull'elsa */}
        <div className="flex flex-col gap-1.5 shrink-0 w-[300px] sm:w-[368px] select-none">
          {/* Compact Tactical Modules docked seamlessly above the Katana spine */}
          <div className="flex flex-wrap items-center gap-1.5 pl-1">
            {hud.bowUnlocked && (
              <div
                className={`px-2.5 py-1 bg-[#0F172A]/85 border-l-2 text-white flex items-center gap-2 ${
                  bowHasCharge ? 'border-[#F59E0B]' : 'border-[#64748B]'
                }`}
              >
                <span className="font-display text-[10px] font-bold tracking-wider text-[#FBBF24]">
                  ARCO {hud.bowCharges}/{hud.bowMaxCharges}
                </span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: hud.bowMaxCharges }).map((_, idx) => {
                    const filled = idx < hud.bowCharges;
                    const recharging = idx === hud.bowCharges;
                    const widthPct = filled ? 100 : recharging ? bowSegmentPct : 0;
                    return (
                      <div key={idx} className="w-2.5 h-1.5 bg-white/20 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-100 ${
                            filled ? 'bg-[#F59E0B]' : 'bg-[#94A3B8]'
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, widthPct))}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <span className="font-mono-nums text-[9px] text-slate-300">
                  {bowFull
                    ? hud.gamepadConnected
                      ? '→'
                      : 'G'
                    : `${hud.bowCooldown}s`}
                </span>
              </div>
            )}

            {hud.timeSlowUnlocked && (
              <div
                className={`px-2.5 py-1 bg-[#0F172A]/85 border-l-2 text-white flex items-center gap-2 ${
                  hud.timeSlowActive
                    ? 'border-[#38BDF8]'
                    : chronoReady
                      ? 'border-[#0284C7]'
                      : 'border-[#64748B]'
                }`}
              >
                <span className="font-display text-[10px] font-bold tracking-wider text-[#38BDF8]">
                  STASI
                </span>
                <div className="w-10 h-1 bg-white/20 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      hud.timeSlowActive
                        ? 'bg-[#38BDF8]'
                        : chronoReady
                          ? 'bg-[#0EA5E9]'
                          : 'bg-[#94A3B8]'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, chronoBarPct))}%` }}
                  />
                </div>
                <span className="font-mono-nums text-[9px] text-slate-200">
                  {hud.timeSlowActive
                    ? `${hud.timeSlowRemaining.toFixed(1)}s`
                    : chronoReady
                      ? hud.gamepadConnected
                        ? '↑'
                        : 'T'
                      : `${hud.timeSlowCooldown}s`}
                </span>
              </div>
            )}

            {(hud.comboStep > 0 || hud.counterReady || hud.comboHint || hud.combosUnlocked) && (
              <div className="px-2.5 py-1 bg-[#0F172A]/85 border-l-2 border-[#E12D39] text-white flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {(hud.combosUnlocked ? [1, 2, 3, 4] : [1, 2, 3]).map((step) => {
                    const active = hud.comboStep >= step;
                    const readyCross = hud.combosUnlocked && hud.comboStep === 4;
                    return (
                      <span
                        key={step}
                        className={`h-1.5 w-2.5 transition-colors ${
                          active
                            ? readyCross
                              ? 'bg-[#E12D39]'
                              : 'bg-[#38BDF8]'
                            : 'bg-white/20'
                        }`}
                      />
                    );
                  })}
                </div>
                <span
                  className={`font-display text-[10px] font-bold tracking-wider uppercase ${
                    hud.counterReady
                      ? 'text-[#38BDF8]'
                      : hud.combosUnlocked && hud.comboStep === 4
                        ? 'text-[#FB7185]'
                        : 'text-slate-100'
                  }`}
                >
                  {hud.comboHint ??
                    (hud.combosUnlocked
                      ? `ARTI ${hud.discoveredCount}/${hud.totalSecretCombos}`
                      : `SERIE ${hud.comboStep}/3`)}
                </span>
              </div>
            )}

            <div
              className={`px-2.5 py-1 bg-[#0F172A]/85 border-l-2 text-white flex items-center gap-2 ${
                hud.healCharges > 0 ? 'border-[#10B981]' : 'border-[#64748B]'
              }`}
            >
              <span
                className={`font-display text-[10px] font-bold tracking-wider ${
                  hud.healCharges > 0 ? 'text-[#34D399]' : 'text-slate-400'
                }`}
              >
                CURA {hud.healCharges}/{hud.healMaxCharges}
              </span>
              <span className="font-mono-nums text-[9px] text-slate-300">
                {hud.healCharges > 0
                  ? hud.gamepadConnected
                    ? '↓'
                    : 'X'
                  : 'ESAURITA'}
              </span>
            </div>
          </div>

          {/* Sculpted Katana Weapon Silhouette Housing Vitals */}
          <div
            className={`relative transition-transform duration-75 ${
              isHitFlash
                ? '-translate-x-1 translate-y-0.5 drop-shadow-[0_0_16px_rgba(225,45,57,0.75)]'
                : 'drop-shadow-[0_6px_14px_rgba(10,15,28,0.45)]'
            }`}
          >
            {dmgFlash > 0.08 && hud.lastDamageAmount > 0 && (
              <div
                className="absolute -top-3.5 right-1 z-20 px-1.5 py-0.5 bg-[#991B1B] border border-[#FB7185] text-white font-mono-nums text-[11px] font-extrabold tracking-wider"
                style={{ opacity: Math.min(1, dmgFlash * 1.35) }}
              >
                -{hud.lastDamageAmount} HP
              </div>
            )}
            <svg
              viewBox="0 0 380 48"
              className="w-full h-12 overflow-visible"
              aria-label={`Vitalità ${hud.hp} su ${hud.maxHp}`}
            >
              <defs>
                {/* Katana Blade Tapered Curved Silhouette */}
                <clipPath id="katana-blade-clip">
                  <path d="M 96 10 Q 225 9 338 5 L 372 13 Q 348 25 320 27 L 96 28 Z" />
                </clipPath>
                <linearGradient id="katana-hp-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#991B1B" />
                  <stop offset="65%" stopColor="#E12D39" />
                  <stop offset="100%" stopColor="#FB7185" />
                </linearGradient>
                <linearGradient id="katana-steel-bg" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1E293B" stopOpacity="0.92" />
                  <stop offset="55%" stopColor="#0F172A" stopOpacity="0.94" />
                  <stop offset="100%" stopColor="#334155" stopOpacity="0.92" />
                </linearGradient>
                <linearGradient id="katana-gold" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FDE68A" />
                  <stop offset="50%" stopColor="#D97706" />
                  <stop offset="100%" stopColor="#78350F" />
                </linearGradient>
              </defs>

              {/* TSUKA (Hilt / Impugnatura) */}
              <rect x="4" y="13" width="8" height="14" rx="1.5" fill="url(#katana-gold)" />
              <rect x="12" y="14" width="70" height="12" fill="#0D131F" stroke="#334155" strokeWidth="1" />
              {/* Traditional Tsukamaki diamond wrap */}
              {[18, 28, 38, 48, 58, 68].map((x) => (
                <polygon
                  key={x}
                  points={`${x},20 ${x + 4},15 ${x + 8},20 ${x + 4},25`}
                  fill="#B91C1C"
                  opacity="0.92"
                />
              ))}

              {/* TSUBA (Handguard) & HABAKI (Blade Collar) */}
              <rect x="82" y="5" width="7" height="30" rx="2.5" fill="url(#katana-gold)" stroke="#111827" strokeWidth="1" />
              <rect x="89" y="11" width="7" height="18" fill="#F59E0B" />

              {/* NAGASA (Blade Channel with Trailing Damage Chunk + Current HP Fill inside) */}
              <path
                d="M 96 10 Q 225 9 338 5 L 372 13 Q 348 25 320 27 L 96 28 Z"
                fill="url(#katana-steel-bg)"
              />
              <g clipPath="url(#katana-blade-clip)">
                {/* Trailing lost-HP highlight so damage chunk is immediately visible */}
                <rect
                  x="96"
                  y="4"
                  width={Math.max(0, (276 * trailHpPct) / 100)}
                  height="26"
                  fill="#FDE68A"
                  fillOpacity="0.88"
                  className="transition-[width] duration-500 ease-out"
                />
                <rect
                  x="96"
                  y="4"
                  width={Math.max(0, (276 * hpPct) / 100)}
                  height="26"
                  fill="url(#katana-hp-grad)"
                />
                {/* Crisp metallic Hamon edge sheen along the lower blade bevel */}
                <path
                  d="M 96 24 Q 230 23 356 17"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="1.2"
                  strokeOpacity="0.65"
                />
              </g>
              {/* Outer forged blade outline (flashes rose/crimson on hit) */}
              <path
                d="M 96 10 Q 225 9 338 5 L 372 13 Q 348 25 320 27 L 96 28 Z"
                fill="none"
                stroke={isHitFlash ? '#FB7185' : isCriticalHp ? '#F87171' : '#CBD5E1'}
                strokeWidth={isHitFlash ? '2.2' : '1.35'}
              />

              {/* HP Label & Numeric Readout inside Blade */}
              <text
                x="108"
                y="21.5"
                fill="#FFFFFF"
                fontSize="9.5"
                fontWeight="800"
                letterSpacing="1.6"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}
              >
                VITALITÀ
              </text>
              <text
                x="312"
                y="21.5"
                textAnchor="end"
                fill="#FFFFFF"
                fontSize="10"
                fontWeight="700"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}
              >
                {hud.hp}/{hud.maxHp}
              </text>
            </svg>

            {/* SAYA (Scabbard Sub-Bars for Postura & Energia flush under the katana blade) */}
            <div className="ml-[24%] mr-[10%] -mt-1.5 bg-[#0D131F]/88 border border-[#334155] px-2.5 py-1.5 grid grid-cols-2 gap-2.5">
              <div>
                <div className="flex justify-between text-[9px] font-semibold tracking-wider text-amber-300 mb-0.5">
                  <span>POSTURA</span>
                  <span className="font-mono-nums">{hud.posture}%</span>
                </div>
                <div className="h-1 w-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-[#F59E0B] transition-all duration-75"
                    style={{ width: `${posturePct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[9px] font-semibold tracking-wider text-sky-300 mb-0.5">
                  <span>ENERGIA</span>
                  <span className="font-mono-nums">{hud.stamina}%</span>
                </div>
                <div className="h-1 w-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-[#38BDF8] transition-all duration-75"
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

        {/* Controls Guide (Bottom-Right — Completely Hideable from Settings or [H]) */}
        <div className="hidden md:flex flex-col items-end gap-1.5 shrink-0 min-w-[200px]">
          {(hud.isBlocking || hud.gamepadConnected) && (
            <div className="text-right text-[11px]">
              {hud.isBlocking ? (
                <span className="font-display font-semibold text-[#0284C7]">GUARDIA ATTIVA</span>
              ) : (
                <span className="text-[#475569]">Gamepad attivo</span>
              )}
            </div>
          )}

          {showControlsGuide && (
            <div className="flex flex-col items-end pointer-events-auto">
              <button
                type="button"
                onClick={onToggleControlsGuide}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#F8FAFC]/90 border border-[#D4DCE6] text-[11px] text-[#475569] hover:text-[#12161F] cursor-pointer"
              >
                <EyeOff className="w-3 h-3" />
                <span>Nascondi Comandi (H)</span>
              </button>

              <div className="bg-[#F8FAFC]/90 border border-t-0 border-[#D4DCE6] px-3.5 py-2.5 text-[11px] text-[#334155] grid grid-cols-2 gap-x-4 gap-y-1">
                {hud.gamepadConnected ? (
                  <>
                    <span>Stick SX · Muovi</span>
                    <span>X · Colpo</span>
                    <span>Y · Pesante</span>
                    <span className="font-semibold text-[#0284C7]">LB · Parata</span>
                    <span>A · Salta</span>
                    <span>B · Schiva</span>
                    <span>RB · Aggancia / Rilascia</span>
                    <span>Levetta DX · Cambia Bersaglio</span>
                    <span className="font-semibold text-[#059669]">↓ D-Pad · Cura Totale</span>
                    <span className="font-semibold text-[#D97706]">Select · Daimoku</span>
                    {hud.timeSlowUnlocked && (
                      <span className="font-semibold text-[#0284C7]">↑ / L3 · Stasi (3.5s)</span>
                    )}
                    {hud.bowUnlocked && (
                      <span className="font-semibold text-[#D97706]">→ D-Pad · Arco</span>
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
                    <span>Tab / R · Ri-aggancia</span>
                    <span>Z / Rotella · Cambia</span>
                    <span className="font-semibold text-[#059669]">X · Cura Totale</span>
                    <span className="font-semibold text-[#D97706]">U · Daimoku</span>
                    {hud.timeSlowUnlocked && (
                      <span className="font-semibold text-[#0284C7]">T · Stasi (3.5s)</span>
                    )}
                    {hud.bowUnlocked && (
                      <span className="font-semibold text-[#D97706]">G · Arco</span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
