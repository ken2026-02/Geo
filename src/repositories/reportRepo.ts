import { query, ensureQuickLogEntriesTable } from '../db/db';

export interface HandoverItem {
  id: string;
  cluster_key: string;
  location_id: string;
  chainage_start: number;
  chainage_end: number;
  side: string;
  position: string;
  entry_type: string;
  entry_type_id: string;
  risk_level: string;
  status: string;
  summary: string;
  timestamp: string;
  photo_count: number;
  is_handover_item: number;
}

export const reportRepo = {
  getDailyHandover: (date: string, projectId?: string): HandoverItem[] => {
    ensureQuickLogEntriesTable();
    const sql = `
      WITH RankedHandover AS (
          SELECT 
              e.id,
              l.cluster_key,
              e.location_id,
              l.chainage_start,
              l.chainage_end,
              l.side,
              l.position,
              e.entry_type_id,
              rt.label as entry_type,
              rl.label as risk_level,
              rl.weight as risk_weight,
              rs.label as status,
              e.summary,
              e.timestamp,
              e.is_handover_item,
              COALESCE(ql.review_required, 0) as quick_log_review_required,
              (SELECT COUNT(*) FROM media_metadata m WHERE m.entry_id = e.id) as photo_count,
              ROW_NUMBER() OVER (
                  PARTITION BY l.cluster_key 
                  ORDER BY rl.weight DESC, rs.weight DESC, e.timestamp DESC
              ) as rank
          FROM entries e
          JOIN locations l ON e.location_id = l.id
          LEFT JOIN quick_log_entries ql ON ql.entry_id = e.id
          JOIN ref_risk_level rl ON e.risk_level_id = rl.id
          JOIN ref_entry_type rt ON e.entry_type_id = rt.id
          JOIN ref_status rs ON e.status_id = rs.id
          WHERE 
              DATE(e.timestamp) = DATE(?)
              AND e.is_deleted = 0
              AND l.is_deleted = 0
              AND (? IS NULL OR e.project_id = ?)
              AND (
                  rl.weight >= 2
                  OR e.status_id != 'ST_CLOSED'
                  OR rt.id IN ('ET1', 'ET2', 'ET3', 'ET4', 'ET5', 'ET6', 'ET8', 'ET9', 'ET12')
                  OR (rt.id = 'ET7' AND COALESCE(ql.review_required, 0) = 1)
                  OR e.is_handover_item = 1
              )
      )
      SELECT 
          id, location_id, cluster_key, chainage_start, chainage_end, side, position, 
          entry_type_id, entry_type, risk_level, status, summary, timestamp, photo_count, is_handover_item
      FROM RankedHandover 
      WHERE rank = 1 
      ORDER BY risk_weight DESC, timestamp DESC 
      LIMIT 15;
    `;
    const projectFilter = projectId || null;
    return query<HandoverItem>(sql, [date, projectFilter, projectFilter]);
  }
};
