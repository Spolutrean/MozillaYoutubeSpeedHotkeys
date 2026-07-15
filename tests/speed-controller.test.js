import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampSpeed,
  formatSpeed,
  decreaseSpeed,
  increaseSpeed,
  speedFromDigit,
  shouldIgnoreKeyEvent,
} from '../src/speed-core.js';

test('formats speed values like YouTube speed chips', () => {
  assert.equal(formatSpeed(1), '1x');
  assert.equal(formatSpeed(1.05), '1.05x');
  assert.equal(formatSpeed(1.5), '1.5x');
  assert.equal(formatSpeed(3), '3x');
});

test('clamps playback speed to supported 0.25x..3x range', () => {
  assert.equal(clampSpeed(0.1), 0.25);
  assert.equal(clampSpeed(0.25), 0.25);
  assert.equal(clampSpeed(2.95), 2.95);
  assert.equal(clampSpeed(9), 3);
});

test('left and right arrows adjust speed by fine 0.05x steps', () => {
  assert.equal(decreaseSpeed(1), 0.95);
  assert.equal(increaseSpeed(1), 1.05);
  assert.equal(decreaseSpeed(0.25), 0.25);
  assert.equal(increaseSpeed(3), 3);
});

test('digit shortcuts set exact speeds 1x, 2x, and 3x', () => {
  assert.equal(speedFromDigit('1'), 1);
  assert.equal(speedFromDigit('2'), 2);
  assert.equal(speedFromDigit('3'), 3);
  assert.equal(speedFromDigit('4'), null);
});

test('hotkeys are ignored while typing in editable controls', () => {
  assert.equal(shouldIgnoreKeyEvent({ target: { tagName: 'INPUT' } }), true);
  assert.equal(shouldIgnoreKeyEvent({ target: { tagName: 'TEXTAREA' } }), true);
  assert.equal(shouldIgnoreKeyEvent({ target: { tagName: 'DIV', isContentEditable: true } }), true);
  assert.equal(shouldIgnoreKeyEvent({ target: { tagName: 'DIV', isContentEditable: false } }), false);
});
