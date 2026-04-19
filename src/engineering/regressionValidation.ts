import { analyzeKinematics } from './kinematicEngine';
import { computeWedgeGeometry } from './wedgeGeometry';
import { planeToPole, planeToGreatCirclePoints, lineToStereonetXY } from '../utils/stereonet';
import { planeToPole as rocPlaneToPole, projectPoleEqualAngle } from '../utils/stereonetRocscience';
import { evaluateBearingCheck } from './bearingCapacitySpreadsheet';
import fs from 'node:fs';
import path from 'node:path';

interface RegressionCaseResult {
  name: string;
  pass: boolean;
  detail: string;
}

const parseNumericInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const approx = (actual: number | null | undefined, expected: number, tolerance: number): boolean => {
  return typeof actual === 'number' && Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
};

const allFinite = (points: { x: number; y: number }[]): boolean => points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
const allInsideNet = (points: { x: number; y: number }[]): boolean => points.every((p) => ((p.x ** 2) + (p.y ** 2)) <= 1.000001);

const results: RegressionCaseResult[] = [];
const add = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail });

const userExample = analyzeKinematics(78, 140, 30, [
  { id: 'J1', dip: 65, dipDirection: 50 },
  { id: 'J2', dip: 56, dipDirection: 230 },
  { id: 'J3', dip: 45, dipDirection: 127 }
]);
add('User example planar on J3', userExample.planarPossible && userExample.controllingSet === 'J3', `planar=${userExample.planarPossible}, controllingSet=${userExample.controllingSet}`);
add('User example wedge on J1 + J3', userExample.wedgePossible && userExample.controllingPair === 'J1 + J3', `wedge=${userExample.wedgePossible}, pair=${userExample.controllingPair}`);
add('User example wedge trend ~113', approx(userExample.wedgeTrend, 113.09, 1.0), `trend=${userExample.wedgeTrend}`);
add('User example wedge plunge ~44', approx(userExample.wedgePlunge, 44.15, 1.0), `plunge=${userExample.wedgePlunge}`);

const planarCase = analyzeKinematics(70, 180, 30, [
  { id: 'J1', dip: 45, dipDirection: 180 },
  { id: 'J2', dip: 30, dipDirection: 90 }
]);
add('Case 1 planar sliding', planarCase.planarPossible && !planarCase.wedgePossible, `planar=${planarCase.planarPossible}, wedge=${planarCase.wedgePossible}`);

const wedgeCase = analyzeKinematics(60, 180, 30, [
  { id: 'J1', dip: 50, dipDirection: 170 },
  { id: 'J2', dip: 50, dipDirection: 190 },
  { id: 'J3', dip: 20, dipDirection: 90 }
]);
add('Case 2 wedge sliding', wedgeCase.wedgePossible && wedgeCase.controllingPair === 'J1 + J2', `wedge=${wedgeCase.wedgePossible}, pair=${wedgeCase.controllingPair}`);
add('Case 2 trend ~180', approx(wedgeCase.wedgeTrend, 180, 1.0), `trend=${wedgeCase.wedgeTrend}`);
add('Case 2 plunge ~49.6', approx(wedgeCase.wedgePlunge, 49.57, 1.0), `plunge=${wedgeCase.wedgePlunge}`);

const noFailureCase = analyzeKinematics(45, 180, 30, [
  { id: 'J1', dip: 20, dipDirection: 0 },
  { id: 'J2', dip: 15, dipDirection: 90 },
  { id: 'J3', dip: 10, dipDirection: 270 }
]);
add('Case 3 no failure', !noFailureCase.planarPossible && !noFailureCase.wedgePossible && !noFailureCase.topplingPossible, JSON.stringify(noFailureCase));

const topplingCase = analyzeKinematics(70, 180, 25, [
  { id: 'J1', dip: 80, dipDirection: 0 },
  { id: 'J2', dip: 30, dipDirection: 90 },
  { id: 'J3', dip: 25, dipDirection: 270 }
]);
add('Case 4 toppling sensitive', topplingCase.topplingPossible && !topplingCase.wedgePossible, JSON.stringify(topplingCase));

const userPole = planeToPole(45, 127);
add('Pole trend formula', approx(userPole.trend, 307, 0.01), `trend=${userPole.trend}`);
add('Pole plunge formula', approx(userPole.plunge, 45, 0.01), `plunge=${userPole.plunge}`);

const slopeCaseNorth = rocPlaneToPole(45, 180);
const slopeNorthProj = projectPoleEqualAngle(45, 180);
add('Rocscience slope 45/180 pole trend', approx(slopeCaseNorth.trend, 0, 0.01), `trend=${slopeCaseNorth.trend}`);
add('Rocscience slope 45/180 pole plunge', approx(slopeCaseNorth.plunge, 45, 0.01), `plunge=${slopeCaseNorth.plunge}`);
add('Rocscience slope 45/180 on north side', Math.abs(slopeNorthProj.x) < 0.02 && slopeNorthProj.y > 0.35, `x=${slopeNorthProj.x}, y=${slopeNorthProj.y}`);

const slopeCaseWest = rocPlaneToPole(45, 90);
const slopeWestProj = projectPoleEqualAngle(45, 90);
add('Rocscience slope 45/090 pole trend', approx(slopeCaseWest.trend, 270, 0.01), `trend=${slopeCaseWest.trend}`);
add('Rocscience slope 45/090 pole plunge', approx(slopeCaseWest.plunge, 45, 0.01), `plunge=${slopeCaseWest.plunge}`);
add('Rocscience slope 45/090 on west side', slopeWestProj.x < -0.35 && Math.abs(slopeWestProj.y) < 0.02, `x=${slopeWestProj.x}, y=${slopeWestProj.y}`);

const slopeCaseNw = rocPlaneToPole(78, 140);
const slopeNwProj = projectPoleEqualAngle(78, 140);
add('Rocscience slope 78/140 pole trend', approx(slopeCaseNw.trend, 320, 0.01), `trend=${slopeCaseNw.trend}`);
add('Rocscience slope 78/140 pole plunge', approx(slopeCaseNw.plunge, 12, 0.01), `plunge=${slopeCaseNw.plunge}`);
add('Rocscience slope 78/140 in NW quadrant', slopeNwProj.x < -0.45 && slopeNwProj.y > 0.5, `x=${slopeNwProj.x}, y=${slopeNwProj.y}`);

