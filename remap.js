/* Entry modifier remap v4.1 - for playentry.org only.
 * Both physical Shift keys activate virtual Right Shift (161).
 * Both physical Ctrl keys activate virtual Right Ctrl (163).
 * Native Shift (16) and Ctrl (17) remain unchanged.
 * These are Entry-only virtual key values, not operating-system remaps.
 */
(() => {
  'use strict';
  const NAME = '__entryShiftRemapV4';
  if (window[NAME]) return;

  const VIRTUAL = { shift: 161, ctrl: 163 };
  const LABEL = { shift: 'Right Shift (virtual)', ctrl: 'Right Ctrl (virtual)' };
  const held = {
    shift: { left: false, right: false },
    ctrl: { left: false, right: false }
  };
  const seenKeydown = new WeakSet();
  const stats = { captured: 0, emitted: 0, failures: 0, lastKey: '-', lastError: null };
  const originals = new WeakMap();
  const isFunction = value => typeof value === 'function';

  function entry() { return window.Entry || null; }

  function physicalModifier(event) {
    const e = event && (event.originalEvent || event);
    if (!e) return null;
    let kind;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') kind = 'shift';
    else if (e.code === 'ControlLeft' || e.code === 'ControlRight') kind = 'ctrl';
    else if (e.key === 'Shift' || e.keyCode === 16 || e.which === 16) kind = 'shift';
    else if (e.key === 'Control' || e.key === 'Ctrl' ||
             e.keyCode === 17 || e.which === 17) kind = 'ctrl';
    else return null;
    const side = e.code?.endsWith('Left') ? 'left'
      : e.code?.endsWith('Right') ? 'right'
      : e.location === 1 ? 'left'
      : e.location === 2 ? 'right'
      : null;
    return side ? { kind, side } : null;
  }

  function isTextInput(event) {
    const e = event && (event.originalEvent || event);
    const E = entry();
    try {
      if (isFunction(E?.Utils?.isInInput) && E.Utils.isInInput(event)) return true;
    } catch (_) {}
    const target = e?.target || event?.target;
    return !!target?.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
  }

  function setVirtualState() {
    const keys = entry()?.pressedKeys;
    if (!Array.isArray(keys)) return;
    for (const kind of ['shift', 'ctrl']) {
      const code = VIRTUAL[kind];
      const pressed = held[kind].left || held[kind].right;
      if (pressed) {
        if (!keys.includes(code)) keys.push(code);
      } else {
        for (let i = keys.length - 1; i >= 0; i--) {
          if (keys[i] === code) keys.splice(i, 1);
        }
      }
    }
  }

  function raiseVirtualRight(kind) {
    const E = entry();
    try {
      if (!E?.engine?.isState?.('run')) return;
      const map = E.container?.mapEntityIncludeCloneOnScene;
      const raise = E.engine?.raiseKeyEvent;
      if (!isFunction(map) || !isFunction(raise)) {
        stats.lastError = 'Engine keyPress API unavailable';
        return;
      }
      map.call(E.container, raise, ['keyPress', VIRTUAL[kind]]);
      stats.emitted++;
    } catch (error) {
      stats.failures++;
      stats.lastError = String(error);
      console.warn('[Entry modifier remap] Key event dispatch failed:', error);
    }
  }

  function handleDown(event) {
    const key = physicalModifier(event);
    if (!key) return;
    const { kind, side } = key;
    const raw = event.originalEvent || event;
    held[kind][side] = true;
    setVirtualState();
    if (raw && typeof raw === 'object') {
      if (seenKeydown.has(raw)) return;
      seenKeydown.add(raw);
    }
    stats.captured++;
    stats.lastKey = `${kind} ${side} down`;
    // Normal Shift (16) and Ctrl (17) processing is left intact.
    // Dispatch the separate virtual event after the native listeners.
    if (!isTextInput(event)) {
      queueMicrotask(() => {
        setVirtualState();
        raiseVirtualRight(kind);
      });
    }
  }

  function handleUp(event) {
    const key = physicalModifier(event);
    if (!key) return;
    held[key.kind][key.side] = false;
    stats.lastKey = `${key.kind} ${key.side} up`;
    setVirtualState();
  }

  function releaseAll() {
    for (const kind of ['shift', 'ctrl']) {
      held[kind].left = false;
      held[kind].right = false;
    }
    setVirtualState();
  }

  window.addEventListener('keydown', handleDown, true);
  document.addEventListener('keydown', handleDown, true);
  window.addEventListener('keyup', handleUp, true);
  document.addEventListener('keyup', handleUp, true);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });

  function addVirtualOption(options, kind, nativeCode) {
    if (!Array.isArray(options) || options.some(x => String(x?.[1]) === String(VIRTUAL[kind]))) return;
    const idx = options.findIndex(x => String(x?.[1]) === String(nativeCode));
    options.splice(idx >= 0 ? idx + 1 : options.length, 0,
      [LABEL[kind], String(VIRTUAL[kind])]);
  }

  function installPatches() {
    const E = entry();
    if (!E || !E.Utils) return;
    try {
      // Do not change Entry.Utils.inputToKeycode or native key codes.
      const boolBlock = E.block?.is_press_some_key;
      const keyEventBlock = E.block?.when_some_key_pressed;
      for (const options of [boolBlock?.params?.[0]?.options, keyEventBlock?.params?.[1]?.options]) {
        addVirtualOption(options, 'shift', 16);
        addVirtualOption(options, 'ctrl', 17);
      }

      if (boolBlock && isFunction(boolBlock.func) && !boolBlock.func.__entryShiftV4) {
        const old = boolBlock.func;
        const wrapper = function(sprite, script) {
          try {
            const value = Number(script.getField('VALUE', script));
            const kind = value === VIRTUAL.shift ? 'shift'
              : value === VIRTUAL.ctrl ? 'ctrl' : null;
            if (kind) {
              return held[kind].left || held[kind].right ||
                (Array.isArray(E.pressedKeys) && E.pressedKeys.includes(VIRTUAL[kind]));
            }
          } catch (_) {}
          return old.apply(this, arguments);
        };
        Object.defineProperty(wrapper, '__entryShiftV4', { value: true });
        boolBlock.func = wrapper;
      }

      // In current Entry sources, keyboardControl is an instance arrow field,
      // not a prototype method. Replace it before renderOptions registers it.
      const fieldProto = E.FieldKeyboard?.prototype;
      if (fieldProto && isFunction(fieldProto.renderOptions) &&
          !fieldProto.renderOptions.__entryShiftV4) {
        const oldRender = fieldProto.renderOptions;
        const wrappedRender = function(...args) {
          if (isFunction(this.keyboardControl) && !this.keyboardControl.__entryShiftV4) {
            const oldControl = this.keyboardControl;
            const wrappedControl = (e) => {
              const modifier = physicalModifier(e);
              if (modifier && isFunction(this.applyValue)) {
                e?.stopPropagation?.();
                e?.preventDefault?.();
                this.applyValue(String(VIRTUAL[modifier.kind]), false, true);
                return;
              }
              return oldControl.call(this, e);
            };
            Object.defineProperty(wrappedControl, '__entryShiftV4', { value: true });
            this.keyboardControl = wrappedControl;
          }
          return oldRender.apply(this, args);
        };
        Object.defineProperty(wrappedRender, '__entryShiftV4', { value: true });
        fieldProto.renderOptions = wrappedRender;
      }

      if (isFunction(E.getKeyCodeMap) && !E.getKeyCodeMap.__entryShiftV4) {
        const old = E.getKeyCodeMap;
        const wrapper = function(...args) {
          const map = old.apply(this, args);
          if (map && typeof map === 'object') {
            map[VIRTUAL.shift] = LABEL.shift;
            map[VIRTUAL.ctrl] = LABEL.ctrl;
          }
          return map;
        };
        Object.defineProperty(wrapper, '__entryShiftV4', { value: true });
        E.getKeyCodeMap = wrapper;
      }

      setVirtualState();
    } catch (error) {
      stats.failures++;
      stats.lastError = String(error);
      console.warn('[Entry Shift v4] Patch failed:', error);
    }
  }

  const diagnostic = {
    version: '4.1.0',
    status() {
      const E = entry();
      const boolOptions = E?.block?.is_press_some_key?.params?.[0]?.options;
      const eventOptions = E?.block?.when_some_key_pressed?.params?.[1]?.options;
      return {
        entryLoaded: !!E,
        engineRunning: E?.engine?.isState?.('run') ?? null,
        nativeShiftLeftCode: E?.KeyboardCode?.codeToKeyCode?.ShiftLeft ?? null,
        nativeShiftRightCode: E?.KeyboardCode?.codeToKeyCode?.ShiftRight ?? null,
        nativeCtrlLeftCode: E?.KeyboardCode?.codeToKeyCode?.ControlLeft ?? null,
        nativeCtrlRightCode: E?.KeyboardCode?.codeToKeyCode?.ControlRight ?? null,
        leftHeld: held.shift.left,
        rightHeld: held.shift.right,
        leftCtrlHeld: held.ctrl.left,
        rightCtrlHeld: held.ctrl.right,
        rightVirtualPressed: E?.pressedKeys?.includes?.(VIRTUAL.shift) ?? false,
        rightCtrlVirtualPressed: E?.pressedKeys?.includes?.(VIRTUAL.ctrl) ?? false,
        normalShiftPressed: E?.pressedKeys?.includes?.(16) ?? false,
        normalCtrlPressed: E?.pressedKeys?.includes?.(17) ?? false,
        rightBlockOption: !!boolOptions?.some?.(x => String(x?.[1]) === '161'),
        eventBlockOption: !!eventOptions?.some?.(x => String(x?.[1]) === '161'),
        rightCtrlBlockOption: !!boolOptions?.some?.(x => String(x?.[1]) === '163'),
        rightCtrlEventBlockOption: !!eventOptions?.some?.(x => String(x?.[1]) === '163'),
        booleanBlockPatched: !!E?.block?.is_press_some_key?.func?.__entryShiftV4,
        keyboardFieldPatched: !!E?.FieldKeyboard?.prototype?.renderOptions?.__entryShiftV4,
        ...stats
      };
    },
    testVirtual(kind = 'shift') {
      if (kind !== 'shift' && kind !== 'ctrl') return { error: 'Expected shift or ctrl' };
      const E = entry();
      const wasPressed = held[kind].left;
      held[kind].left = true;
      setVirtualState();
      const result = E?.pressedKeys?.includes?.(VIRTUAL[kind]) ?? false;
      held[kind].left = wasPressed;
      setVirtualState();
      return { keyStateWorking: result, kind, ...this.status() };
    }
  };

  Object.defineProperty(window, NAME, { value: diagnostic, configurable: false });
  installPatches();
  const poll = setInterval(installPatches, 250);
  window.addEventListener('pagehide', () => clearInterval(poll), { once: true });
  console.info('[Entry modifier remap v4.1] loaded; check __entryShiftRemapV4.status()');
})();
