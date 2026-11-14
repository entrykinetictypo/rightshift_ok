/* Entry Both-Sides Shift/Ctrl v4.2.0
 * Keep the built-in Entry Shift (16) and Ctrl (17) blocks.
 * Make each block respond to BOTH left and right physical modifier keys.
 * Do not add virtual keys, change native KeyboardEvents or block dropdowns.
 */
(() => {
  'use strict';

  const NAME = '__entryModifierBothSides';
  if (window[NAME]) return;

  const KEYCODE = { shift: 16, ctrl: 17 };
  const MARK = '__entryBothSidesV42';
  const held = {
    shift: { left: false, right: false },
    ctrl: { left: false, right: false }
  };
  const tracked = { shift: false, ctrl: false };
  const seenDown = new WeakSet();
  const seenUp = new WeakSet();
  const forwarded = new WeakSet();
  const stats = {
    keydowns: 0, keyups: 0, entryNotifications: 0,
    fallbackEvents: 0, errors: 0, lastKey: '-', lastError: null
  };

  const getEntry = () => window.Entry;
  const rawEvent = e => e && (e.originalEvent || e);

  function modifierOf(event) {
    const e = rawEvent(event);
    if (!e) return null;
    let kind = null;
    let side = null;

    if (e.code === 'ShiftLeft') return { kind: 'shift', side: 'left' };
    if (e.code === 'ShiftRight') return { kind: 'shift', side: 'right' };
    if (e.code === 'ControlLeft') return { kind: 'ctrl', side: 'left' };
    if (e.code === 'ControlRight') return { kind: 'ctrl', side: 'right' };

    if (e.key === 'Shift' || e.keyCode === 16 || e.which === 16) {
      kind = 'shift';
    } else if (e.key === 'Control' || e.key === 'Ctrl' ||
               e.keyCode === 17 || e.which === 17) {
      kind = 'ctrl';
    } else {
      return null;
    }

    if (e.location === 1) side = 'left';
    if (e.location === 2) side = 'right';
    return side ? { kind, side } : null;
  }

  function inTextInput(event) {
    const e = rawEvent(event);
    const E = getEntry();
    try {
      if (typeof E?.Utils?.isInInput === 'function' &&
          E.Utils.isInInput(event)) return true;
    } catch (_) {}
    const target = e?.target || event?.target;
    return !!target?.closest?.(
      'input, textarea, select, [contenteditable="true"], [contenteditable=""]'
    );
  }

  function syncOne(kind) {
    const E = getEntry();
    const keys = E?.pressedKeys;
    if (!tracked[kind] || !Array.isArray(keys)) return;
    const code = KEYCODE[kind];
    const isHeld = held[kind].left || held[kind].right;

    if (isHeld && !keys.includes(code)) {
      keys.push(code);
    } else if (!isHeld) {
      for (let i = keys.length - 1; i >= 0; i--) {
        if (keys[i] === code) keys.splice(i, 1);
      }
    }
  }

  function raiseMissingKeyEvent(kind) {
    const E = getEntry();
    if (!E?.engine?.isState?.('run')) return;
    try {
      const map = E.container?.mapEntityIncludeCloneOnScene;
      const raise = E.engine?.raiseKeyEvent;
      if (typeof map !== 'function' || typeof raise !== 'function') return;
      map.call(E.container, raise, ['keyPress', KEYCODE[kind]]);
      stats.fallbackEvents++;
    } catch (error) {
      stats.errors++;
      stats.lastError = String(error);
      console.warn('[Entry both-sides] fallback failed:', error);
    }
  }

  function onDown(event) {
    const mod = modifierOf(event);
    if (!mod) return;
    const e = rawEvent(event);
    if (seenDown.has(e)) return;
    seenDown.add(e);

    const { kind, side } = mod;
    tracked[kind] = true;
    held[kind][side] = true;
    syncOne(kind);
    stats.keydowns++;
    stats.lastKey = kind + ' ' + side + ' down';

    // Run after Entry's ordinary keydown listeners. If Entry received
    // this event, it handles the existing block itself; no duplicates.
    queueMicrotask(() => {
      syncOne(kind);
      if (held[kind][side] && !forwarded.has(e) && !inTextInput(event)) {
        raiseMissingKeyEvent(kind);
      }
    });
  }

  function onUp(event) {
    const mod = modifierOf(event);
    if (!mod) return;
    const e = rawEvent(event);
    if (seenUp.has(e)) return;
    seenUp.add(e);

    const { kind, side } = mod;
    tracked[kind] = true;
    held[kind][side] = false;
    stats.keyups++;
    stats.lastKey = kind + ' ' + side + ' up';
    // An ordinary Entry keyup may remove 16/17 even if the OTHER side
    // is still held. Reconcile after Entry has processed the event.
    queueMicrotask(() => syncOne(kind));
  }

  function releaseAll() {
    for (const kind of ['shift', 'ctrl']) {
      held[kind].left = false;
      held[kind].right = false;
      syncOne(kind);
    }
  }

  window.addEventListener('keydown', onDown, true);
  document.addEventListener('keydown', onDown, true);
  window.addEventListener('keyup', onUp, true);
  document.addEventListener('keyup', onUp, true);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });

  function installPatches() {
    const E = getEntry();
    if (!E?.Utils) return;

    try {
      // Preserve Entry's native key codes. Only fix missing side mappings.
      const map = E.KeyboardCode?.codeToKeyCode;
      if (map) {
        map.ShiftLeft = KEYCODE.shift;
        map.ShiftRight = KEYCODE.shift;
        map.ControlLeft = KEYCODE.ctrl;
        map.ControlRight = KEYCODE.ctrl;
      }

      // The boolean [key pressed?] block must use the original 16/17.
      const booleanBlock = E.block?.is_press_some_key;
      if (typeof booleanBlock?.func === 'function' &&
          !booleanBlock.func[MARK]) {
        const original = booleanBlock.func;
        const patched = function(sprite, script) {
          try {
            const code = Number(script.getField('VALUE', script));
            if (code === KEYCODE.shift || code === KEYCODE.ctrl) {
              const kind = code === KEYCODE.shift ? 'shift' : 'ctrl';
              if (held[kind].left || held[kind].right) return true;
            }
          } catch (_) {}
          return original.apply(this, arguments);
        };
        patched[MARK] = true;
        booleanBlock.func = patched;
      }

      // Ensure Entry resolves both physical sides to the built-in code.
      if (typeof E.Utils.inputToKeycode === 'function' &&
          !E.Utils.inputToKeycode[MARK]) {
        const original = E.Utils.inputToKeycode;
        const patched = function(event) {
          const mod = modifierOf(event);
          if (mod) return KEYCODE[mod.kind];
          return original.apply(this, arguments);
        };
        patched[MARK] = true;
        E.Utils.inputToKeycode = patched;
      }

      // Detect when Entry's own keyboard handler received a keydown.
      // Only then suppress our fallback to avoid duplicate event blocks.
      const keyEvent = E.keyPressed;
      if (typeof keyEvent?.notify === 'function' && !keyEvent.notify[MARK]) {
        const original = keyEvent.notify;
        const patched = function(event) {
          const mod = modifierOf(event);
          if (mod) {
            forwarded.add(rawEvent(event));
            stats.entryNotifications++;
            syncOne(mod.kind);
          }
          return original.apply(this, arguments);
        };
        patched[MARK] = true;
        keyEvent.notify = patched;
      }

      syncOne('shift');
      syncOne('ctrl');
    } catch (error) {
      stats.errors++;
      stats.lastError = String(error);
      console.warn('[Entry both-sides] patch failed:', error);
    }
  }

  const diagnostic = {
    version: '4.2.0',
    status() {
      const E = getEntry();
      const boolOptions = E?.block?.is_press_some_key?.params?.[0]?.options;
      const eventOptions = E?.block?.when_some_key_pressed?.params?.[1]?.options;
      return {
        entryLoaded: !!E,
        engineRunning: E?.engine?.isState?.('run') ?? null,
        leftShiftHeld: held.shift.left,
        rightShiftHeld: held.shift.right,
        leftCtrlHeld: held.ctrl.left,
        rightCtrlHeld: held.ctrl.right,
        shiftPressed: E?.pressedKeys?.includes?.(16) ?? false,
        ctrlPressed: E?.pressedKeys?.includes?.(17) ?? false,
        shiftNativeCode: E?.KeyboardCode?.codeToKeyCode?.ShiftRight ?? null,
        ctrlNativeCode: E?.KeyboardCode?.codeToKeyCode?.ControlRight ?? null,
        booleanBlockPatched: !!E?.block?.is_press_some_key?.func?.[MARK],
        keyMapperPatched: !!E?.Utils?.inputToKeycode?.[MARK],
        listenerPatched: !!E?.keyPressed?.notify?.[MARK],
        // Must be false for this version: no extra virtual-key choices.
        virtualShiftOption: !!boolOptions?.some?.(x => String(x?.[1]) === '161'),
        virtualCtrlOption: !!boolOptions?.some?.(x => String(x?.[1]) === '163'),
        virtualShiftEventOption: !!eventOptions?.some?.(x => String(x?.[1]) === '161'),
        virtualCtrlEventOption: !!eventOptions?.some?.(x => String(x?.[1]) === '163'),
        ...stats
      };
    }
  };
  Object.defineProperty(window, NAME, { value: diagnostic });
  installPatches();
  const poll = setInterval(installPatches, 250);
  window.addEventListener('pagehide', () => clearInterval(poll), { once: true });
  console.info('[Entry both-sides v4.2] loaded; __entryModifierBothSides.status()');
})();