const wedgeGeometry = computeWedgeGeometry(
  { dip: 78, dipDirection: 140 },
  { dip: 65, dipDirection: 50 },
  { dip: 45, dipDirection: 127 },
  3,
  25
);
add('Wedge geometry trend consistency', approx(wedgeGeometry.intersectionTrend, 113.09, 1.0), `trend=${wedgeGeometry.intersectionTrend}`);
add('Wedge geometry plunge consistency', approx(wedgeGeometry.intersectionPlunge, 44.15, 1.0), `plunge=${wedgeGeometry.intersectionPlunge}`);

const greatCircle = planeToGreatCirclePoints(45, 127);
add('Great circle point count', greatCircle.length === 91, `count=${greatCircle.length}`);
add('Great circle finite', allFinite(greatCircle), 'all projected points finite');
add('Great circle inside net', allInsideNet(greatCircle), 'all projected points inside unit circle');

const lineProjection = lineToStereonetXY(113.08756730101402, 44.14714756741876);
add('Intersection projection finite', Number.isFinite(lineProjection.x) && Number.isFinite(lineProjection.y), `x=${lineProjection.x}, y=${lineProjection.y}`);
add('Intersection projection inside net', ((lineProjection.x ** 2) + (lineProjection.y ** 2)) <= 1.000001, `r2=${(lineProjection.x ** 2) + (lineProjection.y ** 2)}`);

const numericCases: Array<{ input: string; expected: number | null }> = [
  { input: '', expected: null },
  { input: '-', expected: null },
  { input: '-10', expected: -10 },
  { input: '0.5', expected: 0.5 },
  { input: '10.', expected: 10 }
];
for (const numericCase of numericCases) {
  const actual = parseNumericInput(numericCase.input);
  add(`Numeric input ${JSON.stringify(numericCase.input)}`, actual === numericCase.expected, `actual=${actual}, expected=${numericCase.expected}`);
}

