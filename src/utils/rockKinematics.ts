/**
 * ROCK KINEMATICS UTILITY
 *
 * PURPOSE:
 * Provides a unified vector-geometry core for rock kinematic analysis (Planar, Wedge, Toppling).
 * Uses standard spatial calculations consistent with Rocscience/Dips principles.
 *
 * GEOMETRIC ASSUMPTIONS:
 * - Joints are assumed to be persistent, planar discontinuities.
 * - Friction angle is assumed uniform across all joint sets.
 * - Slope face is assumed to be a planar surface.
 * - Coordinate system: x = East, y = North, z = Up.
 *
 * ADMISSIBILITY ASSUMPTIONS:
 * - Planar: Joint dip direction daylights in the slope face and dip exceeds the friction angle.
 * - Wedge: Intersection of two joints daylights and plunges steeper than the friction angle.
 * - Toppling: Joint must dip into the slope and strike nearly parallel to the slope face.
 *
 * CONVENTIONS:
 * - All angles in degrees unless otherwise specified.
 * - Dip: 0-90 degrees.
 * - Dip Direction / Trend: 0-360 degrees.
 * - Plunge: 0-90 degrees.
 */

export interface Orientation {
  dip: number;
  dipDir: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface TrendPlunge {
  trend: number;
  plunge: number;
}

const EPS = 1e-9;

export const normalizeAngle = (angle: number): number => {
  return ((angle % 360) + 360) % 360;
};

export const angularDifference = (a: number, b: number): number => {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b)) % 360;
  return diff > 180 ? 360 - diff : diff;
};

export const normalizeVector = (v: Vector3): Vector3 => {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (mag < EPS) return { x: 0, y: 0, z: 0 };
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
};

/**
 * Converts a plane (Dip/DipDir) to a lower-hemisphere pole vector.
 */
export const planeToNormal = (dip: number, dipDir: number): Vector3 => {
  const poleTrend = normalizeAngle(dipDir + 180);
  const polePlunge = 90 - dip;
  const trendRad = (poleTrend * Math.PI) / 180;
  const plungeRad = (polePlunge * Math.PI) / 180;

  return normalizeVector({
    x: Math.cos(plungeRad) * Math.sin(trendRad),
    y: Math.cos(plungeRad) * Math.cos(trendRad),
    z: -Math.sin(plungeRad)
  });
};

/**
 * Converts a vector into lower-hemisphere trend and plunge.
 */
export const vectorToTrendPlunge = (v: Vector3): TrendPlunge => {
  let unit = normalizeVector(v);
  if (Math.abs(unit.x) < EPS && Math.abs(unit.y) < EPS && Math.abs(unit.z) < EPS) {
    return { trend: 0, plunge: 0 };
  }

  if (unit.z > 0) {
    unit = { x: -unit.x, y: -unit.y, z: -unit.z };
  }

  return {
    trend: normalizeAngle(Math.atan2(unit.x, unit.y) * (180 / Math.PI)),
    plunge: Math.asin(Math.min(1, Math.max(-1, -unit.z))) * (180 / Math.PI)
  };
};

export const flipLine = (line: TrendPlunge): TrendPlunge => ({
  trend: normalizeAngle(line.trend + 180),
  plunge: line.plunge
});

export const orientLineForSlope = (line: TrendPlunge, slopeDipDir: number): TrendPlunge => {
  const flipped = flipLine(line);
  return angularDifference(flipped.trend, slopeDipDir) < angularDifference(line.trend, slopeDipDir)
    ? flipped
    : line;
};

export const intersectionLine = (p1: Orientation, p2: Orientation): TrendPlunge | null => {
  const n1 = planeToNormal(p1.dip, p1.dipDir);
  const n2 = planeToNormal(p2.dip, p2.dipDir);

  const v = {
    x: n1.y * n2.z - n1.z * n2.y,
    y: n1.z * n2.x - n1.x * n2.z,
    z: n1.x * n2.y - n1.y * n2.x
  };

  const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (mag < 0.001) return null;

  return vectorToTrendPlunge(v);
};

export const isDaylighting = (trend: number, slopeDipDir: number, tolerance: number = 20): boolean => {
  return Math.min(
    angularDifference(trend, slopeDipDir),
    angularDifference(normalizeAngle(trend + 180), slopeDipDir)
  ) <= tolerance;
};

export const isPlanarKinematicallyAdmissible = (
  joint: Orientation,
  slope: Orientation,
  frictionAngle: number,
  tolerance: number = 20
): boolean => {
  const dirDiff = angularDifference(joint.dipDir, slope.dipDir);
  return dirDiff <= tolerance && joint.dip < slope.dip && joint.dip > frictionAngle;
};

export const isWedgeKinematicallyAdmissible = (
  j1: Orientation,
  j2: Orientation,
  slope: Orientation,
  frictionAngle: number,
  tolerance: number = 30
): { admissible: boolean; intersection: TrendPlunge | null } => {
  const rawIntersection = intersectionLine(j1, j2);
  const intersection = rawIntersection ? orientLineForSlope(rawIntersection, slope.dipDir) : null;
  if (!intersection) return { admissible: false, intersection: null };

  const admissible = (
    angularDifference(intersection.trend, slope.dipDir) <= tolerance &&
    intersection.plunge < slope.dip &&
    intersection.plunge > frictionAngle
  );

  return { admissible, intersection };
};

export const isTopplingKinematicallyAdmissible = (
  joint: Orientation,
  slope: Orientation,
  frictionAngle: number,
  tolerance: number = 20
): boolean => {
  const oppositeDir = normalizeAngle(slope.dipDir + 180);
  const dirDiff = angularDifference(joint.dipDir, oppositeDir);

  return (
    dirDiff <= tolerance &&
    (90 - joint.dip) + frictionAngle < slope.dip &&
    joint.dip > 60
  );
};
