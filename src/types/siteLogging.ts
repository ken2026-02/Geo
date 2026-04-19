// Prefer Word spec enums, but keep open string unions for backwards compatibility.
export type SupportElementType =
  | 'anchor'
  | 'soil_nail'
  | 'micro_pile'
  | 'pile'
  | 'permanent_casing'
  | 'suitability_test'
  | 'trial_hole'
  | string;

export type SupportElementStatus =
  | 'draft'
  | 'logging_in_progress'
  | 'interpretation_pending'
  | 'verification_pending'
  | 'review_pending'
  | 'approved_for_grouting'
  | 'finalised'
  | string;

export interface Site {
  id: string;
  project_id: string;
  site_code: string;
  site_name: string | null;
  chainage_from_km: number | null;
  chainage_to_km: number | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SupportElement {
  id: string;
  project_id: string;
  site_id: string;
  element_type: SupportElementType | string;
  element_code: string | null;
  status: SupportElementStatus | string;
  location_description: string | null;
  chainage: number | null;
  offset_description: string | null;
  ground_rl: number | null;
  hole_angle_deg: number | null;
  hole_diameter_mm: number | null;
  rig_type: string | null;
  rig_model: string | null;
  bit_type: string | null;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string | null;
}

export interface SiteDesignInput {
  id: string;
  element_id: string;
  design_type: string;
  input_json: string;
  created_at?: string;
  updated_at?: string;
}

export interface SiteDrillingRecord {
  id: string;
  element_id: string;
  record_date: string | null; // ISO date
  method: string | null;
  start_depth_m: number | null;
  end_depth_m: number | null;
  notes: string | null;
  start_date?: string | null;
  end_date?: string | null;
  logged_by?: string | null;
  approved_by?: string | null;
  record_page_count?: number | null;
  general_note?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SiteDrillingInterval {
  id: string;
  record_id: string;
  from_depth_m: number;
  to_depth_m: number;
  observed_text: string | null;
  interpreted_text: string | null;
  recovery_text: string | null;
  water_text: string | null;
  response_text: string | null;
  drilling_time_min?: number | null;
  material_observed?: string | null;
  material_interpreted?: string | null;
  colour?: string | null;
  secondary_components_json?: string | null;
  weathering_class?: string | null;
  rock_type?: string | null;
  recovery_type?: string | null;
  water_condition?: string | null;
  drilling_response_json?: string | null;
  logging_phrase_output?: string | null;
  free_text_note?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SiteGroundReference {
  id: string;
  project_id: string;
  site_id: string | null;
  reference_type: string;
  source_label: string | null;
  reference_json: string;
  geotechnical_units_json?: string | null;
  expected_tor_min_m?: number | null;
  expected_tor_max_m?: number | null;
  reference_tor_velocity_ms?: number | null;
  expected_material_above_tor_json?: string | null;
  expected_material_below_tor_json?: string | null;
  site_risk_flags_json?: string | null;
  reference_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SiteInterpretation {
  id: string;
  element_id: string;
  confidence: string | null;
  summary: string | null;
  interpretation_json: string | null;
  reference_tor_depth_m?: number | null;
  reference_tor_velocity_ms?: number | null;
  actual_tor_depth_m?: number | null;
  tor_variance_m?: number | null;
  tor_variance_reason_json?: string | null;
  continuous_rock_start_m?: number | null;
  weak_band_intervals_json?: string | null;
  interpretation_confidence?: string | null;
  interpretation_summary?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SiteBoreholeCalibration {
  id: string;
  site_id: string;
  site_line_id: string | null;
  borehole_id: string;
  borehole_offset_m: string | null;
  elevation_difference_m: number | null;
  borehole_tor_depth_m_bgl: number | null;
  borehole_lithology_at_tor: string | null;
  srt_velocity_at_tor_ms: string | null;
  difference_geophysics_minus_borehole_m: number | null;
  variance_note: string | null;
  confidence: 'high' | 'medium' | 'low' | string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SiteCleanOutRecord {
  id: string;
  drilling_record_id: string;
  method_air: number;
  method_water: number;
  method_grout: number;
  clean_out_depth_m: number | null;
  clean_out_datetime: string | null;
  base_condition: 'clean' | 'soft' | 'sedimented' | 'contaminated' | 'unknown' | string | null;
  sedimentation_observed: number;
  approved_for_grouting: number;
  approval_note: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SiteApprovalRecord {
  id: string;
  element_id: string;
  logged_by: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  approved_for_grouting: number;
  approval_datetime: string | null;
  approval_comment: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SiteVerificationRecord {
  id: string;
  element_id: string;
  result_json: string;
  created_at?: string;
  updated_at?: string;
}

export interface SiteLoggingPhrase {
  id: string;
  category: 'material_observed' | 'material_interpreted' | 'recovery' | 'water' | 'behaviour' | 'template' | string;
  text: string;
  site_specific: number;
  site_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SiteOutputReport {
  id: string;
  element_id: string;
  report_text: string;
  report_json: string;
  created_at?: string;
  updated_at?: string;
}

export interface SiteFieldEvent {
  id: string;
  element_id: string;
  drilling_record_id: string | null;
  event_datetime: string | null;
  category: string | null;
  depth_m: number | null;
  note: string | null;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string | null;
}

export interface SitePhotoAttachment {
  id: string;
  element_id: string;
  drilling_record_id?: string | null;
  photo_type?: string | null;
  depth_m?: number | null;
  blob_key: string;
  mime_type: string | null;
  caption: string | null;
  taken_datetime: string | null;
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string | null;
}
