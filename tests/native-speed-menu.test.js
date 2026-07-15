import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contentScript = readFileSync(new URL('../content-script.js', import.meta.url), 'utf8');
const pageBridge = readFileSync(new URL('../page-bridge.js', import.meta.url), 'utf8');
const extensionSource = `${contentScript}\n${pageBridge}`;

test('S opens YouTube native playback speed menu instead of custom centered overlay', () => {
  assert.match(extensionSource, /toggleNativeSpeedMenu/);
  assert.match(extensionSource, /ytsh-toggle-native-speed-menu/);
  assert.match(extensionSource, /closeYoutubeSpeedMenu/);
  assert.match(extensionSource, /openSettingsMenuItem\('playbackRate'\)/);
  assert.match(extensionSource, /handleBridgeKeydown/);
  assert.match(extensionSource, /stopImmediatePropagation/);
  assert.match(extensionSource, /setPlaybackRate/);
  assert.match(extensionSource, /setVideoSpeed\(digitSpeed\)/);
  assert.match(extensionSource, /\.ytp-settings-button/);
  assert.match(extensionSource, /Playback speed|Скорость воспроизведения|Snelheid/);
  assert.doesNotMatch(extensionSource, /document\.createElement\('dialog'\)/);
  assert.doesNotMatch(extensionSource, /ytsh-panel/);
});
