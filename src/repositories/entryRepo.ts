import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface Entry {
  id: string;
  project_id: string;
  location_id: string;
  entry_type_id: string;
  risk_level_id: string;
  status_id: string;
  author: string;
  timestamp: string;
  summary?: string;
  is_handover_item: number;
  is_deleted?: number;
  deleted_at?: string;
}

export const entryRepo = {
  create: async (entry: Omit<Entry, 'id' | 'timestamp'>): Promise<string> => {
    const id = uuidv4();
    console.log('[entryRepo] create entry start', id);
    await execute(
      `INSERT INTO entries (id, project_id, location_id, entry_type_id, risk_level_id, status_id, author, summary, is_handover_item)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, entry.project_id, entry.location_id, entry.entry_type_id, entry.risk_level_id, entry.status_id, entry.author, entry.summary, entry.is_handover_item]
    );
    console.log('[entryRepo] create entry done', id);
    return id;
  },

  listByDate: (date: string): Entry[] => {
    return query<Entry>(
      'SELECT * FROM entries WHERE DATE(timestamp) = DATE(?) AND is_deleted = 0 ORDER BY timestamp DESC',
      [date]
    );
  },

  listRecent: (limit: number = 10): any[] => {
    return query<any>(`
      SELECT e.*, l.chainage_start, l.chainage_end, l.side, l.position, rt.label as type_label, rl.label as risk_label
      FROM entries e
      JOIN locations l ON e.location_id = l.id
      JOIN ref_entry_type rt ON e.entry_type_id = rt.id
      JOIN ref_risk_level rl ON e.risk_level_id = rl.id
      WHERE e.is_deleted = 0 AND l.is_deleted = 0
      ORDER BY e.timestamp DESC
      LIMIT ?
    `, [limit]);
  },

  listPaged: (params: {
    projectId: string;
    limit: number;
    offset: number;
    query?: string;
    entryTypeId?: string;
    riskLevelId?: string;
    statusId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): any[] => {
    let sql = `
      SELECT e.*, l.chainage_start, l.chainage_end, l.side, l.position, rt.label as type_label, rl.label as risk_label,
      (SELECT COUNT(*) FROM media_metadata WHERE entry_id = e.id) as media_count
      FROM entries e
      JOIN locations l ON e.location_id = l.id
      JOIN ref_entry_type rt ON e.entry_type_id = rt.id
      JOIN ref_risk_level rl ON e.risk_level_id = rl.id
      WHERE e.project_id = ? AND e.is_deleted = 0 AND l.is_deleted = 0
    `;
    const values: any[] = [params.projectId];

    if (params.query) {
      sql += ` AND (e.summary LIKE ? OR l.chainage_start LIKE ?)`;
      values.push(`%${params.query}%`, `%${params.query}%`);
    }
    if (params.entryTypeId) {
      sql += ` AND e.entry_type_id = ?`;
      values.push(params.entryTypeId);
    }
    if (params.riskLevelId) {
      sql += ` AND e.risk_level_id = ?`;
      values.push(params.riskLevelId);
    }
    if (params.statusId) {
      sql += ` AND e.status_id = ?`;
      values.push(params.statusId);
    }
    if (params.dateFrom) {
      sql += ` AND DATE(e.timestamp) >= DATE(?)`;
      values.push(params.dateFrom);
    }
    if (params.dateTo) {
      sql += ` AND DATE(e.timestamp) <= DATE(?)`;
      values.push(params.dateTo);
    }

    sql += ` ORDER BY e.timestamp DESC LIMIT ? OFFSET ?`;
    values.push(params.limit, params.offset);

    return query<any>(sql, values);
  },

  listByLocation: (projectId: string, locationId: string): any[] => {
    return query<any>(`
      SELECT e.*, rt.label as type_label, rl.label as risk_label,
      (SELECT COUNT(*) FROM media_metadata WHERE entry_id = e.id) as media_count
      FROM entries e
      JOIN locations l ON e.location_id = l.id
      JOIN ref_entry_type rt ON e.entry_type_id = rt.id
      JOIN ref_risk_level rl ON e.risk_level_id = rl.id
      WHERE e.project_id = ? AND e.location_id = ? AND e.is_deleted = 0 AND l.is_deleted = 0
      ORDER BY e.timestamp DESC
    `, [projectId, locationId]);
  },

  listByCluster: (projectId: string, clusterKey: string): any[] => {
    return query<any>(`
      SELECT e.*, rt.label as type_label, rl.label as risk_label,
      (SELECT COUNT(*) FROM media_metadata WHERE entry_id = e.id) as media_count
      FROM entries e
      JOIN locations l ON e.location_id = l.id
      JOIN ref_entry_type rt ON e.entry_type_id = rt.id
      JOIN ref_risk_level rl ON e.risk_level_id = rl.id
      WHERE e.project_id = ? AND l.cluster_key = ? AND e.is_deleted = 0 AND l.is_deleted = 0
      ORDER BY e.timestamp DESC
    `, [projectId, clusterKey]);
  },

  listByProject: (projectId: string): any[] => {
    return query<any>(`
      SELECT e.*, l.chainage_start, l.chainage_end, l.side, l.position, rt.label as type_label, rl.label as risk_label,
      (SELECT COUNT(*) FROM media_metadata WHERE entry_id = e.id) as media_count
      FROM entries e
      JOIN locations l ON e.location_id = l.id
      JOIN ref_entry_type rt ON e.entry_type_id = rt.id
      JOIN ref_risk_level rl ON e.risk_level_id = rl.id
      WHERE e.project_id = ? AND e.is_deleted = 0 AND l.is_deleted = 0
      ORDER BY e.timestamp DESC
    `, [projectId]);
  },

  listByProjectAndType: (projectId: string, entryTypeId: string): any[] => {
    return query<any>(`
      SELECT e.*, l.chainage_start, l.chainage_end, l.side, l.position, rt.label as type_label, rl.label as risk_label
      FROM entries e
      JOIN locations l ON e.location_id = l.id
      JOIN ref_entry_type rt ON e.entry_type_id = rt.id
      JOIN ref_risk_level rl ON e.risk_level_id = rl.id
      WHERE e.project_id = ? AND e.entry_type_id = ? AND e.is_deleted = 0 AND l.is_deleted = 0
      ORDER BY e.timestamp DESC
    `, [projectId, entryTypeId]);
  },

  getWithDetails: (id: string) => {
    const entry = query<Entry>('SELECT * FROM entries WHERE id = ? AND is_deleted = 0', [id])[0];
    if (!entry) return null;

    // This would be expanded to fetch module-specific data based on entry_type_id
    return {
      ...entry,
      location: query('SELECT * FROM locations WHERE id = ?', [entry.location_id])[0],
      media: query('SELECT * FROM media_metadata WHERE entry_id = ?', [id])
    };
  },

  softDelete: async (id: string) => {
    await execute('UPDATE entries SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  },

  restore: async (id: string) => {
    await execute('UPDATE entries SET is_deleted = 0, deleted_at = NULL WHERE id = ?', [id]);
  },

  updateEntry: async (id: string, fields: Partial<Entry>) => {
    const sets: string[] = [];
    const values: any[] = [];
    
    Object.entries(fields).forEach(([key, val]) => {
      if (['project_id', 'risk_level_id', 'status_id', 'summary', 'is_handover_item', 'location_id'].includes(key)) {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    });

    if (sets.length === 0) return;
    
    values.push(id);
    await execute(`UPDATE entries SET ${sets.join(', ')} WHERE id = ?`, values);
  }
};
