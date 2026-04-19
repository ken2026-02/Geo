const KEY = "geofield_active_project_id";

export const getActiveProjectId = (): string | null => {
  return localStorage.getItem(KEY);
};

export const setActiveProjectId = (id: string): void => {
  localStorage.setItem(KEY, id);
};

export const clearActiveProjectId = (): void => {
  localStorage.removeItem(KEY);
};
