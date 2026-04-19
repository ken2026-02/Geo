import type { SiteBoreholeCalibration, SiteGroundReference, SiteLoggingPhrase } from '../types/siteLogging';

type GroundReferenceSeed = {
  site_code: string;
  groundReference: Partial<SiteGroundReference>;
  calibrations: Array<Omit<SiteBoreholeCalibration, 'id' | 'site_id'>>;
};

export const SITE_GROUND_REFERENCE_SEEDS: GroundReferenceSeed[] = [
  {
    site_code: 'CCH013',
    groundReference: {
      geotechnical_units_json: JSON.stringify(['extremely_weathered_material', 'argillite_greywacke']),
      expected_tor_min_m: 6.3,
      expected_tor_max_m: 6.7,
      reference_tor_velocity_ms: 1600,
      expected_material_above_tor_json: JSON.stringify(['xw_argillite', 'clayey_sand_transition']),
      expected_material_below_tor_json: JSON.stringify(['argillite_greywacke', 'increasingly_competent_rock']),
      site_risk_flags_json: JSON.stringify(['weathering_profile']),
      reference_notes:
        'BH209 reference: ToR around 6.5 m in XW argillite / clayey sand transition. Competency increases by about 9.7 m at 2550 m/s.',
      reference_json: JSON.stringify(
        {
          source: 'Word report extract',
          units: ['XW material', 'Argillite/Greywacke rock'],
          examples: ['0.00-6.15 m XW material', '6.15-11.95 m Argillite/Greywacke rock'],
        },
        null,
        2
      ),
    },
    calibrations: [
      {
        site_line_id: 'CCH013-NS-001-SRT',
        borehole_id: 'BH209',
        borehole_offset_m: null,
        elevation_difference_m: null,
        borehole_tor_depth_m_bgl: 6.5,
        borehole_lithology_at_tor: 'XW argillite / clayey sand transition',
        srt_velocity_at_tor_ms: '1650/2550',
        difference_geophysics_minus_borehole_m: 0.2,
        variance_note: 'Competent material develops with depth; geophysics and borehole should be read together.',
        confidence: 'high',
      },
    ],
  },
  {
    site_code: 'CCH022',
    groundReference: {
      geotechnical_units_json: JSON.stringify(['colluvium', 'residual_soil', 'extremely_weathered_material']),
      expected_tor_min_m: null,
      expected_tor_max_m: null,
      reference_tor_velocity_ms: 1600,
      site_risk_flags_json: JSON.stringify(['groundwater_influence', 'low_confidence_tor']),
      reference_notes: 'Groundwater may influence velocity interpretation at this site.',
      reference_json: JSON.stringify({ source: 'Word report extract', note: 'Groundwater may influence velocity interpretation.' }, null, 2),
    },
    calibrations: [],
  },
  {
    site_code: 'CCH025',
    groundReference: {
      geotechnical_units_json: JSON.stringify(['colluvium', 'residual_soil', 'extremely_weathered_material', 'argillite_greywacke']),
      expected_tor_min_m: null,
      expected_tor_max_m: null,
      reference_tor_velocity_ms: 1600,
      site_risk_flags_json: JSON.stringify(['velocity_inversion', 'elevation_discrepancy', 'low_confidence_tor', 'rapid_depth_variation']),
      reference_notes:
        'Strong variation and lower confidence depending on location, inversion and elevation difference. BH206/207/208 show mixed colluvium, residual, XW and rock conditions.',
      reference_json: JSON.stringify(
        {
          source: 'Word report extract',
          examples: [
            'BH206: colluvium / residual / XW / argillite',
            'BH207: long colluvium and abandoned',
            'BH208: colluvium / XW / rock',
          ],
        },
        null,
        2
      ),
    },
    calibrations: [],
  },
];

export const LOGGING_PHRASE_SEEDS: Array<Omit<SiteLoggingPhrase, 'id' | 'created_at' | 'updated_at'>> = [
  { category: 'material_observed', text: 'colluvium with cobbles', site_specific: 0, site_id: null },
  { category: 'material_observed', text: 'extremely weathered material', site_specific: 0, site_id: null },
  { category: 'material_observed', text: 'argillite / greywacke chips', site_specific: 0, site_id: null },
  { category: 'material_interpreted', text: 'colluvial soil', site_specific: 0, site_id: null },
  { category: 'material_interpreted', text: 'residual soil', site_specific: 0, site_id: null },
  { category: 'material_interpreted', text: 'competent rock', site_specific: 0, site_id: null },
  { category: 'recovery', text: 'good return', site_specific: 0, site_id: null },
  { category: 'recovery', text: 'partial loss', site_specific: 0, site_id: null },
  { category: 'water', text: 'dry', site_specific: 0, site_id: null },
  { category: 'water', text: 'water encountered', site_specific: 0, site_id: null },
  { category: 'behaviour', text: 'slow drilling', site_specific: 0, site_id: null },
  { category: 'behaviour', text: 'hammer bounce', site_specific: 0, site_id: null },
  { category: 'template', text: 'Observed transition to more competent material with depth.', site_specific: 0, site_id: null },

  // Phrase-builder categories (field-first dropdowns)
  { category: 'observed_material', text: 'colluvium', site_specific: 0, site_id: null },
  { category: 'observed_material', text: 'clayey silty sand', site_specific: 0, site_id: null },
  { category: 'observed_material', text: 'sandy clay', site_specific: 0, site_id: null },
  { category: 'observed_material', text: 'angular rock chips', site_specific: 0, site_id: null },
  { category: 'interpreted_material', text: 'colluvium (inferred)', site_specific: 0, site_id: null },
  { category: 'interpreted_material', text: 'XW argillite', site_specific: 0, site_id: null },
  { category: 'interpreted_material', text: 'MW argillite', site_specific: 0, site_id: null },
  { category: 'interpreted_material', text: 'argillite/greywacke rock', site_specific: 0, site_id: null },
  { category: 'colour', text: 'brown', site_specific: 0, site_id: null },
  { category: 'colour', text: 'dark grey', site_specific: 0, site_id: null },
  { category: 'colour', text: 'grey', site_specific: 0, site_id: null },
  { category: 'modifier', text: 'high percentage of rock fragments', site_specific: 0, site_id: null },
  { category: 'modifier', text: 'possible boulders', site_specific: 0, site_id: null },
  { category: 'modifier', text: 'with cobbles', site_specific: 0, site_id: null },
  { category: 'water', text: 'with water', site_specific: 0, site_id: null },
  { category: 'recovery', text: 'inconsistent recovery', site_specific: 0, site_id: null },
  { category: 'drilling_response', text: 'slow drilling', site_specific: 0, site_id: null },
  { category: 'drilling_response', text: 'hammer bounce', site_specific: 0, site_id: null },
  { category: 'weathering', text: 'XW', site_specific: 0, site_id: null },
  { category: 'weathering', text: 'MW', site_specific: 0, site_id: null },
  { category: 'weathering', text: 'SW', site_specific: 0, site_id: null },
  { category: 'rock_type', text: 'argillite', site_specific: 0, site_id: null },
  { category: 'rock_type', text: 'greywacke', site_specific: 0, site_id: null },
  { category: 'common_phrase', text: 'Possible boulders; drilling recovery is inconsistent.', site_specific: 0, site_id: null },
  { category: 'common_phrase', text: 'Recovered as clayey silty sand with rock chips, with water.', site_specific: 0, site_id: null },
  { category: 'common_phrase', text: 'Observed transition to more competent material with depth.', site_specific: 0, site_id: null },
];
