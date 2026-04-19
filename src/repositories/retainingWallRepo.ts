import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface RetainingWallCheck {
  id: string;
  entry_id: string;
  wall_height: number;
  base_width: number;
  toe_width: number;
  heel_width: number;
  soil_unit_weight: number;
  soil_friction_angle: number;
  cohesion: number;
  surcharge: number;
  groundwater_condition: string;
  sliding_fs: number;
  overturning_fs: number;
  bearing_pressure: number;
  eccentricity: number;
  stability_result: string;
  notes: string;
}

export const retainingWallRepo = {
  create: async (data: Omit<RetainingWallCheck, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO retaining_wall_checks (id, entry_id, wall_height, base_width, toe_width, heel_width, soil_unit_weight, soil_friction_angle, cohesion, surcharge, groundwater_condition, sliding_fs, overturning_fs, bearing_pressure, eccentricity, stability_result, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.entry_id, data.wall_height, data.base_width, data.toe_width, data.heel_width, data.soil_unit_weight, data.soil_friction_angle, data.cohesion, data.surcharge, data.groundwater_condition, data.sliding_fs, data.overturning_fs, data.bearing_pressure, data.eccentricity, data.stability_result, data.notes]
    );
    return id;
  },
  getByEntryId: (entryId: string): RetainingWallCheck | null => {
    const results = query<RetainingWallCheck>('SELECT * FROM retaining_wall_checks WHERE entry_id = ?', [entryId]);
    return results[0] || null;
  }
};
