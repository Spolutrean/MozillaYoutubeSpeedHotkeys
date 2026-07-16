# YouTube Speed Hotkeys

Firefox extension that opens YouTube's native playback-speed menu and adds speed hotkeys.

## Hotkeys

- `S` — open/close YouTube's native playback speed menu in the bottom-right settings popup.
- `←` / `→` while the speed menu is open — decrease/increase speed by `0.05x`.
- `1`, `2`, `3` while the speed menu is open — set `1x`, `2x`, `3x` directly.

## Install temporarily in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` from this folder, or select the packaged `.zip`.
4. Open YouTube and press `S` while a video is present.

## Package

The generated extension packages are inside the `release` folder.