const bearingSpreadsheetSample = evaluateBearingCheck({
  meta: {
    title: 'CCH009 - southern pad',
    geotechRef: 'BH201',
    machinery: '25T Slew Crane',
    assessmentDate: '2026-04-16',
    preparedBy: 'NK',
  },
  equipment: {
    pressureKPa: 198,
    trackLengthM: 0.967,
    trackWidthM: 0.967,
    bearingFOS: 2,
  },
  platform: {
    id: 'platform',
    name: 'Platform',
    description: 'Type 2.3 Capping Layer (Lightly Bound)',
    thicknessM: 0.15,
    suKPa: 0,
    phiDeg: 36,
    cKPa: 5,
    gammaKNm3: 19,
    nu: 0.3,
    distributionRatio: 0.5,
    distributionMode: 'auto',
    distributionBasisId: 'platform-unreinforced',
    reinforced: false,
  },
  layers: [
    {
      id: 'layer-1',
      name: 'Layer 1',
      description: 'Colluvium with Cobbles',
      thicknessM: 1,
      suKPa: 0,
      phiDeg: 34,
      cKPa: 1,
      gammaKNm3: 19,
      nu: 0.3,
      distributionRatio: 0.75,
      distributionMode: 'auto',
      distributionBasisId: 'cohesionless-dense',
    },
    {
      id: 'layer-2',
      name: 'Layer 2',
      description: 'Colluvium with Cobbles',
      thicknessM: 0.5,
      suKPa: 0,
      phiDeg: 32,
      cKPa: 1,
      gammaKNm3: 19,
      nu: 0.3,
      distributionRatio: 0.75,
      distributionMode: 'auto',
      distributionBasisId: 'cohesionless-dense',
    },
    {
      id: 'layer-3',
      name: 'Layer 3',
      description: 'Colluvium with Cobbles',
      thicknessM: 0.5,
      suKPa: 0,
      phiDeg: 32,
      cKPa: 1,
      gammaKNm3: 19,
      nu: 0.3,
      distributionRatio: 0.75,
      distributionMode: 'auto',
      distributionBasisId: 'cohesionless-dense',
    },
  ],
  notes: '',
});
add('Bearing sample platform allowable matches spreadsheet', approx(bearingSpreadsheetSample.layerChecks[0]?.bearing.qall, 330.52403739436062, 1e-6), `qall=${bearingSpreadsheetSample.layerChecks[0]?.bearing.qall}`);
add('Bearing sample layer 1 allowable matches spreadsheet', approx(bearingSpreadsheetSample.layerChecks[1]?.bearing.qall, 206.09284996999938, 1e-6), `qall=${bearingSpreadsheetSample.layerChecks[1]?.bearing.qall}`);
add('Bearing sample layer 2 allowable matches spreadsheet', approx(bearingSpreadsheetSample.layerChecks[2]?.bearing.qall, 372.10621734923728, 1e-6), `qall=${bearingSpreadsheetSample.layerChecks[2]?.bearing.qall}`);
add('Bearing sample layer 3 allowable matches spreadsheet', approx(bearingSpreadsheetSample.layerChecks[3]?.bearing.qall, 482.19590433254729, 1e-6), `qall=${bearingSpreadsheetSample.layerChecks[3]?.bearing.qall}`);
add('Bearing sample linear platform stress matches spreadsheet', approx(bearingSpreadsheetSample.layerChecks[0]?.stress.linear, 148.39244555333903, 1e-6), `linear=${bearingSpreadsheetSample.layerChecks[0]?.stress.linear}`);
add('Bearing sample linear layer 1 stress matches spreadsheet', approx(bearingSpreadsheetSample.layerChecks[1]?.stress.linear, 27.034023883987139, 1e-6), `linear=${bearingSpreadsheetSample.layerChecks[1]?.stress.linear}`);
add('Bearing sample linear layer 2 stress matches spreadsheet', approx(bearingSpreadsheetSample.layerChecks[2]?.stress.linear, 16.331719252420175, 1e-6), `linear=${bearingSpreadsheetSample.layerChecks[2]?.stress.linear}`);
add('Bearing sample Westergaard layer 1 stress matches spreadsheet', approx(bearingSpreadsheetSample.layerChecks[1]?.stress.westergaard, 49.435721203138399, 1e-6), `westergaard=${bearingSpreadsheetSample.layerChecks[1]?.stress.westergaard}`);
add('Bearing sample Westergaard layer 2 stress matches spreadsheet', approx(bearingSpreadsheetSample.layerChecks[2]?.stress.westergaard, 29.394092584506076, 1e-6), `westergaard=${bearingSpreadsheetSample.layerChecks[2]?.stress.westergaard}`);
add('Bearing sample Boussinesq platform stress matches spreadsheet', approx(bearingSpreadsheetSample.layerChecks[0]?.stress.boussinesq, 194.06195147993697, 1e-6), `boussinesq=${bearingSpreadsheetSample.layerChecks[0]?.stress.boussinesq}`);
add('Bearing sample Boussinesq layer 1 stress matches spreadsheet', approx(bearingSpreadsheetSample.layerChecks[1]?.stress.boussinesq, 51.556210956212084, 1e-6), `boussinesq=${bearingSpreadsheetSample.layerChecks[1]?.stress.boussinesq}`);
add('Bearing sample Boussinesq layer 2 stress matches spreadsheet', approx(bearingSpreadsheetSample.layerChecks[2]?.stress.boussinesq, 28.394690106931698, 1e-6), `boussinesq=${bearingSpreadsheetSample.layerChecks[2]?.stress.boussinesq}`);

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const schemaSource = fs.readFileSync(path.join(repoRoot, 'src', 'db', 'schema.ts'), 'utf8');
const wedgeRepoSource = fs.readFileSync(path.join(repoRoot, 'src', 'repositories', 'wedgeFoSRepo.ts'), 'utf8');
const serviceSource = fs.readFileSync(path.join(repoRoot, 'src', 'services', 'engineeringDataService.ts'), 'utf8');
const brainSource = fs.readFileSync(path.join(repoRoot, 'src', 'engineering', 'rockEngineeringBrain.ts'), 'utf8');
const entryDetailSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'EntryDetail.tsx'), 'utf8');
const mappingSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'Mapping.tsx'), 'utf8');
const quickLogSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'QuickLog.tsx'), 'utf8');
const investigationSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'InvestigationLog.tsx'), 'utf8');
const quickLogRepoSource = fs.readFileSync(path.join(repoRoot, 'src', 'repositories', 'quickLogRepo.ts'), 'utf8');
const investigationRepoSource = fs.readFileSync(path.join(repoRoot, 'src', 'repositories', 'investigationRepo.ts'), 'utf8');
const structuralAssessmentSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'StructuralAssessment.tsx'), 'utf8');
const slopeAssessmentSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'SlopeAssessment.tsx'), 'utf8');
const bearingCapacitySource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'BearingCapacity.tsx'), 'utf8');
const earthPressureSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'EarthPressure.tsx'), 'utf8');
const settlementScreeningSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'SettlementScreening.tsx'), 'utf8');
const retainingWallSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'RetainingWallCheck.tsx'), 'utf8');
const soilSlopeSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'SoilSlopeStability.tsx'), 'utf8');
const dashboardSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'RockEngineeringDashboard.tsx'), 'utf8');
const soilServiceSource = fs.readFileSync(path.join(repoRoot, 'src', 'services', 'soilEngineeringDataService.ts'), 'utf8');
const reportRepoSource = fs.readFileSync(path.join(repoRoot, 'src', 'repositories', 'reportRepo.ts'), 'utf8');
const entryRepoSource = fs.readFileSync(path.join(repoRoot, 'src', 'repositories', 'entryRepo.ts'), 'utf8');
const actionRepoSource = fs.readFileSync(path.join(repoRoot, 'src', 'repositories', 'actionRepo.ts'), 'utf8');
const mediaRepoSource = fs.readFileSync(path.join(repoRoot, 'src', 'repositories', 'mediaRepo.ts'), 'utf8');
const fieldLoggingDefaultsSource = fs.readFileSync(path.join(repoRoot, 'src', 'utils', 'fieldLoggingDefaults.ts'), 'utf8');
const entryEditSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'EntryEdit.tsx'), 'utf8');
const locationDetailSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'LocationDetail.tsx'), 'utf8');
const homeSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'Home.tsx'), 'utf8');
const mainSource = fs.readFileSync(path.join(repoRoot, 'src', 'main.tsx'), 'utf8');
const rockClassificationSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'RockClassification.tsx'), 'utf8');
const gsiAssessmentSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'GSIAssessment.tsx'), 'utf8');
const supportDesignSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'SupportDesign.tsx'), 'utf8');
const formDraftsSource = fs.readFileSync(path.join(repoRoot, 'src', 'state', 'formDrafts.ts'), 'utf8');
const userPreferencesSource = fs.readFileSync(path.join(repoRoot, 'src', 'state', 'userPreferences.ts'), 'utf8');
const checklistSource = fs.readFileSync(path.join(repoRoot, 'docs', 'field-logging-regression-checklist.md'), 'utf8');
const locationOverviewSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'LocationOverview.tsx'), 'utf8');
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.tsx'), 'utf8');
const locationTimelineSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'LocationTimeline.tsx'), 'utf8');
const recordsSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'Records.tsx'), 'utf8');
const handoverSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'Handover.tsx'), 'utf8');
const exportBundleSource = fs.readFileSync(path.join(repoRoot, 'src', 'utils', 'exportBundle.ts'), 'utf8');
const projectsSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'Projects.tsx'), 'utf8');
const locationsSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'Locations.tsx'), 'utf8');
const wedgeFoSViewSource = fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'WedgeFoSView.tsx'), 'utf8');
const wedgeResultPanelsSource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'WedgeFoSResultPanels.tsx'), 'utf8');
const wedgeParameterPanelSource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'WedgeFoSParameterPanel.tsx'), 'utf8');
const quickLogObservationLibrarySource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'QuickLogObservationLibrary.tsx'), 'utf8');
const quickLogEventChainPanelSource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'QuickLogEventChainPanel.tsx'), 'utf8');
const handoverHeaderPanelSource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'HandoverHeaderPanel.tsx'), 'utf8');
const viteConfigSource = fs.readFileSync(path.join(repoRoot, 'vite.config.ts'), 'utf8');
const bearingSpreadsheetSource = fs.readFileSync(path.join(repoRoot, 'src', 'engineering', 'bearingCapacitySpreadsheet.ts'), 'utf8');
const bearingBasisSource = fs.readFileSync(path.join(repoRoot, 'src', 'config', 'bearingCapacityBasis.ts'), 'utf8');
const bearingRepoSource = fs.readFileSync(path.join(repoRoot, 'src', 'repositories', 'bearingCapacityRepo.ts'), 'utf8');
const bearingChartSource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'BearingCapacityChart.tsx'), 'utf8');

