import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface SoilSlopeStability {
  id: string;
  entry_id: string;
  slope_height: number;
  slope_angle: number;
  soil_type: string;
  cohesion: number;
  friction_angle: number;
  groundwater_condition: string;
  erosion_present: number;
  tension_crack_present: number;
  toe_condition: string;
  stability_concern: string;
  indicative_fs_band: string;
  controlling_factor: string;
  design_note: string;
  notes: string;
}

export const soilSlopeRepo = {
  create: async (data: Omit<SoilSlopeStability, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO soil_slope_stability (id, entry_id, slope_height, slope_angle, soil_type, cohesion, friction_angle, groundwater_condition, erosion_present, tension_crack_present, toe_condition, stability_concern, indicative_fs_band, controlling_factor, design_note, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.entry_id, data.slope_height, data.slope_angle, data.soil_type, data.cohesion, data.friction_angle, data.groundwater_condition, data.erosion_present, data.tension_crack_present, data.toe_condition, data.stability_concern, data.indicative_fs_band, data.controlling_factor, data.design_note, data.notes]
    );
    return id;
  },
  getByEntryId: (entryId: string): SoilSlopeStability | null => {
    const results = query<SoilSlopeStability>('SELECT * FROM soil_slope_stability WHERE entry_id = ?', [entryId]);
    return results[0] || null;
  }
};
