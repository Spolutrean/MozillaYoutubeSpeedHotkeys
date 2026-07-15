import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const pageHtml = `<!doctype html>
<html>
<head><title>YouTube fixture</title></head>
<body>
  <div id="movie_player" class="html5-video-player" style="width: 900px; height: 500px; background: #111; position: relative;">
    <video width="640" height="360" src="data:video/mp4;base64," style="width: 640px; height: 360px;"></video>
    <button class="ytp-settings-button" aria-label="Settings" style="position:absolute; right:10px; bottom:10px;">⚙</button>
  </div>
  <script>
    const settings = document.querySelector('.ytp-settings-button');
    const video = document.querySelector('video');
    Object.defineProperty(video, 'readyState', { value: 4 });
    function openSettingsMenu() {
      let popup = document.querySelector('.ytp-popup.ytp-settings-menu');
      if (popup) popup.remove();
      popup = document.createElement('div');
      popup.className = 'ytp-popup ytp-settings-menu';
      popup.style.position = 'absolute';
      popup.style.right = '20px';
      popup.style.bottom = '55px';
      popup.style.background = '#222';
      popup.style.color = 'white';
      popup.innerHTML = '<div class="ytp-menuitem">Quality</div><div class="ytp-menuitem">Playback speed</div>';
      document.body.append(popup);
      popup.querySelectorAll('.ytp-menuitem')[1].addEventListener('click', () => {
        popup.innerHTML = '<div class="ytp-menuitem">0.25</div><div class="ytp-menuitem">0.5</div><div class="ytp-menuitem">Normal</div><div class="ytp-menuitem">1.25</div><div class="ytp-menuitem">1.5</div><div class="ytp-menuitem">2</div>';
      });
    }
    settings.addEventListener('click', openSettingsMenu);
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        video.dataset.seekCount = String(Number(video.dataset.seekCount || '0') + 1);
      }
    });
    document.querySelector('#movie_player').openSettingsMenuItem = () => {
      openSettingsMenu();
      document.querySelector('.ytp-popup.ytp-settings-menu .ytp-menuitem:nth-child(2)')?.click();
    };
  </script>
</body>
</html>`;

const server = createServer({
  key: readFileSync(new URL('./certs/key.pem', import.meta.url)),
  cert: readFileSync(new URL('./certs/cert.pem', import.meta.url)),
}, (req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(pageHtml);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = server.address().port;

const extensionPath = new URL('..', import.meta.url).pathname;
const userDataDir = `/tmp/yt-speed-extension-e2e-${Date.now()}`;
const browser = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  executablePath: '/usr/bin/chromium-browser',
  ignoreHTTPSErrors: true,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--host-resolver-rules=MAP www.youtube.com 127.0.0.1',
    '--no-sandbox',
  ],
});

try {
  const page = await browser.newPage();
  await page.goto(`https://www.youtube.com:${port}/watch?v=test`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ytp-settings-button');
  await page.waitForFunction(() => window.ytshPageBridgeInstalled === true, null, { timeout: 5000 });

  await page.keyboard.press('s');
  const opened = await page.waitForFunction(() => /Playback speed|Normal|1[,.]25|2/.test(document.querySelector('.ytp-popup.ytp-settings-menu')?.innerText || ''), null, { timeout: 3000 }).then(() => true).catch(() => false);
  if (!opened) {
    console.log('debug after S', await page.evaluate(() => ({
      bridge: window.ytshPageBridgeInstalled,
      ds: document.documentElement.dataset.ytshBridgeInstalled,
      html: document.querySelector('.ytp-popup.ytp-settings-menu')?.outerHTML,
      text: document.querySelector('.ytp-popup.ytp-settings-menu')?.innerText,
      videoReady: document.querySelector('video')?.readyState,
      scripts: [...document.scripts].map((s) => s.src).filter(Boolean),
    })));
  }
  assert.equal(opened, true);

  const menuText = await page.locator('.ytp-popup.ytp-settings-menu').innerText();
  assert.match(menuText, /Playback speed|Normal|1[,.]25|2/);

  await page.keyboard.press('2');
  const rate2 = await page.$eval('video', (video) => video.playbackRate);
  assert.equal(rate2, 2);

  await page.keyboard.press('ArrowLeft');
  const rateLeft = await page.$eval('video', (video) => video.playbackRate);
  assert.equal(rateLeft, 1.95);

  await page.keyboard.press('s');
  await page.waitForFunction(() => {
    const menu = document.querySelector('.ytp-popup.ytp-settings-menu');
    return !menu || menu.style.display === 'none' || menu.getClientRects().length === 0;
  }, null, { timeout: 3000 });

  await page.keyboard.press('ArrowRight');
  const seekCount = await page.$eval('video', (video) => Number(video.dataset.seekCount || '0'));
  assert.equal(seekCount, 1, 'ArrowRight should reach YouTube/video seek handler after the speed menu is closed');
  const rateAfterClosedArrow = await page.$eval('video', (video) => video.playbackRate);
  assert.equal(rateAfterClosedArrow, 1.95, 'ArrowRight outside the speed menu must not change playback speed');

  console.log('E2E OK: S opened native speed menu; 2 and ArrowLeft updated playbackRate; S closed menu; arrows seek after close.');
} finally {
  await browser.close();
  server.close();
}