const wedgePersistenceFields = [
  'controlling_pair',
  'wedge_trend',
  'wedge_plunge',
  'water_head',
  'water_force',
  'risk_class',
  'action_level',
  'support_recommendation',
  'review_required',
  'driving_force',
  'shear_resistance',
  'shotcrete_contribution',
  'bolt_contribution',
  'anchor_contribution'
];
for (const field of wedgePersistenceFields) {
  add(`Schema contains ${field}`, schemaSource.includes(field), field);
  add(`Wedge repo persists ${field}`, wedgeRepoSource.includes(field), field);
}

const wedgeSnapshotFields = [
  'wedge_risk_class',
  'wedge_action_level',
  'wedge_support_recommendation',
  'wedge_review_required',
  'wedge_controlling_pair',
  'wedge_trend',
  'wedge_plunge'
];
for (const field of wedgeSnapshotFields) {
  add(`Snapshot exposes ${field}`, serviceSource.includes(field), field);
}

const wedgeEntryDetailFields = [
  'controlling_pair',
  'wedge_trend',
  'wedge_plunge',
  'water_head',
  'water_force',
  'risk_class',
  'action_level',
  'support_recommendation',
  'review_required',
  'driving_force',
  'shear_resistance',
  'shotcrete_contribution',
  'bolt_contribution',
  'anchor_contribution'
];
for (const field of wedgeEntryDetailFields) {
  add(`EntryDetail reads ${field}`, entryDetailSource.includes(`wedgeFoSData.${field}`), field);
}

add('Summary logic references latest wedge text', brainSource.includes('Latest wedge check:'), 'latestWedge text');
add('Rock brain prefers structured quick log observations', brainSource.includes('snapshot.quick_log_observations') && !brainSource.includes('entryRepo.listByLocation'), 'rock structured observations');
add('Rock brain uses mapping structure flags', brainSource.includes('snapshot.mapping_persistence_present') && brainSource.includes('snapshot.mapping_aperture_present'), 'rock mapping flags');
add('Summary logic exposes field action', brainSource.includes('fieldAction'), 'fieldAction');
add('Summary logic promotes wedge over single mode', brainSource.includes("failureMode = 'Multiple mechanisms'"), 'failureMode override');
add('Snapshot service filters deleted entries', (serviceSource.match(/AND e\.is_deleted = 0/g) || []).length >= 7, `count=${(serviceSource.match(/AND e\.is_deleted = 0/g) || []).length}`);

const mappingFields = ['ref_persistence', 'ref_aperture', 'ref_joint_water'];
for (const field of mappingFields) {
  add(`Mapping screen references ${field}`, mappingSource.includes(field), field);
}
add('EntryDetail reads mapping persistence', entryDetailSource.includes('set.persistence_id'), 'mapping persistence detail');
add('EntryDetail reads mapping aperture', entryDetailSource.includes('set.aperture_id'), 'mapping aperture detail');
add('EntryDetail reads mapping joint water', entryDetailSource.includes('set.water_id'), 'mapping joint water detail');
add('Phrase builder includes persistence', fs.readFileSync(path.join(repoRoot, 'src', 'phrases', 'phraseBuilder.ts'), 'utf8').includes('ref_persistence'), 'mapping phrase persistence');
add('Phrase builder includes aperture', fs.readFileSync(path.join(repoRoot, 'src', 'phrases', 'phraseBuilder.ts'), 'utf8').includes('ref_aperture'), 'mapping phrase aperture');
add('Phrase builder includes joint water', fs.readFileSync(path.join(repoRoot, 'src', 'phrases', 'phraseBuilder.ts'), 'utf8').includes('ref_joint_water'), 'mapping phrase water');

add('Schema contains quick_log_entries', schemaSource.includes('quick_log_entries'), 'quick_log_entries');
add('QuickLog repo persists selected_observations', quickLogRepoSource.includes('selected_observations'), 'selected_observations');
add('QuickLog repo persists trigger_category', quickLogRepoSource.includes('trigger_category'), 'trigger_category');
add('QuickLog repo persists immediate_action', quickLogRepoSource.includes('immediate_action'), 'immediate_action');
add('QuickLog repo persists review_required', quickLogRepoSource.includes('review_required'), 'review_required');
add('QuickLog screen builds generated summary', quickLogSource.includes('buildQuickLogSummary'), 'buildQuickLogSummary');
add('QuickLog detail block present', entryDetailSource.includes('Quick Log Details'), 'EntryDetail ET7');
add('QuickLog save requires observation selection', quickLogSource.includes('Please select at least one observation before saving'), 'QuickLog observation validation');
add('QuickLog create failure rolls back orphan entry', quickLogSource.includes('entryRepo.softDelete(entryId)'), 'QuickLog rollback');

add('Schema contains investigation_logs', schemaSource.includes('investigation_logs'), 'investigation_logs');
add('Investigation repo persists structured fields', investigationRepoSource.includes('investigation_type') && investigationRepoSource.includes('secondary_components'), 'investigation persistence');
add('Investigation screen uses type-specific summary builder', investigationSource.includes('buildInvestigationLoggingParagraph'), 'type-specific summary');
add('Investigation detail block present', entryDetailSource.includes('Investigation Details'), 'EntryDetail ET12');

