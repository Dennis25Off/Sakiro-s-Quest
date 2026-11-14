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
  lockOnPressed: boolean;
  pausePressed: boolean;
  gamepadConnected: boolean;
  gamepadName: string;
}

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
  private pendingLockOn = false;
  private pendingPause = false;
  private accumCamX = 0;
  private accumCamY = 0;
  private prevBlockHeld = false;

  // Gamepad previous-frame button states for edge detection
  private prevPadButtons: boolean[] = new Array(18).fill(false);
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
    if (e.code === 'Tab' || e.code === 'KeyR') {
      e.preventDefault();
      this.pendingLockOn = true;
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
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.canvas = null;
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
    this.pendingLight = false;
    this.pendingHeavy = false;
    this.pendingParry = false;
    this.pendingDodge = false;
    this.pendingJump = false;
    this.pendingBow = false;
    this.pendingTimeSlow = false;
    this.pendingLockOn = false;
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
    let lockOnPressed = this.pendingLockOn;
    let pausePressed = this.pendingPause;

    this.pendingLight = false;
    this.pendingHeavy = false;
    this.pendingParry = false;
    this.pendingDodge = false;
    this.pendingJump = false;
    this.pendingBow = false;
    this.pendingTimeSlow = false;
    this.pendingLockOn = false;
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
      // D-Pad Right (15) -> Bow Shot (Arco)
      // Start (9) -> Pause
      if (this.isGameplayActive) {
        if (just(0)) jumpPressed = true;
        if (just(1)) dodgePressed = true;
        if (just(2) || just(7)) lightAttackPressed = true;
        if (just(3)) heavyAttackPressed = true;
        if (just(5) || just(11)) lockOnPressed = true;
        if (just(12) || just(10)) timeSlowPressed = true;
        if (just(15)) bowPressed = true;
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
      lockOnPressed,
      pausePressed,
      gamepadConnected,
      gamepadName,
    };
  }
}
