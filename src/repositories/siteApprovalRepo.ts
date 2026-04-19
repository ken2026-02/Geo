import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SiteApprovalRecord } from '../types/siteLogging';

export const siteApprovalRepo = {
  getByElement: (elementId: string): SiteApprovalRecord | null =>
    query<SiteApprovalRecord>('SELECT * FROM site_approval_records WHERE element_id = ?', [elementId])[0] ?? null,

  upsertByElement: async (elementId: string, patch: Omit<SiteApprovalRecord, 'id' | 'element_id'>): Promise<string> => {
    const existing = siteApprovalRepo.getByElement(elementId);
    if (existing) {
      await execute(
        `UPDATE site_approval_records
         SET logged_by = ?, reviewed_by = ?, approved_by = ?, approved_for_grouting = ?,
             approval_datetime = ?, approval_comment = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          patch.logged_by ?? null,
          patch.reviewed_by ?? null,
          patch.approved_by ?? null,
          patch.approved_for_grouting,
          patch.approval_datetime ?? null,
          patch.approval_comment ?? null,
          existing.id,
        ]
      );
      return existing.id;
    }

    const id = uuidv4();
    await execute(
      `INSERT INTO site_approval_records (
        id, element_id, logged_by, reviewed_by, approved_by, approved_for_grouting,
        approval_datetime, approval_comment, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        elementId,
        patch.logged_by ?? null,
        patch.reviewed_by ?? null,
        patch.approved_by ?? null,
        patch.approved_for_grouting,
        patch.approval_datetime ?? null,
        patch.approval_comment ?? null,
      ]
    );
    return id;
  },
};

