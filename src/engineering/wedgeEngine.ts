/**
 * Wedge Engine Module
 * Screening-level wedge stability analysis.
 */

import { JointSet } from './jointSetEngine';
import { calculateWaterForce, WaterCondition } from './waterEngine';
import { computeWedgeGeometry, WedgeGeometry } from './wedgeGeometry';
import { normalizeAngle } from '../utils/rockKinematics';

export interface WedgeResult {
  fsUnsupported: number;
  fsSupported: number;
  fsDry: number;
  fsWet: number;
  isStable: boolean;
  controllingPair?: string;
  confidenceSummary?: string;
  warnings?: string[];
  geometry?: WedgeGeometry;
  debug?: {
    weight: number;
    slidingAngle: number;
    drivingDry: number;
    normalDry: number;
    resistingDry: number;
    drivingEff: number;
    normalEff: number;
    resistingEff: number;
    cohesionResistance: number;
    boltContribution: number;
    anchorContribution: number;
    shotcreteContribution: number;
    waterForce: number;
    waterDriving: number;
  };
}

export interface WedgeFoSParams {
  slope: { dip: number, dipDirection: number };
  joint1: { dip: number, dipDirection: number };
  joint2: { dip: number, dipDirection: number };
  frictionAngle: number;
  boltForce?: number;
  boltNumber?: number;
  boltTrend?: number;
  boltPlunge?: number;
  boltEffectiveness?: number;
  anchorForce?: number;
  anchorNumber?: number;
  anchorTrend?: number;
  anchorPlunge?: number;
  anchorEffectiveness?: number;
  shotcreteShearStrength?: number;
  shotcreteThickness?: number;
  slidingPlaneContactLength?: number;
  shotcreteReduction?: number;
  unitWeight?: number;
  wedgeHeight?: number;
  waterHead?: number;
  condition?: WaterCondition;
  manualWedgeWeight?: number;
  cohesion?: number;
}

const safeDiv = (num: number, den: number) => (Number.isFinite(num) && Number.isFinite(den) && den > 1e-6 ? num / den : 0);

const toVector = (trend: number, plunge: number): [number, number, number] => {
  const tr = normalizeAngle(trend) * Math.PI / 180;
  const pl = plunge * Math.PI / 180;
  return [
    Math.cos(pl) * Math.sin(tr),
    Math.cos(pl) * Math.cos(tr),
    -Math.sin(pl)
  ];
};

