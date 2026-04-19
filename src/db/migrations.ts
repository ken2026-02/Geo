import type { Database } from 'sql.js';

export const LATEST_DB_VERSION = 35;

type PersistFn = () => Promise<void>;

export interface DbMigration {
  version: number;
  label: string;
  up: (db: Database, persist: PersistFn, seedSql: string) => Promise<void>;
}

const getColumnNames = (db: Database, tableName: string): string[] => {
  const result = db.exec(`PRAGMA table_info(${tableName})`);
  if (result.length === 0) return [];
  return result[0].values.map((row: any) => String(row[1]));
};

const addColumnIfNotExists = (db: Database, tableName: string, columnName: string, columnDef: string) => {
  const columns = getColumnNames(db, tableName);
  if (!columns.includes(columnName)) {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
  }
};

export const migrations: DbMigration[] = [
  {
    version: 2,
    label: 'Seed refresh',
    up: async (db, persist, seedSql) => {
      db.run(seedSql);
      db.run('PRAGMA user_version = 2;');
      await persist();
    },
  },
  {
    version: 3,
    label: 'Location recents and pinning',
    up: async (db, persist) => {
      try {
        db.run('ALTER TABLE locations ADD COLUMN last_used_at DATETIME;');
        db.run('ALTER TABLE locations ADD COLUMN is_pinned INTEGER DEFAULT 0;');
      } catch (e) {
        console.warn('[DB] Migration to v3: Columns might already exist', e);
      }
      db.run('PRAGMA user_version = 3;');
      await persist();
    },
  },
  {
    version: 4,
    label: 'Handover tables',
    up: async (db, persist) => {
      try {
        db.run(`
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
        `);
        db.run(`
          CREATE TABLE IF NOT EXISTS handover_item_overrides (
            date TEXT,
            entry_id TEXT,
            sort_order INTEGER,
            is_hidden INTEGER DEFAULT 0,
            manual_bullets TEXT,
            PRIMARY KEY(date, entry_id)
          );
        `);
      } catch (e) {
        console.warn('[DB] Migration to v4: Tables might already exist', e);
      }
      db.run('PRAGMA user_version = 4;');
      await persist();
    },
  },
  {
    version: 5,
    label: 'Entry soft delete',
    up: async (db, persist) => {
      try {
        const columns = getColumnNames(db, 'entries');
        if (!columns.includes('is_deleted')) {
          db.run('ALTER TABLE entries ADD COLUMN is_deleted INTEGER DEFAULT 0;');
          db.run('ALTER TABLE entries ADD COLUMN deleted_at DATETIME;');
        }
      } catch (e) {
        console.warn('[DB] Migration to v5: Columns might already exist', e);
      }
      db.run('PRAGMA user_version = 5;');
      await persist();
    },
  },
  {
    version: 6,
    label: 'Location soft delete',
    up: async (db, persist) => {
      try {
        const columns = getColumnNames(db, 'locations');
        if (!columns.includes('is_deleted')) {
          db.run('ALTER TABLE locations ADD COLUMN is_deleted INTEGER DEFAULT 0;');
          db.run('ALTER TABLE locations ADD COLUMN deleted_at DATETIME;');
        }
      } catch (e) {
        console.warn('[DB] Migration to v6: Columns might already exist', e);
      }
      db.run('PRAGMA user_version = 6;');
      await persist();
    },
  },
  {
    version: 7,
    label: 'RMR assessments',
    up: async (db, persist) => {
      try {
        db.run(`
          CREATE TABLE IF NOT EXISTS rmr_assessments (
            id TEXT PRIMARY KEY,
            entry_id TEXT NOT NULL,
            ucs_rating REAL,
            rqd_rating REAL,
            spacing_rating REAL,
            condition_rating REAL,
            groundwater_rating REAL,
            orientation_adjustment REAL,
            total_rmr REAL,
            rock_class TEXT,
            notes TEXT,
            FOREIGN KEY(entry_id) REFERENCES entries(id)
          );
        `);
        db.run("INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET13', 'Rock Mass Rating');");
      } catch (e) {
        console.warn('[DB] Migration to v7: Table might already exist', e);
      }
      db.run('PRAGMA user_version = 7;');
      await persist();
    },
  },
  {
    version: 8,
    label: 'GSI assessments',
    up: async (db, persist) => {
      try {
        db.run(`
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
            FOREIGN KEY(entry_id) REFERENCES entries(id)
          );
        `);
        db.run("INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET14', 'Geological Strength Index');");
      } catch (e) {
        console.warn('[DB] Migration to v8: Table might already exist', e);
      }
      db.run('PRAGMA user_version = 8;');
      await persist();
    },
  },
  {
    version: 9,
    label: 'Structural assessments',
    up: async (db, persist) => {
      try {
        db.run(`
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
            FOREIGN KEY(entry_id) REFERENCES entries(id)
          );
        `);
        db.run("INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET15', 'Structural Assessment');");
      } catch (e) {
        console.warn('[DB] Migration to v9: Table might already exist', e);
      }
      db.run('PRAGMA user_version = 9;');
      await persist();
    },
  },
  {
    version: 10,
    label: 'Structural assessment extra fields',
    up: async (db, persist) => {
      try {
        addColumnIfNotExists(db, 'structural_assessments', 'controlling_set', 'TEXT');
        addColumnIfNotExists(db, 'structural_assessments', 'controlling_pair', 'TEXT');
        addColumnIfNotExists(db, 'structural_assessments', 'confidence_level', 'TEXT');
        addColumnIfNotExists(db, 'structural_assessments', 'engineering_note', 'TEXT');
      } catch (e) {
        console.warn('[DB] Migration to v10 error', e);
      }
      db.run('PRAGMA user_version = 10;');
      await persist();
    },
  },
  {
    version: 11,
    label: 'Support designs',
    up: async (db, persist) => {
      try {
        db.run(`
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
            FOREIGN KEY(entry_id) REFERENCES entries(id)
          );
        `);
        db.run("INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET16', 'Support Design');");
      } catch (e) {
        console.warn('[DB] Migration to v11: Table might already exist', e);
      }
      db.run('PRAGMA user_version = 11;');
      await persist();
    },
  },
  {
    version: 12,
    label: 'Support design calculator',
    up: async (db, persist) => {
      try {
        db.run(`
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
            FOREIGN KEY(entry_id) REFERENCES entries(id)
          );
        `);
        db.run("INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET17', 'Support Design Calculator');");
      } catch (e) {
        console.warn('[DB] Migration to v12: Table might already exist', e);
      }
      db.run('PRAGMA user_version = 12;');
      await persist();
    },
  },
  {
    version: 13,
    label: 'Initial soil engineering tables',
    up: async (db, persist) => {
      try {
        db.run(`
          CREATE TABLE IF NOT EXISTS bearing_capacity_assessments (
            id TEXT PRIMARY KEY,
            entry_id TEXT NOT NULL,
            footing_width REAL,
            footing_depth REAL,
            unit_weight REAL,
            cohesion REAL,
            friction_angle REAL,
            groundwater_depth REAL,
            factor_of_safety REAL,
            ultimate_bearing_capacity REAL,
            allowable_bearing_capacity REAL,
            controlling_mode TEXT,
            notes TEXT,
            FOREIGN KEY(entry_id) REFERENCES entries(id)
          );
        `);
        db.run(`
          CREATE TABLE IF NOT EXISTS earth_pressure_assessments (
            id TEXT PRIMARY KEY,
            entry_id TEXT NOT NULL,
            wall_height REAL,
            surcharge REAL,
            unit_weight REAL,
            cohesion REAL,
            friction_angle REAL,
            groundwater_condition TEXT,
            pressure_state TEXT,
            coefficient REAL,
            resultant_force REAL,
            point_of_application REAL,
            notes TEXT,
            FOREIGN KEY(entry_id) REFERENCES entries(id)
          );
        `);
        db.run("INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET18', 'Bearing Capacity');");
        db.run("INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET19', 'Earth Pressure');");
      } catch (e) {
        console.warn('[DB] Migration to v13: Tables might already exist', e);
      }
      db.run('PRAGMA user_version = 13;');
      await persist();
    },
  },
  {
    version: 14,
    label: 'Settlement screening',
    up: async (db, persist) => {
      try {
        db.run(`
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
            FOREIGN KEY(entry_id) REFERENCES entries(id)
          );
        `);
        db.run("INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET20', 'Settlement Screening');");
      } catch (e) {
        console.warn('[DB] Migration to v14: Tables might already exist', e);
      }
      db.run('PRAGMA user_version = 14;');
      await persist();
    },
  },
  {
    version: 15,
    label: 'Retaining wall and soil slope',
    up: async (db, persist) => {
      try {
        db.run(`
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
            FOREIGN KEY(entry_id) REFERENCES entries(id)
          );
        `);
        db.run(`
          CREATE TABLE IF NOT EXISTS soil_slope_stability (
            id TEXT PRIMARY KEY,
            entry_id TEXT NOT NULL,
            slope_height REAL,
            slope_angle REAL,
            unit_weight REAL,
            cohesion REAL,
            friction_angle REAL,
            pore_pressure_ratio REAL,
            stability_concern TEXT,
            indicative_fs_band TEXT,
            controlling_factor TEXT,
            recommended_action TEXT,
            notes TEXT,
            FOREIGN KEY(entry_id) REFERENCES entries(id)
          );
        `);
        db.run("INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET22', 'Retaining Wall Check');");
        db.run("INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET23', 'Soil Slope Stability');");
      } catch (e) {
        console.warn('[DB] Migration to v15: Tables might already exist', e);
      }
      db.run('PRAGMA user_version = 15;');
      await persist();
    },
  },
  {
    version: 16,
    label: 'Soil slope stability extra fields',
    up: async (db, persist) => {
      try {
        addColumnIfNotExists(db, 'soil_slope_stability', 'soil_type', 'TEXT');
        addColumnIfNotExists(db, 'soil_slope_stability', 'groundwater_condition', 'TEXT');
        addColumnIfNotExists(db, 'soil_slope_stability', 'erosion_present', 'INTEGER');
        addColumnIfNotExists(db, 'soil_slope_stability', 'tension_crack_present', 'INTEGER');
        addColumnIfNotExists(db, 'soil_slope_stability', 'toe_condition', 'TEXT');
        addColumnIfNotExists(db, 'soil_slope_stability', 'design_note', 'TEXT');
      } catch (e) {
        console.warn('[DB] Migration to v16 error', e);
      }
      db.run('PRAGMA user_version = 16;');
      await persist();
    },
  },
  {
    version: 17,
    label: 'Location judgements',
    up: async (db, persist) => {
      try {
        db.run(`
          CREATE TABLE IF NOT EXISTS location_judgements (
            id TEXT PRIMARY KEY,
            location_id TEXT NOT NULL,
            status TEXT,
            concern_level TEXT,
            concern_note TEXT,
            recommended_step TEXT,
            include_in_handover INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(location_id) REFERENCES locations(id)
          );
        `);
        db.run("INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET24', 'Location Judgement');");
      } catch (e) {
        console.warn('[DB] Migration to v17: Table might already exist', e);
      }
      db.run('PRAGMA user_version = 17;');
      await persist();
    },
  },
  {
    version: 18,
    label: 'Location judgement flags',
    up: async (db, persist) => {
      try {
        addColumnIfNotExists(db, 'location_judgements', 'include_in_handover', 'INTEGER DEFAULT 0');
        addColumnIfNotExists(db, 'location_judgements', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
      } catch (e) {
        console.warn('[DB] Migration to v18 error', e);
      }
      db.run('PRAGMA user_version = 18;');
      await persist();
    },
  },
  {
    version: 19,
    label: 'Active project flag',
    up: async (db, persist) => {
      try {
        addColumnIfNotExists(db, 'projects', 'is_active', 'INTEGER DEFAULT 0');
      } catch (e) {
        console.warn('[DB] Migration to v19 error', e);
      }
      db.run('PRAGMA user_version = 19;');
      await persist();
    },
  },
  {
    version: 20,
    label: 'Initial wedge FoS table',
    up: async (db, persist) => {
      try {
        db.run(`
          CREATE TABLE IF NOT EXISTS wedge_fos_assessments (
            id TEXT PRIMARY KEY,
            entry_id TEXT NOT NULL,
            wedge_weight REAL,
            friction_angle REAL,
            cohesion REAL,
            groundwater_condition TEXT,
            fos REAL,
            stability_class TEXT,
            interpretation TEXT,
            notes TEXT,
            FOREIGN KEY (entry_id) REFERENCES entries(id)
          );
        `);
        db.run("INSERT OR IGNORE INTO ref_entry_type (id, label) VALUES ('ET25', 'Wedge FoS Analysis');");
      } catch (e) {
        console.warn('[DB] Migration to v20 error', e);
      }
      db.run('PRAGMA user_version = 20;');
      await persist();
    },
  },
  {
    version: 21,
    label: 'Wedge FoS support columns',
    up: async (db, persist) => {
      try {
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'shotcrete_thickness', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'shotcrete_shear_strength', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'shotcrete_area', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'shotcrete_reduction_factor', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'bolt_capacity', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'bolt_orientation', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'bolt_reduction_factor', 'REAL');
      } catch (e) {
        console.warn('[DB] Migration to v21 error', e);
      }
      db.run('PRAGMA user_version = 21;');
      await persist();
    },
  },
  {
    version: 22,
    label: 'Wedge FoS extra support fields',
    up: async (db, persist) => {
      try {
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'fos_shotcrete', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'fos_bolt', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'fos_combined', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'shotcrete_trace_length', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'bolt_trend', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'bolt_plunge', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'bolt_effectiveness', 'REAL');
      } catch (e) {
        console.warn('[DB] Migration to v22 error', e);
      }
      db.run('PRAGMA user_version = 22;');
      await persist();
    },
  },
  {
    version: 23,
    label: 'Wedge FoS support metadata',
    up: async (db, persist) => {
      try {
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'fos_anchor', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'support_type', 'TEXT');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'bolt_number', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'anchor_force', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'anchor_number', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'anchor_trend', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'anchor_plunge', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'anchor_effectiveness', 'REAL');
      } catch (e) {
        console.warn('[DB] Migration to v23 error', e);
      }
      db.run('PRAGMA user_version = 23;');
      await persist();
    },
  },
  {
    version: 24,
    label: 'Wedge FoS result detail fields',
    up: async (db, persist) => {
      try {
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'water_head', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'water_force', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'controlling_pair', 'TEXT');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'wedge_trend', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'wedge_plunge', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'risk_class', 'TEXT');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'action_level', 'TEXT');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'support_recommendation', 'TEXT');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'review_required', 'INTEGER');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'driving_force', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'shear_resistance', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'shotcrete_contribution', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'bolt_contribution', 'REAL');
        addColumnIfNotExists(db, 'wedge_fos_assessments', 'anchor_contribution', 'REAL');
      } catch (e) {
        console.warn('[DB] Migration to v24 error', e);
      }
      db.run('PRAGMA user_version = 24;');
      await persist();
    },
  },
  {
    version: 25,
    label: 'Structural assessment friction angle',
    up: async (db, persist) => {
      try {
        addColumnIfNotExists(db, 'structural_assessments', 'friction_angle', 'REAL');
      } catch (e) {
        console.warn('[DB] Migration to v25 error', e);
      }
      db.run('PRAGMA user_version = 25;');
      await persist();
    },
  },
  {
    version: 26,
    label: 'Investigation logs',
    up: async (db, persist) => {
      try {
        db.run(`
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
            FOREIGN KEY(entry_id) REFERENCES entries(id)
          );
        `);
      } catch (e) {
        console.warn('[DB] Migration to v26 error', e);
      }
      db.run('PRAGMA user_version = 26;');
      await persist();
    },
  },
  {
    version: 27,
    label: 'Quick log entries',
    up: async (db, persist) => {
      try {
        db.run(`
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
        `);
      } catch (e) {
        console.warn('[DB] Migration to v27 error', e);
      }
      db.run('PRAGMA user_version = 27;');
      await persist();
    },
  },
  {
    version: 28,
    label: 'Bearing capacity profile data',
    up: async (db, persist) => {
      try {
        db.run(`
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
            FOREIGN KEY(entry_id) REFERENCES entries(id)
          );
        `);
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'title', 'TEXT');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'geotech_ref', 'TEXT');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'machinery', 'TEXT');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'assessment_date', 'TEXT');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'prepared_by', 'TEXT');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'pressure_kpa', 'REAL');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'track_length_m', 'REAL');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'track_width_m', 'REAL');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'platform_thickness_m', 'REAL');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'controlling_layer', 'TEXT');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'overall_pass', 'INTEGER');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'platform_json', 'TEXT');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'layers_json', 'TEXT');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'result_json', 'TEXT');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'chart_json', 'TEXT');
        addColumnIfNotExists(db, 'bearing_capacity_assessments', 'basis_version', 'TEXT');
      } catch (e) {
        console.warn('[DB] Migration to v28 error', e);
      }
      db.run('PRAGMA user_version = 28;');
      await persist();
    },
  },
  {
    version: 29,
    label: 'Site logging module tables',
    up: async (db, persist) => {
      try {
        db.run(`
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
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_sites_project_code ON sites(project_id, site_code);`);

        db.run(`
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
            hole_angle_deg REAL,
            hole_diameter_mm REAL,
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
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_support_elements_site ON support_elements(site_id, updated_at);`);

        db.run(`
          CREATE TABLE IF NOT EXISTS site_design_inputs (
            id TEXT PRIMARY KEY,
            element_id TEXT NOT NULL,
            design_type TEXT NOT NULL,
            input_json TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (element_id) REFERENCES support_elements(id)
          );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_design_inputs_element ON site_design_inputs(element_id);`);

        db.run(`
          CREATE TABLE IF NOT EXISTS site_drilling_records (
            id TEXT PRIMARY KEY,
            element_id TEXT NOT NULL,
            record_date TEXT,
            method TEXT,
            start_depth_m REAL,
            end_depth_m REAL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (element_id) REFERENCES support_elements(id)
          );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_drilling_records_element ON site_drilling_records(element_id, updated_at);`);

        db.run(`
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (record_id) REFERENCES site_drilling_records(id)
          );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_drilling_intervals_record ON site_drilling_intervals(record_id, from_depth_m);`);

        db.run(`
          CREATE TABLE IF NOT EXISTS site_ground_references (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            site_id TEXT,
            reference_type TEXT NOT NULL,
            source_label TEXT,
            reference_json TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id),
            FOREIGN KEY (site_id) REFERENCES sites(id)
          );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_ground_references_site ON site_ground_references(site_id, reference_type);`);

        db.run(`
          CREATE TABLE IF NOT EXISTS site_interpretations (
            id TEXT PRIMARY KEY,
            element_id TEXT NOT NULL,
            confidence TEXT,
            summary TEXT,
            interpretation_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (element_id) REFERENCES support_elements(id)
          );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_interpretations_element ON site_interpretations(element_id, updated_at);`);
      } catch (e) {
        console.warn('[DB] Migration to v29 error', e);
      }
      db.run('PRAGMA user_version = 29;');
      await persist();
    },
  },
  {
    version: 30,
    label: 'Site logging Phase 1 schema alignment (Word spec)',
    up: async (db, persist) => {
      try {
        // Align support_elements with Word SupportElement schema (additive only).
        addColumnIfNotExists(db, 'support_elements', 'nail_rl', 'REAL');
        addColumnIfNotExists(db, 'support_elements', 'bar_diameter', 'TEXT');

        // Align site_design_inputs with Word DesignInput schema (keep input_json as source-of-truth).
        addColumnIfNotExists(db, 'site_design_inputs', 'element_type', 'TEXT');
        addColumnIfNotExists(db, 'site_design_inputs', 'reference_rl_type', 'TEXT');
        addColumnIfNotExists(db, 'site_design_inputs', 'design_json', 'TEXT');

        // Align drilling record main fields (keep existing method/depth fields).
        addColumnIfNotExists(db, 'site_drilling_records', 'start_date', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_records', 'end_date', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_records', 'logged_by', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_records', 'approved_by', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_records', 'record_page_count', 'INTEGER');
        addColumnIfNotExists(db, 'site_drilling_records', 'general_note', 'TEXT');

        // Align drilling interval detailed logging fields (keep existing observed_text etc).
        addColumnIfNotExists(db, 'site_drilling_intervals', 'drilling_time_min', 'REAL');
        addColumnIfNotExists(db, 'site_drilling_intervals', 'material_observed', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_intervals', 'material_interpreted', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_intervals', 'colour', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_intervals', 'secondary_components_json', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_intervals', 'weathering_class', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_intervals', 'rock_type', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_intervals', 'recovery_type', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_intervals', 'water_condition', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_intervals', 'drilling_response_json', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_intervals', 'logging_phrase_output', 'TEXT');
        addColumnIfNotExists(db, 'site_drilling_intervals', 'free_text_note', 'TEXT');

        // Ground reference per site (Word GroundReference) - keep reference_json but add structured columns.
        addColumnIfNotExists(db, 'site_ground_references', 'geotechnical_units_json', 'TEXT');
        addColumnIfNotExists(db, 'site_ground_references', 'expected_tor_min_m', 'REAL');
        addColumnIfNotExists(db, 'site_ground_references', 'expected_tor_max_m', 'REAL');
        addColumnIfNotExists(db, 'site_ground_references', 'reference_tor_velocity_ms', 'REAL');
        addColumnIfNotExists(db, 'site_ground_references', 'expected_material_above_tor_json', 'TEXT');
        addColumnIfNotExists(db, 'site_ground_references', 'expected_material_below_tor_json', 'TEXT');
        addColumnIfNotExists(db, 'site_ground_references', 'site_risk_flags_json', 'TEXT');
        addColumnIfNotExists(db, 'site_ground_references', 'reference_notes', 'TEXT');

        // Interpretation (Word Interpretation) - keep interpretation_json but add structured columns.
        addColumnIfNotExists(db, 'site_interpretations', 'reference_tor_depth_m', 'REAL');
        addColumnIfNotExists(db, 'site_interpretations', 'reference_tor_velocity_ms', 'REAL');
        addColumnIfNotExists(db, 'site_interpretations', 'actual_tor_depth_m', 'REAL');
        addColumnIfNotExists(db, 'site_interpretations', 'tor_variance_m', 'REAL');
        addColumnIfNotExists(db, 'site_interpretations', 'tor_variance_reason_json', 'TEXT');
        addColumnIfNotExists(db, 'site_interpretations', 'continuous_rock_start_m', 'REAL');
        addColumnIfNotExists(db, 'site_interpretations', 'weak_band_intervals_json', 'TEXT');
        addColumnIfNotExists(db, 'site_interpretations', 'interpretation_confidence', 'TEXT');
        addColumnIfNotExists(db, 'site_interpretations', 'interpretation_summary', 'TEXT');
      } catch (e) {
        console.warn('[DB] Migration to v30 error', e);
      }
      db.run('PRAGMA user_version = 30;');
      await persist();
    },
  },
  {
    version: 31,
    label: 'Site logging Phase 2 and 3 entities',
    up: async (db, persist) => {
      try {
        db.run(`
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
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_borehole_calibrations_site ON site_borehole_calibrations(site_id, borehole_id);`);

        db.run(`
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
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_clean_out_records_record ON site_clean_out_records(drilling_record_id);`);

        db.run(`
          CREATE TABLE IF NOT EXISTS site_anchor_verifications (
            id TEXT PRIMARY KEY,
            element_id TEXT NOT NULL,
            result_json TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (element_id) REFERENCES support_elements(id)
          );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_anchor_verifications_element ON site_anchor_verifications(element_id);`);

        db.run(`
          CREATE TABLE IF NOT EXISTS site_pile_verifications (
            id TEXT PRIMARY KEY,
            element_id TEXT NOT NULL,
            result_json TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (element_id) REFERENCES support_elements(id)
          );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_pile_verifications_element ON site_pile_verifications(element_id);`);

        db.run(`
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
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_approval_records_element ON site_approval_records(element_id);`);

        db.run(`
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
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_logging_phrases_category ON site_logging_phrases(category, site_id);`);
      } catch (e) {
        console.warn('[DB] Migration to v31 error', e);
      }
      db.run('PRAGMA user_version = 31;');
      await persist();
    },
  },
  {
    version: 32,
    label: 'Site logging output reports',
    up: async (db, persist) => {
      try {
        db.run(`
          CREATE TABLE IF NOT EXISTS site_output_reports (
            id TEXT PRIMARY KEY,
            element_id TEXT NOT NULL,
            report_text TEXT NOT NULL,
            report_json TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (element_id) REFERENCES support_elements(id)
          );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_output_reports_element ON site_output_reports(element_id);`);
      } catch (e) {
        console.warn('[DB] Migration to v32 error', e);
      }
      db.run('PRAGMA user_version = 32;');
      await persist();
    },
  },
  {
    version: 33,
    label: 'Site logging field events',
    up: async (db, persist) => {
      try {
        db.run(`
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
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_field_events_element ON site_field_events(element_id, updated_at);`);
      } catch (e) {
        console.warn('[DB] Migration to v33 error', e);
      }
      db.run('PRAGMA user_version = 33;');
      await persist();
    },
  },
  {
    version: 34,
    label: 'Site logging photo attachments',
    up: async (db, persist) => {
      try {
        db.run(`
          CREATE TABLE IF NOT EXISTS site_photo_attachments (
            id TEXT PRIMARY KEY,
            element_id TEXT NOT NULL,
            blob_key TEXT NOT NULL,
            mime_type TEXT,
            caption TEXT,
            taken_datetime TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            deleted_at DATETIME,
            FOREIGN KEY (element_id) REFERENCES support_elements(id)
          );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_site_photo_attachments_element ON site_photo_attachments(element_id, updated_at);`);
      } catch (e) {
        console.warn('[DB] Migration to v34 error', e);
      }
      db.run('PRAGMA user_version = 34;');
      await persist();
    },
  },
  {
    version: 35,
    label: 'Site logging photo attachment metadata alignment (Word spec)',
    up: async (db, persist) => {
      try {
        addColumnIfNotExists(db, 'site_photo_attachments', 'drilling_record_id', 'TEXT');
        addColumnIfNotExists(db, 'site_photo_attachments', 'photo_type', 'TEXT');
        addColumnIfNotExists(db, 'site_photo_attachments', 'depth_m', 'REAL');
        db.run(
          `CREATE INDEX IF NOT EXISTS idx_site_photo_attachments_record ON site_photo_attachments(drilling_record_id, updated_at);`
        );
      } catch (e) {
        console.warn('[DB] Migration to v35 error', e);
      }
      db.run('PRAGMA user_version = 35;');
      await persist();
    },
  },
];

export async function runMigrations(db: Database, currentVersion: number, persist: PersistFn, seedSql: string) {
  for (const migration of migrations) {
    if (currentVersion < migration.version) {
      console.log(`[DB] Migrating to version ${migration.version} (${migration.label})...`);
      await migration.up(db, persist, seedSql);
    }
  }
}
