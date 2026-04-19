/**
 * WEDGE FOS ANALYSIS UTILITY
 * 
 * PURPOSE:
 * Provides a simplified limit-equilibrium analysis for a single wedge.
 * 
 * FORMULAS:
 * - Driving Force (T) = W * sin(alpha)
 * - Normal Force (N) = W * cos(alpha)
 * - Friction Resistance (Rf) = (N - U) * tan(phi)
 * - Cohesion Resistance (Rc) = c * A
 * - Total Resistance (R) = Rf + Rc
 * - FoS = R / T
 * 
 * VARIABLES:
 * - W: Wedge weight
 * - alpha: Sliding plunge angle
 * - phi: Friction angle
 * - c: Cohesion
 * - A: Simplified sliding area (assumed 1.0 for V1)
 * - U: Uplift force (groundwater)
 * 
 * GROUNDWATER MODIFIER (U):
 * - Dry: U = 0
 * - Damp: U = 0.1 * W
 * - Wet: U = 0.3 * W
 * - Flowing: U = 0.5 * W
 * 
 * ASSUMPTIONS:
 * - Single wedge sliding along the intersection of two joints.
 * - Simplified 2D limit equilibrium approach.
 * - No external loads (bolts, anchors) in V1.
 * 
 * LIMITATIONS VS FULL SWEDGE:
 * - This is a preliminary screening tool.
 * - Does not account for complex 3D wedge geometry or lateral constraints.
 * - Simplified groundwater model.
 * - Preliminary engineering assessment only.
 * 
 * DEVELOPER NOTES:
 * - Formulas: Limit equilibrium analysis based on driving force (T = W*sin(alpha)) and resisting force (R = (N-U)*tan(phi) + c*A).
 * - Assumptions: Simplified 2D limit equilibrium, single wedge sliding along intersection, no complex 3D geometry.
 * - Limitations: Preliminary screening tool only. Does not account for complex 3D wedge geometry, lateral constraints, or advanced groundwater models.
 * - Why preliminary: This module is intended for initial field assessment. For final design, use rigorous software like Rocscience SWedge/UnWedge/RocSlope2.
 * 
 * SUPPORT ESTIMATION DOCUMENTATION:
 * - Shotcrete: Fs = thickness(m) * shearStrength(kPa) * area(m2) * reductionFactor. Assumes shear failure along the wedge perimeter.
 * - Bolt: Fb = capacity(kN) * reductionFactor. Assumes bolt acts as a tension member; efficiency factor is currently 1.0 (perfect orientation).
 * - These are simplified field-oriented estimates. For rigorous design, use full Rocscience SWedge/UnWedge/RocSlope2 software.
 */

export type GroundwaterCondition = 'Dry' | 'Damp' | 'Wet' | 'Pressurized' | 'Flowing';

export interface WedgeFoSInputs {
  weight: number;
  plunge: number;
  trend: number; // Added for bolt calculation
  frictionAngle: number;
  cohesion: number;
  groundwater: GroundwaterCondition;
  shotcrete?: {
    traceLengthM: number;
    thicknessMm: number;
    shearStrengthKpa: number;
    reductionFactor: number;
  };
  bolt?: {
    capacityKn: number;
    trendDeg: number;
    plungeDeg: number;
    effectiveness: number;
  };
}

export interface WedgeFoSResult {
  fos: number;
  fosShotcrete: number;
  fosBolt: number;
  fosCombined: number;
  drivingForce: number;
  resistingForce: number;
  shotcreteContribution: number;
  boltContribution: number;
  stabilityClass: 'Stable' | 'Marginal' | 'Unstable';
  interpretation: string;
}

export const calculateWedgeFoS = (inputs: WedgeFoSInputs): WedgeFoSResult => {
  const { weight, plunge, trend, frictionAngle, cohesion, groundwater, shotcrete, bolt } = inputs;
  const alphaRad = (plunge * Math.PI) / 180;
  const phiRad = (frictionAngle * Math.PI) / 180;

  // Driving force
  const T = weight * Math.sin(alphaRad);
  
  // Normal force
  const N = weight * Math.cos(alphaRad);

  // Groundwater modifier (Uplift U)
  let U = 0;
  switch (groundwater) {
    case 'Damp': U = 0.1 * weight; break;
    case 'Wet': U = 0.3 * weight; break;
    case 'Flowing': U = 0.5 * weight; break;
    default: U = 0;
  }

  // Friction resistance (Rf)
  const Rf = Math.max(0, N - U) * Math.tan(phiRad);
  
  // Cohesion resistance (Rc) - Assume area A=1 for V1
  const Rc = cohesion * 1.0;

  // Total resistance
  const R = Rf + Rc;

  // Support forces
  let F_sc = 0;
  if (shotcrete) {
    // F_sc = L * t * τ * reduction_factor
    F_sc = shotcrete.traceLengthM * (shotcrete.thicknessMm / 1000) * shotcrete.shearStrengthKpa * shotcrete.reductionFactor;
  }

  let F_bolt = 0;
  if (bolt) {
    // Angle between bolt and sliding direction (simplified)
    const angleDiffRad = Math.abs(bolt.plungeDeg - plunge) * Math.PI / 180;
    const raw_F_bolt = bolt.capacityKn * Math.cos(angleDiffRad) * bolt.effectiveness;
    
    // Limit bolt contribution: F_bolt_effective = min(bolt_force, wedge_weight * 2)
    F_bolt = Math.min(raw_F_bolt, weight * 2);
  }

  const fos = T > 0 ? R / T : Infinity;
  const fosShotcrete = T > 0 ? (R + F_sc) / T : Infinity;
  const fosBolt = T > 0 ? (R + F_bolt) / T : Infinity;
  const fosCombined = T > 0 ? (R + F_sc + F_bolt) / T : Infinity;

  const finalFos = fosCombined; // Use combined for classification
  let stabilityClass: 'Stable' | 'Marginal' | 'Unstable' = 'Unstable';
  if (finalFos > 1.3) {
    stabilityClass = 'Stable';
  } else if (finalFos >= 1.0) {
    stabilityClass = 'Marginal';
  }

  const interpretation = `Based on the wedge weight of ${weight.toFixed(1)} kN and shear strength parameters (phi=${frictionAngle}°, c=${cohesion} kPa), the combined FoS is ${finalFos.toFixed(2)}, indicating ${stabilityClass.toLowerCase()} stability.`;

  return {
    fos,
    fosShotcrete,
    fosBolt,
    fosCombined,
    drivingForce: T,
    resistingForce: R,
    shotcreteContribution: F_sc,
    boltContribution: F_bolt,
    stabilityClass,
    interpretation
  };
};
