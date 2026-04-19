export interface DecisionResult {
  actionLevel: 'No immediate action' | 'Monitor' | 'Scaling required' | 'Support required' | 'Engineer review required';
  supportRecommendation: 'Spot bolts' | 'Pattern bolts' | 'Mesh' | 'Shotcrete' | 'Bolt + mesh' | 'Bolt + shotcrete' | 'Full support package' | 'None';
  reviewRequired: boolean;
  confidenceNote: string;
  riskSummary: string;
}

export const decisionEngine = {
  // ... existing methods ...
  getRockMassQuality: (q: number | null, rmr: number | null, gsi: number | null): string => {
    // Priority: RMR > Q > GSI
    if (rmr !== null) {
      if (rmr > 80) return 'Very Good';
      if (rmr > 60) return 'Good';
      if (rmr > 40) return 'Fair';
      if (rmr > 20) return 'Poor';
      return 'Very Poor';
    }
    if (q !== null) {
      if (q > 40) return 'Very Good';
      if (q > 10) return 'Good';
      if (q > 4) return 'Fair';
      if (q > 1) return 'Poor';
      return 'Very Poor';
    }
    if (gsi !== null) {
      if (gsi > 75) return 'Very Good';
      if (gsi > 55) return 'Good';
      if (gsi > 35) return 'Fair';
      if (gsi > 15) return 'Poor';
      return 'Very Poor';
    }
    return 'Unknown';
  },

  getFailureMode: (structural: any): string => {
    if (!structural) return 'Unknown';
    const modes = [];
    if (structural.planar_possible) modes.push('Planar');
    if (structural.wedge_possible) modes.push('Wedge');
    if (structural.toppling_possible) modes.push('Toppling');
    if (modes.length === 0) return 'None';
    return modes.join(', ');
  },

  getHazardLevel: (structural: any): string => {
    if (!structural) return 'Unknown';
    const modes = [];
    if (structural.planar_possible) modes.push('Planar');
    if (structural.wedge_possible) modes.push('Wedge');
    if (structural.toppling_possible) modes.push('Toppling');
    
    if (modes.length >= 2) return 'Critical';
    if (modes.length === 1) return 'High';
    return 'Low';
  },

  getSupportRecommendation: (q: number | null): string => {
    if (q === null) return 'Insufficient data (Q-value required)';
    if (q > 10) return 'Spot bolts';
    if (q > 4) return 'Systematic bolts';
    if (q > 1) return 'Bolts + mesh';
    if (q > 0.1) return 'Bolts + mesh + shotcrete';
    return 'Heavy support';
  },

  getMonitoringRecommendation: (hazard: string): string => {
    if (hazard === 'Critical' || hazard === 'High') {
      return 'Prism monitoring, Crack mapping, Regular inspection';
    }
    if (hazard === 'Moderate') {
      return 'Regular visual inspection';
    }
    return 'Routine inspection';
  },

  getSiteActionRecommendation: (wedgeResult: any, sensitivityResult: any): string => {
    if (wedgeResult.fsSupported < 1.2) return 'Scaling before access, Exclusion zone, Full bolts';
    if (wedgeResult.fsSupported < 1.5) return 'Spot bolts, Mesh';
    return 'Engineer review, Routine monitoring';
  },

  evaluateSiteAction: (
    mechanism: 'Planar' | 'Wedge' | 'Toppling' | 'None',
    fsDry: number,
    fsWet: number,
    confidenceSummary: string | undefined,
    warnings: string[] | undefined,
    supportAdequacy: 'Adequate' | 'Inadequate' | 'Unknown' = 'Unknown',
    blockWeight: number = 0
  ): DecisionResult => {
    let actionLevel: DecisionResult['actionLevel'] = 'No immediate action';
    let supportRecommendation: DecisionResult['supportRecommendation'] = 'None';
    let reviewRequired = false;

    // Rule-based logic
    if (fsDry > 1.3 && fsWet < 1.0) {
      actionLevel = 'Support required';
      supportRecommendation = 'Bolt + shotcrete';
      reviewRequired = true;
    } else if (fsDry < 1.0 || supportAdequacy === 'Inadequate') {
      actionLevel = 'Support required';
      supportRecommendation = blockWeight > 1000 ? 'Bolt + shotcrete' : 'Bolt + mesh';
      reviewRequired = true;
    } else if (fsDry < 1.2) {
      actionLevel = 'Scaling required';
      supportRecommendation = 'Mesh';
      reviewRequired = false;
    } else if (fsDry < 1.5) {
      actionLevel = 'Monitor';
      supportRecommendation = 'Spot bolts';
      reviewRequired = false;
    }

    // Override for low confidence or high scatter
    if (confidenceSummary?.includes('Low') || warnings?.includes('High scatter')) {
      actionLevel = 'Engineer review required';
      reviewRequired = true;
    }

    return {
      actionLevel,
      supportRecommendation,
      reviewRequired,
      confidenceNote: confidenceSummary || 'High confidence',
      riskSummary: `Mechanism: ${mechanism}, FS_dry: ${fsDry.toFixed(2)}, FS_wet: ${fsWet.toFixed(2)}`
    };
  }
};
