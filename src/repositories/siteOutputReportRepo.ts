import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SiteOutputReport } from '../types/siteLogging';

export const siteOutputReportRepo = {
  getByElementId: (elementId: string): SiteOutputReport | null => {
    return query<SiteOutputReport>('SELECT * FROM site_output_reports WHERE element_id = ? ORDER BY updated_at DESC', [
      elementId,
    ])[0] ?? null;
  },

  upsertByElementId: async (elementId: string, reportText: string, reportJson: string): Promise<string> => {
    const existing = siteOutputReportRepo.getByElementId(elementId);
    if (existing) {
      await execute(
        `UPDATE site_output_reports
         SET report_text = ?,
             report_json = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [reportText, reportJson, existing.id]
      );
      return existing.id;
    }

    const id = uuidv4();
    await execute(
      `INSERT INTO site_output_reports (id, element_id, report_text, report_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, elementId, reportText, reportJson]
    );
    return id;
  },
};

