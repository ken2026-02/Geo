/**
 * Kinematic Engine Module
 * Analysis of planar sliding, wedge sliding, and toppling.
 */

import { isPlanarKinematicallyAdmissible, isWedgeKinematicallyAdmissible, isTopplingKinematicallyAdmissible } from '../utils/rockKinematics';
import { JointSet } from './jointSetEngine';

export interface KinematicResult {
  planarPossible: boolean;
  wedgePossible: boolean;
  topplingPossible: boolean;
  controllingSet: string | null;
  controllingPair?: string | null;
  wedgeTrend?: number | null;
  wedgePlunge?: number | null;
  admissibilityNotes: string[];
  confidenceSummary?: string;
  warnings?: string[];
}

export const analyzeKinematics = (
  slopeDip: number,
  slopeDipDirection: number,
  frictionAngle: number,
  jointsOrSets: ({ id: string, dip: number, dipDirection: number } | JointSet)[]
): KinematicResult => {
  const slope = { dip: slopeDip, dipDir: slopeDipDirection };

  const jointInputs = jointsOrSets.map(item => {
    if ('meanOrientation' in item) {
      return {
        id: item.id,
        dip: item.meanOrientation.dip,
        dipDirection: item.meanOrientation.dipDirection,
        confidence: item.confidence,
        warnings: item.warnings
      };
    }
    return { ...item, confidence: 'High', warnings: [] };
  });

  const planarJoint = jointInputs.find(js =>
    isPlanarKinematicallyAdmissible({ dip: js.dip, dipDir: js.dipDirection }, slope, frictionAngle)
  );
  const planarPossible = Boolean(planarJoint);

  let wedgePossible = false;
  let controllingPair: string | null = null;
  let wedgeTrend: number | null = null;
  let wedgePlunge: number | null = null;
  let bestScore = -Infinity;

  if (jointInputs.length >= 2) {
    for (let i = 0; i < jointInputs.length; i++) {
      for (let k = i + 1; k < jointInputs.length; k++) {
        const wedge = isWedgeKinematicallyAdmissible(
          { dip: jointInputs[i].dip, dipDir: jointInputs[i].dipDirection },
          { dip: jointInputs[k].dip, dipDir: jointInputs[k].dipDirection },
          slope,
          frictionAngle
        );
        if (!wedge.admissible || !wedge.intersection) continue;

        const score = wedge.intersection.plunge;
        if (score > bestScore) {
          bestScore = score;
          wedgePossible = true;
          controllingPair = `${jointInputs[i].id} + ${jointInputs[k].id}`;
          wedgeTrend = wedge.intersection.trend;
          wedgePlunge = wedge.intersection.plunge;
        }
      }
    }
  }

  const topplingJoint = jointInputs.find(js =>
    isTopplingKinematicallyAdmissible({ dip: js.dip, dipDir: js.dipDirection }, slope, frictionAngle)
  );
  const topplingPossible = Boolean(topplingJoint);

  const warnings = jointInputs.flatMap(ji => ji.warnings);
  const lowestConfidence = jointInputs.reduce((acc, ji) => {
    if (ji.confidence === 'Low') return 'Low';
    if (ji.confidence === 'Medium' && acc === 'High') return 'Medium';
    return acc;
  }, 'High' as 'Low' | 'Medium' | 'High');

  return {
    planarPossible,
    wedgePossible,
    topplingPossible,
    controllingSet: planarJoint?.id ?? topplingJoint?.id ?? null,
    controllingPair,
    wedgeTrend,
    wedgePlunge,
    admissibilityNotes: [],
    confidenceSummary: `Overall Confidence: ${lowestConfidence}`,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};
