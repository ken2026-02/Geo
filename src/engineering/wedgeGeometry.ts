/**
 * Wedge Geometry Module
 * Computes wedge block geometry and weight based on plane orientations.
 *
 * Notes:
 * - This is a screening-level geometric model, not a full 3D polyhedral solver.
 * - Geometry now uses the shared kinematic utilities so wedge trend/plunge matches the structural assessment.
 */

import { angularDifference, isWedgeKinematicallyAdmissible, orientLineForSlope, planeToNormal, vectorToTrendPlunge } from '../utils/rockKinematics';

export interface Plane {
  dip: number;
  dipDirection: number;
}

export interface WedgeGeometry {
  intersectionTrend: number;
  intersectionPlunge: number;
  wedgeHeight: number;
  wedgeVolume: number;
  wedgeWeight: number;
  slidingPlaneArea: number;
  isValid: boolean;
  validityNote?: string;
}

const EPS = 1e-6;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

const assessWedgeValidity = (
  slope: Plane,
  trend: number,
  plunge: number
): { isValid: boolean; note?: string } => {
  const trendDiff = angularDifference(trend, slope.dipDirection);
  if (plunge <= 0.1) return { isValid: false, note: 'Intersection plunge is too shallow for a meaningful wedge slide.' };
  if (plunge >= slope.dip) return { isValid: false, note: 'Intersection plunge does not daylight below the slope dip.' };
  if (trendDiff > 30) return { isValid: false, note: 'Intersection trend is not aligned toward the slope face.' };
  return { isValid: true };
};

export const computeWedgeGeometry = (
  slope: Plane,
  joint1: Plane,
  joint2: Plane,
  wedgeHeight: number,
  unitWeight: number
): WedgeGeometry => {
  const n1 = planeToNormal(joint1.dip, joint1.dipDirection);
  const n2 = planeToNormal(joint2.dip, joint2.dipDirection);

  const rawIntersection = {
    x: n1.y * n2.z - n1.z * n2.y,
    y: n1.z * n2.x - n1.x * n2.z,
    z: n1.x * n2.y - n1.y * n2.x
  };

  const mag = Math.sqrt(rawIntersection.x ** 2 + rawIntersection.y ** 2 + rawIntersection.z ** 2);
  const defaultLine = { trend: slope.dipDirection, plunge: 0 };
  const lowerLine = mag < EPS ? defaultLine : vectorToTrendPlunge(rawIntersection);
  const line = orientLineForSlope(lowerLine, slope.dipDirection);
  const validity = assessWedgeValidity(slope, line.trend, line.plunge);
  const admissible = isWedgeKinematicallyAdmissible(
    { dip: joint1.dip, dipDir: joint1.dipDirection },
    { dip: joint2.dip, dipDir: joint2.dipDirection },
    { dip: slope.dip, dipDir: slope.dipDirection },
    0,
    30
  );

  const H = Math.max(0.1, wedgeHeight);
  const gamma = Math.max(0, unitWeight);
  const dip1 = Math.max(5, Math.min(85, joint1.dip)) * Math.PI / 180;
  const dip2 = Math.max(5, Math.min(85, joint2.dip)) * Math.PI / 180;
  const dotNormals = clamp(Math.abs((n1.x * n2.x) + (n1.y * n2.y) + (n1.z * n2.z)), 0, 1);
  const dihedralAngle = Math.max(10 * Math.PI / 180, Math.acos(dotNormals));
  const dihedralSin = Math.max(Math.sin(dihedralAngle), Math.sin(10 * Math.PI / 180));

  let wedgeVolume = (H ** 3) / (6 * Math.tan(dip1) * Math.tan(dip2) * dihedralSin);
  wedgeVolume = Math.max(0, wedgeVolume);

  const planeArea1 = (H ** 2) / Math.max(0.2, Math.sin(dip1));
  const planeArea2 = (H ** 2) / Math.max(0.2, Math.sin(dip2));
  let slidingPlaneArea = 0.5 * (planeArea1 + planeArea2);
  slidingPlaneArea *= clamp(dihedralSin, 0.25, 1);

  const isValid = validity.isValid && admissible.intersection !== null && mag >= EPS;
  if (!isValid) {
    wedgeVolume = 0;
    slidingPlaneArea = 0;
  }

  return {
    intersectionTrend: line.trend,
    intersectionPlunge: line.plunge,
    wedgeHeight: H,
    wedgeVolume,
    wedgeWeight: wedgeVolume * gamma,
    slidingPlaneArea,
    isValid,
    validityNote: isValid ? undefined : validity.note ?? 'Joint set pair does not form a kinematically valid wedge.'
  };
};
