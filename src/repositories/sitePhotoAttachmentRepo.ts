import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import type { SitePhotoAttachment } from '../types/siteLogging';

export const sitePhotoAttachmentRepo = {
  listByElement: (elementId: string): SitePhotoAttachment[] => {
    return query<SitePhotoAttachment>(
      `SELECT * FROM site_photo_attachments
       WHERE element_id = ? AND is_deleted = 0
       ORDER BY updated_at DESC`,
      [elementId]
    );
  },

  create: async (data: Omit<SitePhotoAttachment, 'id' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>) => {
    const id = uuidv4();
    await execute(
      `INSERT INTO site_photo_attachments (
        id, element_id, drilling_record_id, photo_type, depth_m,
        blob_key, mime_type, caption, taken_datetime,
        created_at, updated_at, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)`,
      [
        id,
        data.element_id,
        (data as any).drilling_record_id ?? null,
        (data as any).photo_type ?? null,
        (data as any).depth_m ?? null,
        data.blob_key,
        data.mime_type ?? null,
        data.caption ?? null,
        data.taken_datetime ?? null,
      ]
    );
    return id;
  },

  remove: async (id: string): Promise<void> => {
    await execute(
      `UPDATE site_photo_attachments
       SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );
  },
};
