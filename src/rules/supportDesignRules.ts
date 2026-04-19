export interface SupportRecommendation {
  label: string;
  boltSpacing: string | null;
  meshRequired: boolean;
  shotcreteThickness: string | null;
  summary: string;
}

const tightenSpacing = (spacing: string | null): string => {
  switch (spacing) {
    case '2-3 m':
      return '1.5-2 m';
    case '1.5-2 m':
      return '1.2-1.5 m';
    case '1-1.5 m':
      return '1.0-1.2 m';
    default:
      return spacing ?? '1.5-2 m';
  }
};

export const getSupportDesign = (
  q: number,
  hazardLevel?: string,
  groundwater?: string,
  unsupportedFoS?: number | null,
  failureMode?: string | null
): SupportRecommendation => {
  let recommendation: SupportRecommendation;

  if (q > 10) {
    recommendation = {
      label: 'Spot Bolts As Required',
      boltSpacing: null,
      meshRequired: false,
      shotcreteThickness: null,
      summary: 'Scaling and spot bolts as required for local blocks.'
    };
  } else if (q > 4) {
    recommendation = {
      label: 'Systematic Bolting',
      boltSpacing: '2-3 m',
      meshRequired: false,
      shotcreteThickness: null,
      summary: 'Install systematic bolts at 2-3 m spacing.'
    };
  } else if (q > 1) {
    recommendation = {
      label: 'Bolts And Mesh',
      boltSpacing: '1.5-2 m',
      meshRequired: true,
      shotcreteThickness: null,
      summary: 'Install systematic bolts at 1.5-2 m spacing with mesh.'
    };
  } else if (q > 0.1) {
    recommendation = {
      label: 'Bolts, Mesh And Shotcrete',
      boltSpacing: '1.5-2 m',
      meshRequired: true,
      shotcreteThickness: '50-75 mm',
      summary: 'Install bolts, mesh and 50-75 mm shotcrete.'
    };
  } else {
    recommendation = {
      label: 'Heavy Temporary Support',
      boltSpacing: '1-1.5 m',
      meshRequired: true,
      shotcreteThickness: '75-100 mm',
      summary: 'Install dense bolts, mesh and 75-100 mm shotcrete pending engineering review.'
    };
  }

  if (hazardLevel === 'HIGH' || hazardLevel === 'CRITICAL' || hazardLevel === 'High' || hazardLevel === 'Critical') {
    recommendation.meshRequired = true;
    recommendation.boltSpacing = tightenSpacing(recommendation.boltSpacing);
    if (!recommendation.shotcreteThickness && (failureMode === 'Wedge' || failureMode === 'Multiple mechanisms')) {
      recommendation.shotcreteThickness = '50-75 mm';
    }
    recommendation.summary += ' Review the support pattern and tighten spacing for the current hazard.';
  }

  if (unsupportedFoS !== null && unsupportedFoS !== undefined) {
    if (unsupportedFoS < 1.0) {
      recommendation.label = 'Immediate Support Review Required';
      recommendation.meshRequired = true;
      recommendation.boltSpacing = '1.0-1.2 m';
      recommendation.shotcreteThickness = recommendation.shotcreteThickness ?? '75-100 mm';
      recommendation.summary += ' Screening FoS is below 1.0; restrict exposure, install additional temporary support and review the support pattern.';
    } else if (unsupportedFoS < 1.3) {
      recommendation.meshRequired = true;
      recommendation.boltSpacing = tightenSpacing(recommendation.boltSpacing);
      recommendation.shotcreteThickness = recommendation.shotcreteThickness ?? '50-75 mm';
      recommendation.summary += ' Screening FoS is marginal; increase active support coverage.';
    }
  }

  if (groundwater && ['Wet', 'Dripping', 'Flowing', 'Pressurized', 'Damp'].includes(groundwater)) {
    recommendation.summary += ' Implement drainage and corrosion review.';
  }

  return recommendation;
};