add('StructuralAssessment imports mapping defaults', structuralAssessmentSource.includes('buildStructuralDefaultsFromMapping'), 'mapping -> structural defaults');
add('StructuralAssessment loads latest mapping', structuralAssessmentSource.includes('mappingRepo.getLatestByProjectAndLocation'), 'mapping latest load');
add('BearingCapacity uses investigation defaults', bearingCapacitySource.includes('buildSoilDefaultsFromInvestigation'), 'investigation -> bearing defaults');
add('EarthPressure uses investigation defaults', earthPressureSource.includes('buildSoilDefaultsFromInvestigation'), 'investigation -> earth defaults');
add('SettlementScreening uses investigation defaults', settlementScreeningSource.includes('buildSoilDefaultsFromInvestigation'), 'investigation -> settlement defaults');
add('RetainingWallCheck uses investigation defaults', retainingWallSource.includes('buildSoilDefaultsFromInvestigation'), 'investigation -> retaining wall defaults');
add('SoilSlopeStability uses investigation defaults', soilSlopeSource.includes('buildSoilDefaultsFromInvestigation'), 'investigation -> soil slope defaults');
add('Field logging defaults helper exists', fieldLoggingDefaultsSource.includes('buildStructuralDefaultsFromMapping') && fieldLoggingDefaultsSource.includes('buildSoilDefaultsFromInvestigation'), 'fieldLoggingDefaults helper');
add('Engineering snapshot exposes quick log fields', serviceSource.includes('quick_log_summary') && serviceSource.includes('quick_log_review_required') && serviceSource.includes('quick_log_observations'), 'quick log snapshot');
add('Engineering snapshot exposes mapping structure flags', serviceSource.includes('mapping_set_count') && serviceSource.includes('mapping_persistence_present') && serviceSource.includes('mapping_joint_water_present'), 'mapping structure snapshot');
add('Soil service returns structured investigation labels', soilServiceSource.includes('moisture_label') && soilServiceSource.includes('plasticity_label'), 'structured investigation labels');
add('Soil brain prefers structured observations over entry summaries', fs.readFileSync(path.join(repoRoot, 'src', 'engineering', 'soilEngineeringBrain.ts'), 'utf8').includes('engineeringDataService.getEngineeringSnapshotByLocation') && !fs.readFileSync(path.join(repoRoot, 'src', 'engineering', 'soilEngineeringBrain.ts'), 'utf8').includes('entryRepo.listByLocation'), 'soil structured observations');
add('Dashboard shows latest quick log hazard feed', dashboardSource.includes('Latest field observation / hazard'), 'dashboard quick log card');
add('Dashboard filters deleted action/photo entries', dashboardSource.includes('e.is_deleted = 0'), 'dashboard deleted filter');
add('Handover query joins quick log entries', reportRepoSource.includes('LEFT JOIN quick_log_entries ql ON ql.entry_id = e.id'), 'handover quick log join');
add('Handover includes review-required quick logs', reportRepoSource.includes("rt.id = 'ET7'") && reportRepoSource.includes('ql.review_required'), 'handover quick log review feed');

add('QuickLog repo supports updateByEntryId', quickLogRepoSource.includes('updateByEntryId'), 'QuickLog update');
add('Investigation repo supports updateByEntryId', investigationRepoSource.includes('updateByEntryId'), 'Investigation update');
add('Mapping repo supports updateByEntryId', fs.readFileSync(path.join(repoRoot, 'src', 'repositories', 'mappingRepo.ts'), 'utf8').includes('updateByEntryId'), 'Mapping update');
add('EntryDetail offers module edit', entryDetailSource.includes('Edit in Module') && entryDetailSource.includes("state: { entryId: id, mode: 'edit' }"), 'EntryDetail module edit');
add('EntryEdit offers module edit redirect', entryEditSource.includes('This record has structured module data.') && entryEditSource.includes("state: { entryId: id, mode: 'edit' }"), 'EntryEdit module edit');
add('QuickLog supports edit mode by entryId', quickLogSource.includes('useLocation') && quickLogSource.includes('quickLogRepo.updateByEntryId') && quickLogSource.includes('Edit Quick Log'), 'QuickLog edit mode');
add('Mapping supports edit mode by entryId', mappingSource.includes('useLocation') && mappingSource.includes('mappingRepo.updateByEntryId') && mappingSource.includes('Edit Rock Mapping'), 'Mapping edit mode');
add('Investigation supports edit mode by entryId', investigationSource.includes('useLocation') && investigationSource.includes('investigationRepo.updateByEntryId') && investigationSource.includes('Edit Investigation Log'), 'Investigation edit mode');
add('LocationDetail shows soil engineering summary', locationDetailSource.includes('Soil Engineering Summary') && locationDetailSource.includes('soilSummary'), 'LocationDetail soil summary');
add('LocationDetail shows latest field observation', locationDetailSource.includes('Latest Field Observation / Hazard') && locationDetailSource.includes('quick_log_summary'), 'LocationDetail quick hazard');
add('Soil service filters deleted open actions', soilServiceSource.includes('e.is_deleted = 0 AND a.is_closed = 0'), 'soil deleted filter');
add('Home includes field logging guidance', homeSource.includes('field observation / hazard') && homeSource.includes('soil / fill / transition') && homeSource.includes('slope screening'), 'Home guidance');
add('Shared user preferences module exists', userPreferencesSource.includes('getFieldAuthor') && userPreferencesSource.includes('isAutoBackupEnabled') && userPreferencesSource.includes('getLoggingStylePreference'), 'user preference helpers');
add('Shared form drafts module exists', formDraftsSource.includes('export const DRAFT_KEYS') && formDraftsSource.includes('loadFormDraft') && formDraftsSource.includes('saveFormDraft') && formDraftsSource.includes('clearFormDraft'), 'form draft helpers');
add('Home uses shared auto-backup preference', homeSource.includes('isAutoBackupEnabled') && homeSource.includes('setAutoBackupEnabledPreference'), 'Home shared preference');
add('Main uses shared auto-backup preference', mainSource.includes('isAutoBackupEnabled()') && !mainSource.includes("localStorage.getItem('geofield_auto_backup')"), 'Main shared preference');
add('Mapping uses shared logging preferences', mappingSource.includes('getLoggingStylePreference') && mappingSource.includes('setLoggingQualifiersPreference') && !mappingSource.includes("localStorage.getItem('geofield_pref_style')"), 'Mapping shared preferences');
add('Investigation uses shared logging preferences', investigationSource.includes('getLoggingStylePreference') && investigationSource.includes('setLoggingQualifiersPreference') && !investigationSource.includes("localStorage.getItem('geofield_pref_style')"), 'Investigation shared preferences');
add('QuickLog uses shared author and backup preferences', quickLogSource.includes('getFieldAuthor') && quickLogSource.includes('isAutoBackupEnabled') && !quickLogSource.includes("localStorage.getItem('geo_author')"), 'QuickLog shared preferences');
add('SlopeAssessment uses shared author and backup preferences', slopeAssessmentSource.includes('getFieldAuthor') && slopeAssessmentSource.includes('isAutoBackupEnabled') && !slopeAssessmentSource.includes("localStorage.getItem('geo_author')"), 'Slope shared preferences');
add('RockClassification uses shared author and backup preferences', rockClassificationSource.includes('getFieldAuthor') && rockClassificationSource.includes('isAutoBackupEnabled') && !rockClassificationSource.includes("localStorage.getItem('geo_author')"), 'Rock classification shared preferences');
add('Checklist includes edit in module', checklistSource.includes('Edit in Module') && checklistSource.includes('resave'), 'checklist edit/resave');
add('Home uses dynamic backup import', homeSource.includes("await import('../utils/backupBundle')") && !homeSource.includes("import { exportBackupZip, importBackupZip } from '../utils/backupBundle'"), 'Home backup import');
add('LocationOverview uses soil engineering summary service', locationOverviewSource.includes('getSoilEngineeringSummary') && !locationOverviewSource.includes('bearingCapacityRepo'), 'LocationOverview soil summary');
add('LocationOverview shows latest field observation', locationOverviewSource.includes('Latest field observation / hazard') && locationOverviewSource.includes('quick_log_summary'), 'LocationOverview quick hazard');
add('LocationTimeline filters deleted actions', locationTimelineSource.includes('e.is_deleted = 0'), 'LocationTimeline deleted filter');
add('LocationTimeline links to location review', locationTimelineSource.includes('Location Review') && locationTimelineSource.includes('locationOverviewRoute'), 'LocationTimeline location review');
add('Records offers location review action', recordsSource.includes('Location Review') && recordsSource.includes('locationOverviewRoute'), 'Records location review');
add('Records offers timeline action', recordsSource.includes('Timeline') && recordsSource.includes('locationTimelineRoute'), 'Records timeline');
add('Handover export uses final numbering', handoverSource.includes('3 Engineering summaries') && handoverSource.includes('4 Engineering judgement') && handoverSource.includes('9 Photo references'), 'Handover numbering');
add('Checklist covers location review and timeline', checklistSource.includes('Records / Location review workflow') && checklistSource.includes('LocationTimeline.tsx'), 'checklist location review');


