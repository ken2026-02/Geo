/**
 * GeoField AU - Phase 1.2 Schema & Seed Data
 */

export const DDL = `
-- 1. REFERENCE TABLES
CREATE TABLE IF NOT EXISTS ref_entry_type (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_risk_level (id TEXT PRIMARY KEY, label TEXT NOT NULL, weight INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ref_status (id TEXT PRIMARY KEY, label TEXT NOT NULL, weight INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ref_action_priority (id TEXT PRIMARY KEY, label TEXT NOT NULL, weight INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ref_lithology (id TEXT PRIMARY KEY, label TEXT NOT NULL, code TEXT);
CREATE TABLE IF NOT EXISTS ref_colour (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_weathering (id TEXT PRIMARY KEY, label TEXT NOT NULL, code TEXT, description TEXT);
CREATE TABLE IF NOT EXISTS ref_rock_strength (id TEXT PRIMARY KEY, label TEXT NOT NULL, code TEXT, range_mpa TEXT);
CREATE TABLE IF NOT EXISTS ref_structure (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_groundwater (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_joint_spacing (id TEXT PRIMARY KEY, label TEXT NOT NULL, range_mm TEXT);
CREATE TABLE IF NOT EXISTS ref_persistence (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_aperture (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_roughness (id TEXT PRIMARY KEY, label TEXT NOT NULL, value REAL);
CREATE TABLE IF NOT EXISTS ref_infill (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_joint_water (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_slope_type (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_failure_mode (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_likelihood (id TEXT PRIMARY KEY, label TEXT NOT NULL, weight INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ref_consequence (id TEXT PRIMARY KEY, label TEXT NOT NULL, weight INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ref_instability_indicator (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_controls (id TEXT PRIMARY KEY, label TEXT NOT NULL, category TEXT);
CREATE TABLE IF NOT EXISTS ref_bench_condition (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_toe_condition (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_drainage_condition (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_qa_result (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_anchor_type (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_bolt_type (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_grout_type (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_grout_return (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_wall_type (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_wall_condition (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_q_jn (id TEXT PRIMARY KEY, value REAL, label TEXT);
CREATE TABLE IF NOT EXISTS ref_q_jr (id TEXT PRIMARY KEY, value REAL, label TEXT);
CREATE TABLE IF NOT EXISTS ref_q_ja (id TEXT PRIMARY KEY, value REAL, label TEXT);
CREATE TABLE IF NOT EXISTS ref_q_jw (id TEXT PRIMARY KEY, value REAL, label TEXT);
CREATE TABLE IF NOT EXISTS ref_q_srf (id TEXT PRIMARY KEY, value REAL, label TEXT);
CREATE TABLE IF NOT EXISTS ref_soil_material_type (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_grain_size (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_grading (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_fines_content (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_plasticity (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_moisture (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_consistency (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_density (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_cementation (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_structure (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_fabric (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_angularity (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_particle_shape (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_organic_content (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_secondary_components (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_origin_soil (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_origin_fill (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_fill_inclusions (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_rock_transition (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_fill_moisture_condition (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_soil_classification_symbol (id TEXT PRIMARY KEY, label TEXT NOT NULL, description TEXT);
CREATE TABLE IF NOT EXISTS ref_fill_type (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_fill_composition (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_fill_contaminants (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_transition_material (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_pressure_state (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_compressibility (id TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ref_controlling_issue (id TEXT PRIMARY KEY, label TEXT NOT NULL);

-- 2. CORE DATA TABLES
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    chainage_start REAL,
    chainage_end REAL,
    side TEXT CHECK(side IN ('LHS', 'RHS', 'CL')),
    position TEXT CHECK(position IN ('Toe', 'Mid', 'Crest', 'Face', 'Bench')),
    lat REAL,
    lon REAL,
    rl REAL,
    cluster_key TEXT NOT NULL,
    description TEXT,
    last_used_at DATETIME,
    is_pinned INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    deleted_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_location_cluster ON locations(cluster_key);

CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    entry_type_id TEXT NOT NULL,
    risk_level_id TEXT NOT NULL,
    status_id TEXT NOT NULL,
    author TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    summary TEXT,
    is_handover_item INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    deleted_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (entry_type_id) REFERENCES ref_entry_type(id),
    FOREIGN KEY (risk_level_id) REFERENCES ref_risk_level(id),
    FOREIGN KEY (status_id) REFERENCES ref_status(id)
);
CREATE INDEX IF NOT EXISTS idx_entries_project_ts ON entries(project_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_entries_location_ts ON entries(location_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_entries_risk ON entries(risk_level_id);

-- 3. MODULE TABLES
CREATE TABLE IF NOT EXISTS mapping_entries (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    lithology_id TEXT REFERENCES ref_lithology(id),
    weathering_id TEXT REFERENCES ref_weathering(id),
    strength_id TEXT REFERENCES ref_rock_strength(id),
    structure_id TEXT REFERENCES ref_structure(id),
    groundwater_id TEXT REFERENCES ref_groundwater(id),
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS quick_log_entries (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    observation_mode TEXT,
    selected_observations TEXT,
    trigger_category TEXT,
    immediate_action TEXT,
    review_required INTEGER DEFAULT 0,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS investigation_logs (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    investigation_type TEXT NOT NULL,
    material_type_id TEXT,
    plasticity_id TEXT,
    moisture_id TEXT,
    consistency_id TEXT,
    structure_id TEXT,
    origin_id TEXT,
    secondary_components TEXT,
    grain_size_id TEXT,
    grading_id TEXT,
    fines_content_id TEXT,
    density_id TEXT,
    angularity_id TEXT,
    fill_type_id TEXT,
    composition_id TEXT,
    contaminant_id TEXT,
    inclusion_id TEXT,
    transition_material_id TEXT,
    notes TEXT,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS settlement_screening_assessments (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    soil_type TEXT,
    footing_width REAL,
    footing_pressure REAL,
    groundwater_condition TEXT,
    compressibility_flag TEXT,
    settlement_risk TEXT,
    differential_settlement_risk TEXT,
    design_note TEXT,
    notes TEXT,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS discontinuity_sets (
    id TEXT PRIMARY KEY,
    mapping_id TEXT,
    assessment_id TEXT,
    set_number INTEGER,
    dip INTEGER,
    dip_dir INTEGER,
    spacing_id TEXT REFERENCES ref_joint_spacing(id),
    persistence_id TEXT REFERENCES ref_persistence(id),
    aperture_id TEXT REFERENCES ref_aperture(id),
    roughness_id TEXT REFERENCES ref_roughness(id),
    infill_id TEXT REFERENCES ref_infill(id),
    water_id TEXT REFERENCES ref_joint_water(id),
    FOREIGN KEY (mapping_id) REFERENCES mapping_entries(id),
    FOREIGN KEY (assessment_id) REFERENCES slope_assessments(id)
);

CREATE TABLE IF NOT EXISTS slope_assessments (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    slope_type_id TEXT REFERENCES ref_slope_type(id),
    height REAL,
    angle INTEGER,
    dip_direction INTEGER,
    failure_mode_id TEXT REFERENCES ref_failure_mode(id),
    likelihood_id TEXT REFERENCES ref_likelihood(id),
    consequence_id TEXT REFERENCES ref_consequence(id),
    bench_condition_id TEXT REFERENCES ref_bench_condition(id),
    toe_condition_id TEXT REFERENCES ref_toe_condition(id),
    drainage_condition_id TEXT REFERENCES ref_drainage_condition(id),
    recommended_controls_text TEXT,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS slope_assessment_controls (
    assessment_id TEXT,
    control_id TEXT,
    PRIMARY KEY (assessment_id, control_id),
    FOREIGN KEY (assessment_id) REFERENCES slope_assessments(id),
    FOREIGN KEY (control_id) REFERENCES ref_controls(id)
);

CREATE TABLE IF NOT EXISTS slope_assessment_indicators (
    assessment_id TEXT,
    indicator_id TEXT,
    PRIMARY KEY (assessment_id, indicator_id),
    FOREIGN KEY (assessment_id) REFERENCES slope_assessments(id),
    FOREIGN KEY (indicator_id) REFERENCES ref_instability_indicator(id)
);

CREATE TABLE IF NOT EXISTS q_assessments (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    rqd INTEGER,
    jn_id TEXT REFERENCES ref_q_jn(id),
    jr_id TEXT REFERENCES ref_q_jr(id),
    ja_id TEXT REFERENCES ref_q_ja(id),
    jw_id TEXT REFERENCES ref_q_jw(id),
    srf_id TEXT REFERENCES ref_q_srf(id),
    computed_q REAL,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS qa_anchor (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    anchor_id TEXT,
    anchor_type_id TEXT REFERENCES ref_anchor_type(id),
    grout_type_id TEXT REFERENCES ref_grout_type(id),
    test_load REAL,
    result_id TEXT REFERENCES ref_qa_result(id),
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS qa_bolt (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    bolt_id TEXT,
    bolt_type_id TEXT REFERENCES ref_bolt_type(id),
    length_m REAL,
    spacing_m REAL,
    grout_return_id TEXT REFERENCES ref_grout_return(id),
    issues_text TEXT,
    result_id TEXT REFERENCES ref_qa_result(id),
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS qa_shotcrete (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    panel_id TEXT,
    thickness_mm INTEGER,
    mix_design TEXT,
    result_id TEXT REFERENCES ref_qa_result(id),
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS qa_retaining (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    wall_type_id TEXT REFERENCES ref_wall_type(id),
    condition_id TEXT REFERENCES ref_wall_condition(id),
    drainage_id TEXT REFERENCES ref_drainage_condition(id),
    result_id TEXT REFERENCES ref_qa_result(id),
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS retaining_wall_checks (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    wall_height REAL,
    base_width REAL,
    toe_width REAL,
    heel_width REAL,
    soil_unit_weight REAL,
    soil_friction_angle REAL,
    cohesion REAL,
    surcharge REAL,
    groundwater_condition TEXT,
    sliding_fs REAL,
    overturning_fs REAL,
    bearing_pressure REAL,
    eccentricity REAL,
    stability_result TEXT,
    notes TEXT,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS soil_slope_stability (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    slope_height REAL,
    slope_angle REAL,
    unit_weight REAL,
    cohesion REAL,
    friction_angle REAL,
    pore_pressure_ratio REAL,
    soil_type TEXT,
    groundwater_condition TEXT,
    erosion_present INTEGER,
    tension_crack_present INTEGER,
    toe_condition TEXT,
    stability_concern TEXT,
    indicative_fs_band TEXT,
    controlling_factor TEXT,
    recommended_action TEXT,
    design_note TEXT,
    notes TEXT,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

-- 3.X SITE LOGGING (NEW MODULE)
CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    site_code TEXT NOT NULL,
    site_name TEXT,
    chainage_from_km REAL,
    chainage_to_km REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_sites_project_code ON sites(project_id, site_code);

CREATE TABLE IF NOT EXISTS support_elements (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    element_type TEXT NOT NULL,
    element_code TEXT,
    status TEXT NOT NULL,
    location_description TEXT,
    chainage REAL,
    offset_description TEXT,
    ground_rl REAL,
    nail_rl REAL,
    hole_angle_deg REAL,
    hole_diameter_mm REAL,
    bar_diameter TEXT,
    rig_type TEXT,
    rig_model TEXT,
    bit_type TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0,
    deleted_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (site_id) REFERENCES sites(id)
);
CREATE INDEX IF NOT EXISTS idx_support_elements_site ON support_elements(site_id, updated_at);

CREATE TABLE IF NOT EXISTS site_design_inputs (
    id TEXT PRIMARY KEY,
    element_id TEXT NOT NULL,
    design_type TEXT NOT NULL,
    input_json TEXT NOT NULL,
    element_type TEXT,
    reference_rl_type TEXT,
    design_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (element_id) REFERENCES support_elements(id)
);
CREATE INDEX IF NOT EXISTS idx_site_design_inputs_element ON site_design_inputs(element_id);

CREATE TABLE IF NOT EXISTS site_drilling_records (
    id TEXT PRIMARY KEY,
    element_id TEXT NOT NULL,
    record_date TEXT,
    method TEXT,
    start_depth_m REAL,
    end_depth_m REAL,
    notes TEXT,
    start_date TEXT,
    end_date TEXT,
    logged_by TEXT,
    approved_by TEXT,
    record_page_count INTEGER,
    general_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (element_id) REFERENCES support_elements(id)
);
CREATE INDEX IF NOT EXISTS idx_site_drilling_records_element ON site_drilling_records(element_id, updated_at);

CREATE TABLE IF NOT EXISTS site_drilling_intervals (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL,
    from_depth_m REAL NOT NULL,
    to_depth_m REAL NOT NULL,
    observed_text TEXT,
    interpreted_text TEXT,
    recovery_text TEXT,
    water_text TEXT,
    response_text TEXT,
    drilling_time_min REAL,
    material_observed TEXT,
    material_interpreted TEXT,
    colour TEXT,
    secondary_components_json TEXT,
    weathering_class TEXT,
    rock_type TEXT,
    recovery_type TEXT,
    water_condition TEXT,
    drilling_response_json TEXT,
    logging_phrase_output TEXT,
    free_text_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES site_drilling_records(id)
);
CREATE INDEX IF NOT EXISTS idx_site_drilling_intervals_record ON site_drilling_intervals(record_id, from_depth_m);

CREATE TABLE IF NOT EXISTS site_ground_references (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    site_id TEXT,
    reference_type TEXT NOT NULL,
    source_label TEXT,
    reference_json TEXT NOT NULL,
    geotechnical_units_json TEXT,
    expected_tor_min_m REAL,
    expected_tor_max_m REAL,
    reference_tor_velocity_ms REAL,
    expected_material_above_tor_json TEXT,
    expected_material_below_tor_json TEXT,
    site_risk_flags_json TEXT,
    reference_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (site_id) REFERENCES sites(id)
);
CREATE INDEX IF NOT EXISTS idx_site_ground_references_site ON site_ground_references(site_id, reference_type);

CREATE TABLE IF NOT EXISTS site_interpretations (
    id TEXT PRIMARY KEY,
    element_id TEXT NOT NULL,
    confidence TEXT,
    summary TEXT,
    interpretation_json TEXT,
    reference_tor_depth_m REAL,
    reference_tor_velocity_ms REAL,
    actual_tor_depth_m REAL,
    tor_variance_m REAL,
    tor_variance_reason_json TEXT,
    continuous_rock_start_m REAL,
    weak_band_intervals_json TEXT,
    interpretation_confidence TEXT,
    interpretation_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (element_id) REFERENCES support_elements(id)
);
CREATE INDEX IF NOT EXISTS idx_site_interpretations_element ON site_interpretations(element_id, updated_at);

CREATE TABLE IF NOT EXISTS site_borehole_calibrations (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    site_line_id TEXT,
    borehole_id TEXT NOT NULL,
    borehole_offset_m TEXT,
    elevation_difference_m REAL,
    borehole_tor_depth_m_bgl REAL,
    borehole_lithology_at_tor TEXT,
    srt_velocity_at_tor_ms TEXT,
    difference_geophysics_minus_borehole_m REAL,
    variance_note TEXT,
    confidence TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id)
);
CREATE INDEX IF NOT EXISTS idx_site_borehole_calibrations_site ON site_borehole_calibrations(site_id, borehole_id);

CREATE TABLE IF NOT EXISTS site_clean_out_records (
    id TEXT PRIMARY KEY,
    drilling_record_id TEXT NOT NULL,
    method_air INTEGER DEFAULT 0,
    method_water INTEGER DEFAULT 0,
    method_grout INTEGER DEFAULT 0,
    clean_out_depth_m REAL,
    clean_out_datetime TEXT,
    base_condition TEXT,
    sedimentation_observed INTEGER DEFAULT 0,
    approved_for_grouting INTEGER DEFAULT 0,
    approval_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (drilling_record_id) REFERENCES site_drilling_records(id)
);
CREATE INDEX IF NOT EXISTS idx_site_clean_out_records_record ON site_clean_out_records(drilling_record_id);

CREATE TABLE IF NOT EXISTS site_anchor_verifications (
    id TEXT PRIMARY KEY,
    element_id TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (element_id) REFERENCES support_elements(id)
);
CREATE INDEX IF NOT EXISTS idx_site_anchor_verifications_element ON site_anchor_verifications(element_id);

CREATE TABLE IF NOT EXISTS site_pile_verifications (
    id TEXT PRIMARY KEY,
    element_id TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (element_id) REFERENCES support_elements(id)
);
CREATE INDEX IF NOT EXISTS idx_site_pile_verifications_element ON site_pile_verifications(element_id);

CREATE TABLE IF NOT EXISTS site_approval_records (
    id TEXT PRIMARY KEY,
    element_id TEXT NOT NULL,
    logged_by TEXT,
    reviewed_by TEXT,
    approved_by TEXT,
    approved_for_grouting INTEGER DEFAULT 0,
    approval_datetime TEXT,
    approval_comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (element_id) REFERENCES support_elements(id)
);
CREATE INDEX IF NOT EXISTS idx_site_approval_records_element ON site_approval_records(element_id);

CREATE TABLE IF NOT EXISTS site_logging_phrases (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  site_specific INTEGER DEFAULT 0,
  site_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);
CREATE INDEX IF NOT EXISTS idx_site_logging_phrases_category ON site_logging_phrases(category, site_id);

CREATE TABLE IF NOT EXISTS site_output_reports (
  id TEXT PRIMARY KEY,
  element_id TEXT NOT NULL,
  report_text TEXT NOT NULL,
  report_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (element_id) REFERENCES support_elements(id)
);
CREATE INDEX IF NOT EXISTS idx_site_output_reports_element ON site_output_reports(element_id);

CREATE TABLE IF NOT EXISTS site_field_events (
  id TEXT PRIMARY KEY,
  element_id TEXT NOT NULL,
  drilling_record_id TEXT,
  event_datetime TEXT,
  category TEXT,
  depth_m REAL,
  note TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_deleted INTEGER DEFAULT 0,
  deleted_at DATETIME,
  FOREIGN KEY (element_id) REFERENCES support_elements(id),
  FOREIGN KEY (drilling_record_id) REFERENCES site_drilling_records(id)
);
CREATE INDEX IF NOT EXISTS idx_site_field_events_element ON site_field_events(element_id, updated_at);

CREATE TABLE IF NOT EXISTS site_photo_attachments (
  id TEXT PRIMARY KEY,
  element_id TEXT NOT NULL,
  drilling_record_id TEXT,
  photo_type TEXT,
  depth_m REAL,
  blob_key TEXT NOT NULL,
  mime_type TEXT,
  caption TEXT,
  taken_datetime TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_deleted INTEGER DEFAULT 0,
  deleted_at DATETIME,
  FOREIGN KEY (element_id) REFERENCES support_elements(id),
  FOREIGN KEY (drilling_record_id) REFERENCES site_drilling_records(id)
);
CREATE INDEX IF NOT EXISTS idx_site_photo_attachments_element ON site_photo_attachments(element_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_site_photo_attachments_record ON site_photo_attachments(drilling_record_id, updated_at);

CREATE TABLE IF NOT EXISTS bearing_capacity_assessments (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    title TEXT,
    geotech_ref TEXT,
    machinery TEXT,
    assessment_date TEXT,
    prepared_by TEXT,
    pressure_kpa REAL,
    track_length_m REAL,
    track_width_m REAL,
    platform_thickness_m REAL,
    factor_of_safety REAL,
    footing_width REAL,
    footing_depth REAL,
    unit_weight REAL,
    cohesion REAL,
    friction_angle REAL,
    groundwater_depth REAL,
    ultimate_bearing_capacity REAL,
    allowable_bearing_capacity REAL,
    controlling_mode TEXT,
    controlling_layer TEXT,
    overall_pass INTEGER DEFAULT 0,
    platform_json TEXT,
    layers_json TEXT,
    result_json TEXT,
    chart_json TEXT,
    basis_version TEXT,
    notes TEXT,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    priority_id TEXT REFERENCES ref_action_priority(id),
    description TEXT,
    assigned_to TEXT,
    due_date DATE,
    is_closed INTEGER DEFAULT 0,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);
CREATE INDEX IF NOT EXISTS idx_actions_closed_due ON actions(is_closed, due_date);

CREATE TABLE IF NOT EXISTS media_metadata (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    blob_key TEXT NOT NULL,
    mime_type TEXT,
    caption TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);
CREATE INDEX IF NOT EXISTS idx_media_entry ON media_metadata(entry_id);

CREATE TABLE IF NOT EXISTS handover_notes (
    id TEXT PRIMARY KEY,
    date TEXT UNIQUE,
    site_coverage TEXT,
    geotech_assessment TEXT,
    qa_hold_points TEXT,
    risk_bullets TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS handover_item_overrides (
    date TEXT,
    entry_id TEXT,
    sort_order INTEGER,
    is_hidden INTEGER DEFAULT 0,
    manual_bullets TEXT,
    PRIMARY KEY(date, entry_id)
);

CREATE TABLE IF NOT EXISTS rmr_assessments (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    ucs_rating INTEGER,
    rqd_rating INTEGER,
    spacing_rating INTEGER,
    condition_rating INTEGER,
    groundwater_rating INTEGER,
    orientation_adjustment INTEGER,
    total_rmr INTEGER,
    rock_class TEXT,
    notes TEXT,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS gsi_assessments (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    structure_class TEXT,
    surface_condition_class TEXT,
    gsi_min INTEGER,
    gsi_max INTEGER,
    gsi_mid INTEGER,
    confidence_level TEXT,
    notes TEXT,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);
CREATE TABLE IF NOT EXISTS structural_assessments (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    slope_dip REAL,
    slope_dip_dir REAL,
    joint1_dip REAL,
    joint1_dip_dir REAL,
    joint2_dip REAL,
    joint2_dip_dir REAL,
    joint3_dip REAL,
    joint3_dip_dir REAL,
    friction_angle REAL,
    planar_possible INTEGER,
    wedge_possible INTEGER,
    toppling_possible INTEGER,
    dominant_failure_mode TEXT,
    hazard_level TEXT,
    notes TEXT,
    controlling_set TEXT,
    controlling_pair TEXT,
    confidence_level TEXT,
    engineering_note TEXT,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);
CREATE TABLE IF NOT EXISTS support_designs (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    source_q_value REAL,
    source_rmr INTEGER,
    source_gsi INTEGER,
    source_failure_mode TEXT,
    support_class TEXT,
    bolt_length_m REAL,
    bolt_spacing_m REAL,
    mesh_required INTEGER,
    shotcrete_thickness_mm INTEGER,
    drainage_required INTEGER,
    support_notes TEXT,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);
CREATE TABLE IF NOT EXISTS wedge_fos_assessments (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    wedge_weight REAL,
    friction_angle REAL,
    cohesion REAL,
    groundwater_condition TEXT,
    water_head REAL,
    water_force REAL,
    controlling_pair TEXT,
    wedge_trend REAL,
    wedge_plunge REAL,
    fos REAL,
    fos_shotcrete REAL,
    fos_bolt REAL,
    fos_anchor REAL,
    fos_combined REAL,
    stability_class TEXT,
    risk_class TEXT,
    action_level TEXT,
    support_recommendation TEXT,
    review_required INTEGER,
    interpretation TEXT,
    support_type TEXT,
    shotcrete_trace_length REAL,
    shotcrete_thickness REAL,
    shotcrete_shear_strength REAL,
    shotcrete_area REAL,
    shotcrete_reduction_factor REAL,
    bolt_capacity REAL,
    bolt_number REAL,
    bolt_trend REAL,
    bolt_plunge REAL,
    bolt_effectiveness REAL,
    bolt_orientation REAL,
    bolt_reduction_factor REAL,
    anchor_force REAL,
    anchor_number REAL,
    anchor_trend REAL,
    anchor_plunge REAL,
    anchor_effectiveness REAL,
    driving_force REAL,
    shear_resistance REAL,
    shotcrete_contribution REAL,
    bolt_contribution REAL,
    anchor_contribution REAL,
    notes TEXT,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);
CREATE TABLE IF NOT EXISTS support_design_calculations (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    source_q_value REAL,
    source_rmr INTEGER,
    source_gsi INTEGER,
    source_failure_mode TEXT,
    groundwater_severity TEXT,
    excavation_span REAL,
    batter_height REAL,
    support_class TEXT,
    bolt_length_m REAL,
    bolt_spacing_m REAL,
    mesh_required INTEGER,
    shotcrete_thickness_mm INTEGER,
    drainage_required INTEGER,
    design_note TEXT,
    FOREIGN KEY (entry_id) REFERENCES entries(id)
);
`;

