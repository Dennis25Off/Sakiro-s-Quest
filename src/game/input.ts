export interface UnifiedInput {
  moveX: number;
  moveY: number;
  camDeltaX: number;
  camDeltaY: number;
  lightAttackPressed: boolean;
  heavyAttackPressed: boolean;
  blockHeld: boolean;
  parryJustPressed: boolean;
  dodgePressed: boolean;
  jumpPressed: boolean;
  bowPressed: boolean;
  timeSlowPressed: boolean;
  healPressed: boolean;
  lockOnPressed: boolean;
  cycleTargetPressed: boolean;
  cycleTargetDir: -1 | 0 | 1;
  daimokuPressed: boolean;
  pausePressed: boolean;
  gamepadConnected: boolean;
  gamepadName: string;
}

interface GamepadHapticActuatorLike {
  playEffect?: (
    type: string,
    params: {
      startDelay: number;
      duration: number;
      weakMagnitude: number;
      strongMagnitude: number;
    },
  ) => Promise<string>;
  pulse?: (value: number, duration: number) => Promise<boolean>;
  reset?: () => Promise<string>;
}

type GamepadWithHaptics = Omit<Gamepad, 'vibrationActuator'> & {
  vibrationActuator?: GamepadHapticActuatorLike;
  hapticActuators?: GamepadHapticActuatorLike[];
};

export class InputManager {
  private keys = new Set<string>();
  private mouseButtons = new Set<number>();
  private pendingLight = false;
  private pendingHeavy = false;
  private pendingParry = false;
  private pendingDodge = false;
  private pendingJump = false;
  private pendingBow = false;
  private pendingTimeSlow = false;
  private pendingHeal = false;
  private pendingLockOn = false;
  private pendingCycleTarget = false;
  private pendingDaimoku = false;
  private pendingPause = false;
  private accumCamX = 0;
  private accumCamY = 0;
  private prevBlockHeld = false;

  // Gamepad previous-frame button states & haptic throttling
  private prevPadButtons: boolean[] = new Array(18).fill(false);
  private rightStickCooldown = 0;
  private rumbleUntilMs = 0;
  private rumblePriority = 0;
  private draggingCamera = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private canvas: HTMLElement | null = null;
  public pointerLocked = false;
  public isGameplayActive = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.keys.add(e.code);

    if (e.code === 'Escape') {
      this.pendingPause = true;
      return;
    }
    if (!this.isGameplayActive) return;

    if (e.code === 'KeyJ') this.pendingLight = true;
    if (e.code === 'KeyK' || e.code === 'KeyQ') this.pendingHeavy = true;
    if (e.code === 'KeyL' || e.code === 'KeyF') {
      this.pendingParry = true;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyV') {
      this.pendingDodge = true;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      this.pendingJump = true;
    }
    if (e.code === 'KeyG') {
      this.pendingBow = true;
    }
    if (e.code === 'KeyT') {
      this.pendingTimeSlow = true;
    }
    if (e.code === 'KeyX') {
      this.pendingHeal = true;
    }
    if (e.code === 'Tab' || e.code === 'KeyR') {
      e.preventDefault();
      this.pendingLockOn = true;
    }
    if (e.code === 'KeyZ') {
      this.pendingCycleTarget = true;
    }
    if (e.code === 'KeyU') {
      this.pendingDaimoku = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.isGameplayActive) return;
    if (e.target !== this.canvas) return;