add('Mapping uses nav-state prefill', mappingSource.includes('navState') && mappingSource.includes('projectId') && mappingSource.includes('locationId'), 'Mapping nav-state prefill');
add('Mapping create writes summary directly', mappingSource.includes('summary: editedSummary') && !mappingSource.includes("UPDATE entries SET summary = ? WHERE id = ?"), 'Mapping summary direct write');
add('Investigation uses nav-state prefill', investigationSource.includes('navState') && investigationSource.includes('setProjectId') && investigationSource.includes('setLocationId'), 'Investigation nav-state prefill');
add('Investigation save has top-level failure guard', investigationSource.includes("alert('Failed to save investigation log')"), 'Investigation save guard');
add('SlopeAssessment uses nav-state prefill', slopeAssessmentSource.includes('useLocation') && slopeAssessmentSource.includes('navState') && slopeAssessmentSource.includes('project_id'), 'Slope nav-state prefill');
add('Export bundle uses printable HTML summary', exportBundleSource.includes('Project Delivery Summary') && exportBundleSource.includes('Print / Save PDF') && exportBundleSource.includes('openPrintWindow'), 'Export summary HTML');
add('Export bundle reuses print window helper', exportBundleSource.includes('function openPrintWindow') && exportBundleSource.includes('Photo Sheet'), 'Export print helper');
add('Locations screen offers review workflow actions', locationsSource.includes('Review') && locationsSource.includes('Timeline') && locationsSource.includes('/location-overview/'), 'Locations review actions');
add('Projects screen shows workflow guidance', projectsSource.includes('Project workflow') && projectsSource.includes('Locations for field review'), 'Projects guidance');
add('Projects screen links active project to review surfaces', projectsSource.includes('/locations') && projectsSource.includes('/records') && projectsSource.includes('/handover'), 'Projects active actions');
add('Vite config defines manual chunks', viteConfigSource.includes('manualChunks') && viteConfigSource.includes('vendor-react') && viteConfigSource.includes('field-logging'), 'Vite manual chunks');
add('App uses shared route constants', appSource.includes("import { ROUTES") && appSource.includes('entryDetailRoute') && appSource.includes('locationOverviewRoute'), 'App route constants');
add('LocationOverview uses review surface header', locationOverviewSource.includes('ReviewSurfaceHeader') && locationOverviewSource.includes('Location review'), 'LocationOverview review header');
add('LocationTimeline uses review surface header', locationTimelineSource.includes('ReviewSurfaceHeader') && locationTimelineSource.includes('Timeline review'), 'LocationTimeline review header');
add('Dashboard uses review surface header component', dashboardSource.includes('ReviewSurfaceHeader') && dashboardSource.includes('Shift-ready engineering status for the selected location'), 'Dashboard review header component');
add('Handover uses review surface header component', handoverSource.includes('HandoverHeaderPanel') && handoverHeaderPanelSource.includes('Daily field and engineering handover pack'), 'Handover review header component');
add('WedgeFoSView uses extracted parameter panel', wedgeFoSViewSource.includes('WedgeFoSParameterPanel') && wedgeParameterPanelSource.includes('Wedge Stability Parameters') && wedgeParameterPanelSource.includes('Support Estimation') && wedgeParameterPanelSource.includes('Groundwater'), 'Wedge parameter panel extraction');
add('WedgeFoSView uses extracted result panels', wedgeFoSViewSource.includes('WedgeFoSResultPanels') && wedgeResultPanelsSource.includes('FoS Breakdown') && wedgeResultPanelsSource.includes('Result Summary'), 'Wedge result panel extraction');
add('QuickLog uses extracted observation library', quickLogSource.includes('QuickLogObservationLibrary') && quickLogObservationLibrarySource.includes('Observation Library'), 'QuickLog observation panel extraction');
add('QuickLog uses extracted event chain panel', quickLogSource.includes('QuickLogEventChainPanel') && quickLogEventChainPanelSource.includes('Event Chain'), 'QuickLog event panel extraction');
add('Handover uses extracted header panel', handoverSource.includes('HandoverHeaderPanel') && handoverHeaderPanelSource.includes('Daily field and engineering handover pack'), 'Handover header panel extraction');


