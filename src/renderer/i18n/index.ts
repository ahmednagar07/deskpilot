/**
 * Lightweight i18n system for DeskPilot
 *
 * Usage:
 *   import { useI18n } from '../i18n';
 *   const { t } = useI18n();
 *   t('nav.dashboard')         // → "Dashboard"
 *   t('organizer.moveFiles', { count: 5 })  // → "Move 5 Files"
 */
import { create } from 'zustand';
import en from './en.json';
import ar from './ar.json';

// ── Supported languages ─────────────────────────────────────
export type Locale = 'en' | 'ar';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

const translations: Record<Locale, Record<string, unknown>> = { en, ar };

// ── Zustand store ───────────────────────────────────────────
interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

function getInitialLocale(): Locale {
  const stored = localStorage.getItem('deskpilot-locale');
  if (stored && stored in translations) return stored as Locale;
  return 'en';
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: getInitialLocale(),
  setLocale: (locale: Locale) => {
    localStorage.setItem('deskpilot-locale', locale);
    // Set dir attribute for RTL languages
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    set({ locale });
  },
}));

// Apply initial direction
const initialLocale = getInitialLocale();
document.documentElement.dir = initialLocale === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = initialLocale;

// ── Translation function ────────────────────────────────────
/**
 * Get a translated string by dot-separated key.
 * Supports variable interpolation: {{varName}}
 * Falls back to English, then to the raw key.
 */
function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const parts = key.split('.');

  // Try current locale first, then English fallback
  let value = getNestedValue(translations[locale], parts);
  if (value === undefined && locale !== 'en') {
    value = getNestedValue(translations.en, parts);
  }
  if (value === undefined) return key;

  let result = String(value);

  // Interpolate variables: {{count}} → actual value
  if (vars) {
    for (const [varName, varValue] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), String(varValue));
    }
  }

  return result;
}

function getNestedValue(obj: Record<string, unknown>, parts: string[]): unknown {
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ── React hook ──────────────────────────────────────────────
export function useI18n() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);

  const t = (key: string, vars?: Record<string, string | number>): string => {
    return translate(locale, key, vars);
  };

  return { t, locale, setLocale };
}
