import type { LoggingStyle } from '../utils/loggingStyle';

const KEYS = {
  author: 'geo_author',
  autoBackup: 'geofield_auto_backup',
  loggingStyle: 'geofield_pref_style',
  loggingQualifiers: 'geofield_pref_qualifiers',
} as const;

const readString = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeString = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Failed to save preference: ${key}`, error);
  }
};

export const getFieldAuthor = (): string => readString(KEYS.author) || 'User';

export const isAutoBackupEnabled = (): boolean => readString(KEYS.autoBackup) === 'true';

export const setAutoBackupEnabledPreference = (enabled: boolean) => {
  writeString(KEYS.autoBackup, String(enabled));
};

export const getLoggingStylePreference = (): LoggingStyle => {
  const value = readString(KEYS.loggingStyle);
  return value === 'SHORT' || value === 'FULL' ? value : 'FULL';
};

export const setLoggingStylePreference = (style: LoggingStyle) => {
  writeString(KEYS.loggingStyle, style);
};

export const getLoggingQualifiersPreference = (): string[] => {
  const raw = readString(KEYS.loggingQualifiers);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export const setLoggingQualifiersPreference = (qualifiers: string[]) => {
  writeString(KEYS.loggingQualifiers, JSON.stringify(qualifiers));
};

