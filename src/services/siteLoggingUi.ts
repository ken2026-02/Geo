// UI-only helpers for the Site Logging module.
//
// SINGLE SOURCE OF TRUTH:
// This file defines the canonical UI mapping for element types, statuses, continue rules,
// and photo type constants. Do not duplicate these mappings elsewhere.

export const PHOTO_TYPE_REFERENCE_DIAGRAM = 'reference_diagram' as const;

export const normalizeElementType = (t: string): string => {
  const v = (t || '').trim();
  const map: Record<string, string> = {
    Anchor: 'anchor',
    SoilNail: 'soil_nail',
    MicroPile: 'micro_pile',
    Pile: 'micro_pile', // legacy labels
    PermanentCasing: 'micro_pile', // legacy labels
    // Legacy record types: keep compatibility but do not expose as top-level field types.
    SuitabilityTest: 'anchor',
    TrialHole: 'anchor',
    Other: 'anchor',
  };
  return map[v] ?? v.toLowerCase();
};

export const formatTypeLabel = (t: string) => {
  const v = normalizeElementType(t);
  if (['micro_pile', 'pile', 'permanent_casing'].includes(v)) return 'Pile';
  if (['anchor', 'soil_nail', 'suitability_test', 'trial_hole'].includes(v)) return 'Anchor / Soil Nail';
  return 'Anchor / Soil Nail';
};

export const formatElementTypeShortLabel = (t: string) => {
  const v = normalizeElementType(t);
  if (['micro_pile', 'pile', 'permanent_casing'].includes(v)) return 'Pile';
  if (v === 'soil_nail') return 'Soil nail';
  return 'Anchor';
};

export const coerceElementTypeToFieldType = (t: string): 'anchor' | 'soil_nail' | 'micro_pile' => {
  const v = normalizeElementType(t);
  if (['micro_pile', 'pile', 'permanent_casing'].includes(v)) return 'micro_pile';
  if (v === 'soil_nail') return 'soil_nail';
  return 'anchor';
};

export const normalizeStatus = (s: string): string => {
  const v = (s || '').trim();
  const map: Record<string, string> = {
    // Legacy UI labels
    Draft: 'draft',
    InProgress: 'in_progress',
    Completed: 'finalised',
    Hold: 'review',
    Rejected: 'review',

    // Legacy detailed statuses (keep compatibility but simplify for field UI)
    logging_in_progress: 'in_progress',
    interpretation_pending: 'review',
    verification_pending: 'review',
    review_pending: 'review',
    approved_for_grouting: 'review',
  };
  const lower = v.toLowerCase();
  return map[v] ?? map[lower] ?? lower;
};

export const formatStatusLabel = (s: string) => {
  const v = normalizeStatus(s);
  const map: Record<string, string> = {
    draft: 'Draft',
    in_progress: 'In progress',
    review: 'Review',
    finalised: 'Finalised',
  };
  return map[v] ?? s;
};

export const coerceStatusToFieldStatus = (s: string): 'draft' | 'in_progress' | 'review' | 'finalised' => {
  const v = normalizeStatus(s);
  if (v === 'draft') return 'draft';
  if (v === 'in_progress') return 'in_progress';
  if (v === 'review') return 'review';
  if (v === 'finalised') return 'finalised';
  // Default to draft for unknown legacy values in field UI.
  return 'draft';
};

export const canContinueStatus = (s: string) => {
  const v = normalizeStatus(s);
  return v === 'in_progress' || v === 'draft';
};
