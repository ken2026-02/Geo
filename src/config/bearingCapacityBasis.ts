import type { DistributionBasisId } from '../engineering/bearingCapacitySpreadsheet';

export interface BearingBasisRecord {
  id: string;
  category: 'inputs' | 'bearing' | 'stress' | 'distribution' | 'reporting';
  code: string;
  title: string;
  definition: string;
  guidance: string;
  formula?: string;
  source: string;
  usedIn: string[];
  sectionId?: string;
  relatedTargets?: Array<{
    label: string;
    targetId: string;
  }>;
}

export const DISTRIBUTION_PRESETS: Record<
  Exclude<DistributionBasisId, 'manual'>,
  {
    label: string;
    ratio: number;
    guidance: string;
    source: string;
  }
> = {
  'cohesive-soft': {
    label: 'Cohesive: very soft to soft',
    ratio: 0,
    guidance: 'Use 1V:0H distribution for very soft to soft cohesive materials.',
    source: 'Spreadsheet rule table: cohesive material load distribution',
  },
  'cohesive-firm': {
    label: 'Cohesive: soft to firm',
    ratio: 0.25,
    guidance: 'Use 1V:0.25H distribution for soft to firm cohesive materials.',
    source: 'Spreadsheet rule table: cohesive material load distribution',
  },
  'cohesive-hard': {
    label: 'Cohesive: firm to hard',
    ratio: 0.5,
    guidance: 'Use 1V:0.5H distribution for firm to hard cohesive materials.',
    source: 'Spreadsheet rule table: cohesive material load distribution',
  },
  'cohesionless-loose': {
    label: 'Cohesionless: very loose to loose',
    ratio: 0.25,
    guidance: 'Use 1V:0.25H where phi is about 30 degrees or less.',
    source: 'Spreadsheet rule table: cohesionless material load distribution',
  },
  'cohesionless-medium': {
    label: 'Cohesionless: loose to medium dense',
    ratio: 0.5,
    guidance: 'Use 1V:0.5H where phi is between about 30 and 33 degrees.',
    source: 'Spreadsheet rule table: cohesionless material load distribution',
  },
  'cohesionless-dense': {
    label: 'Cohesionless: medium dense to very dense',
    ratio: 0.75,
    guidance: 'Use 1V:0.75H where phi is above about 33 degrees.',
    source: 'Spreadsheet rule table: cohesionless material load distribution',
  },
  'platform-unreinforced': {
    label: 'Platform: unreinforced',
    ratio: 0.5,
    guidance: 'Default spreadsheet platform spread for the platform layer in the current tracked plant check workbook.',
    source: 'Spreadsheet sample default: platform distribution 1V:0.5H',
  },
  'platform-reinforced': {
    label: 'Platform: reinforced',
    ratio: 1,
    guidance: 'Use 1V:1H distribution for reinforced platforms.',
    source: 'Spreadsheet note: reinforced platform rule',
  },
};

