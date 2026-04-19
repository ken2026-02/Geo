export type NormalizedJointSet = {
  id: string;
  dip: number;
  dipDirection: number;
};

export type NormalizedStructuralInput = {
  projectId: string;
  locationId: string;
  slopeDip: number | null;
  slopeDipDir: number | null;
  slopeOrientation: { dip: number | null; dipDirection: number | null };
  frictionAngle: number;
  friction: number;
  jointSets: NormalizedJointSet[];
  joint1Dip: number | null;
  joint1DipDir: number | null;
  joint2Dip: number | null;
  joint2DipDir: number | null;
  joint3Dip: number | null;
  joint3DipDir: number | null;
  planarPossible: boolean;
  wedgePossible: boolean;
  topplingPossible: boolean;
  controllingSet: string | null;
  controllingPair: string | null;
  wedgeTrend: number | null;
  wedgePlunge: number | null;
  confidenceLevel: string;
  engineeringNote: string;
  notes: string;
  kinematicResult: {
    planarPossible: boolean;
    wedgePossible: boolean;
    topplingPossible: boolean;
    controllingSet: string | null;
    controllingPair: string | null;
    wedgeTrend: number | null;
    wedgePlunge: number | null;
    confidenceSummary: string;
  };
};

type NormalizeOptions = {
  projectId?: string;
  locationId?: string;
  defaultEngineeringNote?: string;
};

export const parseStructuralNumeric = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeJointSets = (source: any): NormalizedJointSet[] => {
  if (source?.jointSets && Array.isArray(source.jointSets)) {
    return source.jointSets
      .map((joint: any, index: number) => ({
        id: String(joint?.id ?? `J${index + 1}`).toUpperCase(),
        dip: parseStructuralNumeric(joint?.dip ?? joint?.meanOrientation?.dip),
        dipDirection: parseStructuralNumeric(joint?.dipDirection ?? joint?.meanOrientation?.dipDirection)
      }))
      .filter((joint: any) => joint.dip !== null && joint.dipDirection !== null)
      .map((joint: any) => ({ id: joint.id, dip: joint.dip as number, dipDirection: joint.dipDirection as number }));
  }

  const fallback = [
    { id: 'J1', dip: parseStructuralNumeric(source?.joint1Dip), dipDirection: parseStructuralNumeric(source?.joint1DipDir) },
    { id: 'J2', dip: parseStructuralNumeric(source?.joint2Dip), dipDirection: parseStructuralNumeric(source?.joint2DipDir) },
    { id: 'J3', dip: parseStructuralNumeric(source?.joint3Dip), dipDirection: parseStructuralNumeric(source?.joint3DipDir) }
  ];

  return fallback
    .filter((joint) => joint.dip !== null && joint.dipDirection !== null)
    .map((joint) => ({ id: joint.id, dip: joint.dip as number, dipDirection: joint.dipDirection as number }));
};

export const normalizeStructuralInput = (source: any, options: NormalizeOptions = {}): NormalizedStructuralInput | null => {
  if (!source) return null;

  const projectId = String(source.projectId ?? options.projectId ?? '');
  const locationId = String(source.locationId ?? options.locationId ?? '');
  const slopeDip = parseStructuralNumeric(source.slopeDip ?? source.slopeOrientation?.dip);
  const slopeDipDir = parseStructuralNumeric(source.slopeDipDir ?? source.slopeOrientation?.dipDirection);
  const frictionAngle = parseStructuralNumeric(source.frictionAngle ?? source.friction) ?? 30;
  const jointSets = normalizeJointSets(source);

  const jointById = (jointId: string) => jointSets.find((joint) => joint.id === jointId) ?? null;
  const joint1 = jointById('J1');
  const joint2 = jointById('J2');
  const joint3 = jointById('J3');

  const planarPossible = Boolean(source.kinematicResult?.planarPossible ?? source.planarPossible);
  const wedgePossible = Boolean(source.kinematicResult?.wedgePossible ?? source.wedgePossible);
  const topplingPossible = Boolean(source.kinematicResult?.topplingPossible ?? source.topplingPossible);
  const controllingSet = source.kinematicResult?.controllingSet ?? source.controllingSet ?? null;
  const controllingPair = source.kinematicResult?.controllingPair ?? source.controllingPair ?? source.wedgeGeometry?.controllingPair ?? null;
  const wedgeTrend = parseStructuralNumeric(source.kinematicResult?.wedgeTrend ?? source.wedgeTrend ?? source.wedgeGeometry?.trend);
  const wedgePlunge = parseStructuralNumeric(source.kinematicResult?.wedgePlunge ?? source.wedgePlunge ?? source.wedgeGeometry?.plunge);
  const confidenceLevel = String(source.confidenceLevel ?? source.kinematicResult?.confidenceSummary ?? 'Low');
  const engineeringNote = String(source.engineeringNote ?? options.defaultEngineeringNote ?? 'Structural kinematic interpretation from the current assessment.');
  const notes = String(source.notes ?? '');

  return {
    projectId,
    locationId,
    slopeDip,
    slopeDipDir,
    slopeOrientation: { dip: slopeDip, dipDirection: slopeDipDir },
    frictionAngle,
    friction: frictionAngle,
    jointSets,
    joint1Dip: joint1?.dip ?? null,
    joint1DipDir: joint1?.dipDirection ?? null,
    joint2Dip: joint2?.dip ?? null,
    joint2DipDir: joint2?.dipDirection ?? null,
    joint3Dip: joint3?.dip ?? null,
    joint3DipDir: joint3?.dipDirection ?? null,
    planarPossible,
    wedgePossible,
    topplingPossible,
    controllingSet,
    controllingPair,
    wedgeTrend,
    wedgePlunge,
    confidenceLevel,
    engineeringNote,
    notes,
    kinematicResult: {
      planarPossible,
      wedgePossible,
      topplingPossible,
      controllingSet,
      controllingPair,
      wedgeTrend,
      wedgePlunge,
      confidenceSummary: confidenceLevel
    }
  };
};

export const normalizeStructuralRepoRecord = (record: any, options: NormalizeOptions = {}) =>
  normalizeStructuralInput(
    {
      projectId: options.projectId,
      locationId: options.locationId,
      slopeDip: record?.slope_dip,
      slopeDipDir: record?.slope_dip_dir,
      joint1Dip: record?.joint1_dip,
      joint1DipDir: record?.joint1_dip_dir,
      joint2Dip: record?.joint2_dip,
      joint2DipDir: record?.joint2_dip_dir,
      joint3Dip: record?.joint3_dip,
      joint3DipDir: record?.joint3_dip_dir,
      frictionAngle: record?.friction_angle,
      planarPossible: record?.planar_possible,
      wedgePossible: record?.wedge_possible,
      topplingPossible: record?.toppling_possible,
      controllingSet: record?.controlling_set,
      controllingPair: record?.controlling_pair,
      confidenceLevel: record?.confidence_level,
      engineeringNote: record?.engineering_note,
      notes: record?.notes
    },
    options
  );
