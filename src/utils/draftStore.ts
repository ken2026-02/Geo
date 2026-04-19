export const draftStore = {
  saveDraft: (key: string, data: any) => {
    try {
      localStorage.setItem(`draft_${key}`, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save draft', e);
    }
  },
  loadDraft: (key: string) => {
    try {
      const draft = localStorage.getItem(`draft_${key}`);
      return draft ? JSON.parse(draft) : null;
    } catch (e) {
      console.error('Failed to load draft', e);
      return null;
    }
  },
  clearDraft: (key: string) => {
    try {
      localStorage.removeItem(`draft_${key}`);
    } catch (e) {
      console.error('Failed to clear draft', e);
    }
  }
};
