import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SiteDesignInput } from '../types/siteLogging';

export const siteDesignInputRepo = {
  listByElement: (elementId: string): SiteDesignInput[] => {
    return query<SiteDesignInput>(
      `SELECT * FROM site_design_inputs
       WHERE element_id = ?
       ORDER BY updated_at DESC`,
      [elementId]
    );
  },

  getByElementAndType: (elementId: string, designType: string): SiteDesignInput | null => {
    return query<SiteDesignInput>(
      `SELECT * FROM site_design_inputs
       WHERE element_id = ? AND design_type = ?`,
      [elementId, designType]
    )[0] ?? null;
  },

  upsert: async (
    elementId: string,
    designType: string,
    inputJson: string,
    meta?: { element_type?: string | null; reference_rl_type?: string | null; design_json?: string | null }
  ): Promise<string> => {
    const existing = siteDesignInputRepo.getByElementAndType(elementId, designType);
    if (existing) {
      await execute(
        `UPDATE site_design_inputs
         SET input_json = ?,
             element_type = COALESCE(?, element_type),
             reference_rl_type = COALESCE(?, reference_rl_type),
             design_json = COALESCE(?, design_json),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [inputJson, meta?.element_type ?? null, meta?.reference_rl_type ?? null, meta?.design_json ?? null, existing.id]
      );
      return existing.id;
    }

    const id = uuidv4();
    await execute(
      `INSERT INTO site_design_inputs (
         id, element_id, design_type, input_json, element_type, reference_rl_type, design_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        elementId,
        designType,
        inputJson,
        meta?.element_type ?? null,
        meta?.reference_rl_type ?? null,
        meta?.design_json ?? null,
      ]
    );
    return id;
  },
};
