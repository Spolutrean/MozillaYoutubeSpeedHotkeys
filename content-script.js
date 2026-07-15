(() => {
  'use strict';

  const MIN_SPEED = 0.25;
  const MAX_SPEED = 3;
  const STEP = 0.05;
  const STORAGE_KEY = 'yt-speed-hotkeys:last-speed';
  const SPEED_MENU_LABELS = [
    'Playback speed',
    'Speed',
    'Скорость воспроизведения',
    'Скорость',
    'Afspeelsnelheid',
    'Snelheid',
    'Wiedergabegeschwindigkeit',
    'Velocidad de reproducción',
    'Vitesse de lecture',
  ];

  let nativeSpeedMenuOpen = false;
  let currentVideo = null;

  function installPageBridge() {
    if (!document.documentElement) {
      document.addEventListener('DOMContentLoaded', installPageBridge, { once: true });
      return;
    }
    if (document.documentElement.dataset.ytshBridgeInstalled) return;
    document.documentElement.dataset.ytshBridgeInstalled = 'true';
    const script = document.createElement('script');
    const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;
    if (!runtime?.getURL) return;
    script.src = runtime.getURL('page-bridge.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).append(script);
  }

  const roundSpeed = (speed) => Math.round(Number(speed) * 100) / 100;
  const clampSpeed = (speed) => {
    const numeric = Number(speed);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, roundSpeed(numeric)));
  };
  const decreaseSpeed = (speed) => clampSpeed(Number(speed) - STEP);
  const increaseSpeed = (speed) => clampSpeed(Number(speed) + STEP);
  const speedFromDigit = (key) => (key === '1' ? 1 : key === '2' ? 2 : key === '3' ? 3 : null);
  const shouldIgnoreKeyEvent = (event) => {
    if (!event || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return true;
    const target = event.target;
    if (!target) return false;
    const tagName = String(target.tagName || '').toUpperCase();
    return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
  };

  function getPlayer() {
    return document.querySelector('.html5-video-player') || document.querySelector('#movie_player');
  }

  function getVideo() {
    const videos = [...document.querySelectorAll('video')];
    return videos.find((video) => video.readyState >= 1) || videos[0] || null;
  }

  function readStoredSpeed() {
    try {
      return clampSpeed(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return 1;
    }
  }

  function storeSpeed(speed) {
    try {
      localStorage.setItem(STORAGE_KEY, String(clampSpeed(speed)));
    } catch (_) {
      // Ignore private-storage failures.
    }
  }

  function currentSpeed() {
    const playerRate = getPlayer()?.getPlaybackRate?.();
    if (Number.isFinite(Number(playerRate))) return clampSpeed(playerRate);
    const video = getVideo();
    return clampSpeed(video?.playbackRate || readStoredSpeed() || 1);
  }

  function setVideoSpeed(speed) {
    const nextSpeed = clampSpeed(speed);
    const video = getVideo();
    if (video) {
      video.playbackRate = nextSpeed;
      currentVideo = video;
    }
    storeSpeed(nextSpeed);
    markNativeSpeedOption(nextSpeed);
    return nextSpeed;
  }

  function wakePlayerControls() {
    const player = getPlayer();
    if (!player) return;
    const rect = player.getBoundingClientRect();
    player.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }));
  }

  function settingsMenuVisible() {
    const menu = document.querySelector('.ytp-popup.ytp-settings-menu');
    return Boolean(menu && menu.style.display !== 'none' && menu.getClientRects().length > 0);
  }

  function speedSubmenuVisible() {
    if (!settingsMenuVisible()) return false;
    const menu = document.querySelector('.ytp-popup.ytp-settings-menu');
    if (!menu) return false;
    const text = menu.textContent.replace(/\s+/g, ' ').trim();
    const title = menu.querySelector('.ytp-panel-title')?.textContent?.trim() || '';
    if (SPEED_MENU_LABELS.some((label) => title.includes(label) || text.includes(label))) return true;
    return [...menu.querySelectorAll('.ytp-menuitem')].some((item) => /^(0\.25|0\.5|0\.75|Normal|Обычная|1|1[,.]25|1[,.]5|1[,.]75|2)/.test(item.textContent.trim()));
  }

  function clickSettingsButton() {
    const button = document.querySelector('.ytp-settings-button');
    if (!button) return false;
    button.click();
    return true;
  }

  function findPlaybackSpeedMenuItem() {
    const menu = document.querySelector('.ytp-popup.ytp-settings-menu');
    if (!menu) return null;
    const items = [...menu.querySelectorAll('.ytp-menuitem')];
    return items.find((item) => {
      const text = item.textContent.replace(/\s+/g, ' ').trim();
      return SPEED_MENU_LABELS.some((label) => text.includes(label));
    }) || null;
  }

  function toggleNativeSpeedMenu() {
    wakePlayerControls();
    const wasVisible = settingsMenuVisible();
    window.dispatchEvent(new CustomEvent('ytsh-toggle-native-speed-menu'));
    if (wasVisible) {
      const menu = document.querySelector('.ytp-popup.ytp-settings-menu');
      if (menu) menu.style.display = 'none';
      nativeSpeedMenuOpen = false;
      return true;
    }
    setTimeout(() => {
      nativeSpeedMenuOpen = speedSubmenuVisible() || Boolean(findPlaybackSpeedMenuItem());
      markNativeSpeedOption(currentSpeed());
    }, 250);
    return true;
  }

  function markNativeSpeedOption(speed) {
    const menu = document.querySelector('.ytp-popup.ytp-settings-menu');
    if (!menu) return;
    const formatted = speed === 1 ? 'Normal' : String(Number(speed.toFixed(2)));
    for (const item of menu.querySelectorAll('.ytp-menuitem')) {
      const text = item.textContent.replace(/\s+/g, ' ').trim();
      const selected = text === formatted || text.startsWith(`${formatted} `);
      item.setAttribute('aria-checked', selected ? 'true' : 'false');
      item.classList.toggle('ytsh-selected-speed', selected);
    }
  }

  function handleKeydown(event) {
    if (shouldIgnoreKeyEvent(event)) return;

    if (event.key?.toLowerCase() === 's') {
      const video = getVideo();
      if (!video) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleNativeSpeedMenu();
      return;
    }

    // Only steal numeric/arrow keys while the native speed menu is visibly open.
    // Otherwise YouTube must keep its normal ←/→ seek behavior.
    if (!speedSubmenuVisible()) return;

    const digitSpeed = speedFromDigit(event.key);
    if (digitSpeed !== null || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.postMessage({ type: 'ytsh-speed-key', key: event.key }, '*');
    }
  }

  function attachVideoRateSync() {
    const video = getVideo();
    if (!video || video === currentVideo) return;
    currentVideo = video;
  }

  document.addEventListener('click', () => {
    setTimeout(() => {
      nativeSpeedMenuOpen = speedSubmenuVisible();
    }, 0);
  }, true);

  window.addEventListener('keydown', handleKeydown, true);
  installPageBridge();
  setInterval(attachVideoRateSync, 1000);
  attachVideoRateSync();
})();
