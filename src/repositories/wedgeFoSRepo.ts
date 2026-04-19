import { execute, query } from '../db/db';

export interface WedgeFoSAssessment {
  id: string;
  entry_id: string;
  wedge_weight: number | null;
  friction_angle: number | null;
  cohesion: number | null;
  groundwater_condition: string | null;
  water_head?: number | null;
  water_force?: number | null;
  controlling_pair?: string | null;
  wedge_trend?: number | null;
  wedge_plunge?: number | null;
  fos: number | null;
  fos_shotcrete: number | null;
  fos_bolt: number | null;
  fos_anchor?: number | null;
  fos_combined: number | null;
  stability_class: string | null;
  risk_class?: string | null;
  action_level?: string | null;
  support_recommendation?: string | null;
  review_required?: number | null;
  interpretation: string | null;
  support_type?: string | null;
  shotcrete_trace_length: number | null;
  shotcrete_thickness: number | null;
  shotcrete_shear_strength: number | null;
  shotcrete_reduction_factor: number | null;
  bolt_capacity: number | null;
  bolt_number?: number | null;
  bolt_trend: number | null;
  bolt_plunge: number | null;
  bolt_effectiveness: number | null;
  anchor_force?: number | null;
  anchor_number?: number | null;
  anchor_trend?: number | null;
  anchor_plunge?: number | null;
  anchor_effectiveness?: number | null;
  driving_force?: number | null;
  shear_resistance?: number | null;
  shotcrete_contribution?: number | null;
  bolt_contribution?: number | null;
  anchor_contribution?: number | null;
  notes: string | null;
}

export const wedgeFoSRepo = {
  saveWedgeFoSAssessment: async (data: WedgeFoSAssessment): Promise<void> => {
    await execute(
      `INSERT INTO wedge_fos_assessments (
        id, entry_id, wedge_weight, friction_angle, cohesion, groundwater_condition, water_head, water_force,
        controlling_pair, wedge_trend, wedge_plunge,
        fos, fos_shotcrete, fos_bolt, fos_anchor, fos_combined, stability_class,
        risk_class, action_level, support_recommendation, review_required,
        interpretation, support_type,
        shotcrete_trace_length, shotcrete_thickness, shotcrete_shear_strength, shotcrete_reduction_factor,
        bolt_capacity, bolt_number, bolt_trend, bolt_plunge, bolt_effectiveness,
        anchor_force, anchor_number, anchor_trend, anchor_plunge, anchor_effectiveness,
        driving_force, shear_resistance, shotcrete_contribution, bolt_contribution, anchor_contribution,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id, data.entry_id, data.wedge_weight, data.friction_angle, data.cohesion, data.groundwater_condition, data.water_head ?? null, data.water_force ?? null,
        data.controlling_pair ?? null, data.wedge_trend ?? null, data.wedge_plunge ?? null,
        data.fos, data.fos_shotcrete, data.fos_bolt, data.fos_anchor ?? null, data.fos_combined, data.stability_class,
        data.risk_class ?? null, data.action_level ?? null, data.support_recommendation ?? null, data.review_required ?? null,
        data.interpretation, data.support_type ?? null,
        data.shotcrete_trace_length, data.shotcrete_thickness, data.shotcrete_shear_strength, data.shotcrete_reduction_factor,
        data.bolt_capacity, data.bolt_number ?? null, data.bolt_trend, data.bolt_plunge, data.bolt_effectiveness,
        data.anchor_force ?? null, data.anchor_number ?? null, data.anchor_trend ?? null, data.anchor_plunge ?? null, data.anchor_effectiveness ?? null,
        data.driving_force ?? null, data.shear_resistance ?? null, data.shotcrete_contribution ?? null, data.bolt_contribution ?? null, data.anchor_contribution ?? null,
        data.notes
      ]
    );
  },

  getByEntryId: (entryId: string): WedgeFoSAssessment | null => {
    const results = query<WedgeFoSAssessment>(
      'SELECT * FROM wedge_fos_assessments WHERE entry_id = ?',
      [entryId]
    );
    return results.length > 0 ? results[0] : null;
  }
};
