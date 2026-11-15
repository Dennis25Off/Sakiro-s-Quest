import React, { useEffect, useState } from 'react';
import { FastForward } from 'lucide-react';

interface StoryIntroOverlayProps {
  active: boolean;
  gamepadConnected: boolean;
  onFinish: () => void;
}

interface IntroBeat {
  start: number;
  end: number;
  kicker: string;
  title: string;
  text: string;
}

const INTRO_DURATION = 12.5;

const INTRO_BEATS: IntroBeat[] = [
  {
    start: 0,
    end: 3.1,
    kicker: 'PROLOGO · CENERE E SANGUE',
    title: 'La Notte del Tradimento',
    text: "Nell'oscurità senza luna, il clan dello Shogun Kurogane accerchiò la dimora di Sakiro, colpendo nell'ombra chi aveva giurato di servire.",
  },
  {
    start: 3.1,
    end: 6.3,
    kicker: 'LE BRACI DELLA CASATA',
    title: 'Una Famiglia Sterminata',
    text: "Le fiamme divorarono il cortile e ogni voce amica fu ridotta al silenzio. Dalle ceneri della sua famiglia, Sakiro raccolse soltanto l'acciaio.",
  },
  {
    start: 6.3,
    end: 9.4,
    kicker: 'IL PERCHÉ DELLA LAMA',
    title: 'Il Giuramento di Sakiro',
    text: 'Sakiro non impugna la katana per gloria né per pietà: deve vendicare la sua famiglia uccidendo tutti i suoi nemici, uno dopo l’altro.',
  },
  {
    start: 9.4,
    end: INTRO_DURATION,
    kicker: 'DIECI ATTI DI VENDETTA',
    title: 'Nessun Colpevole Sopravviverà',
    text: "Dalla soglia del santuario fino all'altare infernale di Kurogane, la lama segnerà la fine di ogni traditore.",
  },
];

export const StoryIntroOverlay: React.FC<StoryIntroOverlayProps> = ({
  active,
  gamepadConnected,
  onFinish,
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }

    const startTime = performance.now();
    let rafId = 0;
    let finished = false;
    let prevGpSkip = false;

    const triggerFinish = () => {
      if (finished) return;
      finished = true;
      onFinish();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (performance.now() - startTime < 450) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        triggerFinish();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    const tick = (now: number) => {
      const sec = (now - startTime) / 1000;
      setElapsed(Math.min(INTRO_DURATION, sec));

      if (sec >= INTRO_DURATION) {
        triggerFinish();
        return;
      }

      if (sec > 0.45 && navigator.getGamepads) {
        const pads = navigator.getGamepads();
        const pad = pads.find((p) => p && p.connected) ?? null;
        const skipPressed = Boolean(
          pad && (pad.buttons[0]?.pressed || pad.buttons[9]?.pressed),
        );
        if (skipPressed && !prevGpSkip) {
          triggerFinish();
          return;
        }
        prevGpSkip = skipPressed;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [active, onFinish]);

  if (!active) return null;

  const beatIndex = Math.max(
    0,
    INTRO_BEATS.findIndex((b) => elapsed >= b.start && elapsed < b.end),
  );
  const currentBeat =
    elapsed >= INTRO_BEATS[INTRO_BEATS.length - 1].start
      ? INTRO_BEATS[INTRO_BEATS.length - 1]
      : INTRO_BEATS[beatIndex];
  const progressPct = Math.max(0, Math.min(100, (elapsed / INTRO_DURATION) * 100));

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between">
      {/* Top cinematic vignette & Skip Button */}
      <div className="w-full bg-gradient-to-b from-[#090D16]/88 via-[#090D16]/45 to-transparent px-6 sm:px-10 pt-5 pb-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-block w-2 h-2 bg-[#E12D39]" />
          <span className="font-mono-nums text-[11px] tracking-[0.28em] text-slate-300 uppercase">
            {currentBeat.kicker}
          </span>
        </div>

        <button
          type="button"
          onClick={onFinish}
          className="pointer-events-auto flex items-center gap-2 px-4 py-1.5 bg-[#090D16]/65 backdrop-blur-md border border-white/25 text-xs font-semibold tracking-wider text-white hover:border-[#E12D39] hover:text-[#FB7185] transition-colors cursor-pointer"
        >
          <span>Salta Intro [{gamepadConnected ? 'A / Start' : 'Spazio'}]</span>
          <FastForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom narrative caption keeping Sakiro's 3D animation unobstructed in center */}
      <div className="w-full bg-gradient-to-t from-[#090D16]/94 via-[#090D16]/76 to-transparent px-6 sm:px-12 pt-14 pb-7 flex flex-col items-center text-center">
        <h2 className="font-display text-xl sm:text-3xl font-bold text-white tracking-wide">
          {currentBeat.title}
        </h2>
        <p className="max-w-2xl text-sm sm:text-base text-slate-200 leading-relaxed mt-2.5">
          {currentBeat.text}
        </p>

        {/* Chapter Beat Indicators + Progress Blade */}
        <div className="w-full max-w-md mt-5 flex flex-col gap-2">
          <div className="flex items-center justify-center gap-2">
            {INTRO_BEATS.map((beat, idx) => {
              const activeBeat = beat.title === currentBeat.title;
              const passed = elapsed >= beat.end;
              return (
                <span
                  key={beat.kicker}
                  className={`h-1 transition-all duration-300 ${
                    activeBeat
                      ? 'w-8 bg-[#E12D39]'
                      : passed
                        ? 'w-4 bg-white/60'
                        : 'w-4 bg-white/20'
                  }`}
                  aria-label={`Scena ${idx + 1}`}
                />
              );
            })}
          </div>
          <div className="h-[2px] w-full bg-white/15 overflow-hidden">
            <div
              className="h-full bg-[#E12D39] transition-[width] duration-75 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
