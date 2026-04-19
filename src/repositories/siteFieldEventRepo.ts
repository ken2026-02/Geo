import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SiteFieldEvent } from '../types/siteLogging';

export const siteFieldEventRepo = {
  listByElement: (elementId: string): SiteFieldEvent[] => {
    return query<SiteFieldEvent>(
      `SELECT * FROM site_field_events
       WHERE element_id = ? AND is_deleted = 0
       ORDER BY COALESCE(event_datetime, updated_at) DESC`,
      [elementId]
    );
  },

  create: async (data: Omit<SiteFieldEvent, 'id' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>) => {
    const id = uuidv4();
    await execute(
      `INSERT INTO site_field_events (
        id, element_id, drilling_record_id, event_datetime, category, depth_m, note, created_by,
        created_at, updated_at, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)`,
      [
        id,
        data.element_id,
        data.drilling_record_id ?? null,
        data.event_datetime ?? null,
        data.category ?? null,
        data.depth_m ?? null,
        data.note ?? null,
        data.created_by ?? null,
      ]
    );
    return id;
  },

  update: async (id: string, patch: Partial<Omit<SiteFieldEvent, 'id' | 'element_id'>>) => {
    const current = query<SiteFieldEvent>('SELECT * FROM site_field_events WHERE id = ?', [id])[0];
    if (!current) return;
    await execute(
      `UPDATE site_field_events
       SET drilling_record_id = ?,
           event_datetime = ?,
           category = ?,
           depth_m = ?,
           note = ?,
           created_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        patch.drilling_record_id ?? current.drilling_record_id,
        patch.event_datetime ?? current.event_datetime,
        patch.category ?? current.category,
        patch.depth_m ?? current.depth_m,
        patch.note ?? current.note,
        patch.created_by ?? current.created_by,
        id,
      ]
    );
  },

  remove: async (id: string) => {
    await execute(
      `UPDATE site_field_events
       SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );
  },
};

