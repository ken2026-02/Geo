import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SiteGroundReference } from '../types/siteLogging';

export const siteGroundReferenceRepo = {
  getGroundReferenceBySite: (siteId: string): SiteGroundReference | null => {
    return query<SiteGroundReference>(
      `SELECT * FROM site_ground_references
       WHERE site_id = ? AND reference_type = 'GroundReference'
       ORDER BY updated_at DESC`,
      [siteId]
    )[0] ?? null;
  },

  upsertGroundReferenceBySite: async (
    projectId: string,
    siteId: string,
    patch: Partial<{
      geotechnical_units_json: string | null;
      expected_tor_min_m: number | null;
      expected_tor_max_m: number | null;
      reference_tor_velocity_ms: number | null;
      expected_material_above_tor_json: string | null;
      expected_material_below_tor_json: string | null;
      site_risk_flags_json: string | null;
      reference_notes: string | null;
      reference_json: string | null;
      source_label: string | null;
    }>
  ): Promise<string> => {
    const existing = siteGroundReferenceRepo.getGroundReferenceBySite(siteId);
    if (existing) {
      await execute(
        `UPDATE site_ground_references
         SET source_label = ?,
             reference_json = COALESCE(?, reference_json),
             geotechnical_units_json = ?,
             expected_tor_min_m = ?,
             expected_tor_max_m = ?,
             reference_tor_velocity_ms = ?,
             expected_material_above_tor_json = ?,
             expected_material_below_tor_json = ?,
             site_risk_flags_json = ?,
             reference_notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          patch.source_label ?? existing.source_label,
          patch.reference_json ?? null,
          patch.geotechnical_units_json ?? existing.geotechnical_units_json ?? null,
          patch.expected_tor_min_m ?? existing.expected_tor_min_m ?? null,
          patch.expected_tor_max_m ?? existing.expected_tor_max_m ?? null,
          patch.reference_tor_velocity_ms ?? existing.reference_tor_velocity_ms ?? null,
          patch.expected_material_above_tor_json ?? existing.expected_material_above_tor_json ?? null,
          patch.expected_material_below_tor_json ?? existing.expected_material_below_tor_json ?? null,
          patch.site_risk_flags_json ?? existing.site_risk_flags_json ?? null,
          patch.reference_notes ?? existing.reference_notes ?? null,
          existing.id,
        ]
      );
      return existing.id;
    }

    const id = uuidv4();
    await execute(
      `INSERT INTO site_ground_references (
        id, project_id, site_id, reference_type, source_label,
        reference_json,
        geotechnical_units_json, expected_tor_min_m, expected_tor_max_m, reference_tor_velocity_ms,
        expected_material_above_tor_json, expected_material_below_tor_json, site_risk_flags_json, reference_notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'GroundReference', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        projectId,
        siteId,
        patch.source_label ?? null,
        patch.reference_json ?? '{}',
        patch.geotechnical_units_json ?? null,
        patch.expected_tor_min_m ?? null,
        patch.expected_tor_max_m ?? null,
        patch.reference_tor_velocity_ms ?? null,
        patch.expected_material_above_tor_json ?? null,
        patch.expected_material_below_tor_json ?? null,
        patch.site_risk_flags_json ?? null,
        patch.reference_notes ?? null,
      ]
    );
    return id;
  },
  listByProject: (projectId: string): SiteGroundReference[] => {
    return query<SiteGroundReference>(
      `SELECT * FROM site_ground_references
       WHERE project_id = ?
       ORDER BY updated_at DESC`,
      [projectId]
    );
  },

  listBySite: (siteId: string): SiteGroundReference[] => {
    return query<SiteGroundReference>(
      `SELECT * FROM site_ground_references
       WHERE site_id = ?
       ORDER BY updated_at DESC`,
      [siteId]
    );
  },

  create: async (data: Omit<SiteGroundReference, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO site_ground_references (
        id, project_id, site_id, reference_type, source_label, reference_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        data.project_id,
        data.site_id ?? null,
        data.reference_type,
        data.source_label ?? null,
        data.reference_json,
      ]
    );
    return id;
  },

  update: async (id: string, patch: Partial<Omit<SiteGroundReference, 'id' | 'project_id'>>): Promise<void> => {
    const current = query<SiteGroundReference>('SELECT * FROM site_ground_references WHERE id = ?', [id])[0];
    if (!current) return;
    await execute(
      `UPDATE site_ground_references
       SET site_id = ?,
           reference_type = ?,
           source_label = ?,
           reference_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        patch.site_id ?? current.site_id,
        patch.reference_type ?? current.reference_type,
        patch.source_label ?? current.source_label,
        patch.reference_json ?? current.reference_json,
        id,
      ]
    );
  },

  delete: async (id: string): Promise<void> => {
    await execute('DELETE FROM site_ground_references WHERE id = ?', [id]);
  },
};
