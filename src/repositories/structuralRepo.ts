import { execute, query } from '../db/db';

export interface StructuralAssessment {
  id: string;
  entry_id: string;
  slope_dip: number | null;
  slope_dip_dir: number | null;
  joint1_dip: number | null;
  joint1_dip_dir: number | null;
  joint2_dip: number | null;
  joint2_dip_dir: number | null;
  joint3_dip: number | null;
  joint3_dip_dir: number | null;
  friction_angle?: number | null;
  planar_possible: number;
  wedge_possible: number;
  toppling_possible: number;
  dominant_failure_mode: string;
  hazard_level: string;
  notes: string;
  controlling_set?: string | null;
  controlling_pair?: string | null;
  confidence_level?: string | null;
  engineering_note?: string | null;
}

export const structuralRepo = {
  saveStructuralAssessment: async (data: StructuralAssessment): Promise<void> => {
    await execute(
      `INSERT INTO structural_assessments (
        id, entry_id, slope_dip, slope_dip_dir,
        joint1_dip, joint1_dip_dir, joint2_dip, joint2_dip_dir, joint3_dip, joint3_dip_dir,
        friction_angle, planar_possible, wedge_possible, toppling_possible, dominant_failure_mode, hazard_level, notes,
        controlling_set, controlling_pair, confidence_level, engineering_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        data.id, data.entry_id, data.slope_dip, data.slope_dip_dir,
        data.joint1_dip, data.joint1_dip_dir, data.joint2_dip, data.joint2_dip_dir, data.joint3_dip, data.joint3_dip_dir,
        data.friction_angle ?? null,
        data.planar_possible, data.wedge_possible, data.toppling_possible, data.dominant_failure_mode, data.hazard_level, data.notes,
        data.controlling_set || null, data.controlling_pair || null, data.confidence_level || null, data.engineering_note || null
      ]
    );
  },

  getByEntryId: (entryId: string): StructuralAssessment | null => {
    const results = query<StructuralAssessment>(
      'SELECT * FROM structural_assessments WHERE entry_id = ?',
      [entryId]
    );
    return results.length > 0 ? results[0] : null;
  },

  getLatestByProjectAndLocation: (projectId: string, locationId: string): StructuralAssessment | null => {
    const results = query<StructuralAssessment>(`
      SELECT sa.*
      FROM structural_assessments sa
      JOIN entries e ON sa.entry_id = e.id
      WHERE e.project_id = ? AND e.location_id = ? AND e.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT 1
    `, [projectId, locationId]);
    return results.length > 0 ? results[0] : null;
  }
};
