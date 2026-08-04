import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_UI_PREFERENCES, parseUiPreferences } from './settings.ts';

test('settings parser preserves supported operational preferences', () => {
  assert.deepEqual(parseUiPreferences({
    accentColor: 'cyan',
    glassBlur: 'max',
    enableConfetti: true,
    reducedMotion: true,
    interfaceDensity: 'compact',
    startupPage: 'inbox',
    autoPull: false,
    syncIntervalMinutes: 15,
  }), {
    accentColor: 'cyan',
    glassBlur: 'max',
    enableConfetti: true,
    reducedMotion: true,
    interfaceDensity: 'compact',
    startupPage: 'inbox',
    autoPull: false,
    syncIntervalMinutes: 15,
  });
});

test('settings parser rejects unsupported values without carrying unknown fields', () => {
  assert.deepEqual(parseUiPreferences({
    accentColor: 'pink',
    glassBlur: 'none',
    startupPage: 'admin',
    syncIntervalMinutes: 2,
    secretKey: 'must-not-survive',
  }), DEFAULT_UI_PREFERENCES);
});
