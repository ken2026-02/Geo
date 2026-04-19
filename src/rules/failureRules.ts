import { 
  angularDifference, 
  normalizeAngle, 
  isPlanarKinematicallyAdmissible, 
  isTopplingKinematicallyAdmissible,
  isWedgeKinematicallyAdmissible
} from '../utils/rockKinematics';

export interface FailureMode {
  type: 'Planar' | 'Wedge' | 'Toppling';
  label: string;
  description: string;
  severity: 'Low' | 'Moderate' | 'High';
}

export interface SlopeGeometry {
  dip: number;
  dipDirection: number;
}

export interface DiscontinuitySet {
  dip: number;
  dipDirection: number;
}

/**
 * ALGORITHM SPECIFICATION: Slope Failure Prediction (Geometry Screening)
 * 
 * PURPOSE:
 * Provides a preliminary geometric screening for potential failure modes 
 * in a rock slope based on slope geometry and discontinuity sets.
 * 
 * INPUTS:
 * - Slope Geometry (Dip, Dip Direction)
 * - Discontinuity Sets (Dip, Dip Direction)
 * 
 * ENGINEERING RULES:
 * 1. Planar Failure:
 *    - Uses isPlanarKinematicallyAdmissible with assumed friction (20 deg).
 * 
 * 2. Toppling Failure (Flexural):
 *    - Uses isTopplingKinematicallyAdmissible with assumed friction (20 deg).
 * 
 * 3. Wedge Failure (Simplified):
 *    - Uses isWedgeKinematicallyAdmissible with assumed friction (20 deg).
 * 
 * OUTPUTS:
 * - List of potential failure modes with severity and description.
 * 
 * ASSUMPTIONS:
 * - Preliminary screening only.
 * - Assumed friction angle of 20 degrees for screening purposes.
 * 
 * LIMITATIONS:
 * - Does not replace rigorous kinematic analysis (Structural Assessment).
 */

export const predictFailureModes = (
  slope: SlopeGeometry,
  sets: DiscontinuitySet[]
): FailureMode[] => {
  const failures: FailureMode[] = [];

  if (!sets || sets.length === 0) return failures;

  const phi_assumed = 20; // Assumed friction for screening
  const slopeOrientation = { dip: slope.dip, dipDir: slope.dipDirection };

  // 1. Planar Failure
  sets.forEach((set, index) => {
    if (isPlanarKinematicallyAdmissible({ dip: set.dip, dipDir: set.dipDirection }, slopeOrientation, phi_assumed)) {
      failures.push({
        type: 'Planar',
        label: `Potential Planar (Set ${index + 1})`,
        description: `Geometric screening suggests Set ${index + 1} may daylight in the face. Further kinematic verification required.`,
        severity: set.dip > 30 ? 'High' : 'Moderate',
      });
    }
  });

  // 2. Toppling Failure
  sets.forEach((set, index) => {
    if (isTopplingKinematicallyAdmissible({ dip: set.dip, dipDir: set.dipDirection }, slopeOrientation, phi_assumed, 30)) {
      failures.push({
        type: 'Toppling',
        label: `Potential Toppling (Set ${index + 1})`,
        description: `Steeply dipping joints (Set ${index + 1}) striking parallel to the slope but dipping into it. Screening flags potential flexural toppling.`,
        severity: 'Moderate',
      });
    }
  });

  // 3. Wedge Failure
  if (sets.length >= 2) {
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const setA = sets[i];
        const setB = sets[j];
        
        const wedgeResult = isWedgeKinematicallyAdmissible(
          { dip: setA.dip, dipDir: setA.dipDirection },
          { dip: setB.dip, dipDir: setB.dipDirection },
          slopeOrientation,
          phi_assumed,
          45 // Screening tolerance for wedge trend
        );

        if (wedgeResult.admissible) {
          failures.push({
            type: 'Wedge',
            label: `Potential Wedge (Sets ${i + 1} & ${j + 1})`,
            description: `Geometric screening suggests the intersection of Set ${i + 1} and Set ${j + 1} may daylight in the face.`,
            severity: 'High',
          });
        }
      }
    }
  }

  return failures;
};
