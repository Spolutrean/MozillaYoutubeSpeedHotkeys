import assert from 'node:assert/strict';
import { Builder, By, Key, until } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';

const addonPath = '/home/admin/yt-speed-extension/youtube-speed-hotkeys-1.1.7.zip';
const options = new firefox.Options().setBinary('/opt/firefox-aarch64/firefox');
const service = new firefox.ServiceBuilder('/usr/local/bin/geckodriver');
const driver = await new Builder()
  .forBrowser('firefox')
  .setFirefoxOptions(options)
  .setFirefoxService(service)
  .build();

async function js(script, ...args) {
  return driver.executeScript(script, ...args);
}

async function waitForTruthy(script, timeout = 30000) {
  await driver.wait(async () => Boolean(await js(script)), timeout);
}

try {
  await driver.installAddon(addonPath, true);
  await driver.get('https://www.youtube.com/watch?v=jNQXAC9IVRw');

  try {
    const buttons = await driver.findElements(By.xpath("//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'accept') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'agree') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'reject all')]"));
    if (buttons[0]) await buttons[0].click();
  } catch {}

  await driver.wait(until.elementLocated(By.css('video')), 60000);
  await waitForTruthy('return window.ytshPageBridgeInstalled === true', 15000);

  for (let i = 0; i < 12; i += 1) {
    try {
      const skip = await driver.findElements(By.xpath("//*[self::button or @role='button'][contains(., 'Skip')]"));
      if (skip[0]) await skip[0].click();
    } catch {}
    const isAd = await js("return document.querySelector('#movie_player')?.className.includes('ad-showing') || false");
    if (!isAd) break;
    await driver.sleep(3000);
  }
  await waitForTruthy("return !document.querySelector('#movie_player')?.className.includes('ad-showing')", 60000);

  const player = await driver.findElement(By.css('#movie_player'));
  await player.click();
  await driver.actions().sendKeys('s').perform();

  await waitForTruthy("return /Playback speed|Скорость воспроизведения|Normal|Обычная|1[,.]25|2[,.]0/.test(document.querySelector('.ytp-popup.ytp-settings-menu')?.innerText || '')", 15000);
  const popupText = await js("return document.querySelector('.ytp-popup.ytp-settings-menu')?.innerText || ''");
  assert.match(popupText, /Playback speed|Normal|2/i);

  await driver.actions().sendKeys('2').perform();
  await waitForTruthy("const p=document.querySelector('#movie_player'); const v=document.querySelector('video'); return v?.playbackRate === 2 && (!p?.getPlaybackRate || p.getPlaybackRate() === 2)", 5000);

  await driver.actions().sendKeys(Key.ARROW_LEFT).perform();
  await waitForTruthy("const p=document.querySelector('#movie_player'); const v=document.querySelector('video'); const vr=v?.playbackRate || 0; const pr=p?.getPlaybackRate?.(); return Math.abs(vr - 1.95) < 0.001 && (pr === undefined || Math.abs(pr - 1.95) < 0.001)", 5000);

  await driver.actions().sendKeys('s').perform();
  await waitForTruthy("const menu=document.querySelector('.ytp-popup.ytp-settings-menu'); return !menu || menu.style.display === 'none' || menu.getClientRects().length === 0", 5000);

  const result = await js("const p=document.querySelector('#movie_player'); const v=document.querySelector('video'); return {videoRate:v?.playbackRate, playerRate:p?.getPlaybackRate?.(), menuVisible:Boolean(document.querySelector('.ytp-popup.ytp-settings-menu') && document.querySelector('.ytp-popup.ytp-settings-menu').style.display !== 'none')}");
  console.log('FIREFOX E2E OK:', JSON.stringify(result));
} finally {
  await driver.quit();
}
