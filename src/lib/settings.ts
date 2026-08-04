import type { NavTab } from '@/types';

export type AccentColor = 'emerald' | 'cyan' | 'amber';
export type GlassBlur = 'standard' | 'ultra' | 'max';
export type InterfaceDensity = 'comfortable' | 'compact';
export type SyncIntervalMinutes = 1 | 5 | 15 | 30;

export interface UiPreferences {
  accentColor: AccentColor;
  glassBlur: GlassBlur;
  enableConfetti: boolean;
  reducedMotion: boolean;
  interfaceDensity: InterfaceDensity;
  startupPage: NavTab;
  autoPull: boolean;
  syncIntervalMinutes: SyncIntervalMinutes;
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  accentColor: 'emerald',
  glassBlur: 'ultra',
  enableConfetti: false,
  reducedMotion: false,
  interfaceDensity: 'comfortable',
  startupPage: 'dashboard',
  autoPull: true,
  syncIntervalMinutes: 1,
};

const NAV_TABS: NavTab[] = ['dashboard', 'inbox', 'work', 'projects', 'assets', 'knowledge', 'reports', 'settings'];

export function parseUiPreferences(value: unknown): UiPreferences {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const accentColor = ['emerald', 'cyan', 'amber'].includes(String(source.accentColor))
    ? source.accentColor as AccentColor
    : DEFAULT_UI_PREFERENCES.accentColor;
  const glassBlur = ['standard', 'ultra', 'max'].includes(String(source.glassBlur))
    ? source.glassBlur as GlassBlur
    : DEFAULT_UI_PREFERENCES.glassBlur;
  const interfaceDensity = ['comfortable', 'compact'].includes(String(source.interfaceDensity))
    ? source.interfaceDensity as InterfaceDensity
    : DEFAULT_UI_PREFERENCES.interfaceDensity;
  const startupPage = NAV_TABS.includes(source.startupPage as NavTab)
    ? source.startupPage as NavTab
    : DEFAULT_UI_PREFERENCES.startupPage;
  const syncIntervalMinutes = [1, 5, 15, 30].includes(Number(source.syncIntervalMinutes))
    ? Number(source.syncIntervalMinutes) as SyncIntervalMinutes
    : DEFAULT_UI_PREFERENCES.syncIntervalMinutes;

  return {
    accentColor,
    glassBlur,
    enableConfetti: typeof source.enableConfetti === 'boolean' ? source.enableConfetti : DEFAULT_UI_PREFERENCES.enableConfetti,
    reducedMotion: typeof source.reducedMotion === 'boolean' ? source.reducedMotion : DEFAULT_UI_PREFERENCES.reducedMotion,
    interfaceDensity,
    startupPage,
    autoPull: typeof source.autoPull === 'boolean' ? source.autoPull : DEFAULT_UI_PREFERENCES.autoPull,
    syncIntervalMinutes,
  };
}
