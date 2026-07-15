import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const extensionPath = new URL('..', import.meta.url).pathname;
const userDataDir = `/tmp/yt-speed-extension-live-${Date.now()}`;
const browser = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  executablePath: '/usr/bin/chromium-browser',
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

try {
  const page = await browser.newPage();
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const accept = page.getByRole('button', { name: /accept|agree|reject all/i }).first();
  try { await accept.click({ timeout: 5000 }); } catch {}
  await page.waitForSelector('video', { timeout: 60000 });
  await page.waitForFunction(() => window.ytshPageBridgeInstalled === true, null, { timeout: 10000 });
  for (let i = 0; i < 8; i += 1) {
    try { await page.getByText(/^Skip$/i).click({ timeout: 1000 }); } catch {}
    const isAd = await page.$eval('#movie_player', (p) => p.className.includes('ad-showing')).catch(() => false);
    if (!isAd) break;
    await page.waitForTimeout(3000);
  }
  await page.waitForFunction(() => !document.querySelector('#movie_player')?.className.includes('ad-showing'), null, { timeout: 60000 });
  const playerBox = await page.locator('#movie_player').boundingBox();
  if (playerBox) {
    await page.mouse.click(playerBox.x + playerBox.width / 2, playerBox.y + playerBox.height / 2);
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.keyboard.press('s');
    const opened = await page.waitForFunction(
      () => /Playback speed|Скорость воспроизведения|Normal|Обычная|1[,.]25|2[,.]0/.test(document.querySelector('.ytp-popup.ytp-settings-menu')?.innerText || ''),
      null,
      { timeout: 4000 },
    ).then(() => true).catch(() => false);
    if (opened) break;
  }
  await page.waitForFunction(() => /Playback speed|Скорость воспроизведения|Normal|Обычная|1[,.]25|2[,.]0/.test(document.querySelector('.ytp-popup.ytp-settings-menu')?.innerText || ''), null, { timeout: 3000 });
  const text = await page.locator('.ytp-popup.ytp-settings-menu').innerText();
  assert.match(text, /Playback speed|Speed|Normal|2|Quality|Annotations|Loop/i);

  await page.keyboard.press('2');
  await page.waitForFunction(() => {
    const player = document.querySelector('#movie_player');
    const videoRate = document.querySelector('video')?.playbackRate;
    const playerRate = player?.getPlaybackRate?.();
    return videoRate === 2 && (playerRate === undefined || playerRate === 2);
  }, null, { timeout: 3000 });
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => {
    const player = document.querySelector('#movie_player');
    const videoRate = document.querySelector('video')?.playbackRate || 0;
    const playerRate = player?.getPlaybackRate?.();
    return Math.abs(videoRate - 1.95) < 0.001 && (playerRate === undefined || Math.abs(playerRate - 1.95) < 0.001);
  }, null, { timeout: 3000 });

  await page.keyboard.press('s');
  await page.waitForFunction(() => {
    const menu = document.querySelector('.ytp-popup.ytp-settings-menu');
    return !menu || menu.style.display === 'none' || menu.getClientRects().length === 0;
  }, null, { timeout: 5000 });

  console.log('LIVE E2E OK: S opened a YouTube native speed popup; 2 set 2x; ArrowLeft set 1.95x; S closed popup. Popup text:');
  console.log(text.slice(0, 500));
} finally {
  await browser.close();
}
