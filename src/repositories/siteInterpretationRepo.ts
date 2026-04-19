import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SiteInterpretation } from '../types/siteLogging';

export const siteInterpretationRepo = {
  getByElement: (elementId: string): SiteInterpretation | null => {
    return query<SiteInterpretation>('SELECT * FROM site_interpretations WHERE element_id = ?', [elementId])[0] ?? null;
  },

  upsert: async (
    elementId: string,
    patch: Pick<SiteInterpretation, 'confidence' | 'summary' | 'interpretation_json'> & {
      reference_tor_depth_m?: number | null;
      reference_tor_velocity_ms?: number | null;
      actual_tor_depth_m?: number | null;
      tor_variance_m?: number | null;
      tor_variance_reason_json?: string | null;
      continuous_rock_start_m?: number | null;
      weak_band_intervals_json?: string | null;
      interpretation_confidence?: string | null;
      interpretation_summary?: string | null;
    }
  ): Promise<string> => {
    const existing = siteInterpretationRepo.getByElement(elementId);
    if (existing) {
      await execute(
        `UPDATE site_interpretations
         SET confidence = ?,
             summary = ?,
             interpretation_json = ?,
             reference_tor_depth_m = ?,
             reference_tor_velocity_ms = ?,
             actual_tor_depth_m = ?,
             tor_variance_m = ?,
             tor_variance_reason_json = ?,
             continuous_rock_start_m = ?,
             weak_band_intervals_json = ?,
             interpretation_confidence = ?,
             interpretation_summary = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          patch.confidence ?? null,
          patch.summary ?? null,
          patch.interpretation_json ?? null,
          patch.reference_tor_depth_m ?? null,
          patch.reference_tor_velocity_ms ?? null,
          patch.actual_tor_depth_m ?? null,
          patch.tor_variance_m ?? null,
          patch.tor_variance_reason_json ?? null,
          patch.continuous_rock_start_m ?? null,
          patch.weak_band_intervals_json ?? null,
          patch.interpretation_confidence ?? null,
          patch.interpretation_summary ?? null,
          existing.id,
        ]
      );
      return existing.id;
    }

    const id = uuidv4();
    await execute(
      `INSERT INTO site_interpretations (
        id, element_id, confidence, summary, interpretation_json,
        reference_tor_depth_m, reference_tor_velocity_ms, actual_tor_depth_m, tor_variance_m,
        tor_variance_reason_json, continuous_rock_start_m, weak_band_intervals_json,
        interpretation_confidence, interpretation_summary,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        elementId,
        patch.confidence ?? null,
        patch.summary ?? null,
        patch.interpretation_json ?? null,
        patch.reference_tor_depth_m ?? null,
        patch.reference_tor_velocity_ms ?? null,
        patch.actual_tor_depth_m ?? null,
        patch.tor_variance_m ?? null,
        patch.tor_variance_reason_json ?? null,
        patch.continuous_rock_start_m ?? null,
        patch.weak_band_intervals_json ?? null,
        patch.interpretation_confidence ?? null,
        patch.interpretation_summary ?? null,
      ]
    );
    return id;
  },
};
