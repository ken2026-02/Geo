import { query, execute } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface MediaItem {
  id: string;
  entry_id: string;
  blob_key: string;
  mime_type: string;
  caption: string;
  timestamp: string;
  data_url?: string; // Loaded from IndexedDB
}

export const mediaRepo = {
  create: async (media: Omit<MediaItem, 'id' | 'timestamp'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      'INSERT INTO media_metadata (id, entry_id, blob_key, mime_type, caption) VALUES (?, ?, ?, ?, ?)',
      [id, media.entry_id, media.blob_key, media.mime_type, media.caption]
    );
    return id;
  },

  listByEntry: (entryId: string): MediaItem[] => {
    return query<MediaItem>('SELECT * FROM media_metadata WHERE entry_id = ? ORDER BY timestamp DESC', [entryId]);
  },

  countByLocation: (locationId: string): number => {
    const result = query<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM media_metadata mm
      JOIN entries e ON mm.entry_id = e.id
      JOIN locations l ON e.location_id = l.id
      WHERE e.location_id = ? AND e.is_deleted = 0 AND l.is_deleted = 0
    `, [locationId]);
    return result[0]?.count || 0;
  },

  remove: async (id: string): Promise<void> => {
    await execute('DELETE FROM media_metadata WHERE id = ?', [id]);
  }
};
