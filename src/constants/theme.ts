import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#182437',
    background: '#F4EFE8',
    backgroundSoft: '#FBF7F2',
    backgroundElement: '#E8DED0',
    backgroundSelected: '#E5D0BE',
    surface: '#FFFDFC',
    surfaceMuted: '#F2EEE7',
    textSecondary: '#5C677A',
    textMuted: '#8F97A3',
    border: '#DCCEBE',
    accent: '#C96A4A',
    accentSoft: '#F4D8CF',
    success: '#277A6A',
    danger: '#C25850',
    scrim: 'rgba(16, 22, 34, 0.46)',
  },
  dark: {
    text: '#F5EFE7',
    background: '#10151D',
    backgroundSoft: '#171E28',
    backgroundElement: '#1E2935',
    backgroundSelected: '#273545',
    surface: '#18202B',
    surfaceMuted: '#212B38',
    textSecondary: '#C2CBD6',
    textMuted: '#8A97A8',
    border: '#2E3B4F',
    accent: '#F08B63',
    accentSoft: '#4F3128',
    success: '#5FBEAC',
    danger: '#FF9A8F',
    scrim: 'rgba(6, 10, 16, 0.66)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type ThemeMode = keyof typeof Colors;

export function resolveThemeMode(
  scheme: 'light' | 'dark' | 'unspecified' | null | undefined,
): ThemeMode {
  return scheme === 'dark' ? 'dark' : 'light';
}

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
