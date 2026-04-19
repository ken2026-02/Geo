import {
  wrapAzimuth,
  lineToStereonetXY,
  Point2D,
  planeToGreatCirclePoints
} from './stereonet';
import {
  Orientation,
  isPlanarKinematicallyAdmissible,
  isWedgeKinematicallyAdmissible,
  isTopplingKinematicallyAdmissible
} from './rockKinematics';

const slopeDaylightDipAt = (slopeDip: number, slopeDipDir: number, jointDipDir: number): number => {
  const deltaRad = ((wrapAzimuth(jointDipDir - slopeDipDir) + 540) % 360 - 180) * Math.PI / 180;
  const daylight = Math.atan(Math.tan((slopeDip * Math.PI) / 180) * Math.cos(deltaRad)) * (180 / Math.PI);
  return Math.max(0, daylight);
};

/**
 * Generates points for a friction cone on the stereonet.
 * Boundary corresponds to lines plunging at the friction angle.
 */
export const buildFrictionCone = (frictionAngle: number, segments: number = 72): Point2D[] => {
  const points: Point2D[] = [];
  for (let i = 0; i <= segments; i++) {
    const trend = (360 * i) / segments;
    points.push(lineToStereonetXY(trend, frictionAngle));
  }
  return points;
};

export const buildDaylightEnvelope = (slopeDip: number, slopeDipDir: number): Point2D[] => {
  return planeToGreatCirclePoints(slopeDip, slopeDipDir);
};

/**
 * Polygon for planar sliding poles: bounded by friction and daylight limits.
 */
export const buildPlanarEnvelope = (
  slopeDip: number,
  slopeDipDir: number,
  frictionAngle: number,
  lateralLimit: number = 20,
  segments: number = 36
): Point2D[] => {
  const points: Point2D[] = [];

  for (let i = 0; i <= segments; i++) {
    const jointDipDir = wrapAzimuth((slopeDipDir - lateralLimit) + ((2 * lateralLimit * i) / segments));
    const poleTrend = wrapAzimuth(jointDipDir + 180);
    points.push(lineToStereonetXY(poleTrend, 90 - frictionAngle));
  }

  for (let i = segments; i >= 0; i--) {
    const jointDipDir = wrapAzimuth((slopeDipDir - lateralLimit) + ((2 * lateralLimit * i) / segments));
    const poleTrend = wrapAzimuth(jointDipDir + 180);
    const daylightDip = slopeDaylightDipAt(slopeDip, slopeDipDir, jointDipDir);
    const polePlunge = Math.max(0, 90 - daylightDip);
    points.push(lineToStereonetXY(poleTrend, polePlunge));
  }

  return points;
};

export const buildTopplingEnvelope = (
  slopeDip: number,
  slopeDipDir: number,
  frictionAngle: number,
  lateralLimit: number = 30,
  segments: number = 36
): Point2D[] => {
  const points: Point2D[] = [];
  const oppositeDir = wrapAzimuth(slopeDipDir + 180);
  const maxPolePlunge = Math.max(0, Math.min(30, slopeDip - frictionAngle));

  for (let i = 0; i <= segments; i++) {
    const trend = wrapAzimuth((oppositeDir - lateralLimit) + ((2 * lateralLimit * i) / segments));
    points.push(lineToStereonetXY(trend, maxPolePlunge));
  }

  for (let i = segments; i >= 0; i--) {
    const trend = wrapAzimuth((oppositeDir - lateralLimit) + ((2 * lateralLimit * i) / segments));
    points.push(lineToStereonetXY(trend, 0));
  }

  return points;
};

export const isPlanarAdmissibleMarkland = (
  joint: Orientation,
  slope: Orientation,
  frictionAngle: number
): boolean => {
  return isPlanarKinematicallyAdmissible(joint, slope, frictionAngle);
};

export const isWedgeAdmissibleMarkland = (
  j1: Orientation,
  j2: Orientation,
  slope: Orientation,
  frictionAngle: number
): { admissible: boolean; trend: number; plunge: number } => {
  const res = isWedgeKinematicallyAdmissible(j1, j2, slope, frictionAngle);
  return {
    admissible: res.admissible,
    trend: res.intersection?.trend || 0,
    plunge: res.intersection?.plunge || 0
  };
};

export const isTopplingAdmissibleMarkland = (
  joint: Orientation,
  slope: Orientation,
  frictionAngle: number
): boolean => {
  return isTopplingKinematicallyAdmissible(joint, slope, frictionAngle);
};
