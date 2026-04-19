const STORAGE_KEY = 'geo_custom_observations';

export interface CustomObservation {
  label: string;
  category?: string;
}

export const loadCustomObservations = (): CustomObservation[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveCustomObservation = (label: string, category?: string) => {
  const observations = loadCustomObservations();
  if (!observations.find(o => o.label === label)) {
    observations.push({ label, category });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(observations));
  }
};

export const deleteCustomObservation = (label: string) => {
  const observations = loadCustomObservations();
  const filtered = observations.filter(o => o.label !== label);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

export const listAllObservations = () => {
  // This will be merged with default in the UI
  return loadCustomObservations();
};
