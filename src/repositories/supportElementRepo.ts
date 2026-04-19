import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SupportElement } from '../types/siteLogging';

export interface SupportElementRecordListRow extends SupportElement {
  site_code: string;
  site_name: string | null;
}

export const supportElementRepo = {
  listForRecordList: (
    projectId: string,
    filters?: {
      siteId?: string;
      elementType?: string;
      status?: string;
      queryText?: string;
      limit?: number;
    }
  ): SupportElementRecordListRow[] => {
    const where: string[] = ['se.project_id = ?', '(se.is_deleted IS NULL OR se.is_deleted = 0)'];
    const args: any[] = [projectId];

    if (filters?.siteId) {
      where.push('se.site_id = ?');
      args.push(filters.siteId);
    }
    if (filters?.elementType) {
      // Field workflow groups "micro-pile" as a top-level type, but legacy data may store pile/permanent casing.
      if (filters.elementType === 'pile' || filters.elementType === 'micro_pile') {
        where.push(`(se.element_type = 'micro_pile' OR se.element_type = 'pile' OR se.element_type = 'permanent_casing')`);
      } else if (filters.elementType === 'anchor_soil_nail') {
        // Field UI groups anchor + soil nail together. Legacy trial hole / suitability records are treated as this group.
        where.push(`(se.element_type = 'anchor' OR se.element_type = 'soil_nail' OR se.element_type = 'trial_hole' OR se.element_type = 'suitability_test')`);
      } else {
        where.push('se.element_type = ?');
        args.push(filters.elementType);
      }
    }
    if (filters?.status) {
      // Field UI exposes simplified statuses. Keep legacy detailed statuses compatible.
      if (filters.status === 'draft') {
        where.push(`se.status = 'draft'`);
      } else if (filters.status === 'in_progress') {
        where.push(`(se.status = 'in_progress' OR se.status = 'logging_in_progress')`);
      } else if (filters.status === 'review') {
        where.push(
          `(se.status = 'review' OR se.status = 'review_pending' OR se.status = 'interpretation_pending' OR se.status = 'verification_pending' OR se.status = 'approved_for_grouting')`
        );
      } else if (filters.status === 'finalised') {
        where.push(`se.status = 'finalised'`);
      } else {
        where.push('se.status = ?');
        args.push(filters.status);
      }
    }
    if (filters?.queryText) {
      // Keep simple: match code + location text.
      where.push('(se.element_code LIKE ? OR se.location_description LIKE ?)');
      args.push(`%${filters.queryText}%`, `%${filters.queryText}%`);
    }

    const limit = Math.max(1, Math.min(filters?.limit ?? 200, 500));
    return query<SupportElementRecordListRow>(
      `SELECT
         se.*,
         s.site_code AS site_code,
         s.site_name AS site_name
       FROM support_elements se
       JOIN sites s ON s.id = se.site_id
       WHERE ${where.join(' AND ')}
       ORDER BY se.updated_at DESC
       LIMIT ${limit}`,
      args
    );
  },

  listBySite: (siteId: string): SupportElement[] => {
    return query<SupportElement>(
      `SELECT * FROM support_elements
       WHERE site_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
       ORDER BY updated_at DESC`,
      [siteId]
    );
  },

  getById: (id: string): SupportElement | null => {
    return query<SupportElement>(
      `SELECT * FROM support_elements
       WHERE id = ? AND (is_deleted IS NULL OR is_deleted = 0)`,
      [id]
    )[0] ?? null;
  },

  create: async (data: Omit<SupportElement, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO support_elements (
        id, project_id, site_id, element_type, element_code, status, location_description, chainage,
        offset_description, ground_rl, hole_angle_deg, hole_diameter_mm, rig_type, rig_model, bit_type, created_by,
        created_at, updated_at, is_deleted, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, NULL)`,
      [
        id,
        data.project_id,
        data.site_id,
        data.element_type,
        data.element_code ?? null,
        data.status,
        data.location_description ?? null,
        data.chainage ?? null,
        data.offset_description ?? null,
        data.ground_rl ?? null,
        data.hole_angle_deg ?? null,
        data.hole_diameter_mm ?? null,
        data.rig_type ?? null,
        data.rig_model ?? null,
        data.bit_type ?? null,
        data.created_by ?? null,
      ]
    );
    return id;
  },

  update: async (id: string, patch: Partial<Omit<SupportElement, 'id' | 'project_id' | 'site_id'>>): Promise<void> => {
    const current = supportElementRepo.getById(id);
    if (!current) return;
    await execute(
      `UPDATE support_elements
       SET element_type = ?,
           element_code = ?,
           status = ?,
           location_description = ?,
           chainage = ?,
           offset_description = ?,
           ground_rl = ?,
           hole_angle_deg = ?,
           hole_diameter_mm = ?,
           rig_type = ?,
           rig_model = ?,
           bit_type = ?,
           created_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        patch.element_type ?? current.element_type,
        patch.element_code ?? current.element_code,
        patch.status ?? current.status,
        patch.location_description ?? current.location_description,
        patch.chainage ?? current.chainage,
        patch.offset_description ?? current.offset_description,
        patch.ground_rl ?? current.ground_rl,
        patch.hole_angle_deg ?? current.hole_angle_deg,
        patch.hole_diameter_mm ?? current.hole_diameter_mm,
        patch.rig_type ?? current.rig_type,
        patch.rig_model ?? current.rig_model,
        patch.bit_type ?? current.bit_type,
        patch.created_by ?? current.created_by,
        id,
      ]
    );
  },

  softDelete: async (id: string): Promise<void> => {
    await execute(
      `UPDATE support_elements
       SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );
  },
};
