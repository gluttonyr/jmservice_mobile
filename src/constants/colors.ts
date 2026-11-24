import { Platform } from 'react-native';

// JM Services « Orbite » palette, in a light theme (default) and a dark theme.
// The theme is chosen once, when the app starts (styles are built from these values at load time):
// changing it in the profile saves the choice and restarts the app (setThemePreference).
// The admin space is always dark (its turquoise screens are drawn for it).
// The historic names (primaryGreen, darkBg…) are kept so every screen switches at once:
// they now mean "action colour", "page background"… whatever their name says.

export type ThemeName = 'light' | 'dark';

const THEME_KEY = 'jm_theme';
const USER_KEY = 'auth_user';

function readStored(key: string): string | null {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-secure-store').getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    else require('expo-secure-store').setItem(key, value);
  } catch {
    // Not saved: the choice lasts until the app is closed.
  }
}

/** Theme the client chose in the profile (light when never chosen). */
export function getThemePreference(): ThemeName {
  return readStored(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

function storedRoleIsAdmin() {
  try {
    const raw = readStored(USER_KEY);
    return !!raw && (JSON.parse(raw) as { role?: string })?.role === 'ADMIN';
  } catch {
    return false;
  }
}

/** Theme of this run of the app. */
export const theme: ThemeName = storedRoleIsAdmin() ? 'dark' : getThemePreference();
export const isLight = theme === 'light';

/** Value for the dark theme, value for the light theme. */
export const pick = <T,>(dark: T, light: T): T => (isLight ? light : dark);

function restartApp() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.replace('/');
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native').DevSettings?.reload?.();
  } catch {
    // Applied at the next start.
  }
}

/** Saves the client's choice and restarts the app with it. */
export function setThemePreference(next: ThemeName) {
  writeStored(THEME_KEY, next);
  if (next !== theme) restartApp();
}

/**
 * Called when the signed-in account changes (sign-in, sign-out): an admin always gets the dark theme,
 * a client the one they chose. Restarts the website when the theme of this run is not the right one.
 */
export function syncThemeWithAccount(role: string | null | undefined) {
  const wanted: ThemeName = role === 'ADMIN' ? 'dark' : getThemePreference();
  if (wanted !== theme && Platform.OS === 'web') setTimeout(restartApp, 0);
}

const dark = {
  // Action (gold): main buttons, selection, active tab.
  primaryGreen: '#FFC233',
  secondaryGreen: '#FF9F1C',
  // Backgrounds
  darkBg: '#060B1E',
  primaryBg: '#060B1E',
  secondaryBg: '#0B1330',
  cardBg: '#111C3F',
  // Text
  white: '#E8EDF7',
  textSecondary: '#8D9AC0',
  border: 'rgba(120,150,230,0.16)',
  // States
  success: '#3DDC97',
  error: '#FF6B6B',
  warning: '#FFB020',
  glowGreen: 'rgba(255,194,51,0.15)',
  glowGreenStrong: 'rgba(255,194,51,0.3)',

  // ── Orbite tokens ──
  gold: '#FFC233',
  goldEnd: '#FF9F1C',
  /** Gold used for text and thin icons (darker in the light theme, readable on white). */
  goldText: '#FFC233',
  onGold: '#1A1405',
  blue: '#2F7BFF',
  blueLight: '#5AA2FF',
  blueDeep: '#1A3FA8',
  /** Field and inner panel background. */
  night: '#060B1E',
  /** Raised surface (secondary buttons, chips, banners). */
  navy: '#0D1838',
  /** Main text and titles. */
  chrome: '#E8EDF7',
  chromeEnd: '#B9C3DA',
  /** Translucent card over the page background. */
  surface: 'rgba(17,28,63,0.9)',
  /** Light veil on a surface (icon squares, separators). */
  veil: 'rgba(255,255,255,0.07)',
  /** Field border. */
  fieldBorder: 'rgba(120,150,230,0.18)',
  /** Dimmed backdrop behind a window. */
  scrim: 'rgba(3,6,16,0.78)',
  admin: '#19D3C5',
  adminEnd: '#0FA89C',
  adminBg: '#06141A',
  adminSurface: '#0A1B21',
  adminCard: '#0E2229',
  adminBorder: 'rgba(120,210,215,0.14)',
  pureWhite: '#FFFFFF',
};

