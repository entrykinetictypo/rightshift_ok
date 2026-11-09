Entry Shift Remap v4.0.0

Purpose:
- Keep the regular Entry Shift key (code 16) unchanged.
- Add a separate "Right Shift (virtual)" key (value 161) to Entry blocks.
- Both physical LEFT Shift and RIGHT Shift activate the virtual key.
- This is a virtual key for Entry blocks, not an OS-level keyboard remap.

Installation:
1. Disable/remove previous Shift remap extensions v1, v2, and v3.
2. Unzip this archive to a local folder.
3. Open chrome://extensions or edge://extensions.
4. Enable Developer Mode and select "Load unpacked".
5. Select the entry-shift-remap-v4 folder.
6. Reload the playentry.org page.
7. In an Entry keyboard block, choose "Right Shift (virtual)".
   You can also open the keyboard dropdown then press LEFT Shift.
8. Run your project, then press LEFT Shift to test.

Diagnostics (F12 -> Console):
window.__entryShiftRemapV4.status()
While holding Shift, run status() in the console to check whether
rightVirtualPressed is true; alternatively check captured / lastKey.

Reminder:
- Browser-native event.code is not changed, and other programs will not
  see a physical right Shift. This only affects playentry.org's Entry blocks.
- Prior versions of this extension must not run alongside this version.
