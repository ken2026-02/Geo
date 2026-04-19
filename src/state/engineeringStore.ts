import { StructuralAssessmentState } from '../types/engineering';

const initialState: StructuralAssessmentState = {
  project: null,
  location: null,
  slopeOrientation: { dip: 0, dipDirection: 0 },
  jointSets: [],
  friction: 30,
  cohesion: 0,
  groundwater: 'Dry',
  kinematicResult: null,
  wedgeGeometry: null,
  wedgeFoS: null,
  supportEstimation: { shotcrete: null, bolt: null, contribution: null },
  riskScreening: null,
  recommendationBasis: null,
};

let state: StructuralAssessmentState = { ...initialState };

export const engineeringStore = {
  getState: () => ({ ...state }),
  setState: (newState: Partial<StructuralAssessmentState>) => {
    state = { ...state, ...newState };
  },
  reset: () => {
    state = { ...initialState };
  }
};
