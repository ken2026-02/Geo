// Phrase policy helpers for the Site Logging module.
//
// This is intentionally UI/module-scoped (not a DB schema contract).
// Keep phrase categories controlled to prevent data chaos and suggestion drift.

export const SITE_LOGGING_PHRASE_BASE_CATEGORIES = [
  'observed_material',
  'interpreted_material',
  'water',
  'recovery',
  'drilling_response',
  'weathering',
  'rock_type',
  'colour',
  'modifier',
  'common_phrase',
  'sentence_pattern',

  // Engine/support categories (used for seeding + learning context).
  'template_family',
  'template_family_primary',
  'interpretation_hint',
] as const;

export type SiteLoggingPhraseBaseCategory = (typeof SITE_LOGGING_PHRASE_BASE_CATEGORIES)[number];

const BASE_CATEGORY_SET = new Set<string>(SITE_LOGGING_PHRASE_BASE_CATEGORIES as unknown as string[]);

export const normalizePhraseText = (text: string): string =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizePhraseTextKey = (text: string): string => normalizePhraseText(text).toLowerCase();

export const normalizePhraseCategory = (raw: string): { base: string; suffix: string | null; normalized: string } => {
  const v = String(raw || '').trim();
  if (!v) return { base: '', suffix: null, normalized: '' };
  const parts = v.split('@').map((p) => p.trim()).filter(Boolean);
  const base = parts[0] ?? '';
  const suffix = parts.length > 1 ? parts.slice(1).join('@') : null;
  return { base, suffix, normalized: suffix ? `${base}@${suffix}` : base };
};

export const isValidPhraseBaseCategory = (cat: string): cat is SiteLoggingPhraseBaseCategory => {
  const base = normalizePhraseCategory(cat).base;
  return Boolean(base) && BASE_CATEGORY_SET.has(base);
};

// Boundary helpers: keep "reference notes" out of field logging sentence suggestions.
// These are heuristics (not a schema contract).
export const isFieldLogSentence = (raw: string): boolean => {
  const s = String(raw || '').trim();
  if (!s) return false;
  const t = s.toLowerCase();
  // Exclude report/calibration/reference notes. These belong in Reference/Evidence, not final log lines.
  if (t.includes('borehole') || t.includes('geophys') || t.includes('geophysics')) return false;
  if (t.includes('velocity') || t.includes('m/s') || t.includes('srt')) return false;
  if (t.includes('reference:') || t.includes('report extract') || t.includes('word report')) return false;
  if (/\bbh\d+\b/.test(t)) return false;
  if (t.includes('tor around') || t.includes('tor =') || t.includes('tor:')) return false;
  return true;
};