const dot = (a: [number, number, number], b: [number, number, number]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const estimateWedgeFS = (params: WedgeFoSParams): WedgeResult => {
  const {
    slope,
    joint1,
    joint2,
    frictionAngle,
    boltForce = 0,
    boltNumber = 1,
    boltTrend = 0,
    boltPlunge = 0,
    boltEffectiveness = 0.75,
    anchorForce = 0,
    anchorNumber = 0,
    anchorTrend = 0,
    anchorPlunge = 0,
    anchorEffectiveness = 0.75,
    shotcreteShearStrength = 0,
    shotcreteThickness = 0,
    slidingPlaneContactLength = 0,
    shotcreteReduction = 0.3,
    unitWeight = 25,
    wedgeHeight = 1,
    waterHead = 0,
    condition = 'Dry',
    manualWedgeWeight,
    cohesion = 0
  } = params;

  const warnings: string[] = [];
  const geometry = computeWedgeGeometry(slope, joint1, joint2, wedgeHeight, unitWeight);
  if (!geometry.isValid && geometry.validityNote) warnings.push(geometry.validityNote);

  const weight = Math.max(0, manualWedgeWeight !== undefined ? manualWedgeWeight : geometry.wedgeWeight);
  const slidingAngle = Math.max(0, Math.abs(geometry.intersectionPlunge));
  const plungeRadians = slidingAngle * Math.PI / 180;
  const frictionRadians = Math.max(0, frictionAngle) * Math.PI / 180;

  const drivingDry = geometry.isValid ? Math.max(0, weight * Math.sin(plungeRadians)) : 0;
  const normalDry = geometry.isValid ? Math.max(0, weight * Math.cos(plungeRadians)) : 0;
  const cohesionResistance = Math.max(0, cohesion * geometry.slidingPlaneArea);
  const frictionResistanceDry = Math.max(0, normalDry * Math.tan(frictionRadians));
  const resistingDry = Math.max(0, frictionResistanceDry + cohesionResistance);
  const fsDry = safeDiv(resistingDry, drivingDry);

  const waterForce = geometry.isValid ? calculateWaterForce(geometry.slidingPlaneArea, waterHead, condition) : 0;
  const waterDriving = Math.max(0, waterForce * Math.sin(plungeRadians));
  const effectiveNormal = Math.max(0, normalDry - waterForce);
  const drivingEff = drivingDry + waterDriving;
  const frictionResistanceEff = Math.max(0, effectiveNormal * Math.tan(frictionRadians));
  const resistingEff = Math.max(0, frictionResistanceEff + cohesionResistance);
  const fsWet = safeDiv(resistingEff, drivingEff);

  const slidingVector = toVector(geometry.intersectionTrend, slidingAngle);
  const antiSlidingVector: [number, number, number] = [-slidingVector[0], -slidingVector[1], -slidingVector[2]];
  const calculateOrientationFactor = (trend: number, plunge: number) => {
    const supportVector = toVector(trend, plunge);
    return Math.max(0, Math.min(1, dot(antiSlidingVector, supportVector)));
  };

  const boltContribution = Math.max(0, boltNumber) * Math.max(0, boltForce) * Math.max(0, boltEffectiveness) * calculateOrientationFactor(boltTrend, boltPlunge);
  const anchorContribution = Math.max(0, anchorNumber) * Math.max(0, anchorForce) * Math.max(0, anchorEffectiveness) * calculateOrientationFactor(anchorTrend, anchorPlunge);

  if (weight > 0 && boltContribution > weight) {
    warnings.push('Bolt contribution exceeds wedge weight; confirm bolt count, capacity and alignment inputs.');
  }
  if (weight > 0 && anchorContribution > 1.5 * weight) {
    warnings.push('Anchor contribution is high relative to wedge weight; confirm anchor capacity and geometry assumptions.');
  }

  const shotcreteThicknessM = Math.max(0, shotcreteThickness) / 1000;
  let shotcreteContribution = Math.max(0, shotcreteShearStrength) * shotcreteThicknessM * Math.max(0, slidingPlaneContactLength) * Math.max(0, shotcreteReduction);
  const shotcreteCap = Math.max(0, 0.3 * weight);
  if (shotcreteContribution > shotcreteCap && shotcreteCap > 0) {
    shotcreteContribution = shotcreteCap;
    warnings.push('Shotcrete contribution capped for screening-level realism.');
  }

  const fsUnsupported = condition === 'Dry' ? fsDry : fsWet;
  const fsSupported = safeDiv(resistingEff + boltContribution + anchorContribution + shotcreteContribution, drivingEff);

  return {
    fsUnsupported,
    fsSupported,
    fsDry,
    fsWet,
    isStable: fsSupported > 1.3,
    geometry,
    warnings: warnings.length ? warnings : undefined,
    debug: {
      weight,
      slidingAngle,
      drivingDry,
      normalDry,
      resistingDry,
      drivingEff,
      normalEff: effectiveNormal,
      resistingEff,
      cohesionResistance,
      boltContribution,
      anchorContribution,
      shotcreteContribution,
      waterForce,
      waterDriving
    }
  };
};

export const estimateWedgeFSFromSets = (
  slope: { dip: number, dipDirection: number },
  jointSets: JointSet[],
  frictionAngle: number,
  boltForce: number = 0,
  boltNumber: number = 1,
  boltTrend: number = 0,
  boltPlunge: number = 0,
  boltEffectiveness: number = 0.75,
  anchorForce: number = 0,
  anchorNumber: number = 0,
  anchorTrend: number = 0,
  anchorPlunge: number = 0,
  anchorEffectiveness: number = 0.75,
  shotcreteShearStrength: number = 0,
  shotcreteThickness: number = 0,
  slidingPlaneContactLength: number = 0,
  unitWeight: number = 25,
  wedgeHeight: number = 1,
  waterHead: number = 0,
  condition: WaterCondition = 'Dry'
): WedgeResult => {
  if (jointSets.length < 2) {
    return {
      fsUnsupported: 0,
      fsSupported: 0,
      fsDry: 0,
      fsWet: 0,
      isStable: false,
      warnings: ['Insufficient sets for wedge analysis']
    };
  }

  const set1 = jointSets[0];
  const set2 = jointSets[1];

  const result = estimateWedgeFS({
    slope,
    joint1: set1.meanOrientation,
    joint2: set2.meanOrientation,
    frictionAngle,
    boltForce,
    boltNumber,
    boltTrend,
    boltPlunge,
    boltEffectiveness,
    anchorForce,
    anchorNumber,
    anchorTrend,
    anchorPlunge,
    anchorEffectiveness,
    shotcreteShearStrength,
    shotcreteThickness,
    slidingPlaneContactLength,
    shotcreteReduction: 0.3,
    unitWeight,
    wedgeHeight,
    waterHead,
    condition,
    cohesion: 0
  });

  const warnings = jointSets.flatMap(js => js.warnings);
  const lowestConfidence = jointSets.reduce((acc, js) => {
    if (js.confidence === 'Low') return 'Low';
    if (js.confidence === 'Medium' && acc === 'High') return 'Medium';
    return acc;
  }, 'High' as 'Low' | 'Medium' | 'High');

  return {
    ...result,
    controllingPair: set2 ? `${set1.id} + ${set2.id}` : set1.id,
    confidenceSummary: `Overall Confidence: ${lowestConfidence}`,
    warnings: [...(result.warnings || []), ...warnings].filter(Boolean)
  };
};
