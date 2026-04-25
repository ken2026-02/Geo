import type { SiteLoggingReferenceTemplateV1 } from './siteLoggingReferenceTemplate';

const now = () => new Date().toISOString();

const base = (name: string): SiteLoggingReferenceTemplateV1 => ({
  kind: 'site_logging_reference_template',
  schema_version: 1,
  template_name: name,
  metadata: { created_at: now(), updated_at: now() },
  ground_model: {
    geotechnical_units: [],
    expected_tor_min_m: null,
    expected_tor_max_m: null,
    reference_tor_velocity_ms: null,
    expected_material_above_tor: [],
    expected_material_below_tor: [],
    risk_flags: [],
    site_notes: '',
    reference_json: {},
    source_label: 'Starter template',
  },
  phrase_library: { phrases: [], phrase_admin: { archived: [], order_by_category: {} } },
  evidence: { borehole_calibrations: [], references: [] },
});

export const SITE_LOGGING_STARTER_TEMPLATES: Array<{
  id: string;
  title: string;
  description: string;
  template: SiteLoggingReferenceTemplateV1;
}> = [
  {
    id: 'starter-argillite-greywacke-weathered',
    title: 'Argillite / Greywacke weathered rock profile',
    description: 'Weathering terms, rock chips phrasing, and transition-style sentence templates.',
    template: (() => {
      const t = base('Argillite / Greywacke weathered rock profile');
      t.ground_model.expected_material_above_tor = ['Colluvium', 'Residual soil', 'Highly weathered rock fragments'];
      t.ground_model.expected_material_below_tor = ['HW argillite / greywacke', 'MW argillite / greywacke', 'SW rock'];
      t.phrase_library.phrases = [
        { category: 'weathering', text: 'XW', scope: 'site' },
        { category: 'weathering', text: 'HW', scope: 'site' },
        { category: 'weathering', text: 'MW', scope: 'site' },
        { category: 'weathering', text: 'SW', scope: 'site' },
        { category: 'rock_type', text: 'Argillite', scope: 'site' },
        { category: 'rock_type', text: 'Greywacke', scope: 'site' },
        { category: 'observed_material', text: 'dark grey angular rock chips', scope: 'site' },
        { category: 'observed_material', text: 'mixed soil with rock fragments', scope: 'site' },
        { category: 'observed_material', text: 'rock chips with fine dust', scope: 'site' },
        { category: 'interpreted_material', text: 'inferred highly weathered rock', scope: 'site' },
        { category: 'interpreted_material', text: 'HW argillite', scope: 'site' },
        { category: 'interpreted_material', text: 'MW argillite', scope: 'site' },
        { category: 'drilling_response', text: 'hammer bounce', scope: 'site' },
        { category: 'drilling_response', text: 'slow drilling', scope: 'site' },
        { category: 'sentence_pattern', text: 'Recovered as {observed}, with fragments of {interpreted}.', scope: 'site' },
        { category: 'sentence_pattern', text: '{interpreted}, recovered as {observed}, {modifier}.', scope: 'site' },
        { category: 'sentence_pattern', text: 'Transition into {weathering} {rock_type}; returns as {observed}.', scope: 'site' },
      ];
      return t;
    })(),
  },
  {
    id: 'starter-colluvium-over-weathered-rock',
    title: 'Colluvium over weathered rock',
    description: 'Common colluvium material phrasing and boulder/fragment wording.',
    template: (() => {
      const t = base('Colluvium over weathered rock');
      t.ground_model.expected_material_above_tor = ['Colluvium', 'Clayey silty sand', 'Cobbles / boulders possible'];
      t.ground_model.expected_material_below_tor = ['XW/HW rock', 'MW rock'];
      t.phrase_library.phrases = [
        { category: 'observed_material', text: 'clayey silty sand', scope: 'site' },
        { category: 'observed_material', text: 'clayey sandy gravel', scope: 'site' },
        { category: 'observed_material', text: 'mixed return with rock fragments', scope: 'site' },
        { category: 'modifier', text: 'with high percentage of rock fragments', scope: 'site' },
        { category: 'modifier', text: 'possible boulders', scope: 'site' },
        { category: 'water', text: 'with water', scope: 'site' },
        { category: 'recovery', text: 'inconsistent recovery', scope: 'site' },
        { category: 'sentence_pattern', text: 'Inferred {interpreted}, recovered as {observed}, {colour}, {modifier}.', scope: 'site' },
        { category: 'sentence_pattern', text: 'Recovered as {observed}, {modifier}.', scope: 'site' },
      ];
      return t;
    })(),
  },
  {
    id: 'starter-micropile-pile-logging',
    title: 'Micro-pile / pile drilling logging',
    description: 'Pile-oriented phrasing: casing notes, returns and conditions.',
    template: (() => {
      const t = base('Micro-pile / pile drilling logging');
      t.phrase_library.phrases = [
        { category: 'common_phrase', text: 'Casing advanced; monitor returns and stability.', scope: 'site' },
        { category: 'common_phrase', text: 'Clean-out required prior to grout.', scope: 'site' },
        { category: 'drilling_response', text: 'add casing', scope: 'site' },
        { category: 'drilling_response', text: 'flush hole', scope: 'site' },
        { category: 'observed_material', text: 'fine dust', scope: 'site' },
        { category: 'observed_material', text: 'chips', scope: 'site' },
        { category: 'sentence_pattern', text: 'Returns as {observed}; {water}; recovery {recovery}.', scope: 'site' },
      ];
      return t;
    })(),
  },
  {
    id: 'starter-soilnail-anchor-logging',
    title: 'Soil nail / anchor drilling logging',
    description: 'Anchor/soil nail language for rock entry and socket returns.',
    template: (() => {
      const t = base('Soil nail / anchor drilling logging');
      t.phrase_library.phrases = [
        { category: 'common_phrase', text: 'Drilling progress normal; monitor water and recovery.', scope: 'site' },
        { category: 'common_phrase', text: 'Rock entry noted; confirm socket length achieved.', scope: 'site' },
        { category: 'sentence_pattern', text: 'Entered {weathering} {rock_type}; recovered as {observed}.', scope: 'site' },
      ];
      return t;
    })(),
  },
];

