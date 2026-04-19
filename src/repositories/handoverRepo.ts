import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface HandoverNotes {
  id: string;
  date: string;
  site_coverage: string;
  geotech_assessment: string;
  qa_hold_points: string;
  risk_bullets: string;
}

export interface HandoverItemOverride {
  date: string;
  entry_id: string;
  sort_order: number;
  is_hidden: number;
  manual_bullets: string;
}

export const handoverRepo = {
  getNotes: (date: string): HandoverNotes | undefined => {
    const results = query<HandoverNotes>('SELECT * FROM handover_notes WHERE date = ?', [date]);
    return results[0];
  },

  saveNotes: async (notes: Omit<HandoverNotes, 'id'>) => {
    const existing = handoverRepo.getNotes(notes.date);
    if (existing) {
      await execute(
        'UPDATE handover_notes SET site_coverage = ?, geotech_assessment = ?, qa_hold_points = ?, risk_bullets = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?',
        [notes.site_coverage, notes.geotech_assessment, notes.qa_hold_points, notes.risk_bullets, notes.date]
      );
    } else {
      await execute(
        'INSERT INTO handover_notes (id, date, site_coverage, geotech_assessment, qa_hold_points, risk_bullets) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), notes.date, notes.site_coverage, notes.geotech_assessment, notes.qa_hold_points, notes.risk_bullets]
      );
    }
  },

  getOverrides: (date: string): HandoverItemOverride[] => {
    return query<HandoverItemOverride>('SELECT * FROM handover_item_overrides WHERE date = ? ORDER BY sort_order ASC', [date]);
  },

  saveOverride: async (override: HandoverItemOverride) => {
    await execute(
      'INSERT OR REPLACE INTO handover_item_overrides (date, entry_id, sort_order, is_hidden, manual_bullets) VALUES (?, ?, ?, ?, ?)',
      [override.date, override.entry_id, override.sort_order, override.is_hidden, override.manual_bullets]
    );
  },

  saveAllOverrides: async (date: string, overrides: HandoverItemOverride[]) => {
    // Simple approach: clear and re-insert for the date
    await execute('DELETE FROM handover_item_overrides WHERE date = ?', [date]);
    for (const ov of overrides) {
      await handoverRepo.saveOverride(ov);
    }
  }
};
