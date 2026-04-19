import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface Location {
  id: string;
  chainage_start: number;
  chainage_end: number;
  side: 'LHS' | 'RHS' | 'CL';
  position: 'Toe' | 'Mid' | 'Crest' | 'Face' | 'Bench';
  lat?: number;
  lon?: number;
  rl?: number;
  cluster_key: string;
  description?: string;
  last_used_at?: string;
  is_pinned?: number;
}

export const locationRepo = {
  generateClusterKey: (loc: Partial<Location>): string => {
    return `${loc.chainage_start}-${loc.chainage_end}-${loc.side}-${loc.position}`;
  },

  create: async (loc: Omit<Location, 'id' | 'cluster_key'>): Promise<string> => {
    const id = uuidv4();
    const cluster_key = locationRepo.generateClusterKey(loc);
    await execute(
      `INSERT INTO locations (id, chainage_start, chainage_end, side, position, lat, lon, rl, cluster_key, description, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [id, loc.chainage_start, loc.chainage_end, loc.side, loc.position, loc.lat, loc.lon, loc.rl, cluster_key, loc.description]
    );
    return id;
  },

  touch: async (id: string) => {
    await execute('UPDATE locations SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  },

  togglePin: async (id: string) => {
    await execute('UPDATE locations SET is_pinned = 1 - is_pinned WHERE id = ?', [id]);
  },

  clearRecent: async () => {
    await execute('UPDATE locations SET last_used_at = NULL');
  },

  listPinned: (): Location[] => {
    return query<Location>('SELECT * FROM locations WHERE is_pinned = 1 AND is_deleted = 0 ORDER BY chainage_start ASC');
  },

  getById: (id: string): Location | undefined => {
    const results = query<Location>('SELECT * FROM locations WHERE id = ? AND is_deleted = 0', [id]);
    return results[0];
  },

  search: (q: string): Location[] => {
    if (!q) return [];
    
    // Check if q is a number (chainage)
    const ch = parseFloat(q);
    if (!isNaN(ch)) {
      return query<Location>(
        'SELECT * FROM locations WHERE chainage_start <= ? AND chainage_end >= ? AND is_deleted = 0',
        [ch, ch]
      );
    }

    const like = `%${q}%`;
    return query<Location>(
      'SELECT * FROM locations WHERE (side LIKE ? OR position LIKE ? OR description LIKE ? OR cluster_key LIKE ?) AND is_deleted = 0 LIMIT 50',
      [like, like, like, like]
    );
  },

  getAll: (): Location[] => {
    return query<Location>('SELECT * FROM locations WHERE is_deleted = 0 ORDER BY chainage_start ASC');
  },

  getRecent: (limit: number = 20): Location[] => {
    return query<Location>(
      'SELECT * FROM locations WHERE last_used_at IS NOT NULL AND is_deleted = 0 ORDER BY last_used_at DESC LIMIT ?',
      [limit]
    );
  },

  listLocationsForProject: (projectId: string, limit: number = 200): any[] => {
    return query<any>(
      `SELECT 
        l.id, l.cluster_key,
        l.chainage_start, l.chainage_end, l.side, l.position, l.description,
        COUNT(DISTINCT e.id) as entry_count,
        MAX(e.timestamp) as last_entry_ts,
        MAX(rl.weight) as max_risk_weight,
        COUNT(mm.id) as photo_count
      FROM locations l
      LEFT JOIN entries e ON e.location_id = l.id AND e.is_deleted = 0
      LEFT JOIN ref_risk_level rl ON e.risk_level_id = rl.id
      LEFT JOIN media_metadata mm ON e.id = mm.entry_id
      WHERE l.is_deleted = 0 AND (e.project_id = ? OR e.project_id IS NULL)
      GROUP BY l.id
      ORDER BY last_entry_ts DESC NULLS LAST
      LIMIT ?`,
      [projectId, limit]
    );
  },

  updateLocation: async (id: string, fields: Partial<Location>) => {
    const cluster_key = locationRepo.generateClusterKey(fields);
    await execute(
      `UPDATE locations 
       SET chainage_start = ?, chainage_end = ?, side = ?, position = ?, description = ?, cluster_key = ?
       WHERE id = ?`,
      [fields.chainage_start, fields.chainage_end, fields.side, fields.position, fields.description, cluster_key, id]
    );
  },

  softDeleteLocation: async (id: string) => {
    await execute('UPDATE locations SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  },

  countEntriesForLocation: (locationId: string): number => {
    const results = query<any>('SELECT COUNT(*) as count FROM entries WHERE location_id = ? AND is_deleted = 0', [locationId]);
    return results[0]?.count || 0;
  },

  mergeLocation: async (oldLocationId: string, newLocationId: string) => {
    // Update all entries referencing the old location to point to the new location
    await execute('UPDATE entries SET location_id = ? WHERE location_id = ?', [newLocationId, oldLocationId]);
    // Soft delete the old location
    await locationRepo.softDeleteLocation(oldLocationId);
  }
};
