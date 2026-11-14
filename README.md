# Entry Shift & Ctrl Both Sides — v4.2.1

This extension fixes Entry's **existing** keyboard blocks. No additional key choices are added.

- The default **[Shift key pressed?]** and **[when Shift pressed]** blocks (keycode 16) recognize **Left Shift and Right Shift**.
- The default **[Ctrl key pressed?]** and **[when Ctrl pressed]** blocks (keycode 17) recognize **Left Ctrl and Right Ctrl**.
- Holding both keys and releasing only one still counts as pressed until the other is released.
- No operating-system remap, synthetic DOM keyboard event, blocked keys, or browser shortcut override.

## Editor URLs

Works on Entry pages including URLs beginning with:

- https://playentry.org/ws
- https://playentry.org/ws/...
- https://playentry.org/project/...

The manifest's \`https://playentry.org/*\` wildcard already includes \`/ws\`. Version 4.2.1 also enables \`match_origin_as_fallback\` for related \`about:\`, \`data:\`, and \`blob:\` editor frames. The extension remains limited to Entry origins and eligible related frames. The same original Shift (16) / Ctrl (17) dropdown choices are used.

Note: The embedded editor's actual behavior cannot be confirmed without testing the page in Chrome or Edge. Use F12 > Console to check \`window.__entryModifierBothSides.status()\` in the correct frame.

## Installation

1. Remove / disable any older version of this extension.
2. Download or clone the repository and use **Load unpacked** at chrome://extensions (or edge://extensions).
3. Reload the playentry.org project page.
4. Use Entry's **original** Shift and Ctrl options. Do **not** select virtual 161/163 keys: those were removed.
5. Start the project and test both sides of each modifier.

## Diagnostics

Open F12 → Console on the Entry project page:

    window.__entryModifierBothSides.status()

Check the booleans \`booleanBlockPatched\`, \`keyMapperPatched\`, \`listenerPatched\`.
While holding Shift/Ctrl, check \`shiftPressed\`/\`ctrlPressed\` or \`rightShiftHeld\`/\`rightCtrlHeld\`.

The extension only changes Entry's internal block handling. Behavior in other sites and apps is unchanged. Browser shortcuts involving Ctrl can still run normally.
