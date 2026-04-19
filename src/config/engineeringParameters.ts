/**
 * ENGINEERING PARAMETERS CONFIGURATION
 *
 * PURPOSE:
 * Provides standardized reference values for geotechnical and support parameters.
 *
 * NOTES:
 * - Values are screening-level engineering references for field use.
 * - Users may override with project-specific or test-derived values.
 * - Joint friction angle is joint-surface friction, not intact rock friction.
 */

export interface SoilStrengthPreset {
  label: string;
  value: string;
  unitWeight: number;
  cohesion: number;
  frictionAngle: number;
}

export const JOINT_FRICTION_OPTIONS = [
  { label: 'Very weak / slick jointing (20 deg)', value: 20 },
  { label: 'Weak jointed rock (25 deg)', value: 25 },
  { label: 'Moderate jointed rock (30 deg)', value: 30 },
  { label: 'Strong rough jointing (35 deg)', value: 35 },
  { label: 'Very rough / strong rock (40 deg)', value: 40 },
  { label: 'Custom', value: -1 },
];

export const COHESION_OPTIONS = [
  { label: 'Heavily fractured (0 kPa)', value: 0 },
  { label: 'Fractured rock (25 kPa)', value: 25 },
  { label: 'Jointed rock (50 kPa)', value: 50 },
  { label: 'Moderate rock mass (75 kPa)', value: 75 },
  { label: 'Massive rock (150 kPa)', value: 150 },
  { label: 'Custom', value: -1 },
];

export const GROUNDWATER_OPTIONS = [
  { label: 'Dry', value: 'Dry' },
  { label: 'Damp / minor seepage', value: 'Damp' },
  { label: 'Wet', value: 'Wet' },
  { label: 'Flowing water', value: 'Flowing' },
  { label: 'Pressurized', value: 'Pressurized' },
  { label: 'Custom', value: 'Custom' },
];

export const SHOTCRETE_THICKNESS_OPTIONS = [
  { label: '50 mm', value: 50 },
  { label: '75 mm', value: 75 },
  { label: '100 mm', value: 100 },
  { label: '150 mm', value: 150 },
  { label: 'Custom', value: -1 },
];

export const SHOTCRETE_REDUCTION_OPTIONS = [
  { label: 'Patchy contact (0.2)', value: 0.2 },
  { label: 'Typical field bond (0.3)', value: 0.3 },
  { label: 'Good continuity (0.5)', value: 0.5 },
  { label: 'Custom', value: -1 },
];

export const BOLT_CAPACITY_OPTIONS = [
  { label: '20 mm rebar bolt (120 kN)', value: 120 },
  { label: '20 mm high capacity bolt (180 kN)', value: 180 },
  { label: '25 mm rebar bolt (250 kN)', value: 250 },
  { label: 'Cable bolt (450 kN)', value: 450 },
  { label: 'Custom', value: -1 },
];

export const SHOTCRETE_SHEAR_STRENGTH_OPTIONS = [
  { label: 'Poor interface (100 kPa)', value: 100 },
  { label: 'Typical interface (200 kPa)', value: 200 },
  { label: 'Good interface (300 kPa)', value: 300 },
  { label: 'Reinforced / strong bond (400 kPa)', value: 400 },
  { label: 'Custom', value: -1 },
];

export const BOLT_EFFECTIVENESS_OPTIONS = [
  { label: 'Poor alignment (0.4)', value: 0.4 },
  { label: 'Moderate alignment (0.6)', value: 0.6 },
  { label: 'Good alignment (0.8)', value: 0.8 },
  { label: 'Near-optimal (1.0)', value: 1.0 },
  { label: 'Custom', value: -1 },
];

export const ANCHOR_CAPACITY_OPTIONS = [
  { label: 'Light cable anchor (300 kN)', value: 300 },
  { label: 'Standard cable anchor (500 kN)', value: 500 },
  { label: 'High capacity anchor (800 kN)', value: 800 },
  { label: 'Large anchor system (1000 kN)', value: 1000 },
  { label: 'Custom', value: -1 },
];

export const ANCHOR_EFFECTIVENESS_OPTIONS = [
  { label: 'Poor alignment (0.4)', value: 0.4 },
  { label: 'Moderate alignment (0.6)', value: 0.6 },
  { label: 'Good alignment (0.8)', value: 0.8 },
  { label: 'Near-optimal (1.0)', value: 1.0 },
  { label: 'Custom', value: -1 },
];

export const PERSISTENCE_FACTOR_OPTIONS = [
  { label: 'Short persistence (<1 m)', value: 0.5 },
  { label: 'Medium persistence (1-5 m)', value: 0.8 },
  { label: 'Long persistence (5-20 m)', value: 1.1 },
  { label: 'Very persistent (>20 m)', value: 1.4 },
  { label: 'Custom', value: -1 },
];

export const UNIT_WEIGHT_OPTIONS = [
  { label: 'Weathered / weak rock (22 kN/m3)', value: 22 },
  { label: 'Typical rock (25 kN/m3)', value: 25 },
  { label: 'Dense hard rock (27 kN/m3)', value: 27 },
  { label: 'Custom', value: -1 },
];

export const SOIL_STRENGTH_PRESETS: SoilStrengthPreset[] = [
  { label: 'Sand', value: 'sand', unitWeight: 18, cohesion: 0, frictionAngle: 32 },
  { label: 'Clay', value: 'clay', unitWeight: 18, cohesion: 20, frictionAngle: 20 },
  { label: 'Dense gravel', value: 'dense_gravel', unitWeight: 20, cohesion: 0, frictionAngle: 38 },
  { label: 'Silt', value: 'silt', unitWeight: 19, cohesion: 5, frictionAngle: 27 },
  { label: 'Custom', value: 'custom', unitWeight: 0, cohesion: 0, frictionAngle: 0 },
];
