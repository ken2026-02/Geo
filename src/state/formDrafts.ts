import { draftStore } from '../utils/draftStore';

export const DRAFT_KEYS = {
  structuralAssessment: 'structural_assessment',
  quickLog: 'draft_quick_log',
  mapping: 'draft_mapping',
  investigationLog: 'draft_investigation_log',
  slopeAssessment: 'slope_assessment',
  rockClassification: 'draft_rock_classification',
  rockMassRating: 'rmr_assessment',
  gsiAssessment: 'gsi_assessment',
  supportDesign: 'support_design',
  bearingCapacity: 'bearing_capacity_calculator',
  earthPressure: 'earth_pressure_calculator',
  retainingWallCheck: 'retaining_wall_check',
  settlementScreening: 'settlement_screening_calculator',
  soilSlopeStability: 'soil_slope_stability',
} as const;

export type DraftKey = (typeof DRAFT_KEYS)[keyof typeof DRAFT_KEYS];

export const loadFormDraft = (key: DraftKey): any => draftStore.loadDraft(key);

export const saveFormDraft = (key: DraftKey, data: unknown) => {
  draftStore.saveDraft(key, data);
};

export const clearFormDraft = (key: DraftKey) => {
  draftStore.clearDraft(key);
};

export const hasFormDraft = (key: DraftKey): boolean => Boolean(loadFormDraft(key));

