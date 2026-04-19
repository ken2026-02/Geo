import { Plane, Vector3, planeToNormal, normalToPlane } from './geometryCore';

export interface Joint {
  id: string;
  dip: number;
  dipDirection: number;
}

export interface JointSet {
  id: string;
  meanOrientation: Plane;
  meanPole: Vector3;
  count: number;
  scatter: number;
  confidence: 'Low' | 'Medium' | 'High';
  warnings: string[];
}

/**
 * Helper to create a single joint set.
 */
export const createJointSet = (setId: string, jointId: string, joints: Joint[]): JointSet => {
  const grouping: Record<string, string[]> = { [setId]: joints.map(j => j.id) };
  return analyzeJointSets(joints, grouping)[0];
};

/**
 * Analyzes joint sets from raw measurements and a grouping map.
 */
export const analyzeJointSets = (
  joints: Joint[],
  grouping: Record<string, string[]>
): JointSet[] => {
  const sets: Record<string, Joint[]> = {};
  
  // Group joints
  for (const [setId, jointIds] of Object.entries(grouping)) {
    sets[setId] = joints.filter(j => jointIds.includes(j.id));
  }
  
  return Object.entries(sets).map(([setId, setJoints]) => {
    const count = setJoints.length;
    const warnings: string[] = [];
    
    if (count < 1) warnings.push('Insufficient data');
    if (count < 3) warnings.push('Unstable mean due to small sample size');
    
    // Calculate mean pole
    let sumX = 0, sumY = 0, sumZ = 0;
    const poles = setJoints.map(j => planeToNormal({ dip: j.dip, dipDirection: j.dipDirection }));
    
    poles.forEach(p => {
      sumX += p.x;
      sumY += p.y;
      sumZ += p.z;
    });
    
    const meanPole = { x: sumX / count, y: sumY / count, z: sumZ / count };
    const length = Math.sqrt(meanPole.x ** 2 + meanPole.y ** 2 + meanPole.z ** 2);
    const normalizedMeanPole = { x: meanPole.x / length, y: meanPole.y / length, z: meanPole.z / length };
    
    // Calculate scatter (average angular distance in degrees)
    let totalAngularDistance = 0;
    poles.forEach(p => {
      const dot = p.x * normalizedMeanPole.x + p.y * normalizedMeanPole.y + p.z * normalizedMeanPole.z;
      // Clamp dot product to [-1, 1] to avoid NaN from acos
      const clampedDot = Math.max(-1, Math.min(1, dot));
      totalAngularDistance += Math.acos(clampedDot) * (180 / Math.PI);
    });
    
    const scatter = count > 0 ? totalAngularDistance / count : 0;
    if (scatter > 20) warnings.push('High scatter');
    
    // Determine confidence
    let confidence: 'Low' | 'Medium' | 'High' = 'Low';
    if (count > 5) confidence = 'High';
    else if (count >= 3) confidence = 'Medium';
    
    return {
      id: setId,
      meanOrientation: normalToPlane(normalizedMeanPole),
      meanPole: normalizedMeanPole,
      count,
      scatter,
      confidence,
      warnings
    };
  });
};