export const SEED = `
-- Entry Types
INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET1','Mapping'),('ET2','Water Observation'),('ET3','Defect Log'),('ET4','Anchor QA'),('ET5','Retaining QA'),('ET6','Slope Failure'),('ET7','Quick Log'),('ET8','Shotcrete QA'),('ET9','Bolt QA'),('ET10','Site Instruction'),('ET11','Rock Mass Classification'),('ET12','Investigation Log'),('ET13','Rock Mass Rating'),('ET14','Geological Strength Index'),('ET15','Structural Assessment'),('ET16','Support Design'),('ET17','Support Design Calculator');

-- Risk Levels
INSERT OR IGNORE INTO ref_risk_level (id, label, weight) VALUES ('R1','Low',1),('R2','Medium',2),('R3','High',3),('R4','Critical',4);

-- Status
INSERT OR IGNORE INTO ref_status (id, label, weight) VALUES ('ST_OPEN','Open',3),('ST_MONITORING','Monitoring',2),('ST_CLOSED','Closed',0),('ST_DEFERRED','Deferred',1);

-- Action Priority
INSERT OR IGNORE INTO ref_action_priority (id, label, weight) VALUES ('P1','Critical / Immediate',3),('P2','High Priority',2),('P3','Routine',1);

-- Colours
INSERT OR IGNORE INTO ref_colour (id, label) VALUES ('C1','Grey'),('C2','Dark grey'),('C3','Black'),('C4','Brown'),('C5','Reddish brown'),('C6','Yellow-brown'),('C7','Red'),('C8','Pink'),('C9','Green'),('C10','Bluish-grey'),('C11','White'),('C12','Mottled');

-- Structures
INSERT OR IGNORE INTO ref_structure (id, label) VALUES ('STR1','Massive'),('STR2','Bedded'),('STR3','Laminated'),('STR4','Foliated'),('STR5','Sheared'),('STR6','Faulted'),('STR7','Jointed'),('STR8','Brecciated');

-- Roughness
INSERT OR IGNORE INTO ref_roughness (id, label, value) VALUES ('R1','Discontinuous',4.0),('R2','Rough, undulating',3.0),('R3','Smooth, undulating',2.0),('R4','Slickensided, undulating',1.5),('R5','Rough, planar',1.5),('R6','Smooth, planar',1.0),('R7','Slickensided, planar',0.5),('R8','Polished',0.5);

-- Infill
INSERT OR IGNORE INTO ref_infill (id, label) VALUES ('INF1','None/Clean'),('INF2','Clay'),('INF3','Silt'),('INF4','Sand'),('INF5','Calcite'),('INF6','Iron oxide'),('INF7','Gouge'),('INF8','Quartz');

-- Joint Water
INSERT OR IGNORE INTO ref_joint_water (id, label) VALUES ('JW1','Dry'),('JW2','Damp'),('JW3','Wet'),('JW4','Seeping'),('JW5','Flowing'),('JW6','Staining only');

-- Instability Indicators
INSERT OR IGNORE INTO ref_instability_indicator (id, label) VALUES ('IND1','Loose blocks'),('IND2','Overhang'),('IND3','Daylighting joints'),('IND4','Tension cracks'),('IND5','Fresh rockfall debris'),('IND6','Bulging'),('IND7','Seepage/wet patch'),('IND8','Blocked drains/ponding'),('IND9','Erosion/scour'),('IND10','Ravelling'),('IND11','Undercut toe'),('IND12','Recent blasting/vibration');

-- Slope Types
INSERT OR IGNORE INTO ref_slope_type (id, label) VALUES ('SL1','Rock batter'),('SL2','Soil batter'),('SL3','Mixed');

-- Bench Condition
INSERT OR IGNORE INTO ref_bench_condition (id, label) VALUES ('BC1','Good'),('BC2','Fair'),('BC3','Poor');

-- Toe Condition
INSERT OR IGNORE INTO ref_toe_condition (id, label) VALUES ('TC1','Supported'),('TC2','Undercut'),('TC3','Eroded'),('TC4','NA');

-- Drainage Condition
INSERT OR IGNORE INTO ref_drainage_condition (id, label) VALUES ('DC1','Functional'),('DC2','Partially blocked'),('DC3','Blocked'),('DC4','Not present');

-- QA Refs
INSERT OR IGNORE INTO ref_anchor_type (id, label) VALUES ('AT1','CT Bolt'),('AT2','Self-Drilling'),('AT3','Strand Anchor'),('AT4','Solid Bar'),('AT5','Removable');
INSERT OR IGNORE INTO ref_bolt_type (id, label) VALUES ('BT1','Friction Bolt'),('BT2','Resin Bolt'),('BT3','Expansion Shell'),('BT4','Fiberglass'),('BT5','Cable Bolt'),('BT6','D-Bolt');
INSERT OR IGNORE INTO ref_grout_type (id, label) VALUES ('GT1','GP Cement'),('GT2','High Early Strength'),('GT3','Resin Capsule'),('GT4','Chemical Grout');
INSERT OR IGNORE INTO ref_grout_return (id, label) VALUES ('GR1','Yes'),('GR2','No'),('GR3','Partial');
INSERT OR IGNORE INTO ref_wall_type (id, label) VALUES ('WT1','Crib Wall'),('WT2','Gabion'),('WT3','MSE Wall'),('WT4','Soil Nail Wall'),('WT5','Gravity Wall');
INSERT OR IGNORE INTO ref_wall_condition (id, label) VALUES ('WC1','Excellent'),('WC2','Good'),('WC3','Fair'),('WC4','Poor'),('WC5','Critical');

-- Q-System: Jn
INSERT OR IGNORE INTO ref_q_jn (id, value, label) VALUES ('JN1',0.5,'Massive'),('JN2',2.0,'One joint set'),('JN3',3.0,'One set + random'),('JN4',4.0,'Two sets'),('JN5',6.0,'Two sets + random'),('JN6',9.0,'Three sets'),('JN7',12.0,'Three sets + random'),('JN8',15.0,'Four or more sets');

-- Q-System: Jr
INSERT OR IGNORE INTO ref_q_jr (id, value, label) VALUES ('JR1',4.0,'Discontinuous'),('JR2',3.0,'Rough, undulating'),('JR3',2.0,'Smooth, undulating'),('JR4',1.5,'Slickensided, undulating'),('JR5',1.5,'Rough, planar'),('JR6',1.0,'Smooth, planar'),('JR7',0.5,'Slickensided, planar'),('JR8',1.0,'Crushed zone');

-- Q-System: Ja
INSERT OR IGNORE INTO ref_q_ja (id, value, label) VALUES ('JA1',0.75,'Tightly healed'),('JA2',1.0,'Unaltered walls'),('JA3',2.0,'Slightly altered walls'),('JA4',3.0,'Silty/sandy coating'),('JA5',4.0,'Clay coating'),('JA6',6.0,'Swelling clay coating'),('JA7',8.0,'Crushed rock infill'),('JA8',12.0,'Thick clay infill');

-- Q-System: Jw
INSERT OR IGNORE INTO ref_q_jw (id, value, label) VALUES ('JW1',1.0,'Dry/Minor inflow'),('JW2',0.66,'Medium inflow'),('JW3',0.5,'Large inflow'),('JW4',0.33,'Large inflow, high pressure'),('JW5',0.2,'Exceptionally high pressure'),('JW6',0.1,'Severe pressure'),('JW7',0.05,'Severe pressure, long duration'),('JW8',1.0,'NA');

-- Q-System: SRF
INSERT OR IGNORE INTO ref_q_srf (id, value, label) VALUES ('SRF1',2.5,'Weak zones, many'),('SRF2',5.0,'Weak zones, single'),('SRF3',2.5,'Loose rock, many joints'),('SRF4',1.0,'Medium stress'),('SRF5',0.5,'High stress'),('SRF6',5.0,'Mild rockburst'),('SRF7',10.0,'Heavy rockburst'),('SRF8',5.0,'Squeezing ground');

-- Lithology
INSERT OR IGNORE INTO ref_lithology (id, label, code) VALUES ('L1', 'Basalt', 'BS'), ('L2', 'Andesite', 'AN'), ('L3', 'Granite', 'GR'), ('L4', 'Sandstone', 'SS'), ('L5', 'Siltstone', 'ST'), ('L6', 'Mudstone', 'MS'), ('L7', 'Shale', 'SH'), ('L8', 'Limestone', 'LS'), ('L9', 'Fill', 'FL'), ('L10', 'Laterite', 'LAT'), ('L11', 'Saprolite', 'SAP'), ('L12', 'Schist', 'SC'), ('L13', 'Gneiss', 'GN'), ('L14', 'Quartzite', 'QTZ'), ('L15', 'Conglomerate', 'CON'), ('L16', 'Tuff', 'TF'), ('L17', 'Dolerite', 'DL'), ('L18', 'Rhyolite', 'RH'), ('L19', 'Claystone', 'CS'), ('L20', 'Alluvium', 'AL');

-- Weathering
INSERT OR IGNORE INTO ref_weathering (id, label, code, description) VALUES ('W1', 'Fresh', 'FR', 'No visible sign of rock material weathering'), ('W2', 'Slightly Weathered', 'SW', 'Discolouration on major discontinuity surfaces'), ('W3', 'Moderately Weathered', 'MW', 'Less than half of the rock material is decomposed'), ('W4', 'Highly Weathered', 'HW', 'More than half of the rock material is decomposed'), ('W5', 'Extremely Weathered', 'EW', 'Rock material is decomposed to a soil but structure is preserved'), ('W6', 'Residual Soil', 'RS', 'Soil derived from weathering of rock; structure destroyed');

-- Rock Strength
INSERT OR IGNORE INTO ref_rock_strength (id, label, code, range_mpa) VALUES ('S1','Extremely Low','EL','<1'),('S2','Very Low','VL','1-5'),('S3','Low','L','5-25'),('S4','Medium','M','25-50'),('S5','High','H','50-100'),('S6','Very High','VH','100-250'),('S7','Extremely High','EH','>250');

-- Groundwater
INSERT OR IGNORE INTO ref_groundwater (id, label) VALUES ('GW1', 'Dry'), ('GW2', 'Damp'), ('GW3', 'Wet'), ('GW4', 'Dripping'), ('GW5', 'Flowing');

-- Joint Spacing
INSERT OR IGNORE INTO ref_joint_spacing (id, label, range_mm) VALUES ('SP1', 'Very Wide', '>2000'), ('SP2', 'Wide', '600-2000'), ('SP3', 'Medium', '200-600'), ('SP4', 'Close', '60-200'), ('SP5', 'Very Close', '<60');

-- Persistence
INSERT OR IGNORE INTO ref_persistence (id, label) VALUES ('P1', '<1m'), ('P2', '1-3m'), ('P3', '3-10m'), ('P4', '10-20m'), ('P5', '>20m');

-- Aperture
INSERT OR IGNORE INTO ref_aperture (id, label) VALUES ('A1', 'Tight (<0.1mm)'), ('A2', 'Open (0.1-1mm)'), ('A3', 'Wide (1-5mm)'), ('A4', 'Very Wide (>5mm)');

-- Failure Modes
INSERT OR IGNORE INTO ref_failure_mode (id, label) VALUES ('FM1', 'Planar Slide'), ('FM2', 'Wedge Failure'), ('FM3', 'Toppling'), ('FM4', 'Circular Failure'), ('FM5', 'Rockfall / Raveling');

-- Controls
INSERT OR IGNORE INTO ref_controls (id, label, category) VALUES ('C1', 'Scaling', 'Immediate'), ('C2', 'Exclusion Zone', 'Immediate'), ('C3', 'Shotcrete Support', 'Engineering'), ('C4', 'Rock Bolts', 'Engineering'), ('C5', 'Mesh Installation', 'Engineering'), ('C6', 'Drainage Holes', 'Engineering'), ('C7', 'Prism Monitoring', 'Monitoring'), ('C8', 'Visual Inspection', 'Monitoring'), ('C9', 'Inclinometers', 'Monitoring'), ('C10', 'Berm Construction', 'Engineering');

-- QA Results
INSERT OR IGNORE INTO ref_qa_result (id, label) VALUES ('QA1', 'Acceptable'), ('QA2', 'Minor Issues - Monitor'), ('QA3', 'Major Issues - Rectify'), ('QA4', 'Rejected');

-- Likelihood / Consequence
INSERT OR IGNORE INTO ref_likelihood (id, label, weight) VALUES ('L1','Rare',1),('L2','Unlikely',2),('L3','Possible',3),('L4','Likely',4),('L5','Almost Certain',5);
INSERT OR IGNORE INTO ref_consequence (id, label, weight) VALUES ('C1','Insignificant',1),('C2','Minor',2),('C3','Moderate',3),('C4','Major',4),('C5','Catastrophic',5);

-- Soil Material Types
INSERT OR IGNORE INTO ref_soil_material_type (id, label) VALUES ('MT1','Topsoil'),('MT2','Fill'),('MT3','Clay'),('MT4','Silt'),('MT5','Sand'),('MT6','Gravel'),('MT7','Cobble'),('MT8','Boulder'),('MT9','Clayey SAND'),('MT10','Silty SAND'),('MT11','Sandy CLAY'),('MT12','Silty CLAY'),('MT13','Sandy SILT'),('MT14','Clayey SILT'),('MT15','Decomposed rock / Saprolite'),('MT16','Extremely weathered material (soil-like)');

-- Soil Grain Size
INSERT OR IGNORE INTO ref_soil_grain_size (id, label) VALUES ('GS1','Very fine'),('GS2','Fine'),('GS3','Medium'),('GS4','Coarse'),('GS5','Very coarse'),('GS6','Mixed'),('GS9','Not assessed');

-- Soil Grading
INSERT OR IGNORE INTO ref_soil_grading (id, label) VALUES ('GR1','Well graded'),('GR2','Poorly graded'),('GR3','Uniformly graded'),('GR4','Gap graded'),('GR5','Not assessed');

-- Soil Fines Content
INSERT OR IGNORE INTO ref_soil_fines_content (id, label) VALUES ('FN1','None to trace fines'),('FN2','Little fines'),('FN3','Some fines'),('FN4','Fines-rich'),('FN9','Not assessed');

-- Soil Plasticity
INSERT OR IGNORE INTO ref_soil_plasticity (id, label) VALUES ('PL1','Non-plastic'),('PL2','Low plasticity'),('PL3','Medium plasticity'),('PL4','High plasticity'),('PL5','Not assessed');

-- Soil Moisture
INSERT OR IGNORE INTO ref_soil_moisture (id, label) VALUES ('MO1','Dry'),('MO2','Slightly moist'),('MO3','Moist'),('MO4','Wet'),('MO5','Saturated'),('MO6','Not assessed');

-- Soil Consistency (Cohesive)
INSERT OR IGNORE INTO ref_soil_consistency (id, label) VALUES ('COH1','Very soft'),('COH2','Soft'),('COH3','Firm'),('COH4','Stiff'),('COH5','Very stiff'),('COH6','Hard'),('COH7','Not assessed');

-- Soil Density (Non-cohesive)
INSERT OR IGNORE INTO ref_soil_density (id, label) VALUES ('DEN1','Very loose'),('DEN2','Loose'),('DEN3','Medium dense'),('DEN4','Dense'),('DEN5','Very dense'),('DEN6','Not assessed');

-- Soil Cementation
INSERT OR IGNORE INTO ref_soil_cementation (id, label) VALUES ('CE0','None'),('CE1','Slightly cemented'),('CE2','Cemented'),('CE3','Strongly cemented'),('CE9','Not assessed');

-- Soil Structure
INSERT OR IGNORE INTO ref_soil_structure (id, label) VALUES ('ST1','Massive'),('ST2','Layered / stratified'),('ST3','Laminated'),('ST4','Fissured'),('ST5','Slickensided'),('ST6','Disrupted / remoulded'),('ST7','Desiccation cracks'),('ST8','Cemented bands'),('ST9','Not assessed');

-- Soil Fabric
INSERT OR IGNORE INTO ref_soil_fabric (id, label) VALUES ('FB1','Homogeneous'),('FB2','Heterogeneous'),('FB3','Matrix-supported'),('FB4','Clast-supported'),('FB5','Not assessed');

-- Soil Angularity
INSERT OR IGNORE INTO ref_soil_angularity (id, label) VALUES ('AN1','Angular'),('AN2','Sub-angular'),('AN3','Sub-rounded'),('AN4','Rounded'),('AN9','Not assessed');

-- Soil Particle Shape
INSERT OR IGNORE INTO ref_soil_particle_shape (id, label) VALUES ('PS1','Equant'),('PS2','Elongated'),('PS3','Flat'),('PS4','Flat & elongated'),('PS5','Not assessed');

-- Soil Organic Content
INSERT OR IGNORE INTO ref_soil_organic_content (id, label) VALUES ('OR0','None'),('OR1','Slightly organic'),('OR2','Organic'),('OR3','Highly organic / peat'),('OR4','Not assessed');

-- Soil Secondary Components
INSERT OR IGNORE INTO ref_soil_secondary_components (id, label) VALUES ('SC1','Gravelly'),('SC2','Sandy'),('SC3','Silty'),('SC4','Clayey'),('SC5','Calcareous'),('SC6','Ferruginous (iron oxide)'),('SC7','Micaceous'),('SC8','Rootlets / vegetation'),('SC9','Shell fragments'),('SC10','Lateritic'),('SC11','Quartz-rich'),('SC9X','Not assessed');

-- Origin Soil
INSERT OR IGNORE INTO ref_origin_soil (id, label) VALUES ('OS1','Residual'),('OS2','Alluvial'),('OS3','Colluvial'),('OS4','Aeolian'),('OS5','Lacustrine'),('OS6','Marine'),('OS7','Estuarine'),('OS8','Glacial (rare in AU)'),('OS9','Not assessed');

-- Origin Fill
INSERT OR IGNORE INTO ref_origin_fill (id, label) VALUES ('OF1','Engineered fill'),('OF2','Uncontrolled fill'),('OF3','Road base / pavement material'),('OF4','General construction spoil'),('OF5','Rockfill'),('OF6','Sand fill'),('OF7','Clay fill'),('OF8','Not assessed');

-- Fill Inclusions
INSERT OR IGNORE INTO ref_fill_inclusions (id, label) VALUES ('FI1','Brick'),('FI2','Concrete'),('FI3','Glass'),('FI4','Timber'),('FI5','Metal'),('FI6','Plastic'),('FI7','Ash / Coke'),('FI8','Slag'),('FI9','Bitumen / Asphalt'),('FI10','Not assessed');

-- Soil-Rock Transition
INSERT OR IGNORE INTO ref_soil_rock_transition (id, label) VALUES ('TR1','Extremely weathered rock (EW)'),('TR2','Residual soil (RS)'),('TR3','Transition EW to HW'),('TR4','Soil with rock fragments'),('TR5','Not assessed');

-- Fill Moisture Condition
INSERT OR IGNORE INTO ref_fill_moisture_condition (id, label) VALUES ('FM1','Dry of OMC'),('FM2','At OMC'),('FM3','Wet of OMC'),('FM4','Not assessed');

-- Soil Classification Symbols (AS1726)
INSERT OR IGNORE INTO ref_soil_classification_symbol (id, label, description) VALUES ('GW','GW','Well graded gravel'),('GP','GP','Poorly graded gravel'),('GM','GM','Silty gravel'),('GC','GC','Clayey gravel'),('SW','SW','Well graded sand'),('SP','SP','Poorly graded sand'),('SM','SM','Silty sand'),('SC','SC','Clayey sand'),('ML','ML','Silt of low plasticity'),('CL','CL','Clay of low plasticity'),('OL','OL','Organic silt/clay of low plasticity'),('MH','MH','Silt of high plasticity'),('CH','CH','Clay of high plasticity'),('OH','OH','Organic silt/clay of high plasticity'),('Pt','Pt','Peat and highly organic soils'),('NA','Not assessed','Not assessed');

-- Fill Type
INSERT OR IGNORE INTO ref_fill_type (id, label) VALUES ('FT1','Engineered fill'),('FT2','Uncontrolled fill'),('FT3','Road base / pavement material'),('FT4','General construction spoil'),('FT5','Rockfill'),('FT6','Sand fill'),('FT7','Clay fill'),('FT9','Not assessed');

-- Fill Composition
INSERT OR IGNORE INTO ref_fill_composition (id, label) VALUES ('FC1','Predominantly soil'),('FC2','Predominantly sand/gravel'),('FC3','Predominantly rock fragments'),('FC4','Mixed soil and rubble'),('FC5','Brick fragments'),('FC6','Concrete fragments'),('FC7','Asphalt fragments'),('FC8','Timber / organics'),('FC9','Not assessed');

-- Fill Contaminants
INSERT OR IGNORE INTO ref_fill_contaminants (id, label) VALUES ('FI0','None observed'),('FI1','Construction debris'),('FI2','Organics'),('FI3','Ash / cinders'),('FI4','Hydrocarbon odour / staining'),('FI5','Metal / scrap'),('FI9','Not assessed');

-- Transition Material
INSERT OR IGNORE INTO ref_transition_material (id, label) VALUES ('TM1','Saprolite (decomposed rock)'),('TM2','Extremely weathered rock (soil-like)'),('TM3','Completely weathered rock'),('TM4','Residual soil (relict structure absent)'),('TM5','Colluvium with rock fragments'),('TM9','Not assessed');

-- Pressure State
INSERT OR IGNORE INTO ref_pressure_state (id, label) VALUES ('PS1','Active'),('PS2','Passive'),('PS3','At-rest');

-- Compressibility
INSERT OR IGNORE INTO ref_compressibility (id, label) VALUES ('COMP1','Low'),('COMP2','Moderate'),('COMP3','High'),('COMP4','Very high');

-- Controlling Issue
INSERT OR IGNORE INTO ref_controlling_issue (id, label) VALUES ('CI1','Steep geometry'),('CI2','Weak soil'),('CI3','Seepage'),('CI4','Erosion'),('CI5','Tension cracking'),('CI6','Toe instability');
`;