export const BEARING_BASIS_LIBRARY: BearingBasisRecord[] = [
  {
    id: 'pressure',
    category: 'inputs',
    code: 'BC-INPUT-01',
    title: 'Applied pressure P',
    definition: 'Machine or track contact pressure applied at the loaded area.',
    guidance: 'This is the top-of-platform applied pressure used by all three stress methods.',
    source: 'Spreadsheet key input: P - Pressure (kPa)',
    usedIn: ['Key inputs > P (kPa)', 'Report > Key Inputs', 'Report > Pressure / Bearing Capacity Profile'],
    sectionId: 'bearing-key-inputs',
    relatedTargets: [{ label: 'P (kPa)', targetId: 'bc-pressure' }],
  },
  {
    id: 'track-geometry',
    category: 'inputs',
    code: 'BC-INPUT-02',
    title: 'Track geometry',
    definition: 'Track length L and track width B define the loaded plan area.',
    guidance: 'Linear, Westergaard and Boussinesq stress calculations all use the same track geometry.',
    source: 'Spreadsheet key inputs: L and B',
    usedIn: ['Key inputs > L (m)', 'Key inputs > B (m)', 'Report > Key Inputs', 'Report > Pressure / Bearing Capacity Profile'],
    sectionId: 'bearing-key-inputs',
    relatedTargets: [
      { label: 'L (m)', targetId: 'bc-track-length' },
      { label: 'B (m)', targetId: 'bc-track-width' },
    ],
  },
  {
    id: 'platform-thickness',
    category: 'inputs',
    code: 'BC-INPUT-03',
    title: 'Platform thickness D',
    definition: 'Thickness of the working platform or capping layer.',
    guidance: 'The platform is treated as the first layer and is checked separately.',
    source: 'Spreadsheet key input and platform row',
    usedIn: ['Key inputs > D (m)', 'Platform > Thickness (m)', 'Report > Key Inputs', 'Report > Soil Layers'],
    sectionId: 'bearing-platform',
    relatedTargets: [{ label: 'D (m)', targetId: 'bc-platform-thickness' }],
  },
  {
    id: 'bearing-fos',
    category: 'inputs',
    code: 'BC-INPUT-04',
    title: 'Bearing factor of safety',
    definition: 'Factor of safety applied to ultimate bearing capacity to derive allowable capacity.',
    guidance: 'Allowable bearing capacity is calculated as Qult divided by the selected bearing FOS.',
    formula: 'Qall = Qult / FOS',
    source: 'Spreadsheet key input: Bearing FOS',
    usedIn: ['Key inputs > Bearing FOS', 'Results > Qall', 'Report > Key Inputs', 'Report > Bearing Check'],
    sectionId: 'bearing-key-inputs',
    relatedTargets: [{ label: 'Bearing FOS', targetId: 'bc-bearing-fos' }],
  },
  {
    id: 'su',
    category: 'inputs',
    code: 'BC-INPUT-05',
    title: 'Undrained shear strength Su',
    definition: 'Undrained shear strength used with cohesion in the spreadsheet strength term.',
    guidance: 'The current workbook combines c and Su in the same strength term. Keep the entered value aligned with the source geotechnical log or design note.',
    formula: 'strength term = c + Su',
    source: 'Spreadsheet bearing capacity table',
    usedIn: ['Platform > Su (kPa)', 'Soil profile > Su (kPa)', 'Report > Soil Layers', 'Report > Bearing Capacity Factors / Allowables'],
    sectionId: 'bearing-soil-profile',
    relatedTargets: [
      { label: 'Platform > Su', targetId: 'bc-platform-su' },
      { label: 'Soil profile', targetId: 'bearing-results' },
    ],
  },
  {
    id: 'phi',
    category: 'inputs',
    code: 'BC-INPUT-06',
    title: 'Friction angle phi',
    definition: 'Effective friction angle used to derive bearing factors and cohesionless load distribution rules.',
    guidance: 'phi drives both bearing factors and the automatic 1V:xH distribution presets for cohesionless materials.',
    source: 'Spreadsheet rule tables and bearing factor formulas',
    usedIn: ['Platform > phi (deg)', 'Soil profile > phi (deg)', 'Report > Soil Layers', 'Report > Bearing Capacity Factors / Allowables'],
    sectionId: 'bearing-soil-profile',
    relatedTargets: [
      { label: 'Platform > phi', targetId: 'bc-platform-phi' },
      { label: 'Soil profile', targetId: 'bearing-results' },
    ],
  },
  {
    id: 'c',
    category: 'inputs',
    code: 'BC-INPUT-07',
    title: 'Effective cohesion c',
    definition: 'Effective cohesion entered for the current platform or soil layer.',
    guidance: 'Used together with Su in the workbook strength term. Keep the chosen value traceable to the geotechnical basis.',
    source: 'Spreadsheet layer input table',
    usedIn: ['Platform > c (kPa)', 'Soil profile > c (kPa)', 'Report > Soil Layers', 'Report > Bearing Capacity Factors / Allowables'],
    sectionId: 'bearing-soil-profile',
    relatedTargets: [
      { label: "Platform > c'", targetId: 'bc-platform-c' },
      { label: 'Soil profile', targetId: 'bearing-results' },
    ],
  },
  {
    id: 'gamma',
    category: 'inputs',
    code: 'BC-INPUT-08',
    title: 'Unit weight gamma',
    definition: 'Bulk unit weight used for surcharge accumulation and the unit-weight bearing term.',
    guidance: 'Overburden is accumulated from the gamma and thickness of all layers above the current check depth.',
    formula: 'overburden = sum(gamma * thickness)',
    source: 'Spreadsheet layer input table and bearing calculation',
    usedIn: ['Platform > gamma (kN/m3)', 'Soil profile > gamma (kN/m3)', 'Report > Soil Layers', 'Report > Bearing Capacity Factors / Allowables'],
    sectionId: 'bearing-soil-profile',
    relatedTargets: [
      { label: 'Platform > gamma', targetId: 'bc-platform-gamma' },
      { label: 'Soil profile', targetId: 'bearing-results' },
    ],
  },
  {
    id: 'nu',
    category: 'inputs',
    code: 'BC-INPUT-09',
    title: 'Poisson ratio nu',
    definition: 'Poisson ratio used by the Westergaard stress method.',
    guidance: 'nu is only applied in the Westergaard influence factor. Boussinesq does not use a layer-specific nu in the current workbook.',
    source: 'Spreadsheet Westergaard table',
    usedIn: ['Platform > nu', 'Soil profile > nu', 'Report > Soil Layers', 'Report > Bearing Check'],
    sectionId: 'bearing-soil-profile',
    relatedTargets: [
      { label: 'Platform > nu', targetId: 'bc-platform-nu' },
      { label: 'Soil profile', targetId: 'bearing-results' },
    ],
  },
  {
    id: 'distribution-rule',
    category: 'distribution',
    code: 'BC-DIST-01',
    title: 'Distribution ratio 1V:xH',
    definition: 'Linear spread ratio used to expand the loaded plan dimensions with depth.',
    guidance: 'The app defaults to the spreadsheet rule tables and allows manual override when the design basis requires it.',
    source: 'Spreadsheet rule tables for cohesive, cohesionless and reinforced platform cases',
    usedIn: ['Platform > Distribution basis', 'Platform > Distribution 1V:xH', 'Soil profile > Distribution basis', 'Soil profile > Distribution 1V:xH', 'Report > Soil Layers'],
    sectionId: 'bearing-soil-profile',
    relatedTargets: [
      { label: 'Platform > Distribution basis', targetId: 'bc-platform-distribution-basis' },
      { label: 'Platform > Distribution 1V:xH', targetId: 'bc-platform-distribution-ratio' },
      { label: 'Soil profile', targetId: 'bearing-results' },
    ],
  },
  {
    id: 'bearing-factors',
    category: 'bearing',
    code: 'BC-METHOD-01',
    title: 'Bearing capacity factors',
    definition: 'Nq, Nc and Ngamma are calculated from phi using the spreadsheet method.',
    guidance: 'v1 follows the spreadsheet formulas before any theoretical cleanup.',
    formula: 'Nq = exp(pi tan(phi)) * tan^2(45 + phi/2); Nc = (Nq - 1) * cot(phi); Ngamma = (Nq - 1) * tan(1.4phi)',
    source: 'Spreadsheet formulas on Inputs / Westergaard / Boussinesq sheets',
    usedIn: ['Results > Bearing check table', 'Report > Bearing Capacity Factors / Allowables'],
    sectionId: 'bearing-results',
    relatedTargets: [{ label: 'Results table', targetId: 'bearing-results-table' }],
  },
  {
    id: 'linear-method',
    category: 'stress',
    code: 'BC-STRESS-01',
    title: 'Linear stress method',
    definition: 'Applied pressure is reduced with depth by expanding both loaded dimensions using 1V:xH spread ratios.',
    guidance: 'Platform and soil layer spread ratios are accumulated down the profile.',
    formula: 'Td = (P * L * B) / A*',
    source: 'Spreadsheet Linear sheet',
    usedIn: ['Results > Linear stresses', 'Report > Bearing Check', 'Report > Pressure / Bearing Capacity Profile'],
    sectionId: 'bearing-results',
    relatedTargets: [{ label: 'Results table', targetId: 'bearing-results-table' }],
  },
  {
    id: 'westergaard-method',
    category: 'stress',
    code: 'BC-STRESS-02',
    title: 'Westergaard stress method',
    definition: 'Applied pressure at depth is calculated using a Westergaard influence factor.',
    guidance: 'This method uses nu for the current layer.',
    formula: 'pressure = 4 * I * P',
    source: 'Spreadsheet Westergaard sheet',
    usedIn: ['Results > Westergaard stresses', 'Report > Bearing Check', 'Report > Pressure / Bearing Capacity Profile'],
    sectionId: 'bearing-results',
    relatedTargets: [{ label: 'Results table', targetId: 'bearing-results-table' }],
  },
  {
    id: 'boussinesq-method',
    category: 'stress',
    code: 'BC-STRESS-03',
    title: 'Boussinesq stress method',
    definition: 'Applied pressure at depth is calculated using a Boussinesq influence factor.',
    guidance: 'This method uses the same plan geometry but no layer-specific nu input.',
    formula: 'pressure = I4 * P',
    source: 'Spreadsheet Boussinesq sheet',
    usedIn: ['Results > Boussinesq stresses', 'Report > Bearing Check', 'Report > Pressure / Bearing Capacity Profile'],
    sectionId: 'bearing-results',
    relatedTargets: [{ label: 'Results table', targetId: 'bearing-results-table' }],
  },
  {
    id: 'reporting',
    category: 'reporting',
    code: 'BC-REPORT-01',
    title: 'Report and appendix output',
    definition: 'The report mirrors the workbook structure: key inputs, soil layers, bearing checks, chart, calculation appendix and basis appendix.',
    guidance: 'Use the report as the formal issue sheet. The app screen remains mobile-first and the report remains spreadsheet-style.',
    source: 'GeoField bearing report layout rule',
    usedIn: ['Report export', 'Entry detail > Print / Save PDF'],
    sectionId: 'bearing-results',
    relatedTargets: [
      { label: 'Results summary', targetId: 'bearing-results-summary' },
      { label: 'Assessment note', targetId: 'bearing-assessment-note' },
    ],
  },
];

export const getDistributionPreset = (basisId: DistributionBasisId) =>
  basisId === 'manual' ? null : DISTRIBUTION_PRESETS[basisId];
