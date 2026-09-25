import '@/global.css';

import { useColorScheme } from 'react-native';

// Clean, minimal palette: warm paper neutrals with a single deep-green accent.
export const Colors = {
  light: {
    background: '#FAF8F5',
    surface: '#FFFFFF',
    border: '#E8E4DE',
    text: '#1C1B19',
    textSecondary: '#6B6760',
    accent: '#2F5D50',
    accentText: '#FFFFFF',
    accentSoft: '#E4EDE9',
    warn: '#9A6700',
    warnSoft: '#FBF1DC',
    danger: '#B42318',
    dangerSoft: '#FDECEA',
  },
  dark: {
    background: '#121211',
    surface: '#1C1C1A',
    border: '#2E2D2A',
    text: '#F3F1EC',
    textSecondary: '#A8A49C',
    accent: '#8CC2AE',
    accentText: '#0F1F1A',
    accentSoft: '#1E2E28',
    warn: '#E3B341',
    warnSoft: '#2E2715',
    danger: '#F97066',
    dangerSoft: '#3A1D1A',
  },
} as const;

export type Palette = { [K in keyof typeof Colors.light]: string };

export function useTheme(): Palette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
}

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const Radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const Type = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '600' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.2 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
};