const dbSource = fs.readFileSync(path.join(repoRoot, 'src', 'db', 'db.ts'), 'utf8');
const migrationSource = fs.readFileSync(path.join(repoRoot, 'src', 'db', 'migrations.ts'), 'utf8');
add('DB uses migration runner module', dbSource.includes("import { runMigrations } from './migrations'") && dbSource.includes('await runMigrations(dbInstance, currentVersion, persistDatabase, SEED);'), 'DB migration runner');
add('Migration module defines latest version', migrationSource.includes('export const LATEST_DB_VERSION = 35'), 'Migration latest version');
add('Migration module includes quick_log_entries', migrationSource.includes('Quick log entries') && migrationSource.includes('CREATE TABLE IF NOT EXISTS quick_log_entries'), 'DB quick log migration');
add('DB exposes ensureQuickLogEntriesTable', dbSource.includes('export function ensureQuickLogEntriesTable()'), 'DB quick log ensure helper');
add('DB reset uses scoped IndexedDB deletion', dbSource.includes('deleteIndexedDbDatabase') && dbSource.includes("if (db.name === DB_NAME)"), 'DB reset scope');
add('DB no longer deletes legacy projects at runtime', !dbSource.includes("DELETE FROM projects WHERE name = 'K-Project'") && !dbSource.includes("DELETE FROM locations"), 'DB legacy cleanup removed');
add('Entry repo filters deleted locations in location and cluster queries', entryRepoSource.includes('WHERE e.project_id = ? AND e.location_id = ? AND e.is_deleted = 0 AND l.is_deleted = 0') && entryRepoSource.includes('WHERE e.project_id = ? AND l.cluster_key = ? AND e.is_deleted = 0 AND l.is_deleted = 0'), 'entryRepo deleted filters');
add('LocationOverview uses aggregate action and photo queries', locationOverviewSource.includes('actionRepo.listOpenByLocation(locationId)') && locationOverviewSource.includes('mediaRepo.countByLocation(locationId)') && !locationOverviewSource.includes('entryRepo.listByLocation'), 'LocationOverview aggregates');
add('Action repo supports location-level open action query', actionRepoSource.includes('listOpenByLocation') && actionRepoSource.includes('l.is_deleted = 0'), 'Action repo location aggregate');
add('Media repo supports location-level photo count query', mediaRepoSource.includes('countByLocation') && mediaRepoSource.includes('l.is_deleted = 0'), 'Media repo location aggregate');
add('Export bundle escapes printable HTML content', exportBundleSource.includes('function escapeHtml') && exportBundleSource.includes("escapeHtml(e.summary || '')") && exportBundleSource.includes("escapeHtml(p.caption || 'No caption')"), 'Export bundle HTML escaping');
add('QuickLog repo ensures quick log table', quickLogRepoSource.includes('ensureQuickLogEntriesTable'), 'QuickLog repo ensure');
add('Handover screen shows summary cards', handoverSource.includes('High risks') && handoverSource.includes('Key items') && handoverSource.includes('Open actions'), 'Handover summary cards');
add('Dashboard uses shift-ready review wording', dashboardSource.includes('Shift-ready engineering status for the selected location'), 'Dashboard review wording');
add('Handover uses shift handover heading', handoverHeaderPanelSource.includes('Daily field and engineering handover pack'), 'Handover heading');
add('Export bundle uses project delivery summary wording', exportBundleSource.includes('Project Delivery Summary') && exportBundleSource.includes('Recent field records and engineering logs'), 'Export delivery wording');
add('Device checklist covers mobile photo offline workflow', fs.readFileSync(path.join(repoRoot, 'docs', 'field-logging-device-checklist.md'), 'utf8').includes('## 2. Camera and photo flow') && fs.readFileSync(path.join(repoRoot, 'docs', 'field-logging-device-checklist.md'), 'utf8').includes('## 3. Offline behavior'), 'Device checklist');
add('Report repo ensures quick log table', reportRepoSource.includes('ensureQuickLogEntriesTable'), 'Report repo ensure');
add('Engineering snapshot ensures quick log table', serviceSource.includes('ensureQuickLogEntriesTable'), 'Snapshot ensure');

