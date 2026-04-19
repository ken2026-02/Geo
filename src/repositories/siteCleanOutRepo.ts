import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SiteCleanOutRecord } from '../types/siteLogging';

export const siteCleanOutRepo = {
  getByRecord: (drillingRecordId: string): SiteCleanOutRecord | null =>
    query<SiteCleanOutRecord>('SELECT * FROM site_clean_out_records WHERE drilling_record_id = ?', [drillingRecordId])[0] ?? null,

  upsertByRecord: async (drillingRecordId: string, patch: Omit<SiteCleanOutRecord, 'id' | 'drilling_record_id'>): Promise<string> => {
    const existing = siteCleanOutRepo.getByRecord(drillingRecordId);
    if (existing) {
      await execute(
        `UPDATE site_clean_out_records
         SET method_air = ?, method_water = ?, method_grout = ?, clean_out_depth_m = ?,
             clean_out_datetime = ?, base_condition = ?, sedimentation_observed = ?,
             approved_for_grouting = ?, approval_note = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          patch.method_air,
          patch.method_water,
          patch.method_grout,
          patch.clean_out_depth_m ?? null,
          patch.clean_out_datetime ?? null,
          patch.base_condition ?? null,
          patch.sedimentation_observed,
          patch.approved_for_grouting,
          patch.approval_note ?? null,
          existing.id,
        ]
      );
      return existing.id;
    }
    const id = uuidv4();
    await execute(
      `INSERT INTO site_clean_out_records (
        id, drilling_record_id, method_air, method_water, method_grout, clean_out_depth_m,
        clean_out_datetime, base_condition, sedimentation_observed, approved_for_grouting, approval_note,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        drillingRecordId,
        patch.method_air,
        patch.method_water,
        patch.method_grout,
        patch.clean_out_depth_m ?? null,
        patch.clean_out_datetime ?? null,
        patch.base_condition ?? null,
        patch.sedimentation_observed,
        patch.approved_for_grouting,
        patch.approval_note ?? null,
      ]
    );
    return id;
  },
};

