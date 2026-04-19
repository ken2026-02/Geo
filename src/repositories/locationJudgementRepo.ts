import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface LocationJudgement {
  id: string;
  location_id: string;
  status: 'Normal' | 'Monitor' | 'Review Required' | 'Action Required';
  concern_note: string;
  recommended_step: string;
  include_in_handover: number;
  updated_at: string;
}

export const locationJudgementRepo = {
  getByLocationId: (locationId: string): LocationJudgement | null => {
    const results = query<LocationJudgement>('SELECT * FROM location_judgements WHERE location_id = ?', [locationId]);
    return results.length > 0 ? results[0] : null;
  },

  upsert: async (judgement: Omit<LocationJudgement, 'id' | 'updated_at'>): Promise<void> => {
    const existing = locationJudgementRepo.getByLocationId(judgement.location_id);
    if (existing) {
      await execute(
        'UPDATE location_judgements SET status = ?, concern_note = ?, recommended_step = ?, include_in_handover = ?, updated_at = CURRENT_TIMESTAMP WHERE location_id = ?',
        [judgement.status, judgement.concern_note, judgement.recommended_step, judgement.include_in_handover, judgement.location_id]
      );
    } else {
      const id = uuidv4();
      await execute(
        'INSERT INTO location_judgements (id, location_id, status, concern_note, recommended_step, include_in_handover, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [id, judgement.location_id, judgement.status, judgement.concern_note, judgement.recommended_step, judgement.include_in_handover]
      );
    }
  },

  getForHandover: (): (LocationJudgement & { location_name: string })[] => {
    return query<(LocationJudgement & { location_name: string })>(`
      SELECT lj.*, l.chainage_start, l.chainage_end, l.side, l.position
      FROM location_judgements lj
      JOIN locations l ON lj.location_id = l.id
      WHERE lj.include_in_handover = 1
    `, []);
  }
};
