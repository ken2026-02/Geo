import { execute, query } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { phraseBuilder } from '../phrases/phraseBuilder';

export const qaRepo = {
  createAnchorQA: async (data: any) => {
    const id = uuidv4();
    await execute(
      `INSERT INTO qa_anchor (id, entry_id, anchor_id, anchor_type_id, grout_type_id, test_load, result_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.entry_id, data.anchor_id, data.anchor_type_id, data.grout_type_id, data.test_load, data.result_id]
    );
    await qaRepo.updateSummary('anchor', data);
    return id;
  },

  createBoltQA: async (data: any) => {
    const id = uuidv4();
    await execute(
      `INSERT INTO qa_bolt (id, entry_id, bolt_id, bolt_type_id, length_m, spacing_m, grout_return_id, issues_text, result_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.entry_id, data.bolt_id, data.bolt_type_id, data.length_m, data.spacing_m, data.grout_return_id, data.issues_text, data.result_id]
    );
    await qaRepo.updateSummary('bolt', data);
    return id;
  },

  createShotcreteQA: async (data: any) => {
    const id = uuidv4();
    await execute(
      `INSERT INTO qa_shotcrete (id, entry_id, panel_id, thickness_mm, mix_design, result_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.entry_id, data.panel_id, data.thickness_mm, data.mix_design, data.result_id]
    );
    await qaRepo.updateSummary('shotcrete', data);
    return id;
  },

  createRetainingQA: async (data: any) => {
    const id = uuidv4();
    await execute(
      `INSERT INTO qa_retaining (id, entry_id, wall_type_id, condition_id, drainage_id, result_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.entry_id, data.wall_type_id, data.condition_id, data.drainage_id, data.result_id]
    );
    await qaRepo.updateSummary('retaining', data);
    return id;
  },

  updateSummary: async (type: any, data: any) => {
    const lookup = { getLabel: (t: string, i: any) => {
      const list = query<any>(`SELECT label FROM ${t} WHERE id = ?`, [i]);
      return list[0]?.label || i;
    }};
    const summary = phraseBuilder.buildQAParagraph(type, data, lookup);
    await execute('UPDATE entries SET summary = ? WHERE id = ?', [summary, data.entry_id]);
  }
};
