(() => {
  'use strict';

  window.ytshPageBridgeInstalled = true;

  const MIN_SPEED = 0.25;
  const MAX_SPEED = 3;
  const STEP = 0.05;
  let speedMenuHotkeysUntil = 0;

  const roundSpeed = (speed) => Math.round(Number(speed) * 100) / 100;
  const clampSpeed = (speed) => {
    const numeric = Number(speed);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, roundSpeed(numeric)));
  };
  const decreaseSpeed = (speed) => clampSpeed(Number(speed) - STEP);
  const increaseSpeed = (speed) => clampSpeed(Number(speed) + STEP);
  const speedFromDigit = (key) => (key === '1' ? 1 : key === '2' ? 2 : key === '3' ? 3 : null);

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

  function getVideo() {
    const videos = [...document.querySelectorAll('video')];
    return videos.find((video) => video.readyState >= 1) || videos[0] || null;
  }

  function currentSpeed() {
    const playerRate = getPlayer()?.getPlaybackRate?.();
    if (Number.isFinite(Number(playerRate))) return clampSpeed(playerRate);
    return clampSpeed(getVideo()?.playbackRate || 1);
  }

  function setVideoSpeed(speed) {
    const nextSpeed = clampSpeed(speed);
    const player = getPlayer();
    const video = getVideo();

    // Prefer YouTube's player API. Directly assigning video.playbackRate can be
    // overwritten by YouTube's player state on some layouts/locales.
    if (player?.setPlaybackRate) {
      try {
        player.setPlaybackRate(nextSpeed);
      } catch (_) {
        // Fall back to the media element below.
      }
    }

    if (video) video.playbackRate = nextSpeed;
    markNativeSpeedOption(nextSpeed);
    return nextSpeed;
  }

  function shouldIgnoreKeyEvent(event) {
    if (!event || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return true;
    const target = event.target;
    if (!target) return false;
    const tagName = String(target.tagName || '').toUpperCase();
    return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
  }

  function getPlayer() {
    return document.querySelector('.html5-video-player') || document.querySelector('#movie_player');
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
      const aria = item.getAttribute('aria-label') || '';
      return SPEED_MENU_LABELS.some((label) => text.includes(label) || aria.includes(label));
    }) || null;
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

  function openPlayerSettingsMenu() {
    const player = getPlayer();
    if (player?.openSettingsMenuItem) {
      try {
        player.openSettingsMenuItem('playbackRate');
        return true;
      } catch (_) {
        try {
          player.openSettingsMenuItem('speed');
          return true;
        } catch (_) {
          // Fall through.
        }
      }
    }
    return clickSettingsButton();
  }

  function enterPlaybackSpeedSubmenu() {
    if (speedSubmenuVisible()) {
      speedMenuHotkeysUntil = Date.now() + 10000;
      return true;
    }
    const playbackSpeedItem = findPlaybackSpeedMenuItem();
    if (!playbackSpeedItem) return false;
    playbackSpeedItem.click();
    speedMenuHotkeysUntil = Date.now() + 10000;
    return true;
  }

  function speedMenuHotkeysActive() {
    return speedSubmenuVisible() || (settingsMenuVisible() && Date.now() < speedMenuHotkeysUntil);
  }

  function applySpeedKey(key) {
    const digitSpeed = speedFromDigit(key);
    if (digitSpeed !== null) {
      speedMenuHotkeysUntil = Date.now() + 10000;
      setVideoSpeed(digitSpeed);
      return true;
    }

    if (key === 'ArrowLeft') {
      speedMenuHotkeysUntil = Date.now() + 10000;
      setVideoSpeed(decreaseSpeed(currentSpeed()));
      return true;
    }

    if (key === 'ArrowRight') {
      speedMenuHotkeysUntil = Date.now() + 10000;
      setVideoSpeed(increaseSpeed(currentSpeed()));
      return true;
    }

    return false;
  }

  function handleBridgeKeydown(event) {
    if (shouldIgnoreKeyEvent(event)) return;

    if (event.key?.toLowerCase() === 's' && settingsMenuVisible()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeYoutubeSpeedMenu();
      return;
    }

    // Do not intercept ←/→ unless the speed menu is actually visible; outside
    // that menu, YouTube should seek normally.
    if (!speedSubmenuVisible()) return;

    if (!applySpeedKey(event.key)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function openYoutubeSpeedMenu() {
    if (!settingsMenuVisible() && !openPlayerSettingsMenu()) return;
    setTimeout(enterPlaybackSpeedSubmenu, 0);
    setTimeout(enterPlaybackSpeedSubmenu, 80);
    setTimeout(enterPlaybackSpeedSubmenu, 200);
    speedMenuHotkeysUntil = Date.now() + 10000;
  }

  function closeYoutubeSpeedMenu() {
    speedMenuHotkeysUntil = 0;
    const menu = document.querySelector('.ytp-popup.ytp-settings-menu');
    if (!menu || menu.style.display === 'none') return true;

    const settingsButton = document.querySelector('.ytp-settings-button');
    if (settingsButton) {
      settingsButton.click();
      setTimeout(() => {
        const maybeStillOpen = document.querySelector('.ytp-popup.ytp-settings-menu');
        if (maybeStillOpen && maybeStillOpen.style.display !== 'none') {
          maybeStillOpen.style.display = 'none';
        }
      }, 80);
      return true;
    }

    menu.style.display = 'none';
    return true;
  }

  function toggleYoutubeSpeedMenu() {
    if (settingsMenuVisible()) closeYoutubeSpeedMenu();
    else openYoutubeSpeedMenu();
  }

  window.addEventListener('keydown', handleBridgeKeydown, true);

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'ytsh-toggle-native-speed-menu') {
      toggleYoutubeSpeedMenu();
      return;
    }
    if (event.data?.type === 'ytsh-open-native-speed-menu') {
      openYoutubeSpeedMenu();
      return;
    }
    if (event.data?.type === 'ytsh-speed-key') {
      speedMenuHotkeysUntil = Date.now() + 10000;
      applySpeedKey(event.data.key);
    }
  });

  window.addEventListener('ytsh-toggle-native-speed-menu', toggleYoutubeSpeedMenu);
  window.addEventListener('ytsh-open-native-speed-menu', openYoutubeSpeedMenu);
})();
