/**
 * ROCK ENGINEERING SCREENING UTILITY
 *
 * PURPOSE:
 * Provides preliminary field-oriented screening tools for:
 * 1. Wedge Size Estimation
 * 2. Block Fall Risk Screening
 * 3. Support Recommendation Engine
 */

export interface WedgeSizeInputs {
  height: number;
  s1: number;
  s2: number;
  persistenceFactor: number;
  unitWeight: number;
}

export interface WedgeSizeResult {
  volume: number;
  weight: number;
  sizeClass: 'Small' | 'Medium' | 'Large' | 'Very Large';
}

export const estimateWedgeSize = (inputs: WedgeSizeInputs): WedgeSizeResult => {
  const traceLength = Math.max(inputs.s1, inputs.s2, 0.1);
  const averageSpacing = Math.max(0.1, (inputs.s1 + inputs.s2) / 2);
  const persistence = Math.max(0.25, inputs.persistenceFactor);
  const volume = 0.65 * Math.max(0.2, inputs.height) * traceLength * averageSpacing * persistence;
  const weight = Math.max(0, inputs.unitWeight) * volume;

  let sizeClass: 'Small' | 'Medium' | 'Large' | 'Very Large' = 'Small';
  if (weight > 250) sizeClass = 'Very Large';
  else if (weight > 75) sizeClass = 'Large';
  else if (weight > 15) sizeClass = 'Medium';

  return { volume, weight, sizeClass };
};

export interface RiskScreeningInputs {
  sizeClass: 'Small' | 'Medium' | 'Large' | 'Very Large';
  exposure: 'No exposure' | 'Limited exposure / bench' | 'Active work area' | 'Portal / roadway / critical access';
  trigger: 'Dry / no trigger' | 'Wet / dripping' | 'Flowing / adverse weather';
}

export interface RiskScreeningResult {
  finalRisk: 'Low' | 'Moderate' | 'High' | 'Critical';
}

export const screenBlockFallRisk = (inputs: RiskScreeningInputs): RiskScreeningResult => {
  let riskScore = 0;

  if (inputs.sizeClass === 'Very Large') riskScore += 3;
  else if (inputs.sizeClass === 'Large') riskScore += 2;
  else if (inputs.sizeClass === 'Medium') riskScore += 1;

  if (inputs.exposure === 'Portal / roadway / critical access') riskScore += 3;
  else if (inputs.exposure === 'Active work area') riskScore += 2;
  else if (inputs.exposure === 'Limited exposure / bench') riskScore += 1;

  if (inputs.trigger === 'Flowing / adverse weather') riskScore += 3;
  else if (inputs.trigger === 'Wet / dripping') riskScore += 1;

  let finalRisk: 'Low' | 'Moderate' | 'High' | 'Critical' = 'Low';
  if (riskScore >= 7) finalRisk = 'Critical';
  else if (riskScore >= 4) finalRisk = 'High';
  else if (riskScore >= 2) finalRisk = 'Moderate';

  return { finalRisk };
};

export interface SupportRecommendationInputs {
  wedgeWeight: number;
  unsupportedFos: number | null;
  groundwater: string;
  riskClass: string;
  isAdmissible: boolean;
}

export interface SupportRecommendationResult {
  actionLevel: string;
  approach: string;
  basis: string;
}

export const recommendSupport = (inputs: SupportRecommendationInputs): SupportRecommendationResult => {
  if (!inputs.isAdmissible) {
    return {
      actionLevel: 'Monitor',
      approach: 'Routine inspection',
      basis: 'No kinematically admissible wedge is identified from the current assessment.'
    };
  }

  if ((inputs.unsupportedFos ?? 0) >= 1.5 && inputs.riskClass === 'Low') {
    return {
      actionLevel: 'Monitor',
      approach: 'Routine inspection and scaling as required',
      basis: 'Unsupported FoS is adequate and block-fall risk is low.'
    };
  }

  if (inputs.wedgeWeight < 15 && (inputs.unsupportedFos ?? 0) >= 1.0) {
    return {
      actionLevel: 'Scale and trim',
      approach: 'Mechanical scaling with spot bolts where required',
      basis: 'The wedge is small and can generally be managed by local trimming and spot support.'
    };
  }

  if ((inputs.unsupportedFos ?? 0) < 1.0 || inputs.riskClass === 'Critical') {
    return {
      actionLevel: 'Escalate',
      approach: 'Pattern bolts with mesh/shotcrete and geotechnical review',
      basis: 'The wedge is unstable or the exposure is critical. Restrict access and review temporary support.'
    };
  }

  if (inputs.wedgeWeight > 150) {
    return {
      actionLevel: 'Increase support',
      approach: 'Pattern bolts or cable anchors with mesh and drainage review',
      basis: 'Large wedge weight indicates higher support demand.'
    };
  }

  if (['Wet', 'Flowing', 'Pressurized', 'Damp'].includes(inputs.groundwater)) {
    return {
      actionLevel: 'Add drainage and support',
      approach: 'Pattern bolts with mesh and drainage control',
      basis: 'Groundwater is likely to reduce effective resistance and increase maintenance demand.'
    };
  }

  return {
    actionLevel: 'Support',
    approach: 'Install pattern bolts with local mesh or shotcrete',
    basis: 'Marginal screening stability indicates active support is warranted.'
  };
};