add('Report repo supports project-scoped handover query', reportRepoSource.includes('getDailyHandover: (date: string, projectId?: string)') && reportRepoSource.includes('(? IS NULL OR e.project_id = ?)'), 'project scoped handover');
add('Handover uses active project in handover query', handoverSource.includes('reportRepo.getDailyHandover(date, getActiveProjectId() || undefined)'), 'handover project scope');
add('Home preview uses active project in handover query', homeSource.includes('reportRepo.getDailyHandover(today, getActiveProjectId() || undefined)'), 'home handover scope');
add('Main uses scoped reset in startup recovery UI', mainSource.includes('window.geofieldScopedReset()') && !mainSource.includes('localStorage.clear(); indexedDB.deleteDatabase'), 'scoped startup reset');
add('Main installs runtime error handlers', mainSource.includes('installRuntimeErrorHandlers') && mainSource.includes("window.addEventListener('unhandledrejection'"), 'runtime handlers');
add('App uses error boundary', mainSource.includes('AppErrorBoundary') && fs.readFileSync(path.join(repoRoot, 'src', 'components', 'AppErrorBoundary.tsx'), 'utf8').includes('componentDidCatch'), 'error boundary');
add('Diagnostics persists QuickLog structured row', fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'Diagnostics.tsx'), 'utf8').includes('quickLogRepo.create({') && fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'Diagnostics.tsx'), 'utf8').includes('Quick Log structured data not stored'), 'diagnostics quick log coverage');
add('Diagnostics persists Investigation structured row', fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'Diagnostics.tsx'), 'utf8').includes('investigationRepo.create({') && fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'Diagnostics.tsx'), 'utf8').includes('Investigation structured data not stored'), 'diagnostics investigation coverage');
add('Diagnostics shows runtime error log', fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'Diagnostics.tsx'), 'utf8').includes('Runtime Error Log') && fs.readFileSync(path.join(repoRoot, 'src', 'screens', 'Diagnostics.tsx'), 'utf8').includes('listRuntimeErrors'), 'diagnostics runtime errors');
add('LocationDetail uses aggregate open action count', locationDetailSource.includes('actionRepo.listOpenByLocation(id).length'), 'LocationDetail action aggregate');
add('LocationDetail uses location photo aggregate', locationDetailSource.includes('mediaRepo.countByLocation(id)'), 'LocationDetail photo aggregate');
add('Schema contains bearing capacity profile fields', schemaSource.includes('pressure_kpa REAL') && schemaSource.includes('platform_json TEXT') && schemaSource.includes('basis_version TEXT'), 'bearing schema fields');
add('Migration includes bearing capacity profile migration', migrationSource.includes('Bearing capacity profile data') && migrationSource.includes("PRAGMA user_version = 28"), 'bearing migration v28');
add('Bearing engine exports layered evaluation', bearingSpreadsheetSource.includes('evaluateBearingCheck') && bearingSpreadsheetSource.includes('calcLinearStressAtLayerBases') && bearingSpreadsheetSource.includes('calcWestergaardStressAtLayerBases') && bearingSpreadsheetSource.includes('calcBoussinesqStressAtLayerBases'), 'bearing layered engine');
add('Bearing engine summary exposes controlling layer and method', bearingSpreadsheetSource.includes('controllingLayerName') && bearingSpreadsheetSource.includes('controllingMethod') && bearingSpreadsheetSource.includes('minimumMarginKPa'), 'bearing engine summary');
add('Bearing basis library defines distribution presets', bearingBasisSource.includes('DISTRIBUTION_PRESETS') && bearingBasisSource.includes('platform-reinforced') && bearingBasisSource.includes('cohesionless-dense'), 'bearing basis presets');
add('Bearing basis library includes traceability fields', bearingBasisSource.includes('usedIn: string[]') && bearingBasisSource.includes('sectionId?: string') && bearingBasisSource.includes('Report > Bearing Check'), 'bearing basis traceability');
add('Bearing basis library includes related target indexing', bearingBasisSource.includes('relatedTargets?: Array') && bearingBasisSource.includes("targetId: 'bc-pressure'") && bearingBasisSource.includes("targetId: 'bearing-results-table'"), 'bearing basis related targets');
add('Bearing repo persists JSON profile/result data', bearingRepoSource.includes('platform_json') && bearingRepoSource.includes('layers_json') && bearingRepoSource.includes('result_json') && bearingRepoSource.includes('chart_json'), 'bearing repo JSON persistence');
add('Bearing screen uses layered spreadsheet engine', bearingCapacitySource.includes('evaluateBearingCheck') && bearingCapacitySource.includes('BearingCapacityChart') && bearingCapacitySource.includes('buildSoilDefaultsFromInvestigation'), 'bearing screen engine usage');
add('Bearing screen resets directly after save success', bearingCapacitySource.includes('const resetForm = () => {') && bearingCapacitySource.includes('onContinue={() => {') && bearingCapacitySource.includes('resetForm();'), 'bearing success reset');
add('Bearing repo supports updateByEntryId', bearingRepoSource.includes('updateByEntryId'), 'bearing repo update');
add('Bearing screen supports edit mode by entryId', bearingCapacitySource.includes('const editEntryId') && bearingCapacitySource.includes('loadExistingEntry') && bearingCapacitySource.includes('Edit Bearing Capacity Check'), 'bearing edit mode');
add('Bearing screen supports searchable parameter basis', bearingCapacitySource.includes('basisQuery') && bearingCapacitySource.includes('filteredBasisItems') && bearingCapacitySource.includes('Search parameter basis, formula or source'), 'bearing basis search');
add('Bearing screen supports basis traceability jump', bearingCapacitySource.includes('jumpToTarget') && bearingCapacitySource.includes('Used in') && bearingCapacitySource.includes('Jump to related section'), 'bearing basis jump');
add('Bearing screen supports related setting jumps from basis', bearingCapacitySource.includes('Related settings') && bearingCapacitySource.includes('jumpToTarget') && bearingCapacitySource.includes('target.targetId'), 'bearing basis related setting jump');
add('Bearing detail reads structured ET18 record', entryDetailSource.includes('BearingCapacityAssessmentRecord') && entryDetailSource.includes('bearingCapacityData.layers.length > 0') && entryDetailSource.includes('bearingCapacityData.platform'), 'bearing detail structured record');
add('EntryDetail offers module edit for ET18', entryDetailSource.includes("if (entry.entry_type_id === 'ET18') return { path: '/bearing-capacity', label: 'Bearing Capacity' }"), 'bearing module edit');
add('EntryEdit offers module edit for ET18', entryEditSource.includes("entry?.entry_type_id === 'ET18'") && entryEditSource.includes("path: '/bearing-capacity'"), 'bearing entry edit');
add('Bearing chart component renders all spreadsheet series', bearingChartSource.includes('Linear') && bearingChartSource.includes('Westergaard') && bearingChartSource.includes('Boussinesq') && bearingChartSource.includes('Allowable'), 'bearing chart series');
add('Export bundle supports bearing capacity report', exportBundleSource.includes('export function exportBearingCapacityReport') && exportBundleSource.includes('Bearing Capacity Report') && exportBundleSource.includes('Pressure / Bearing Capacity Profile'), 'bearing export report');
add('Bearing export includes basis appendix and factor table', exportBundleSource.includes('Basis / Source Appendix') && exportBundleSource.includes('Bearing Capacity Factors / Allowables') && (exportBundleSource.includes('Platform bearing check') || exportBundleSource.includes('Bearing Capacity Report')), 'bearing export appendix');
add('Bearing export groups basis appendix by category', exportBundleSource.includes('appendix-title') && exportBundleSource.includes('Distribution') && exportBundleSource.includes('Stress methods'), 'bearing grouped appendix');
const failed = results.filter((result) => !result.pass);
console.table(results.map((result) => ({ case: result.name, pass: result.pass ? 'PASS' : 'FAIL', detail: result.detail })));
if (failed.length > 0) {
  console.error(`\nEngineering regression validation failed: ${failed.length} case(s).`);
  process.exitCode = 1;
} else {
  console.log(`\nEngineering regression validation passed: ${results.length} case(s).`);
}