    this.mouseButtons.add(e.button);
    if (e.button === 0) {
      this.pendingLight = true;
      // Attempt pointer lock smoothly if not yet locked; fallback drag also works
      if (document.pointerLockElement !== this.canvas && this.canvas?.requestPointerLock) {
        try {
          const maybePromise = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch(() => {});
          }
        } catch {
          // Ignore iframe pointer-lock restrictions gracefully
        }
      }
      this.draggingCamera = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    } else if (e.button === 2) {
      this.pendingParry = true;
    } else if (e.button === 1) {
      e.preventDefault();
      this.pendingLockOn = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    this.mouseButtons.delete(e.button);
    if (e.button === 0) {
      this.draggingCamera = false;
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isGameplayActive) return;
    if (document.pointerLockElement === this.canvas) {
      this.accumCamX += e.movementX * 0.0032;
      this.accumCamY += e.movementY * 0.0024;
    } else if (this.draggingCamera) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.accumCamX += dx * 0.005;
      this.accumCamY += dy * 0.0035;
    }
  };

  private onContextMenu = (e: MouseEvent) => {
    if (this.isGameplayActive) {
      e.preventDefault();
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.isGameplayActive) return;
    if (Math.abs(e.deltaY) >= 4) {
      this.pendingCycleTarget = true;
    }
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private onBlur = () => {
    this.keys.clear();
    this.mouseButtons.clear();
    this.draggingCamera = false;
  };

  public attach(canvas: HTMLElement): void {
    this.canvas = canvas;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  public detach(): void {
    this.stopRumble();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.canvas = null;
  }

  public rumble(
    strongMagnitude: number,
    weakMagnitude: number,
    durationMs: number,
    priority = 1,
  ): void {
    const now = performance.now();
    if (now < this.rumbleUntilMs && priority < this.rumblePriority) {
      return;
    }

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads
      ? (Array.from(pads).find((p) => p && p.connected) as GamepadWithHaptics | undefined)
      : undefined;
    if (!pad) return;

    const strong = Math.max(0, Math.min(1, strongMagnitude));
    const weak = Math.max(0, Math.min(1, weakMagnitude));
    const dur = Math.max(20, Math.min(1200, Math.round(durationMs)));

    this.rumbleUntilMs = now + dur;
    this.rumblePriority = priority;

    try {
      if (pad.vibrationActuator?.playEffect) {
        const res = pad.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: dur,
          strongMagnitude: strong,
          weakMagnitude: weak,
        });
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } else if (pad.hapticActuators && pad.hapticActuators.length > 0) {
        const actuator = pad.hapticActuators[0];
        if (actuator?.pulse) {
          const res = actuator.pulse(Math.max(strong, weak), dur);
          if (res && typeof res.catch === 'function') {
            res.catch(() => {});
          }
        }
      }
    } catch {
      // Ignore browsers/controllers that restrict haptic actuators
    }
  }

  public stopRumble(): void {
    this.rumbleUntilMs = 0;
    this.rumblePriority = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads
      ? (Array.from(pads).find((p) => p && p.connected) as GamepadWithHaptics | undefined)
      : undefined;
    if (!pad) return;
    try {
      if (pad.vibrationActuator?.reset) {
        const res = pad.vibrationActuator.reset();
        if (res && typeof res.catch === 'function') res.catch(() => {});
      }
    } catch {
      // Ignore
    }
  }

  public exitPointerLock(): void {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // Ignore
      }
    }
  }

  public clearPending(): void {
    this.stopRumble();
    this.pendingLight = false;
    this.pendingHeavy = false;
    this.pendingParry = false;
    this.pendingDodge = false;
    this.pendingJump = false;
    this.pendingBow = false;
    this.pendingTimeSlow = false;
    this.pendingHeal = false;
    this.pendingLockOn = false;
    this.pendingCycleTarget = false;
    this.pendingDaimoku = false;
    this.pendingPause = false;
    this.accumCamX = 0;
    this.accumCamY = 0;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads ? Array.from(pads).find((p) => p && p.connected) : undefined;
    if (pad) {
      for (let i = 0; i < Math.min(pad.buttons.length, this.prevPadButtons.length); i++) {
        this.prevPadButtons[i] = Boolean(
          pad.buttons[i]?.pressed || (pad.buttons[i]?.value ?? 0) > 0.35,
        );
      }
    }
  }

  public poll(dt: number): UnifiedInput {
    let moveX = 0;
    let moveY = 0;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveY -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveY += 1;

    let camDeltaX = this.accumCamX;
    let camDeltaY = this.accumCamY;
    this.accumCamX = 0;
    this.accumCamY = 0;

    // Keyboard camera turn support for trackpad users (E / C)
    if (this.keys.has('KeyE')) camDeltaX += 1.9 * dt;
    if (this.keys.has('KeyC')) camDeltaX -= 1.9 * dt;

    let blockHeld =
      this.mouseButtons.has(2) || this.keys.has('KeyL') || this.keys.has('KeyF');

    let lightAttackPressed = this.pendingLight;
    let heavyAttackPressed = this.pendingHeavy;
    let parryJustPressed = this.pendingParry;
    let dodgePressed = this.pendingDodge;
    let jumpPressed = this.pendingJump;
    let bowPressed = this.pendingBow;
    let timeSlowPressed = this.pendingTimeSlow;
    let healPressed = this.pendingHeal;
    let lockOnPressed = this.pendingLockOn;
    let cycleTargetPressed = this.pendingCycleTarget;
    let cycleTargetDir: -1 | 0 | 1 = cycleTargetPressed ? 1 : 0;
    let daimokuPressed = this.pendingDaimoku;
    let pausePressed = this.pendingPause;

    if (this.rightStickCooldown > 0) {
      this.rightStickCooldown = Math.max(0, this.rightStickCooldown - dt);
    }

    this.pendingLight = false;
    this.pendingHeavy = false;
    this.pendingParry = false;
    this.pendingDodge = false;
    this.pendingJump = false;
    this.pendingBow = false;
    this.pendingTimeSlow = false;
    this.pendingHeal = false;
    this.pendingLockOn = false;
    this.pendingCycleTarget = false;
    this.pendingDaimoku = false;
    this.pendingPause = false;

    // Poll HTML5 Gamepad API
    let gamepadConnected = false;
    let gamepadName = '';
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads ? Array.from(pads).find((p) => p && p.connected) : undefined;

    if (pad) {
      gamepadConnected = true;
      gamepadName = pad.id.split('(')[0].trim() || 'Gamepad';

      const deadzone = 0.17;
      const lx = Math.abs(pad.axes[0] ?? 0) > deadzone ? pad.axes[0] : 0;
      const ly = Math.abs(pad.axes[1] ?? 0) > deadzone ? pad.axes[1] : 0;
      const rx = Math.abs(pad.axes[2] ?? 0) > deadzone ? pad.axes[2] : 0;
      const ry = Math.abs(pad.axes[3] ?? 0) > deadzone ? pad.axes[3] : 0;

      if (Math.abs(lx) > 0 || Math.abs(ly) > 0) {
        moveX = lx;
        moveY = ly;
      }
      camDeltaX += rx * 2.6 * dt;
      camDeltaY += ry * 1.8 * dt;

      const btn = (idx: number) =>
        Boolean(pad.buttons[idx]?.pressed || (pad.buttons[idx]?.value ?? 0) > 0.35);
      const just = (idx: number) => btn(idx) && !this.prevPadButtons[idx];

      // Standard Mapping:
      // A / Cross (0) -> Jump
      // B / Circle (1) -> Dodge
      // X / Square (2) or RT (7) -> Light Attack
      // Y / Triangle (3) -> Heavy Attack
      // LB / L1 (4) or LT (6) -> Block / Parry
      // RB / R1 (5) or R3 (11) -> Lock-On
      // D-Pad Up (12) or L3 (10) -> Time Slow (Cronostasi)
      // D-Pad Down (13) -> Full Heal (Cura Totale)
      // D-Pad Left (14) -> Cycle Lock-On Target
      // D-Pad Right (15) -> Bow Shot (Arco)
      // Start (9) -> Pause
      const rawRx = pad.axes[2] ?? 0;
      if (this.isGameplayActive) {
        if (Math.abs(rawRx) < 0.25) {
          this.rightStickCooldown = Math.min(this.rightStickCooldown, 0.05);
        } else if (Math.abs(rawRx) > 0.62 && this.rightStickCooldown <= 0) {
          cycleTargetDir = rawRx > 0 ? 1 : -1;
          this.rightStickCooldown = 0.28;
        }
        if (just(0)) jumpPressed = true;
        if (just(1)) dodgePressed = true;
        if (just(2) || just(7)) lightAttackPressed = true;
        if (just(3)) heavyAttackPressed = true;
        if (just(5) || just(11)) lockOnPressed = true;
        if (just(12) || just(10)) timeSlowPressed = true;
        if (just(13)) healPressed = true;
        if (just(14)) {
          cycleTargetPressed = true;
          if (cycleTargetDir === 0) cycleTargetDir = -1;
        }
        if (just(15)) bowPressed = true;
        if (just(8)) daimokuPressed = true;
      }
      if (just(9)) pausePressed = true;

      const padBlock = btn(4) || btn(6);
      if (padBlock) {
        blockHeld = true;
        if (!this.prevBlockHeld) {
          parryJustPressed = true;
        }
      }

      for (let i = 0; i < Math.min(pad.buttons.length, this.prevPadButtons.length); i++) {
        this.prevPadButtons[i] = btn(i);
      }
    }

    if (blockHeld && !this.prevBlockHeld) {
      parryJustPressed = true;
    }
    this.prevBlockHeld = blockHeld;

    // Normalize move vector
    const mag = Math.hypot(moveX, moveY);
    if (mag > 1) {
      moveX /= mag;
      moveY /= mag;
    }

    return {
      moveX,
      moveY,
      camDeltaX,
      camDeltaY,
      lightAttackPressed,
      heavyAttackPressed,
      blockHeld,
      parryJustPressed,
      dodgePressed,
      jumpPressed,
      bowPressed,
      timeSlowPressed,
      healPressed,
      lockOnPressed,
      cycleTargetPressed,
      cycleTargetDir,
      daimokuPressed,
      pausePressed,
      gamepadConnected,
      gamepadName,
    };
  }
}
