Entry Modifier Remap v4.1.0

Purpose:
- Preserve the regular Entry Shift (16) and Ctrl (17) keys.
- Add "Right Shift (virtual)" (161) to Entry keyboard blocks.
  Both physical Left Shift and Right Shift activate this virtual key.
- Add "Right Ctrl (virtual)" (163) to Entry keyboard blocks.
  Both physical Left Ctrl and Right Ctrl activate this virtual key.
- Support "when key pressed" and "is key pressed?" blocks.
- Do not remap operating-system keys or prevent normal keyboard shortcuts.

Installation:
1. Disable/remove old versions of this extension.
2. Load unpacked at chrome://extensions or edge://extensions.
3. Reload playentry.org.
4. Choose "Right Shift (virtual)" or "Right Ctrl (virtual)" in the key menu.
   The menu can also pick a virtual key when you press its physical modifier.
5. Run your project and test the desired key.

Diagnostics (F12 > Console):
window.__entryShiftRemapV4.status()
window.__entryShiftRemapV4.testVirtual('shift')
window.__entryShiftRemapV4.testVirtual('ctrl')

Important:
- Only Entry block behavior is affected, not Windows/macOS keyboard input.
- The virtual 161 and 163 values are Entry-only identifiers, not native keycodes.
- Shift and Ctrl combinations (such as Ctrl+C) may still trigger browser shortcuts.
- Avoid enabling multiple versions of this extension simultaneously.
