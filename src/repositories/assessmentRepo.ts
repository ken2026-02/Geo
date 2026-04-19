import { execute, query, getDb } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { phraseBuilder } from '../phrases/phraseBuilder';

export const assessmentRepo = {
  createQAssessment: async (data: {
    entry_id: string;
    rqd: number;
    jn_id: string;
    jr_id: string;
    ja_id: string;
    jw_id: string;
    srf_id: string;
  }): Promise<string> => {
    const id = uuidv4();
    
    // Fetch numeric values for calculation
    const jn = query<{value: number}>('SELECT value FROM ref_q_jn WHERE id = ?', [data.jn_id])[0]?.value || 1;
    const jr = query<{value: number}>('SELECT value FROM ref_q_jr WHERE id = ?', [data.jr_id])[0]?.value || 1;
    const ja = query<{value: number}>('SELECT value FROM ref_q_ja WHERE id = ?', [data.ja_id])[0]?.value || 1;
    const jw = query<{value: number}>('SELECT value FROM ref_q_jw WHERE id = ?', [data.jw_id])[0]?.value || 1;
    const srf = query<{value: number}>('SELECT value FROM ref_q_srf WHERE id = ?', [data.srf_id])[0]?.value || 1;

    const computed_q = (data.rqd / jn) * (jr / ja) * (jw / srf);

    await execute(
      `INSERT INTO q_assessments (id, entry_id, rqd, jn_id, jr_id, ja_id, jw_id, srf_id, computed_q)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.entry_id, data.rqd, data.jn_id, data.jr_id, data.ja_id, data.jw_id, data.srf_id, computed_q]
    );

    // Update summary
    const lookup = { getLabel: (t: string, i: any) => {
      const list = query<any>(`SELECT label FROM ${t} WHERE id = ?`, [i]);
      return list[0]?.label || i;
    }};
    const summary = phraseBuilder.buildQParagraph({ computed_q, rqd: data.rqd }, lookup);
    await execute('UPDATE entries SET summary = ? WHERE id = ?', [summary, data.entry_id]);

    return id;
  },

  createSlopeAssessment: async (data: {
    entry_id: string;
    slope_type_id: string;
    height: number;
    angle: number;
    failure_mode_id: string;
    likelihood_id: string;
    consequence_id: string;
    bench_condition_id: string;
    toe_condition_id: string;
    drainage_condition_id: string;
    recommended_controls_text: string;
    control_ids: string[];
    indicator_ids: string[];
  }): Promise<string> => {
    const id = uuidv4();
    await execute(
      `INSERT INTO slope_assessments (id, entry_id, slope_type_id, height, angle, failure_mode_id, likelihood_id, consequence_id, bench_condition_id, toe_condition_id, drainage_condition_id, recommended_controls_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.entry_id, data.slope_type_id, data.height, data.angle, data.failure_mode_id, data.likelihood_id, data.consequence_id, data.bench_condition_id, data.toe_condition_id, data.drainage_condition_id, data.recommended_controls_text]
    );

    for (const controlId of data.control_ids) {
      await execute('INSERT INTO slope_assessment_controls (assessment_id, control_id) VALUES (?, ?)', [id, controlId]);
    }
    for (const indicatorId of data.indicator_ids) {
      await execute('INSERT INTO slope_assessment_indicators (assessment_id, indicator_id) VALUES (?, ?)', [id, indicatorId]);
    }

    // Update summary
    const lookup = { getLabel: (t: string, i: any) => {
      const list = query<any>(`SELECT label FROM ${t} WHERE id = ?`, [i]);
      return list[0]?.label || i;
    }};
    const controls = data.control_ids.map(cid => lookup.getLabel('ref_controls', cid));
    const indicators = data.indicator_ids.map(iid => lookup.getLabel('ref_instability_indicator', iid));
    const summary = phraseBuilder.buildSlopeParagraph(data, controls, indicators, lookup);
    await execute('UPDATE entries SET summary = ? WHERE id = ?', [summary, data.entry_id]);

    return id;
  }
};
