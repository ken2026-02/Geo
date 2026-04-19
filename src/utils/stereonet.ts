/**
 * STEREONET UTILITY
 *
 * PURPOSE:
 * Provides mathematical functions for projecting 3D geological orientations
 * (planes and lines) onto a 2D stereonet (Lower Hemisphere, Equal Angle/Wulff projection).
 */

import { normalizeAngle, normalizeVector, planeToNormal, vectorToTrendPlunge, Vector3 } from './rockKinematics';

export interface Point2D {
  x: number;
  y: number;
}

const lineVector = (trend: number, plunge: number): Vector3 => {
  const trendRad = (normalizeAngle(trend) * Math.PI) / 180;
  const plungeRad = (plunge * Math.PI) / 180;
  return {
    x: Math.cos(plungeRad) * Math.sin(trendRad),
    y: Math.cos(plungeRad) * Math.cos(trendRad),
    z: -Math.sin(plungeRad)
  };
};

export const wrapAzimuth = (angle: number): number => {
  return normalizeAngle(angle);
};

export const planeToPole = (dip: number, dipDir: number): { trend: number; plunge: number } => {
  return {
    trend: wrapAzimuth(dipDir + 180),
    plunge: 90 - dip
  };
};

/**
 * Equal-angle (Wulff) lower-hemisphere projection.
 */
export const lineToStereonetXY = (trend: number, plunge: number): Point2D => {
  const trendRad = (wrapAzimuth(trend) * Math.PI) / 180;
  const radius = Math.tan(((90 - plunge) * Math.PI) / 360);
  return {
    x: radius * Math.sin(trendRad),
    y: radius * Math.cos(trendRad)
  };
};

export const poleToStereonetXY = (trend: number, plunge: number): Point2D => {
  return lineToStereonetXY(trend, plunge);
};

/**
 * Generates points for the lower-hemisphere great circle of a plane.
 */
export const planeToGreatCirclePoints = (dip: number, dipDir: number, segments: number = 90): Point2D[] => {
  const normal = planeToNormal(dip, dipDir);
  const strikeTrend = wrapAzimuth(dipDir - 90);
  const strike = lineVector(strikeTrend, 0);
  let dipVector = {
    x: normal.y * strike.z - normal.z * strike.y,
    y: normal.z * strike.x - normal.x * strike.z,
    z: normal.x * strike.y - normal.y * strike.x
  };

  dipVector = normalizeVector(dipVector);
  if (dipVector.z > 0) {
    dipVector = { x: -dipVector.x, y: -dipVector.y, z: -dipVector.z };
  }

  const points: Point2D[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (Math.PI * i) / segments;
    const raw = normalizeVector({
      x: strike.x * Math.cos(theta) + dipVector.x * Math.sin(theta),
      y: strike.y * Math.cos(theta) + dipVector.y * Math.sin(theta),
      z: strike.z * Math.cos(theta) + dipVector.z * Math.sin(theta)
    });

    const lower = raw.z > 0 ? { x: -raw.x, y: -raw.y, z: -raw.z } : raw;
    const line = vectorToTrendPlunge(lower);
    points.push(lineToStereonetXY(line.trend, line.plunge));
  }

  return points;
};
