import { query } from '../db/db';

export const soilEngineeringDataService = {
  getLatestBearingCapacity(locationId: string) {
    const res = query<any>(`
      SELECT bc.*, e.id as entry_id 
      FROM bearing_capacity_assessments bc
      JOIN entries e ON bc.entry_id = e.id
      WHERE e.location_id = ? AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestEarthPressure(locationId: string) {
    const res = query<any>(`
      SELECT ep.*, e.id as entry_id 
      FROM earth_pressure_assessments ep
      JOIN entries e ON ep.entry_id = e.id
      WHERE e.location_id = ? AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestSettlementScreening(locationId: string) {
    const res = query<any>(`
      SELECT ss.*, e.id as entry_id 
      FROM settlement_screening_assessments ss
      JOIN entries e ON ss.entry_id = e.id
      WHERE e.location_id = ? AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestRetainingWallCheck(locationId: string) {
    const res = query<any>(`
      SELECT rwc.*, e.id as entry_id 
      FROM retaining_wall_checks rwc
      JOIN entries e ON rwc.entry_id = e.id
      WHERE e.location_id = ? AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestSoilSlopeStability(locationId: string) {
    const res = query<any>(`
      SELECT sss.*, e.id as entry_id 
      FROM soil_slope_stability sss
      JOIN entries e ON sss.entry_id = e.id
      WHERE e.location_id = ? AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getLatestInvestigationLog(locationId: string) {
    const res = query<any>(`
      SELECT
        il.*,
        e.summary,
        e.timestamp,
        moisture.label AS moisture_label,
        plasticity.label AS plasticity_label,
        density.label AS density_label,
        consistency.label AS consistency_label,
        material.label AS material_label,
        fill_type.label AS fill_type_label,
        transition_material.label AS transition_material_label
      FROM investigation_logs il
      JOIN entries e ON il.entry_id = e.id
      LEFT JOIN ref_soil_moisture moisture ON il.moisture_id = moisture.id
      LEFT JOIN ref_soil_plasticity plasticity ON il.plasticity_id = plasticity.id
      LEFT JOIN ref_soil_density density ON il.density_id = density.id
      LEFT JOIN ref_soil_consistency consistency ON il.consistency_id = consistency.id
      LEFT JOIN ref_soil_material_type material ON il.material_type_id = material.id
      LEFT JOIN ref_fill_type fill_type ON il.fill_type_id = fill_type.id
      LEFT JOIN ref_transition_material transition_material ON il.transition_material_id = transition_material.id
      WHERE e.location_id = ? AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [locationId]);
    return res.length > 0 ? res[0] : null;
  },

  getPhotoCount(locationId: string) {
    const res = query<any>(`
      SELECT COUNT(*) as count
      FROM media_metadata mm
      JOIN entries e ON mm.entry_id = e.id
      WHERE e.location_id = ? AND e.is_deleted = 0
    `, [locationId]);
    return res[0]?.count || 0;
  },

  getOpenActions(locationId: string) {
    const res = query<any>(`
      SELECT COUNT(*) as count
      FROM actions a
      JOIN entries e ON a.entry_id = e.id
      WHERE e.location_id = ? AND e.is_deleted = 0 AND a.is_closed = 0
    `, [locationId]);
    return res[0]?.count || 0;
  }
};
