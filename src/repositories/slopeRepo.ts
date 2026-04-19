import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { actionRepo } from './actionRepo';

export interface SlopeAssessment {
  id: string;
  entry_id: string;
  slope_type_id: string;
  height: number;
  angle: number;
  dip_direction: number;
  failure_mode_id: string;
  likelihood_id: string;
  consequence_id: string;
  bench_condition_id: string;
  toe_condition_id: string;
  drainage_condition_id: string;
  recommended_controls_text?: string;
}

export const slopeRepo = {
  getById: (id: string): SlopeAssessment | undefined => {
    const results = query<SlopeAssessment>('SELECT * FROM slope_assessments WHERE id = ?', [id]);
    return results[0];
  },

  getByEntryId: (entryId: string): SlopeAssessment | undefined => {
    const results = query<SlopeAssessment>('SELECT * FROM slope_assessments WHERE entry_id = ?', [entryId]);
    return results[0];
  },

  getIndicators: (assessmentId: string): string[] => {
    const results = query<{ indicator_id: string }>(
      'SELECT indicator_id FROM slope_assessment_indicators WHERE assessment_id = ?',
      [assessmentId]
    );
    return results.map(r => r.indicator_id);
  },

  getControls: (assessmentId: string): string[] => {
    const results = query<{ control_id: string }>(
      'SELECT control_id FROM slope_assessment_controls WHERE assessment_id = ?',
      [assessmentId]
    );
    return results.map(r => r.control_id);
  },

  getDiscontinuitySets: (assessmentId: string): { dip: number, dip_dir: number }[] => {
    return query<{ dip: number, dip_dir: number }>(
      'SELECT dip, dip_dir FROM discontinuity_sets WHERE assessment_id = ?',
      [assessmentId]
    );
  },

  save: async (
    assessment: Omit<SlopeAssessment, 'id'>, 
    indicators: string[], 
    controls: string[], 
    discontinuitySets: { dip: number, dipDirection: number }[],
    autoAction?: { description: string, priority_id: string }
  ) => {
    const id = uuidv4();
    await execute(
      `INSERT INTO slope_assessments (
        id, entry_id, slope_type_id, height, angle, dip_direction, failure_mode_id, 
        likelihood_id, consequence_id, bench_condition_id, toe_condition_id, 
        drainage_condition_id, recommended_controls_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, assessment.entry_id, assessment.slope_type_id, assessment.height, assessment.angle,
        assessment.dip_direction,
        assessment.failure_mode_id, assessment.likelihood_id, assessment.consequence_id,
        assessment.bench_condition_id, assessment.toe_condition_id, assessment.drainage_condition_id,
        assessment.recommended_controls_text || ''
      ]
    );

    for (const indicatorId of indicators) {
      await execute(
        'INSERT INTO slope_assessment_indicators (assessment_id, indicator_id) VALUES (?, ?)',
        [id, indicatorId]
      );
    }

    for (const controlId of controls) {
      await execute(
        'INSERT INTO slope_assessment_controls (assessment_id, control_id) VALUES (?, ?)',
        [id, controlId]
      );
    }

    for (let i = 0; i < discontinuitySets.length; i++) {
      const set = discontinuitySets[i];
      await execute(
        'INSERT INTO discontinuity_sets (id, assessment_id, set_number, dip, dip_dir) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), id, i + 1, set.dip, set.dipDirection]
      );
    }

    if (autoAction) {
      await actionRepo.create({
        entry_id: assessment.entry_id,
        priority_id: autoAction.priority_id,
        description: autoAction.description,
        assigned_to: 'Geotech',
        due_date: new Date().toISOString().split('T')[0],
        is_closed: 0
      });
    }

    return id;
  }
};
