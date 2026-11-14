import { useEffect, useRef } from 'react';

interface UseGamepadMenuNavOptions {
  enabled: boolean;
  onBack?: () => void;
  deps?: unknown[];
}

export function useGamepadMenuNav({ enabled, onBack, deps = [] }: UseGamepadMenuNavOptions): void {
  const selectedIndexRef = useRef<number>(0);
  const gpActiveRef = useRef<boolean>(false);
  const prevButtonsRef = useRef<boolean[]>(new Array(18).fill(false));
  const repeatTimerRef = useRef<{ dir: string; nextAt: number }>({ dir: '', nextAt: 0 });
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) {
      document.querySelectorAll('[data-gp-selected="true"]').forEach((el) => {
        el.removeAttribute('data-gp-selected');
      });
      return;
    }

    const getItems = (): HTMLElement[] => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-gp-item]'));
      return nodes.filter((el) => {
        if ((el as HTMLButtonElement).disabled) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    };

    const applyHighlight = (items: HTMLElement[], idx: number) => {
      document.querySelectorAll('[data-gp-selected="true"]').forEach((el) => {
        el.removeAttribute('data-gp-selected');
      });
      if (!gpActiveRef.current || items.length === 0) return;
      const safeIdx = Math.max(0, Math.min(items.length - 1, idx));
      selectedIndexRef.current = safeIdx;
      const target = items[safeIdx];
      target.setAttribute('data-gp-selected', 'true');
      target.scrollIntoView({ block: 'nearest' });
    };

    // Keep previous button snapshot on mount so held buttons don't fire immediately
    const initPads = navigator.getGamepads ? navigator.getGamepads() : [];
    const initPad = initPads ? Array.from(initPads).find((p) => p && p.connected) : undefined;
    if (initPad) {
      for (let i = 0; i < Math.min(initPad.buttons.length, prevButtonsRef.current.length); i++) {
        prevButtonsRef.current[i] = Boolean(initPad.buttons[i]?.pressed);
      }
      if (gpActiveRef.current) {
        applyHighlight(getItems(), selectedIndexRef.current);
      }
    }

    const onPointerMove = () => {
      if (gpActiveRef.current) {
        gpActiveRef.current = false;
        document.querySelectorAll('[data-gp-selected="true"]').forEach((el) => {
          el.removeAttribute('data-gp-selected');
        });
      }
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    let rafId = 0;
    const poll = (now: number) => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = pads ? Array.from(pads).find((p) => p && p.connected) : undefined;

      if (pad) {
        const items = getItems();
        const btn = (i: number) => Boolean(pad.buttons[i]?.pressed);
        const just = (i: number) => btn(i) && !prevButtonsRef.current[i];

        const axX = pad.axes[0] ?? 0;
        const axY = pad.axes[1] ?? 0;
        const up = btn(12) || axY < -0.55;
        const down = btn(13) || axY > 0.55;
        const left = btn(14) || axX < -0.55;
        const right = btn(15) || axX > 0.55;

        const dir = up ? 'up' : down ? 'down' : left ? 'left' : right ? 'right' : '';

        let triggerDir = '';
        if (dir) {
          if (repeatTimerRef.current.dir !== dir) {
            triggerDir = dir;
            repeatTimerRef.current = { dir, nextAt: now + 260 };
          } else if (now >= repeatTimerRef.current.nextAt) {
            triggerDir = dir;
            repeatTimerRef.current.nextAt = now + 135;
          }
        } else {
          repeatTimerRef.current.dir = '';
        }

        if (triggerDir && items.length > 0) {
          if (!gpActiveRef.current) {
            gpActiveRef.current = true;
            applyHighlight(items, selectedIndexRef.current);
          } else {
            const currentEl = items[Math.min(selectedIndexRef.current, items.length - 1)];

            if (triggerDir === 'up') {
              const nextIdx = (selectedIndexRef.current - 1 + items.length) % items.length;
              applyHighlight(items, nextIdx);
            } else if (triggerDir === 'down') {
              const nextIdx = (selectedIndexRef.current + 1) % items.length;
              applyHighlight(items, nextIdx);
            } else if (triggerDir === 'left' || triggerDir === 'right') {
              const delta = triggerDir === 'right' ? 1 : -1;

              // Range slider adjustment
              if (currentEl instanceof HTMLInputElement && currentEl.type === 'range') {
                const step = Number(currentEl.step || 0.05);
                const min = Number(currentEl.min || 0);
                const max = Number(currentEl.max || 1);
                const nextVal = Math.max(min, Math.min(max, Number(currentEl.value) + delta * step));
                const nativeSetter = Object.getOwnPropertyDescriptor(
                  HTMLInputElement.prototype,
                  'value',
                )?.set;
                nativeSetter?.call(currentEl, String(nextVal));
                currentEl.dispatchEvent(new Event('input', { bubbles: true }));
                currentEl.dispatchEvent(new Event('change', { bubbles: true }));
              } else if (currentEl instanceof HTMLSelectElement) {
                const nextOpt =
                  (currentEl.selectedIndex + delta + currentEl.options.length) %
                  currentEl.options.length;
                const nativeSetter = Object.getOwnPropertyDescriptor(
                  HTMLSelectElement.prototype,
                  'value',
                )?.set;
                nativeSetter?.call(currentEl, currentEl.options[nextOpt].value);
                currentEl.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                // Jump between left/right panel groups or adjacent horizontal items
                const currentGroup = currentEl.getAttribute('data-gp-group');
                if (triggerDir === 'right' && currentGroup === 'left') {
                  const rightIdx = items.findIndex((el) => el.getAttribute('data-gp-group') === 'right');
                  if (rightIdx !== -1) applyHighlight(items, rightIdx);
                } else if (triggerDir === 'left' && currentGroup === 'right') {
                  const leftIdx = items.findIndex((el) => el.getAttribute('data-gp-group') === 'left');
                  if (leftIdx !== -1) applyHighlight(items, leftIdx);
                } else {
                  const nextIdx = (selectedIndexRef.current + delta + items.length) % items.length;
                  applyHighlight(items, nextIdx);
                }
              }
            }
          }
        }

        // A / Cross (0) -> Click focused item
        if (just(0) && items.length > 0) {
          if (!gpActiveRef.current) {
            gpActiveRef.current = true;
            applyHighlight(items, selectedIndexRef.current);
          } else {
            const target = items[Math.min(selectedIndexRef.current, items.length - 1)];
            target.click();
          }
        }

        // B / Circle (1) -> Back / Return to Left Rail / Resume
        if (just(1)) {
          if (gpActiveRef.current && items.length > 0) {
            const cur = items[Math.min(selectedIndexRef.current, items.length - 1)];
            if (cur?.getAttribute('data-gp-group') === 'right') {
              const leftIdx = items.findIndex((el) => el.getAttribute('data-gp-group') === 'left');
              if (leftIdx !== -1) {
                applyHighlight(items, leftIdx);
              } else {
                onBackRef.current?.();
              }
            } else {
              onBackRef.current?.();
            }
          } else {
            onBackRef.current?.();
          }
        }

        for (let i = 0; i < Math.min(pad.buttons.length, prevButtonsRef.current.length); i++) {
          prevButtonsRef.current[i] = btn(i);
        }
      }

      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
}
