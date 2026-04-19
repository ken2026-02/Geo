import { DRAFT_KEYS, clearFormDraft, loadFormDraft, saveFormDraft } from './formDrafts';

export const structuralAssessmentStore = {
  saveDraft: (data: any) => {
    saveFormDraft(DRAFT_KEYS.structuralAssessment, data);
  },
  loadDraft: () => {
    return loadFormDraft(DRAFT_KEYS.structuralAssessment);
  },
  clearDraft: () => {
    clearFormDraft(DRAFT_KEYS.structuralAssessment);
  }
};
