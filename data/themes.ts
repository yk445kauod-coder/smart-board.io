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
    ar: 'السبورة البيضاء النقية',
    en: 'Pure White Board',
    bg: '#F8FAFC',
    grid: '#CBD5E1',
    dot: true,
    ink: '#080D1E',
    accentInk: 'rgba(0, 229, 255, 0.5)',
  },
  chalk: {
    id: 'chalk',
    ar: 'سبورة الطباشير الكلاسيكية',
    en: 'Classic Chalkboard',
    bg: '#14382A',
    grid: '#1E4D3A',
    dot: true,
    dark: true,
    ink: '#ffffff',
    accentInk: 'rgba(245, 158, 11, 0.5)',
  },
  black: {
    id: 'black',
    ar: 'السبورة الفضائية الداكنة',
    en: 'Cosmic Dark Board',
    bg: '#080D1E',
    grid: '#1E293B',
    dot: true,
    dark: true,
    ink: '#00E5FF',
    accentInk: 'rgba(245, 158, 11, 0.5)',
  },
  cream: {
    id: 'cream',
    ar: 'كريمي هادئ',
    en: 'Cream Board',
    bg: '#fdfbf7',
    grid: '#e5e0d6',
    dot: true,
    ink: '#111111',
    accentInk: 'rgba(0, 229, 255, 0.5)',
  },
};

export const THEME_LIST = Object.values(THEMES);

export function defaultInk(theme: BoardTheme | undefined): string {
  return theme ? (THEMES[theme]?.ink || '#000000') : '#000000';
}

export function isDarkTheme(theme: BoardTheme | undefined): boolean {
  return !!theme && !!THEMES[theme]?.dark;
}