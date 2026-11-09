/* Entry Shift Remap v4 - for playentry.org only.
 * Left Shift -> virtual Right Shift (161), and real Right Shift -> 161 too.
 * Standard Shift (16) stays unchanged; no native event cancellation or
 * KeyboardEvent prototype overrides. 161 is an Entry-only virtual value.
 */
(() => {
  'use strict';
  const NAME = '__entryShiftRemapV4';
  if (window[NAME]) return;

  const VIRTUAL_RIGHT = 161;
  const held = { left: false, right: false };
  const seenKeydown = new WeakSet();
  const stats = { captured: 0, emitted: 0, failures: 0, lastKey: '-', lastError: null };
  const originals = new WeakMap();
  const isFunction = value => typeof value === 'function';

  function entry() { return window.Entry || null; }

  function physicalSide(event) {
    const e = event && (event.originalEvent || event);
    if (!e) return null;
    if (e.code === 'ShiftLeft') return 'left';
    if (e.code === 'ShiftRight') return 'right';
    if (e.key !== 'Shift' && e.keyCode !== 16 && e.which !== 16) return null;
    if (e.location === 1) return 'left';
    if (e.location === 2) return 'right';
    return null;
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
    const pressed = held.left || held.right;
    if (pressed) {
      if (!keys.includes(VIRTUAL_RIGHT)) keys.push(VIRTUAL_RIGHT);
    } else {
      for (let i = keys.length - 1; i >= 0; i--) {
        if (keys[i] === VIRTUAL_RIGHT) keys.splice(i, 1);
      }
    }
  }

  function raiseVirtualRight() {
    const E = entry();
    try {
      if (!E?.engine?.isState?.('run')) return;
      const map = E.container?.mapEntityIncludeCloneOnScene;
      const raise = E.engine?.raiseKeyEvent;
      if (!isFunction(map) || !isFunction(raise)) {
        stats.lastError = 'Engine keyPress API unavailable';
        return;
      }
      map.call(E.container, raise, ['keyPress', VIRTUAL_RIGHT]);
      stats.emitted++;
    } catch (error) {
      stats.failures++;
      stats.lastError = String(error);
      console.warn('[Entry Shift v4] Key event dispatch failed:', error);
    }
  }

  function handleDown(event) {
    const side = physicalSide(event);
    if (!side) return;
    const raw = event.originalEvent || event;
    held[side] = true;
    setVirtualState();
    if (raw && typeof raw === 'object') {
      if (seenKeydown.has(raw)) return;
      seenKeydown.add(raw);
    }
    stats.captured++;
    stats.lastKey = `${side} down`;
    const inInput = isTextInput(event);
    // Entry's real keyPress listeners have already processed Shift (16) by
    // the time this microtask executes. Dispatch 161 independently.
    if (!inInput) {
      queueMicrotask(() => {
        setVirtualState();
        raiseVirtualRight();
      });
    }
  }

  function handleUp(event) {
    const side = physicalSide(event);
    if (!side) return;
    held[side] = false;
    stats.lastKey = `${side} up`;
    setVirtualState();
  }

  function releaseAll() {
    held.left = false;
    held.right = false;
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

  function addRightShiftOption(options) {
    if (!Array.isArray(options) || options.some(x => String(x?.[1]) === '161')) return;
    const idx = options.findIndex(x => String(x?.[1]) === '16');
    options.splice(idx >= 0 ? idx + 1 : 0, 0, ['Right Shift (virtual)', '161']);
  }

  function installPatches() {
    const E = entry();
    if (!E || !E.Utils) return;
    try {
      // Do not change Entry.Utils.inputToKeycode or native key code 16.
      const boolBlock = E.block?.is_press_some_key;
      const keyEventBlock = E.block?.when_some_key_pressed;
      addRightShiftOption(boolBlock?.params?.[0]?.options);
      addRightShiftOption(keyEventBlock?.params?.[1]?.options);

      if (boolBlock && isFunction(boolBlock.func) && !boolBlock.func.__entryShiftV4) {
        const old = boolBlock.func;
        const wrapper = function(sprite, script) {
          try {
            if (Number(script.getField('VALUE', script)) === VIRTUAL_RIGHT) {
              return held.left || held.right ||
                (Array.isArray(E.pressedKeys) && E.pressedKeys.includes(VIRTUAL_RIGHT));
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
              if (physicalSide(e) && isFunction(this.applyValue)) {
                e?.stopPropagation?.();
                e?.preventDefault?.();
                this.applyValue(String(VIRTUAL_RIGHT), false, true);
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
          if (map && typeof map === 'object') map[VIRTUAL_RIGHT] = 'Right Shift (virtual)';
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
    version: '4.0.0',
    status() {
      const E = entry();
      return {
        entryLoaded: !!E,
        engineRunning: E?.engine?.isState?.('run') ?? null,
        nativeShiftLeftCode: E?.KeyboardCode?.codeToKeyCode?.ShiftLeft ?? null,
        nativeShiftRightCode: E?.KeyboardCode?.codeToKeyCode?.ShiftRight ?? null,
        leftHeld: held.left,
        rightHeld: held.right,
        rightVirtualPressed: E?.pressedKeys?.includes?.(VIRTUAL_RIGHT) ?? false,
        normalShiftPressed: E?.pressedKeys?.includes?.(16) ?? false,
        rightBlockOption: !!E?.block?.is_press_some_key?.params?.[0]?.options?.some?.(x => String(x?.[1]) === '161'),
        eventBlockOption: !!E?.block?.when_some_key_pressed?.params?.[1]?.options?.some?.(x => String(x?.[1]) === '161'),
        booleanBlockPatched: !!E?.block?.is_press_some_key?.func?.__entryShiftV4,
        keyboardFieldPatched: !!E?.FieldKeyboard?.prototype?.renderOptions?.__entryShiftV4,
        ...stats
      };
    },
    testVirtual() {
      const E = entry();
      const wasPressed = held.left;
      held.left = true;
      setVirtualState();
      const result = E?.pressedKeys?.includes?.(VIRTUAL_RIGHT) ?? false;
      held.left = wasPressed;
      setVirtualState();
      return { keyStateWorking: result, ...this.status() };
    }
  };
  Object.defineProperty(window, NAME, { value: diagnostic, configurable: false });
  installPatches();
  const poll = setInterval(installPatches, 250);
  window.addEventListener('pagehide', () => clearInterval(poll), { once: true });
  console.info('[Entry Shift v4] loaded; check __entryShiftRemapV4.status()');
})();
