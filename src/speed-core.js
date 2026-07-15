export const MIN_SPEED = 0.25;
export const MAX_SPEED = 3;
export const STEP = 0.05;

export function clampSpeed(speed) {
  const numeric = Number(speed);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, roundSpeed(numeric)));
}

export function roundSpeed(speed) {
  return Math.round(Number(speed) * 100) / 100;
}

export function formatSpeed(speed) {
  const rounded = clampSpeed(speed);
  return `${Number(rounded.toFixed(2))}x`;
}

export function decreaseSpeed(speed) {
  return clampSpeed(Number(speed) - STEP);
}

export function increaseSpeed(speed) {
  return clampSpeed(Number(speed) + STEP);
}

export function speedFromDigit(key) {
  if (key === '1') return 1;
  if (key === '2') return 2;
  if (key === '3') return 3;
  return null;
}

export function shouldIgnoreKeyEvent(event) {
  if (!event || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
    return true;
  }

  const target = event.target;
  if (!target) return false;

  const tagName = String(target.tagName || '').toUpperCase();
  return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

export function shouldCloseOverlayAfterFullscreenChange(overlayOpen, fullscreenElement) {
  return Boolean(overlayOpen && !fullscreenElement);
}

export function shouldRestoreFullscreenForOverlayEscape(overlayOpen, key, fullscreenElement) {
  return Boolean(overlayOpen && (key === 'Escape' || key === 'Esc') && fullscreenElement);
}
