export interface JointSet {
  id: string;
  dip: number;
  dipDirection: number;
  friction: number;
  cohesion: number;
}

export interface WedgeGeometry {
  weight: number;
  plunge: number;
  trend: number;
  isAdmissible: boolean;
  controllingPair: string;
}

export interface SupportEstimation {
  shotcrete: {
    traceLengthM: number;
    thicknessMm: number;
    shearStrengthKpa: number;
    reductionFactor: number;
  } | null;
  bolt: {
    capacityKn: number;
    trendDeg: number;
    plungeDeg: number;
    effectiveness: number;
    number?: number;
  } | null;
  anchor?: {
    capacityKn: number;
    trendDeg: number;
    plungeDeg: number;
    effectiveness: number;
    number?: number;
  } | null;
  contribution: {
    shotcreteKn: number;
    boltKn: number;
    anchorKn?: number;
    combinedKn: number;
  } | null;
}

export interface RiskScreening {
  sizeClass: 'Small' | 'Medium' | 'Large' | 'Very Large';
  exposure: string;
  trigger: string;
  finalRisk: 'Low' | 'Moderate' | 'High' | 'Critical';
}

export interface StructuralAssessmentState {
  project: string | null;
  location: string | null;
  slopeOrientation: {
    dip: number;
    dipDirection: number;
  };
  jointSets: JointSet[];
  friction: number;
  cohesion: number;
  groundwater: 'Dry' | 'Damp' | 'Wet' | 'Flowing';
  kinematicResult: {
    mechanism: 'No mechanism' | 'Planar' | 'Wedge' | 'Toppling' | 'Multiple mechanisms';
    planarPossible?: boolean;
    wedgePossible?: boolean;
    topplingPossible?: boolean;
    controllingSet?: string | null;
    controllingPair?: string | null;
    wedgeTrend?: number | null;
    wedgePlunge?: number | null;
    confidenceSummary?: string;
  } | null;
  wedgeGeometry: WedgeGeometry | null;
  wedgeFoS: {
    fos: number;
    fosShotcrete: number;
    fosBolt: number;
    fosCombined: number;
    drivingForce: number;
    resistingForce: number;
    stabilityClass: 'Stable' | 'Marginal' | 'Unstable';
    interpretation: string;
  } | null;
  supportEstimation: SupportEstimation;
  riskScreening: RiskScreening | null;
  recommendationBasis: string | null;
}
