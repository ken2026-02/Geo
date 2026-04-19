export interface SupportRecommendation {
  label: string;
  description: string;
  color: string;
}

export const getSupportRecommendation = (q: number): SupportRecommendation => {
  if (q > 10) {
    return {
      label: 'Spot Bolting',
      description: 'Spot bolting only',
      color: 'emerald'
    };
  }
  if (q > 4) {
    return {
      label: 'Systematic Bolting',
      description: 'Systematic rock bolts',
      color: 'blue'
    };
  }
  if (q > 1) {
    return {
      label: 'Bolts + Mesh',
      description: 'Rock bolts + mesh',
      color: 'orange'
    };
  }
  if (q > 0.1) {
    return {
      label: 'Bolts + Mesh + Shotcrete',
      description: 'Rock bolts + mesh + shotcrete (50–75 mm)',
      color: 'red'
    };
  }
  return {
    label: 'Heavy Support',
    description: 'Heavy support + shotcrete (75–100 mm)',
    color: 'rose'
  };
};
