import { analyzeKinematics } from './kinematicEngine';
import { estimateWedgeFS } from './wedgeEngine';

const audit = () => {
  const results = [];

  // Case 06: Wedge Sliding – Classic Portal Wedge
  const c06 = analyzeKinematics(60, 180, 30, [{ id: 'J1', dip: 50, dipDirection: 170 }, { id: 'J2', dip: 50, dipDirection: 190 }]);
  results.push({ id: '06', mode: 'Wedge', inputs: 'Slope 60/180, J1 50/170, J2 50/190, F 30', geometry: `Trend: ${c06.wedgeTrend}, Plunge: ${c06.wedgePlunge}`, fs: 'N/A', outcome: 'Possible', match: c06.wedgePossible ? 'Numerical match' : 'No' });

  // Case 07: Wedge Sliding – No Risk
  const c07 = analyzeKinematics(60, 180, 30, [{ id: 'J1', dip: 10, dipDirection: 170 }, { id: 'J2', dip: 10, dipDirection: 190 }]);
  results.push({ id: '07', mode: 'Wedge', inputs: 'Slope 60/180, J1 10/170, J2 10/190, F 30', geometry: `Trend: ${c07.wedgeTrend}, Plunge: ${c07.wedgePlunge}`, fs: 'N/A', outcome: 'Not possible', match: !c07.wedgePossible ? 'Numerical match' : 'No' });

  // Case 08: Vertical Portal Brow Wedge
  const c08 = analyzeKinematics(90, 180, 30, [{ id: 'J1', dip: 50, dipDirection: 180 }, { id: 'J2', dip: 50, dipDirection: 190 }]);
  results.push({ id: '08', mode: 'Wedge', inputs: 'Slope 90/180, J1 50/180, J2 50/190, F 30', geometry: `Trend: ${c08.wedgeTrend}, Plunge: ${c08.wedgePlunge}`, fs: 'N/A', outcome: 'Possible', match: c08.wedgePossible ? 'Numerical match' : 'No' });

  // Case 09: Tunnel Shoulder Wedge
  const c09 = analyzeKinematics(45, 180, 30, [{ id: 'J1', dip: 50, dipDirection: 170 }, { id: 'J2', dip: 50, dipDirection: 190 }]);
  results.push({ id: '09', mode: 'Wedge', inputs: 'Slope 45/180, J1 50/170, J2 50/190, F 30', geometry: `Trend: ${c09.wedgeTrend}, Plunge: ${c09.wedgePlunge}`, fs: 'N/A', outcome: 'Possible', match: c09.wedgePossible ? 'Numerical match' : 'No' });

  // Case 10: Sidewall Planar
  const c10 = analyzeKinematics(90, 180, 30, [{ id: 'J1', dip: 50, dipDirection: 180 }]);
  results.push({ id: '10', mode: 'Planar', inputs: 'Slope 90/180, J 50/180, F 30', geometry: `Daylight: ${c10.planarPossible}`, fs: 'N/A', outcome: 'Possible', match: c10.planarPossible ? 'Numerical match' : 'No' });

  // Case 11: Wedge FS – Simple
  const c11 = estimateWedgeFS({ slope: { dip: 60, dipDirection: 180 }, joint1: { dip: 50, dipDirection: 170 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 30, condition: 'Dry' });
  results.push({ 
    id: '11', 
    vol: c11.geometry?.wedgeVolume.toFixed(2), 
    weight: c11.geometry?.wedgeWeight.toFixed(2), 
    plunge: c11.geometry?.intersectionPlunge.toFixed(1),
    fs_dry: c11.fsDry.toFixed(2),
    outcome: 'FS < 1.5', 
    match: c11.fsUnsupported < 1.5 ? 'Trend match' : 'No' 
  });

  // Case 12: Wedge FS – Stable
  const c12 = estimateWedgeFS({ slope: { dip: 60, dipDirection: 180 }, joint1: { dip: 50, dipDirection: 170 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 35, condition: 'Dry' });
  results.push({ 
    id: '12', 
    vol: c12.geometry?.wedgeVolume.toFixed(2), 
    weight: c12.geometry?.wedgeWeight.toFixed(2), 
    plunge: c12.geometry?.intersectionPlunge.toFixed(1),
    fs_dry: c12.fsDry.toFixed(2),
    outcome: 'FS > 1.5', 
    match: c12.fsUnsupported > 1.5 ? 'Numerical match' : 'Mismatch' 
  });

  // Case 13: Bolt Support Improves FS
  const c13_unsupp = estimateWedgeFS({ slope: { dip: 60, dipDirection: 180 }, joint1: { dip: 50, dipDirection: 170 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 30, condition: 'Dry' });
  const c13_supp = estimateWedgeFS({ slope: { dip: 60, dipDirection: 180 }, joint1: { dip: 50, dipDirection: 170 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 30, boltForce: 150, condition: 'Dry' });
  results.push({ 
    id: '13', 
    vol: c13_supp.geometry?.wedgeVolume.toFixed(2), 
    weight: c13_supp.geometry?.wedgeWeight.toFixed(2), 
    plunge: c13_supp.geometry?.intersectionPlunge.toFixed(1),
    fs_dry: c13_supp.fsUnsupported.toFixed(2),
    fs_supp: c13_supp.fsSupported.toFixed(2),
    outcome: 'FS_supp > FS_unsupp', 
    match: c13_supp.fsSupported > c13_unsupp.fsUnsupported ? 'Trend match' : 'No' 
  });

  // Case 14: Shotcrete Support
  results.push({ id: '14', match: 'Insufficient validation detail' });

  // Case 15: Support Insufficient
  const c15 = estimateWedgeFS({ slope: { dip: 60, dipDirection: 180 }, joint1: { dip: 50, dipDirection: 170 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 30, boltForce: 100, condition: 'Dry' });
  results.push({ 
    id: '15', 
    vol: c15.geometry?.wedgeVolume.toFixed(2), 
    weight: c15.geometry?.wedgeWeight.toFixed(2), 
    plunge: c15.geometry?.intersectionPlunge.toFixed(1),
    fs_supp: c15.fsSupported.toFixed(2),
    outcome: 'Support inadequate', 
    match: c15.fsSupported < 1.0 ? 'Trend match' : 'No' 
  });

  // Case 16: Water Pressure Case
  const c16_dry = estimateWedgeFS({ slope: { dip: 60, dipDirection: 180 }, joint1: { dip: 50, dipDirection: 170 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 30, condition: 'Dry' });
  const c16_wet = estimateWedgeFS({ slope: { dip: 60, dipDirection: 180 }, joint1: { dip: 50, dipDirection: 170 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 30, condition: 'Wet' });
  results.push({ 
    id: '16', 
    vol: c16_wet.geometry?.wedgeVolume.toFixed(2), 
    weight: c16_wet.geometry?.wedgeWeight.toFixed(2), 
    plunge: c16_wet.geometry?.intersectionPlunge.toFixed(1),
    fs_dry: c16_dry.fsDry.toFixed(2),
    fs_wet: c16_wet.fsWet.toFixed(2),
    outcome: 'FS_wet < FS_dry', 
    match: c16_wet.fsWet < c16_dry.fsDry ? 'Trend match' : 'No' 
  });

  console.table(results);
};

audit();
