import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface EarthPressureAssessment {
  id: string;
  entry_id: string;
  wall_height: number;
  surcharge: number;
  unit_weight: number;
  cohesion: number;
  friction_angle: number;
  groundwater_condition: string;
  pressure_state: string;
  coefficient: number;
  resultant_force: number;
  point_of_application: number;
  notes: string;
}

export const earthPressureRepo = {
  create: async (data: Omit<EarthPressureAssessment, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO earth_pressure_assessments (id, entry_id, wall_height, surcharge, unit_weight, cohesion, friction_angle, groundwater_condition, pressure_state, coefficient, resultant_force, point_of_application, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.entry_id, data.wall_height, data.surcharge, data.unit_weight, data.cohesion, data.friction_angle, data.groundwater_condition, data.pressure_state, data.coefficient, data.resultant_force, data.point_of_application, data.notes]
    );
    return id;
  },
  getByEntryId: (entryId: string): EarthPressureAssessment | null => {
    const results = query<EarthPressureAssessment>('SELECT * FROM earth_pressure_assessments WHERE entry_id = ?', [entryId]);
    return results[0] || null;
  }
};
