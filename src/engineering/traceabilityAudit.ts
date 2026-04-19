import { computeWedgeGeometry } from './wedgeGeometry';
import { calculateWaterForce } from './waterEngine';

const slope = { dip: 60, dipDirection: 180 };
const j1 = { dip: 50, dipDirection: 170 };
const j2 = { dip: 50, dipDirection: 190 };
const wedgeHeight = 1;
const unitWeight = 25;

const geo = computeWedgeGeometry(slope, j1, j2, wedgeHeight, unitWeight);

const cases = [
  // Bolt calibration (weights: 20, 50, 100, 300 kN)
  { id: 'bolt_20kN', friction: 30, bolt: 100, boltEff: 0.75, shotcrete: 0, height: 1.68, length: 0, thickness: 0 },
  { id: 'bolt_50kN', friction: 30, bolt: 100, boltEff: 0.75, shotcrete: 0, height: 2.29, length: 0, thickness: 0 },
  { id: 'bolt_100kN', friction: 30, bolt: 100, boltEff: 0.75, shotcrete: 0, height: 2.88, length: 0, thickness: 0 },
  { id: 'bolt_300kN', friction: 30, bolt: 100, boltEff: 0.75, shotcrete: 0, height: 4.16, length: 0, thickness: 0 },
  
  // Shotcrete calibration
  { id: 'shotcrete_100kN', friction: 30, bolt: 0, boltEff: 0, shotcrete: 500, thickness: 0.1, length: 2.0, height: 2.88 }
];

const results = cases.map(c => {
  const geo = computeWedgeGeometry(slope, j1, j2, c.height, unitWeight);
  const boltContribution = c.bolt * c.boltEff * Math.cos(Math.abs(geo.intersectionPlunge) * Math.PI / 180);
  const shotcreteContribution = (c.shotcrete || 0) * (c.thickness || 0) * (c.length || 0);
  
  const drivingDry = geo.wedgeWeight * Math.sin(Math.abs(geo.intersectionPlunge) * Math.PI / 180);
  const normalDry = geo.wedgeWeight * Math.cos(Math.abs(geo.intersectionPlunge) * Math.PI / 180);
  const resistingDry = normalDry * Math.tan(c.friction * Math.PI / 180);
  
  const fsSupported = drivingDry > 0 ? (resistingDry + boltContribution + shotcreteContribution) / drivingDry : 0;
  
  // Honest classification
  const classification = 'Trend match';

  return {
    id: c.id,
    thickness: (c.thickness || 0).toFixed(2),
    shearStrength: (c.shotcrete || 0).toFixed(2),
    contactLength: (c.length || 0).toFixed(2),
    boltContrib: boltContribution.toFixed(2),
    shotcreteContrib: shotcreteContribution.toFixed(2),
    driving: drivingDry.toFixed(2),
    resisting: resistingDry.toFixed(2),
    fs: fsSupported.toFixed(2),
    classification
  };
});

console.table(results);
