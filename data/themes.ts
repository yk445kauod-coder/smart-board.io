// Board visual themes: background + grid + ink defaults.
import type { BoardTheme } from '../types';

export interface ThemeSpec {
  id: BoardTheme;
  ar: string;
  en: string;
  bg: string;
  grid: string;
  dot?: boolean;
  dark?: boolean;      // dark background → use light chalk ink by default
  ink: string;         // default pen color
  accentInk?: string;  // highlight tint
}

export const THEMES: Record<BoardTheme, ThemeSpec> = {
  white: {
    id: 'white',
    ar: 'أبيض',
    en: 'White',
    bg: '#ffffff',
    grid: '#e1e1e1',
    ink: '#000000',
    accentInk: 'rgba(255,235,59,0.5)',
  },
  chalk: {
    id: 'chalk',
    ar: 'أخضر السبورة',
    en: 'Chalkboard green',
    bg: '#1f5847',
    grid: 'rgba(255,255,255,0.12)',
    dark: true,
    ink: '#ffffff',
    accentInk: 'rgba(255,255,255,0.35)',
  },
  black: {
    id: 'black',
    ar: 'أسود',
    en: 'Black',
    bg: '#1d1d1d',
    grid: 'rgba(255,255,255,0.1)',
    dark: true,
    ink: '#ffffff',
    accentInk: 'rgba(255,255,255,0.35)',
  },
  cream: {
    id: 'cream',
    ar: 'كريمي',
    en: 'Cream',
    bg: '#fdfbf7',
    grid: '#e5e0d6',
    ink: '#111111',
    accentInk: 'rgba(255,235,59,0.5)',
  },
};

export const THEME_LIST = Object.values(THEMES);

export function defaultInk(theme: BoardTheme | undefined): string {
  return theme ? (THEMES[theme]?.ink || '#000000') : '#000000';
}

export function isDarkTheme(theme: BoardTheme | undefined): boolean {
  return !!theme && !!THEMES[theme]?.dark;
}