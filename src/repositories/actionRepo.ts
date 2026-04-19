import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface Action {
  id: string;
  entry_id: string;
  priority_id: string;
  description: string;
  assigned_to: string;
  due_date: string;
  is_closed: number;
}

export const actionRepo = {
  create: async (action: Omit<Action, 'id'>): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO actions (id, entry_id, priority_id, description, assigned_to, due_date, is_closed)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, action.entry_id, action.priority_id, action.description, action.assigned_to, action.due_date, action.is_closed]
    );
    return id;
  },

  updateStatus: async (id: string, isClosed: boolean) => {
    await execute('UPDATE actions SET is_closed = ? WHERE id = ?', [isClosed ? 1 : 0, id]);
  },

  listByEntry: (entryId: string): Action[] => {
    return query<Action>('SELECT * FROM actions WHERE entry_id = ?', [entryId]);
  },

  listOpenByLocation: (locationId: string): Action[] => {
    return query<Action>(`
      SELECT a.*
      FROM actions a
      JOIN entries e ON a.entry_id = e.id
      JOIN locations l ON e.location_id = l.id
      WHERE e.location_id = ? AND e.is_deleted = 0 AND l.is_deleted = 0 AND a.is_closed = 0
      ORDER BY a.due_date ASC
    `, [locationId]);
  },

  listOpen: (): Action[] => {
    return query<Action>('SELECT * FROM actions WHERE is_closed = 0 ORDER BY due_date ASC');
  },

  openActions: (date?: string): Action[] => {
    if (date) {
      // Actions created on or before this date that are still open
      return query<Action>(`
        SELECT a.*, e.timestamp as entry_ts
        FROM actions a
        JOIN entries e ON a.entry_id = e.id
        WHERE a.is_closed = 0 
        AND DATE(e.timestamp) <= DATE(?)
        ORDER BY a.priority_id ASC, a.due_date ASC
      `, [date]);
    }
    return actionRepo.listOpen();
  }
};

