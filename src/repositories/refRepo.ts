import { query } from '../db/db';

export interface RefItem {
  id: string;
  label: string;
  weight?: number;
  value?: number;
  code?: string;
  category?: string;
  range_mpa?: string;
  range_mm?: string;
  description?: string;
}

export const REF_TABLES = [
  'ref_entry_type', 'ref_risk_level', 'ref_status', 'ref_action_priority',
  'ref_lithology', 'ref_colour', 'ref_weathering', 'ref_rock_strength',
  'ref_structure', 'ref_groundwater', 'ref_joint_spacing', 'ref_persistence',
  'ref_aperture', 'ref_roughness', 'ref_infill', 'ref_joint_water',
  'ref_slope_type', 'ref_failure_mode', 'ref_likelihood', 'ref_consequence',
  'ref_instability_indicator', 'ref_controls', 'ref_bench_condition',
  'ref_toe_condition', 'ref_drainage_condition', 'ref_qa_result',
  'ref_anchor_type', 'ref_bolt_type', 'ref_grout_type', 'ref_grout_return',
  'ref_wall_type', 'ref_wall_condition', 'ref_q_jn', 'ref_q_jr',
  'ref_q_ja', 'ref_q_jw', 'ref_q_srf',
  'ref_soil_material_type', 'ref_soil_grain_size', 'ref_soil_grading',
  'ref_soil_fines_content', 'ref_soil_plasticity', 'ref_soil_moisture',
  'ref_soil_consistency', 'ref_soil_density', 'ref_soil_cementation',
  'ref_soil_structure', 'ref_soil_fabric', 'ref_soil_angularity',
  'ref_soil_particle_shape', 'ref_soil_organic_content', 'ref_soil_secondary_components',
  'ref_origin_soil', 'ref_origin_fill', 'ref_fill_inclusions',
  'ref_soil_rock_transition', 'ref_fill_moisture_condition', 'ref_soil_classification_symbol',
  'ref_fill_type', 'ref_fill_composition', 'ref_fill_contaminants',
  'ref_transition_material'
] as const;

type RefTableName = typeof REF_TABLES[number];

const cache = new Map<string, RefItem[]>();

export const refRepo = {
  /**
   * Clears the in-memory cache. Call after DB reset or migration.
   */
  clearCache: () => {
    cache.clear();
  },

  /**
   * Preloads specific tables into memory.
   */
  preloadRefTables: async (tables: string[] = [...REF_TABLES]): Promise<void> => {
    for (const table of tables) {
      await refRepo.getRefList(table);
    }
  },

  /**
   * Returns a list of items for a reference table.
   */
  getRefList: async (tableName: string): Promise<RefItem[]> => {
    if (cache.has(tableName)) {
      return cache.get(tableName)!;
    }

    if (!REF_TABLES.includes(tableName as any)) {
      throw new Error(`Invalid ref table: ${tableName}`);
    }

    // Determine sort order
    let orderBy = 'label ASC';
    const columns = query<{name: string}>(`PRAGMA table_info(${tableName})`);
    if (columns.some(c => c.name === 'weight')) {
      orderBy = 'weight DESC';
    } else if (columns.some(c => c.name === 'value')) {
      orderBy = 'value ASC';
    }

    const results = query<RefItem>(`SELECT * FROM ${tableName} ORDER BY ${orderBy}`);
    cache.set(tableName, results);
    return results;
  },

  /**
   * Returns a Map for fast O(1) lookups by ID.
   */
  getRefMap: async (tableName: string): Promise<Map<string, RefItem>> => {
    const list = await refRepo.getRefList(tableName);
    return new Map(list.map(item => [item.id, item]));
  },

  /**
   * Helper to get a single label by ID from a table (uses cache).
   */
  getLabel: async (tableName: string, id: string | null | undefined): Promise<string> => {
    if (!id) return '';
    const map = await refRepo.getRefMap(tableName);
    return map.get(id)?.label || id;
  }
};
