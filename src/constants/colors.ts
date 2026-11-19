// JM Services « Orbite » palette.
// The historic names (primaryGreen, darkBg…) are kept so every screen switches at once:
// they now mean "action colour", "page background"… whatever their name says.
export const Colors = {
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

  // ── New Orbite tokens ──
  gold: '#FFC233',
  goldEnd: '#FF9F1C',
  onGold: '#1A1405',
  blue: '#2F7BFF',
  blueLight: '#5AA2FF',
  blueDeep: '#1A3FA8',
  night: '#060B1E',
  navy: '#0D1838',
  chrome: '#E8EDF7',
  chromeEnd: '#B9C3DA',
  admin: '#19D3C5',
  adminEnd: '#0FA89C',
  adminBg: '#06141A',
  adminSurface: '#0A1B21',
  adminCard: '#0E2229',
  adminBorder: 'rgba(120,210,215,0.14)',
  pureWhite: '#FFFFFF',
};

// Gradients used with expo-linear-gradient.
export const Gradients = {
  gold: ['#FFD255', '#FF9F1C'] as const,
  blue: ['#3D8BFF', '#1F5FE0'] as const,
  // Page background: lighter blue glow at the top fading into the night.
  page: ['#14307A', '#0A1438', '#060B1E'] as const,
  plaque: ['#2457C8', '#152E7A'] as const,
  admin: ['#0F3B40', '#06141A'] as const,
};

// Transaction status pills (background, text), from the design system board.
export const StatusColors = {
  EN_ATTENTE_AUTO: { bg: 'rgba(255,194,51,0.14)', fg: '#FFC94D' },
  EN_VERIFICATION: { bg: 'rgba(47,123,255,0.16)', fg: '#6FA8FF' },
  EN_ATTENTE_PREUVE: { bg: 'rgba(255,140,80,0.14)', fg: '#FF9F6B' },
  EN_ATTENTE_ADMIN: { bg: 'rgba(150,120,255,0.16)', fg: '#B49CFF' },
  EN_RECLAMATION: { bg: 'rgba(255,110,190,0.14)', fg: '#FF8FCB' },
  VALIDEE: { bg: 'rgba(61,220,151,0.14)', fg: '#3DDC97' },
  REJETEE: { bg: 'rgba(255,107,107,0.14)', fg: '#FF7B7B' },
  ANNULEE: { bg: 'rgba(141,154,192,0.16)', fg: '#A3AECB' },
} as const;
