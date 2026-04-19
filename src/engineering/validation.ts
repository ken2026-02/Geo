import { analyzeKinematics } from './kinematicEngine';
import { estimateWedgeFS, estimateWedgeFSFromSets } from './wedgeEngine';
import { performSensitivityAnalysis } from './sensitivityEngine';
import { decisionEngine } from './decisionEngine';
import { createJointSet } from './jointSetEngine';

const runValidation = () => {
  const results = [];

  // 1. True Planar Case
  const planarCase = analyzeKinematics(60, 180, 30, [{ id: 'J1', dip: 50, dipDirection: 180 }]);
  results.push({ case: 'True Planar', pass: planarCase.planarPossible === true });

  // 2. False Planar Case
  const falsePlanarCase = analyzeKinematics(60, 180, 30, [{ id: 'J1', dip: 20, dipDirection: 180 }]);
  results.push({ case: 'False Planar', pass: falsePlanarCase.planarPossible === false });

  // 3. True Wedge Case
  const wedgeCase = analyzeKinematics(60, 180, 30, [{ id: 'J1', dip: 50, dipDirection: 170 }, { id: 'J2', dip: 50, dipDirection: 190 }]);
  results.push({ case: 'True Wedge', pass: wedgeCase.wedgePossible === true });

  // 4. False Wedge Case
  const falseWedgeCase = analyzeKinematics(60, 180, 30, [{ id: 'J1', dip: 10, dipDirection: 170 }, { id: 'J2', dip: 10, dipDirection: 190 }]);
  results.push({ case: 'False Wedge', pass: falseWedgeCase.wedgePossible === false });

  // 5. True Toppling Case
  const topplingCase = analyzeKinematics(60, 180, 30, [{ id: 'J1', dip: 80, dipDirection: 0 }]);
  results.push({ case: 'True Toppling', pass: topplingCase.topplingPossible === true });

  // 6. No-Failure Case
  const noFailureCase = analyzeKinematics(60, 180, 30, [{ id: 'J1', dip: 10, dipDirection: 0 }]);
  results.push({ case: 'No Failure', pass: !noFailureCase.planarPossible && !noFailureCase.wedgePossible && !noFailureCase.topplingPossible });

  // 7. Support Improves FS Case
  const wedgeFS = estimateWedgeFS({ slope: { dip: 50, dipDirection: 170 }, joint1: { dip: 50, dipDirection: 190 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 30, boltForce: 50, condition: 'Dry' });
  results.push({ case: 'Support Improves FS', pass: wedgeFS.fsSupported > wedgeFS.fsUnsupported });

  // 8. Water Reduces FS Case
  results.push({ case: 'Water Reduces FS', pass: 'Pending / Not implemented' });

  // 9. Low-Confidence Joint Set Case
  const lowConfSet = createJointSet('J1', 'J1', [{ id: 'J1', dip: 50, dipDirection: 180 }]);
  results.push({ case: 'Low-Confidence Joint Set', pass: lowConfSet.confidence === 'Low' });

  // 10. Portal Brow Wedge
  const portalBrow = analyzeKinematics(90, 180, 30, [{ id: 'J1', dip: 50, dipDirection: 180 }, { id: 'J2', dip: 50, dipDirection: 190 }]);
  results.push({ case: 'Portal Brow Wedge', pass: portalBrow.wedgePossible === true });

  // 11. Shoulder Wedge
  const shoulderWedge = analyzeKinematics(45, 180, 30, [{ id: 'J1', dip: 50, dipDirection: 170 }, { id: 'J2', dip: 50, dipDirection: 190 }]);
  results.push({ case: 'Shoulder Wedge', pass: shoulderWedge.wedgePossible === true });

  // 12. Sidewall Planar Daylight Case
  const sidewallPlanar = analyzeKinematics(90, 180, 30, [{ id: 'J1', dip: 50, dipDirection: 180 }]);
  results.push({ case: 'Sidewall Planar Daylight', pass: sidewallPlanar.planarPossible === true });

  // 13. Adverse Joints but No Daylight
  const adverseNoDaylight = analyzeKinematics(30, 180, 30, [{ id: 'J1', dip: 20, dipDirection: 180 }]);
  results.push({ case: 'Adverse Joints but No Daylight', pass: adverseNoDaylight.planarPossible === false });

  // 14. Friction-Sensitive Marginal Wedge
  const marginalWedge = estimateWedgeFS({ slope: { dip: 50, dipDirection: 170 }, joint1: { dip: 50, dipDirection: 190 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 45 });
  results.push({ case: 'Friction-Sensitive Marginal Wedge', pass: marginalWedge.fsUnsupported < 1.5 });

  // 16. Low-Confidence Joint Set Kinematic Screening
  const lowConfKinematic = analyzeKinematics(60, 180, 30, [lowConfSet]);
  results.push({ case: 'Low-Confidence Joint Set Kinematic', pass: lowConfKinematic.confidenceSummary?.includes('Low') === true });

  // 17. High-Scatter Joint Set Kinematic Screening
  const highScatterSet = createJointSet('J1', 'J1', [{ id: 'J1', dip: 50, dipDirection: 180 }, { id: 'J2', dip: 60, dipDirection: 200 }, { id: 'J3', dip: 40, dipDirection: 160 }]);
  const highScatterKinematic = analyzeKinematics(60, 180, 30, [highScatterSet]);
  results.push({ case: 'High-Scatter Joint Set Kinematic', pass: highScatterKinematic.warnings?.includes('High scatter') === true });

  // 18. Clean 3-Set Wedge Kinematic Screening
  const set1 = createJointSet('J1', 'J1', [{ id: 'J1', dip: 50, dipDirection: 170 }]);
  const set2 = createJointSet('J2', 'J2', [{ id: 'J2', dip: 50, dipDirection: 190 }]);
  const set3 = createJointSet('J3', 'J3', [{ id: 'J3', dip: 80, dipDirection: 0 }]);
  const wedgeKinematic = analyzeKinematics(60, 180, 30, [set1, set2, set3]);
  results.push({ case: 'Clean 3-Set Wedge Kinematic', pass: wedgeKinematic.wedgePossible === true });

  // 19. No-Failure Set Kinematic Screening
  const safeSet = createJointSet('J1', 'J1', [{ id: 'J1', dip: 10, dipDirection: 0 }]);
  const safeKinematic = analyzeKinematics(60, 180, 30, [safeSet]);
  results.push({ case: 'No-Failure Set Kinematic', pass: !safeKinematic.planarPossible && !safeKinematic.wedgePossible && !safeKinematic.topplingPossible });

  // 20. Clean 3-Set Wedge FS
  const wedgeFSFromSets = estimateWedgeFSFromSets({ dip: 60, dipDirection: 180 }, [set1, set2, set3], 30);
  results.push({ case: 'Clean 3-Set Wedge FS', pass: wedgeFSFromSets.fsUnsupported > 0 });

  // 21. Low-Confidence Wedge FS (1 set)
  const lowConfWedge = estimateWedgeFSFromSets({ dip: 60, dipDirection: 180 }, [set1], 30);
  results.push({ case: 'Low-Confidence Wedge FS', pass: lowConfWedge.warnings?.includes('Insufficient sets for wedge analysis') === true });

  // 22. High-Scatter Wedge FS
  const scatterSet1 = createJointSet('J1', 'J1', [{ id: 'J1', dip: 50, dipDirection: 180 }, { id: 'J2', dip: 60, dipDirection: 200 }, { id: 'J3', dip: 40, dipDirection: 160 }]);
  const scatterSet2 = createJointSet('J2', 'J2', [{ id: 'J4', dip: 50, dipDirection: 190 }, { id: 'J5', dip: 60, dipDirection: 210 }, { id: 'J6', dip: 40, dipDirection: 170 }]);
  const highScatterWedge = estimateWedgeFSFromSets({ dip: 60, dipDirection: 180 }, [scatterSet1, scatterSet2], 30);
  results.push({ case: 'High-Scatter Wedge FS', pass: highScatterWedge.warnings?.includes('High scatter') === true });

  // 23. Direct-Input Legacy Wedge FS
  const legacyWedge = estimateWedgeFS({ slope: { dip: 60, dipDirection: 180 }, joint1: { dip: 50, dipDirection: 170 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 30 });
  results.push({ case: 'Direct-Input Legacy Wedge FS', pass: legacyWedge.fsUnsupported > 0 });

  // 24. Stable Small Block Case
  const stableDecision = decisionEngine.evaluateSiteAction('None', 1.6, 1.6, 'High confidence', undefined, 'Adequate', 500);
  results.push({ case: 'Stable Small Block', pass: stableDecision.actionLevel === 'No immediate action' });

  // 25. Unstable Wedge Case
  const unstableDecision = decisionEngine.evaluateSiteAction('Wedge', 0.8, 0.8, 'High confidence', undefined, 'Inadequate', 2000);
  results.push({ case: 'Unstable Wedge', pass: unstableDecision.actionLevel === 'Support required' });

  // 26. Low-Confidence Wedge Case
  const lowConfDecision = decisionEngine.evaluateSiteAction('Wedge', 1.3, 1.3, 'Overall Confidence: Low', undefined, 'Adequate', 500);
  results.push({ case: 'Low-Confidence Wedge', pass: lowConfDecision.actionLevel === 'Engineer review required' });

  // 27. High-Scatter Case
  const highScatterDecision = decisionEngine.evaluateSiteAction('Wedge', 1.3, 1.3, 'High confidence', ['High scatter'], 'Adequate', 500);
  results.push({ case: 'High-Scatter Case', pass: highScatterDecision.actionLevel === 'Engineer review required' });

  // 28. Support-Adequate Case
  const adequateDecision = decisionEngine.evaluateSiteAction('Wedge', 1.3, 1.3, 'High confidence', undefined, 'Adequate', 500);
  results.push({ case: 'Support-Adequate Case', pass: adequateDecision.actionLevel === 'Monitor' });

  // 29. Support-Inadequate Case
  const inadequateDecision = decisionEngine.evaluateSiteAction('Wedge', 1.3, 1.3, 'High confidence', undefined, 'Inadequate', 500);
  results.push({ case: 'Support-Inadequate Case', pass: inadequateDecision.actionLevel === 'Support required' });

  // 30. Case 1: Dry stable wedge
  const dryStable = estimateWedgeFS({ slope: { dip: 50, dipDirection: 170 }, joint1: { dip: 50, dipDirection: 190 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 30, condition: 'Dry' });
  const dryStableDecision = decisionEngine.evaluateSiteAction('Wedge', dryStable.fsDry, dryStable.fsWet, 'High confidence', undefined, 'Adequate', 500);
  results.push({ case: 'Case 1: Dry stable wedge', pass: dryStableDecision.actionLevel === 'Monitor' });

  // 31. Case 2: Water triggered instability
  const waterTriggered = estimateWedgeFS({ slope: { dip: 50, dipDirection: 170 }, joint1: { dip: 50, dipDirection: 190 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 30, condition: 'Wet' });
  const waterTriggeredDecision = decisionEngine.evaluateSiteAction('Wedge', waterTriggered.fsDry, waterTriggered.fsWet, 'High confidence', undefined, 'Adequate', 500);
  results.push({ case: 'Case 2: Water triggered instability', pass: waterTriggeredDecision.actionLevel === 'Support required' });

  // 32. Case 3: Large wedge with water
  const largeWedge = estimateWedgeFS({ slope: { dip: 50, dipDirection: 170 }, joint1: { dip: 50, dipDirection: 190 }, joint2: { dip: 50, dipDirection: 190 }, frictionAngle: 30, condition: 'Wet' });
  const largeWedgeDecision = decisionEngine.evaluateSiteAction('Wedge', largeWedge.fsDry, largeWedge.fsWet, 'High confidence', undefined, 'Adequate', 2000);
  results.push({ case: 'Case 3: Large wedge with water', pass: largeWedgeDecision.actionLevel === 'Support required' });

  console.table(results);
};

runValidation();
