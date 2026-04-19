import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface QAssessment {
  id: string;
  entry_id: string;
  rqd: number;
  jn_id: string;
  jr_id: string;
  ja_id: string;
  jw_id: string;
  srf_id: string;
  computed_q: number;
}

export const qRepo = {
  getById: (id: string): QAssessment | undefined => {
    const results = query<QAssessment>('SELECT * FROM q_assessments WHERE id = ?', [id]);
    return results[0];
  },

  getByEntryId: (entryId: string): QAssessment | undefined => {
    const results = query<QAssessment>('SELECT * FROM q_assessments WHERE entry_id = ?', [entryId]);
    return results[0];
  },

  save: async (assessment: Omit<QAssessment, 'id'>) => {
    const id = uuidv4();
    await execute(
      `INSERT INTO q_assessments (id, entry_id, rqd, jn_id, jr_id, ja_id, jw_id, srf_id, computed_q)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, assessment.entry_id, assessment.rqd, assessment.jn_id, assessment.jr_id,
        assessment.ja_id, assessment.jw_id, assessment.srf_id, assessment.computed_q
      ]
    );
    return id;
  }
};
