type MappingLikeSet = {
  set_number: number;
  dip: number;
  dip_dir: number;
};

type MappingLikeRecord = {
  sets?: MappingLikeSet[];
};

type InvestigationSeedRecord = {
  investigation_type?: string | null;
  moisture_label?: string | null;
  plasticity_label?: string | null;
  density_label?: string | null;
  consistency_label?: string | null;
};

export const buildStructuralDefaultsFromMapping = (mapping: MappingLikeRecord | null) => {
  const sets = (mapping?.sets || [])
    .slice()
    .sort((a, b) => a.set_number - b.set_number)
    .slice(0, 3);

  return {
    joint1Dip: sets[0] ? String(sets[0].dip) : '',
    joint1DipDir: sets[0] ? String(sets[0].dip_dir) : '',
    joint2Dip: sets[1] ? String(sets[1].dip) : '',
    joint2DipDir: sets[1] ? String(sets[1].dip_dir) : '',
    joint3Dip: sets[2] ? String(sets[2].dip) : '',
    joint3DipDir: sets[2] ? String(sets[2].dip_dir) : ''
  };
};

export const buildSoilDefaultsFromInvestigation = (investigation: InvestigationSeedRecord | null) => {
  const type = investigation?.investigation_type || '';
  const moisture = (investigation?.moisture_label || '').toLowerCase();
  const plasticity = (investigation?.plasticity_label || '').toLowerCase();
  const density = (investigation?.density_label || '').toLowerCase();
  const consistency = (investigation?.consistency_label || '').toLowerCase();

  const isWet = moisture.includes('wet') || moisture.includes('moist') || moisture.includes('seep');
  const groundwaterCondition = isWet ? 'Wet' : 'Dry';
  const groundwaterDepth = isWet ? '1.0' : '5.0';

  if (type === 'Cohesive') {
    const highCompressibility = plasticity.includes('high') || consistency.includes('soft');
    return {
      soilPreset: 'clay',
      soilType: 'Clay',
      compressibilityFlag: highCompressibility ? 'High' : 'Moderate',
      groundwaterCondition,
      groundwaterDepth,
      unitWeight: '18.0',
      cohesion: highCompressibility ? '15.0' : '25.0',
      frictionAngle: '24.0'
    };
  }

  if (type === 'Granular') {
    const dense = density.includes('dense');
    return {
      soilPreset: dense ? 'dense_gravel' : 'sand',
      soilType: 'Sand',
      compressibilityFlag: 'Low',
      groundwaterCondition,
      groundwaterDepth,
      unitWeight: dense ? '20.0' : '18.0',
      cohesion: '0.0',
      frictionAngle: dense ? '38.0' : '32.0'
    };
  }

  if (type === 'Fill') {
    return {
      soilPreset: 'custom',
      soilType: 'Silt',
      compressibilityFlag: 'Moderate',
      groundwaterCondition,
      groundwaterDepth,
      unitWeight: '18.0',
      cohesion: '5.0',
      frictionAngle: '28.0'
    };
  }

  if (type === 'Transition') {
    return {
      soilPreset: 'custom',
      soilType: 'Silt',
      compressibilityFlag: 'Moderate',
      groundwaterCondition,
      groundwaterDepth,
      unitWeight: '19.0',
      cohesion: '10.0',
      frictionAngle: '30.0'
    };
  }

  return null;
};
