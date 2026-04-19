import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface SupportDesignCalculation {
  id: string;
  entry_id: string;
  source_q_value: number | null;
  source_rmr: number | null;
  source_gsi: number | null;
  source_failure_mode: string | null;
  groundwater_severity: string | null;
  excavation_span: number | null;
  batter_height: number | null;
  support_class: string | null;
  bolt_length_m: number | null;
  bolt_spacing_m: number | null;
  mesh_required: number | null;
  shotcrete_thickness_mm: number | null;
  drainage_required: number | null;
  design_note: string | null;
}

export const supportDesignCalculatorRepo = {
  create: async (data: Omit<SupportDesignCalculation, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO support_design_calculations (
        id, entry_id, source_q_value, source_rmr, source_gsi, source_failure_mode,
        groundwater_severity, excavation_span, batter_height, support_class,
        bolt_length_m, bolt_spacing_m, mesh_required, shotcrete_thickness_mm,
        drainage_required, design_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.entry_id, data.source_q_value, data.source_rmr, data.source_gsi,
        data.source_failure_mode, data.groundwater_severity, data.excavation_span,
        data.batter_height, data.support_class, data.bolt_length_m, data.bolt_spacing_m,
        data.mesh_required, data.shotcrete_thickness_mm, data.drainage_required,
        data.design_note
      ]
    );
    return id;
  },

  getByEntryId: (entryId: string): SupportDesignCalculation | null => {
    const results = query<SupportDesignCalculation>('SELECT * FROM support_design_calculations WHERE entry_id = ?', [entryId]);
    return results.length > 0 ? results[0] : null;
  }
};
