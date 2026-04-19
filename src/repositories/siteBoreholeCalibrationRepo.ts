import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SiteBoreholeCalibration } from '../types/siteLogging';

export const siteBoreholeCalibrationRepo = {
  listBySite: (siteId: string): SiteBoreholeCalibration[] =>
    query<SiteBoreholeCalibration>(
      `SELECT * FROM site_borehole_calibrations
       WHERE site_id = ?
       ORDER BY borehole_id ASC`,
      [siteId]
    ),

  createForSite: async (siteId: string, item: Omit<SiteBoreholeCalibration, 'id' | 'site_id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO site_borehole_calibrations (
        id, site_id, site_line_id, borehole_id, borehole_offset_m, elevation_difference_m,
        borehole_tor_depth_m_bgl, borehole_lithology_at_tor, srt_velocity_at_tor_ms,
        difference_geophysics_minus_borehole_m, variance_note, confidence, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        siteId,
        item.site_line_id ?? null,
        item.borehole_id,
        item.borehole_offset_m ?? null,
        item.elevation_difference_m ?? null,
        item.borehole_tor_depth_m_bgl ?? null,
        item.borehole_lithology_at_tor ?? null,
        item.srt_velocity_at_tor_ms ?? null,
        item.difference_geophysics_minus_borehole_m ?? null,
        item.variance_note ?? null,
        item.confidence ?? null,
      ]
    );
    return id;
  },

  update: async (id: string, patch: Partial<Omit<SiteBoreholeCalibration, 'id' | 'site_id'>>): Promise<void> => {
    const current = query<SiteBoreholeCalibration>('SELECT * FROM site_borehole_calibrations WHERE id = ?', [id])[0];
    if (!current) return;
    await execute(
      `UPDATE site_borehole_calibrations
       SET site_line_id = ?,
           borehole_id = ?,
           borehole_offset_m = ?,
           elevation_difference_m = ?,
           borehole_tor_depth_m_bgl = ?,
           borehole_lithology_at_tor = ?,
           srt_velocity_at_tor_ms = ?,
           difference_geophysics_minus_borehole_m = ?,
           variance_note = ?,
           confidence = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        patch.site_line_id ?? current.site_line_id,
        patch.borehole_id ?? current.borehole_id,
        patch.borehole_offset_m ?? current.borehole_offset_m,
        patch.elevation_difference_m ?? current.elevation_difference_m,
        patch.borehole_tor_depth_m_bgl ?? current.borehole_tor_depth_m_bgl,
        patch.borehole_lithology_at_tor ?? current.borehole_lithology_at_tor,
        patch.srt_velocity_at_tor_ms ?? current.srt_velocity_at_tor_ms,
        patch.difference_geophysics_minus_borehole_m ?? current.difference_geophysics_minus_borehole_m,
        patch.variance_note ?? current.variance_note,
        patch.confidence ?? current.confidence,
        id,
      ]
    );
  },

  remove: async (id: string): Promise<void> => {
    await execute('DELETE FROM site_borehole_calibrations WHERE id = ?', [id]);
  },

  upsertManyForSite: async (siteId: string, items: Array<Omit<SiteBoreholeCalibration, 'id' | 'site_id'>>): Promise<void> => {
    await execute('DELETE FROM site_borehole_calibrations WHERE site_id = ?', [siteId]);
    for (const item of items) {
      await execute(
        `INSERT INTO site_borehole_calibrations (
          id, site_id, site_line_id, borehole_id, borehole_offset_m, elevation_difference_m,
          borehole_tor_depth_m_bgl, borehole_lithology_at_tor, srt_velocity_at_tor_ms,
          difference_geophysics_minus_borehole_m, variance_note, confidence, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          siteId,
          item.site_line_id ?? null,
          item.borehole_id,
          item.borehole_offset_m ?? null,
          item.elevation_difference_m ?? null,
          item.borehole_tor_depth_m_bgl ?? null,
          item.borehole_lithology_at_tor ?? null,
          item.srt_velocity_at_tor_ms ?? null,
          item.difference_geophysics_minus_borehole_m ?? null,
          item.variance_note ?? null,
          item.confidence ?? null,
        ]
      );
    }
  },
};
