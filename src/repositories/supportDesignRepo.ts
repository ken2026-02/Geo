import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface SupportDesign {
  id: string;
  entry_id: string;
  source_q_value: number | null;
  source_rmr: number | null;
  source_gsi: number | null;
  source_failure_mode: string | null;
  support_class: string | null;
  bolt_length_m: number | null;
  bolt_spacing_m: number | null;
  mesh_required: number | null;
  shotcrete_thickness_mm: number | null;
  drainage_required: number | null;
  support_notes: string | null;
}

export const supportDesignRepo = {
  create: async (data: Omit<SupportDesign, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO support_designs (
        id, entry_id, source_q_value, source_rmr, source_gsi, source_failure_mode,
        support_class, bolt_length_m, bolt_spacing_m, mesh_required,
        shotcrete_thickness_mm, drainage_required, support_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.entry_id, data.source_q_value, data.source_rmr, data.source_gsi,
        data.source_failure_mode, data.support_class, data.bolt_length_m,
        data.bolt_spacing_m, data.mesh_required, data.shotcrete_thickness_mm,
        data.drainage_required, data.support_notes
      ]
    );
    return id;
  },

  getByEntryId: (entryId: string): SupportDesign | null => {
    const results = query<SupportDesign>('SELECT * FROM support_designs WHERE entry_id = ?', [entryId]);
    return results.length > 0 ? results[0] : null;
  }
};