const light: typeof dark = {
  primaryGreen: '#FFC233',
  secondaryGreen: '#FF9F1C',
  darkBg: '#EEF2FA',
  primaryBg: '#EEF2FA',
  secondaryBg: '#E4EAF6',
  cardBg: '#FFFFFF',
  white: '#16215A',
  textSecondary: '#66739A',
  border: 'rgba(40,70,150,0.12)',
  success: '#12A26A',
  error: '#E5484D',
  warning: '#D98A00',
  glowGreen: 'rgba(255,194,51,0.18)',
  glowGreenStrong: 'rgba(255,194,51,0.35)',

  gold: '#FFC233',
  goldEnd: '#FF9F1C',
  goldText: '#C27800',
  onGold: '#1A1405',
  blue: '#2F7BFF',
  blueLight: '#2563EB',
  blueDeep: '#1A3FA8',
  night: '#F4F6FC',
  navy: '#FFFFFF',
  chrome: '#16215A',
  chromeEnd: '#4A5886',
  surface: '#FFFFFF',
  veil: 'rgba(30,60,140,0.06)',
  fieldBorder: 'rgba(40,70,150,0.16)',
  scrim: 'rgba(12,22,52,0.45)',
  admin: '#19D3C5',
  adminEnd: '#0FA89C',
  adminBg: '#06141A',
  adminSurface: '#0A1B21',
  adminCard: '#0E2229',
  adminBorder: 'rgba(120,210,215,0.14)',
  pureWhite: '#FFFFFF',
};

export const Colors = isLight ? light : dark;

/** Soft shadow of cards in the light theme (nothing in the dark theme, where cards have a border). */
export const CardShadow = isLight
  ? { shadowColor: '#1E3C8C', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 }
  : {};

// Gradients used with expo-linear-gradient.
export const Gradients = {
  gold: ['#FFD255', '#FF9F1C'] as const,
  blue: ['#3D8BFF', '#1F5FE0'] as const,
  // Page background: lighter blue glow at the top fading into the night (light: pale blue into white-blue).
  page: isLight ? (['#DDE7FB', '#EAF0FB', '#F2F5FC'] as const) : (['#14307A', '#0A1438', '#060B1E'] as const),
  plaque: ['#2457C8', '#152E7A'] as const,
  admin: ['#0F3B40', '#06141A'] as const,
};

// Transaction status pills (background, text), from the design system board.
export const StatusColors = isLight
  ? ({
    EN_ATTENTE_AUTO: { bg: 'rgba(255,176,32,0.16)', fg: '#B26B00' },
    EN_VERIFICATION: { bg: 'rgba(47,123,255,0.12)', fg: '#1F5FE0' },
    EN_ATTENTE_PREUVE: { bg: 'rgba(255,120,60,0.14)', fg: '#C2551F' },
    EN_ATTENTE_ADMIN: { bg: 'rgba(130,100,240,0.13)', fg: '#6B4FD8' },
    EN_RECLAMATION: { bg: 'rgba(230,80,160,0.12)', fg: '#B8357C' },
    VALIDEE: { bg: 'rgba(18,162,106,0.13)', fg: '#0E8A59' },
    REJETEE: { bg: 'rgba(229,72,77,0.12)', fg: '#C9373C' },
    ANNULEE: { bg: 'rgba(100,115,155,0.13)', fg: '#5B6789' },
  } as const)
  : ({
    EN_ATTENTE_AUTO: { bg: 'rgba(255,194,51,0.14)', fg: '#FFC94D' },
    EN_VERIFICATION: { bg: 'rgba(47,123,255,0.16)', fg: '#6FA8FF' },
    EN_ATTENTE_PREUVE: { bg: 'rgba(255,140,80,0.14)', fg: '#FF9F6B' },
    EN_ATTENTE_ADMIN: { bg: 'rgba(150,120,255,0.16)', fg: '#B49CFF' },
    EN_RECLAMATION: { bg: 'rgba(255,110,190,0.14)', fg: '#FF8FCB' },
    VALIDEE: { bg: 'rgba(61,220,151,0.14)', fg: '#3DDC97' },
    REJETEE: { bg: 'rgba(255,107,107,0.14)', fg: '#FF7B7B' },
    ANNULEE: { bg: 'rgba(141,154,192,0.16)', fg: '#A3AECB' },
  } as const);
