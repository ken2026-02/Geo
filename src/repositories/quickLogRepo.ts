import { execute, query, ensureQuickLogEntriesTable } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface QuickLogEntry {
  id: string;
  entry_id: string;
  observation_mode: 'Rock' | 'Soil';
  selected_observations: string[];
  trigger_category: string;
  immediate_action: string;
  review_required: number;
}

interface QuickLogRow extends Omit<QuickLogEntry, 'selected_observations'> {
  selected_observations: string | null;
}

export const quickLogRepo = {
  create: async (data: Omit<QuickLogEntry, 'id'>): Promise<string> => {
    ensureQuickLogEntriesTable();
    const id = uuidv4();
    await execute(
      `INSERT INTO quick_log_entries (id, entry_id, observation_mode, selected_observations, trigger_category, immediate_action, review_required)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.entry_id,
        data.observation_mode,
        JSON.stringify(data.selected_observations || []),
        data.trigger_category || '',
        data.immediate_action || '',
        data.review_required || 0
      ]
    );
    return id;
  },

  getByEntryId: (entryId: string): QuickLogEntry | null => {
    ensureQuickLogEntriesTable();
    const row = query<QuickLogRow>('SELECT * FROM quick_log_entries WHERE entry_id = ?', [entryId])[0];
    if (!row) return null;

    let selected: string[] = [];
    try {
      selected = row.selected_observations ? JSON.parse(row.selected_observations) : [];
    } catch {
      selected = [];
    }

    return {
      ...row,
      selected_observations: Array.isArray(selected) ? selected : []
    };
  },

  updateByEntryId: async (entryId: string, data: Omit<QuickLogEntry, 'id' | 'entry_id'>): Promise<void> => {
    ensureQuickLogEntriesTable();
    await execute(
      `UPDATE quick_log_entries
       SET observation_mode = ?,
           selected_observations = ?,
           trigger_category = ?,
           immediate_action = ?,
           review_required = ?
       WHERE entry_id = ?`,
      [
        data.observation_mode,
        JSON.stringify(data.selected_observations || []),
        data.trigger_category || '',
        data.immediate_action || '',
        data.review_required || 0,
        entryId
      ]
    );
  }
};

