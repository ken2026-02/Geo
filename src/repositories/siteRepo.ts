import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { Site } from '../types/siteLogging';

export const siteRepo = {
  listByProject: (projectId: string): Site[] => {
    return query<Site>(
      `SELECT * FROM sites
       WHERE project_id = ?
       ORDER BY site_code ASC`,
      [projectId]
    );
  },

  getById: (id: string): Site | null => {
    return query<Site>('SELECT * FROM sites WHERE id = ?', [id])[0] ?? null;
  },

  create: async (data: Omit<Site, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO sites (
        id, project_id, site_code, site_name, chainage_from_km, chainage_to_km, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        data.project_id,
        data.site_code,
        data.site_name ?? null,
        data.chainage_from_km ?? null,
        data.chainage_to_km ?? null,
        data.notes ?? null,
      ]
    );
    return id;
  },

  update: async (id: string, patch: Partial<Omit<Site, 'id' | 'project_id'>>): Promise<void> => {
    const current = siteRepo.getById(id);
    if (!current) return;
    await execute(
      `UPDATE sites
       SET site_code = ?,
           site_name = ?,
           chainage_from_km = ?,
           chainage_to_km = ?,
           notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        patch.site_code ?? current.site_code,
        patch.site_name ?? current.site_name,
        patch.chainage_from_km ?? current.chainage_from_km,
        patch.chainage_to_km ?? current.chainage_to_km,
        patch.notes ?? current.notes,
        id,
      ]
    );
  },
};

