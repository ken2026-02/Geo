import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, Loader2, Play, Copy, AlertTriangle } from 'lucide-react';
import { getDb, query, execute } from '../db/db';
import { projectRepo } from '../repositories/projectRepo';
import { locationRepo } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { mappingRepo } from '../repositories/mappingRepo';
import { assessmentRepo } from '../repositories/assessmentRepo';
import { qRepo } from '../repositories/qRepo';
import { mediaRepo } from '../repositories/mediaRepo';
import { reportRepo } from '../repositories/reportRepo';
import { actionRepo } from '../repositories/actionRepo';
import { slopeRepo } from '../repositories/slopeRepo';
import { quickLogRepo } from '../repositories/quickLogRepo';
import { investigationRepo } from '../repositories/investigationRepo';
import { putBlob, getBlob, deleteBlob } from '../media/mediaStore';
import { listRuntimeErrors, clearRuntimeErrors } from '../utils/runtimeErrorLog';
import { siteRepo } from '../repositories/siteRepo';
import { supportElementRepo } from '../repositories/supportElementRepo';
import { siteDesignInputRepo } from '../repositories/siteDesignInputRepo';
import { siteDrillingRepo } from '../repositories/siteDrillingRepo';
import { siteInterpretationRepo } from '../repositories/siteInterpretationRepo';
import { evaluateSiteVerification } from '../services/siteLoggingEngines';

interface TestResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  error?: string;
  duration?: number;
}

export const Diagnostics: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([
    { id: 'T1', name: 'DB Ready', status: 'pending' },
    { id: 'T2', name: 'Ref Tables', status: 'pending' },
    { id: 'T3', name: 'Create Project', status: 'pending' },
    { id: 'T4', name: 'Create Location', status: 'pending' },
    { id: 'T5', name: 'Create Quick Observation', status: 'pending' },
    { id: 'T6', name: 'Create Mapping Entry', status: 'pending' },
    { id: 'T7', name: 'Create Investigation Entry', status: 'pending' },
    { id: 'T8', name: 'Create Slope Entry', status: 'pending' },
    { id: 'T9', name: 'Create Q Entry', status: 'pending' },
    { id: 'T10', name: 'Media Store', status: 'pending' },
    { id: 'T11', name: 'Handover Query', status: 'pending' },
    { id: 'T12', name: 'Navigation Data', status: 'pending' },
    { id: 'T13', name: 'Site Logging: Create Site + Element', status: 'pending' },
    { id: 'T14', name: 'Site Logging: Drilling Record + Interval', status: 'pending' },
    { id: 'T15', name: 'Site Logging: Verification Engine', status: 'pending' },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [runtimeErrors, setRuntimeErrors] = useState(listRuntimeErrors());

  const runTest = async (id: string, fn: () => Promise<void>) => {
    const start = performance.now();
    setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'running' } : r));

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 3000)
    );

    try {
      await Promise.race([fn(), timeout]);
      const duration = Math.round(performance.now() - start);
      setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'pass', duration } : r));
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'fail', error: err.message, duration } : r));
      throw err;
    }
  };

  const startDiagnostics = async () => {
    setIsRunning(true);
    setResults(prev => prev.map(r => ({ ...r, status: 'pending', error: undefined, duration: undefined })));
    setRuntimeErrors(listRuntimeErrors());

    let selftestProjectId = '';
    let selftestLocationId = '';
    let selftestEntryId = '';
    let selftestSiteId = '';
    let selftestElementId = '';
    let selftestDrillingRecordId = '';

    try {
      await runTest('T1', async () => {
        const db = getDb();
        if (!db) throw new Error('DB instance not found');
        const res = query<{ val: number }>('SELECT 1 as val');
        if (res[0]?.val !== 1) throw new Error('Query failed');
      });

      await runTest('T2', async () => {
        const tables = ['ref_risk_level', 'ref_status', 'ref_rock_strength', 'ref_weathering', 'ref_q_jn'];
        for (const table of tables) {
          const res = query<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
          if (res[0].count === 0) throw new Error(`Table ${table} is empty`);
        }
      });

      await runTest('T3', async () => {
        selftestProjectId = await projectRepo.create({
          name: 'SELFTEST',
          code: 'ST001'
        });
      });

      await runTest('T4', async () => {
        selftestLocationId = await locationRepo.create({
          chainage_start: 100,
          chainage_end: 110,
          side: 'LHS',
          position: 'Face'
        });
        const loc = locationRepo.getById(selftestLocationId);
        if (!loc) throw new Error('Location retrieval failed');
      });

      await runTest('T5', async () => {
        selftestEntryId = await entryRepo.create({
          project_id: selftestProjectId,
          location_id: selftestLocationId,
          entry_type_id: 'ET7',
          risk_level_id: 'R3',
          status_id: 'ST_OPEN',
          author: 'DIAGNOSTICS',
          summary: 'Test hazard',
          is_handover_item: 1
        });
        await quickLogRepo.create({
          entry_id: selftestEntryId,
          observation_mode: 'Rock',
          selected_observations: ['Loose rock'],
          trigger_category: 'New instability sign',
          immediate_action: 'Barricaded local area',
          review_required: 1,
        });
        const quickLog = quickLogRepo.getByEntryId(selftestEntryId);
        if (!quickLog) throw new Error('Quick Log structured data not stored');
        const entry = entryRepo.getWithDetails(selftestEntryId);
        if (!entry) throw new Error('Entry retrieval failed');
      });

      await runTest('T6', async () => {
        const mappingId = await entryRepo.create({
          project_id: selftestProjectId,
          location_id: selftestLocationId,
          entry_type_id: 'ET1',
          risk_level_id: 'R1',
          status_id: 'ST_OPEN',
          author: 'DIAGNOSTICS',
          summary: 'Diagnostic mapping summary',
          is_handover_item: 1
        });
        await mappingRepo.create(
          {
            entry_id: mappingId,
            lithology_id: 'L1',
            weathering_id: 'W1',
            strength_id: 'S1',
            structure_id: 'STR1',
            groundwater_id: 'GW1'
          },
          [{
            set_number: 1,
            dip: 45,
            dip_dir: 90,
            spacing_id: 'SP1',
            persistence_id: 'P1',
            aperture_id: 'A1',
            roughness_id: 'R1',
            infill_id: 'INF1',
            water_id: 'JW1'
          }]
        );
        const mapping = mappingRepo.getByEntryId(mappingId);
        if (!mapping?.sets?.length) throw new Error('Mapping sets not stored');
      });

      await runTest('T7', async () => {
        const invId = await entryRepo.create({
          project_id: selftestProjectId,
          location_id: selftestLocationId,
          entry_type_id: 'ET12',
          risk_level_id: 'R1',
          status_id: 'ST_OPEN',
          author: 'DIAGNOSTICS',
          summary: 'Soil log summary',
          is_handover_item: 1
        });
        await investigationRepo.create({
          entry_id: invId,
          investigation_type: 'Fill',
          material_type_id: null,
          plasticity_id: null,
          moisture_id: 'FM2',
          consistency_id: null,
          structure_id: null,
          origin_id: null,
          secondary_components: 'Gravel',
          grain_size_id: null,
          grading_id: null,
          fines_content_id: null,
          density_id: null,
          angularity_id: null,
          fill_type_id: 'FT1',
          composition_id: null,
          contaminant_id: null,
          inclusion_id: null,
          transition_material_id: null,
          notes: 'Diagnostic investigation log'
        });
        const investigation = investigationRepo.getByEntryId(invId);
        if (!investigation) throw new Error('Investigation structured data not stored');
      });

      await runTest('T8', async () => {
        const slopeEntryId = await entryRepo.create({
          project_id: selftestProjectId,
          location_id: selftestLocationId,
          entry_type_id: 'ET6',
          risk_level_id: 'R3',
          status_id: 'ST_OPEN',
          author: 'DIAGNOSTICS',
          summary: 'Diagnostic slope summary',
          is_handover_item: 1
        });
        await slopeRepo.save(
          {
            entry_id: slopeEntryId,
            slope_type_id: 'SL1',
            height: 10,
            angle: 45,
            dip_direction: 180,
            failure_mode_id: 'FM1',
            likelihood_id: 'L1',
            consequence_id: 'C1',
            bench_condition_id: 'BC1',
            toe_condition_id: 'TC1',
            drainage_condition_id: 'DC1',
            recommended_controls_text: 'Test controls'
          },
          ['IND1'],
          ['C1'],
          [{ dip: 45, dipDirection: 90 }],
          { description: 'High Risk Action', priority_id: 'P1' }
        );
        const actions = actionRepo.listByEntry(slopeEntryId);
        if (actions.length === 0) throw new Error('Action not created for high risk slope');
      });

      await runTest('T9', async () => {
        const qEntryId = await entryRepo.create({
          project_id: selftestProjectId,
          location_id: selftestLocationId,
          entry_type_id: 'ET11',
          risk_level_id: 'R1',
          status_id: 'ST_OPEN',
          author: 'DIAGNOSTICS',
          summary: 'Diagnostic Q summary',
          is_handover_item: 1
        });
        await assessmentRepo.createQAssessment({
          entry_id: qEntryId,
          rqd: 80,
          jn_id: 'JN1',
          jr_id: 'JR1',
          ja_id: 'JA1',
          jw_id: 'JW1',
          srf_id: 'SRF1'
        });
        const qData = qRepo.getByEntryId(qEntryId);
        if (!qData) throw new Error('Q data not stored');
      });

      await runTest('T10', async () => {
        const blob = new Blob(['test image data'], { type: 'image/png' });
        const blobKey = await putBlob(blob);
        await mediaRepo.create({
          entry_id: selftestEntryId,
          blob_key: blobKey,
          mime_type: 'image/png',
          caption: 'Test photo'
        });
        const retrieved = await getBlob(blobKey);
        if (!retrieved) throw new Error('Blob retrieval failed');
        await deleteBlob(blobKey);
      });

      await runTest('T11', async () => {
        const today = new Date().toISOString().split('T')[0];
        const items = reportRepo.getDailyHandover(today, selftestProjectId);
        if (items.length === 0) throw new Error('No handover items found for today');
      });

      await runTest('T12', async () => {
        const payload = entryRepo.getWithDetails(selftestEntryId);
        if (!payload) throw new Error('Payload null');
        if (!payload.location) throw new Error('Location object missing in payload');
      });

      await runTest('T13', async () => {
        selftestSiteId = await siteRepo.create({
          project_id: selftestProjectId,
          site_code: 'ST-SITE',
          site_name: 'Selftest site',
          chainage_from_km: null,
          chainage_to_km: null,
          notes: null,
        });
        const sites = siteRepo.listByProject(selftestProjectId);
        if (!sites.find((s) => s.id === selftestSiteId)) throw new Error('Site not created');

        selftestElementId = await supportElementRepo.create({
          project_id: selftestProjectId,
          site_id: selftestSiteId,
          element_type: 'anchor',
          element_code: 'ST-A1',
          status: 'draft',
          location_description: 'Diagnostics element',
          chainage: null,
          offset_description: null,
          ground_rl: null,
          hole_angle_deg: null,
          hole_diameter_mm: null,
          rig_type: 'Test rig',
          rig_model: null,
          bit_type: null,
          created_by: 'DIAGNOSTICS',
        });
        const el = supportElementRepo.getById(selftestElementId);
        if (!el) throw new Error('Support element not created');
      });

      await runTest('T14', async () => {
        selftestDrillingRecordId = await siteDrillingRepo.createRecord({
          element_id: selftestElementId,
          record_date: new Date().toISOString().slice(0, 10),
          method: 'DTH',
          start_depth_m: 0,
          end_depth_m: 10,
          notes: 'Diagnostics drilling record',
        } as any);
        const rec = siteDrillingRepo.listRecordsByElement(selftestElementId)[0] ?? null;
        if (!rec) throw new Error('Drilling record not stored');

        await siteDrillingRepo.createInterval({
          record_id: selftestDrillingRecordId,
          from_depth_m: 0,
          to_depth_m: 1,
          observed_text: 'Colluvium',
          interpreted_text: 'Colluvium',
          recovery_text: 'N/A',
          water_text: 'Dry',
          response_text: 'Normal drilling',
          weathering_class: 'xw',
          rock_type: 'not_applicable',
          material_interpreted: 'colluvium',
          logging_phrase_output: '0.00-1.00 m: Colluvium (dry)',
          free_text_note: null,
        } as any);
        const intervals = siteDrillingRepo.listIntervalsByRecord(selftestDrillingRecordId);
        if (!intervals.length) throw new Error('Intervals not stored');
      });

      await runTest('T15', async () => {
        await siteDesignInputRepo.upsert(
          selftestElementId,
          'Anchor',
          JSON.stringify({
            design_anchorage_length_m: 2,
            required_socket_length_m: 2,
            max_overdrill_m: 0.5,
            grout_approval_required: false,
          }),
          { element_type: 'anchor', reference_rl_type: 'ground_rl' }
        );
        await siteInterpretationRepo.upsert(selftestElementId, {
          confidence: null,
          summary: null,
          interpretation_json: JSON.stringify({}),
          actual_tor_depth_m: 6,
          reference_tor_depth_m: 6,
          interpretation_summary: 'Diagnostics interpretation',
        });

        const el = supportElementRepo.getById(selftestElementId);
        if (!el) throw new Error('Element missing');
        const di = siteDesignInputRepo.getByElementAndType(selftestElementId, 'Anchor');
        const rec = siteDrillingRepo.listRecordsByElement(selftestElementId)[0] ?? null;
        const intervals = rec ? siteDrillingRepo.listIntervalsByRecord(rec.id) : [];
        const interp = siteInterpretationRepo.getByElement(selftestElementId);

        const summary = evaluateSiteVerification({
          element: el,
          designInput: di ? JSON.parse(di.input_json) : {},
          record: rec,
          intervals,
          interpretation: interp,
          cleanOut: null,
          approval: null,
        });
        if (summary.kind !== 'anchor') throw new Error(`Unexpected verification kind: ${summary.kind}`);
        if (!summary.status) throw new Error('Verification status missing');
      });
    } catch (err) {
      console.error('Diagnostics failed:', err);
    } finally {
      if (selftestProjectId) {
        console.log('Cleaning up SELFTEST data...');

        // Site logging module cleanup (not tied to entries table)
        try {
          const siteIds = query<{ id: string }>('SELECT id FROM sites WHERE project_id = ?', [selftestProjectId]).map((r) => r.id);
          const elementIds = query<{ id: string }>('SELECT id FROM support_elements WHERE project_id = ?', [selftestProjectId]).map((r) => r.id);

          for (const elId of elementIds) {
            const recordIds = query<{ id: string }>('SELECT id FROM site_drilling_records WHERE element_id = ?', [elId]).map((r) => r.id);
            for (const recId of recordIds) {
              await execute('DELETE FROM site_drilling_intervals WHERE record_id = ?', [recId]);
              await execute('DELETE FROM site_clean_out_records WHERE drilling_record_id = ?', [recId]);
              await execute('DELETE FROM site_field_events WHERE drilling_record_id = ?', [recId]);
              await execute('DELETE FROM site_photo_attachments WHERE drilling_record_id = ?', [recId]);
            }
            await execute('DELETE FROM site_drilling_records WHERE element_id = ?', [elId]);
            await execute('DELETE FROM site_design_inputs WHERE element_id = ?', [elId]);
            await execute('DELETE FROM site_interpretations WHERE element_id = ?', [elId]);
            await execute('DELETE FROM site_approval_records WHERE element_id = ?', [elId]);
            await execute('DELETE FROM site_anchor_verifications WHERE element_id = ?', [elId]);
            await execute('DELETE FROM site_pile_verifications WHERE element_id = ?', [elId]);
            await execute('DELETE FROM site_output_reports WHERE element_id = ?', [elId]);
            await execute('DELETE FROM site_photo_attachments WHERE element_id = ?', [elId]);
            await execute('DELETE FROM site_field_events WHERE element_id = ?', [elId]);
          }

          for (const sId of siteIds) {
            await execute('DELETE FROM site_ground_references WHERE site_id = ?', [sId]);
            await execute('DELETE FROM site_borehole_calibrations WHERE site_id = ?', [sId]);
            await execute('DELETE FROM site_logging_phrases WHERE site_id = ?', [sId]);
          }

          await execute('DELETE FROM support_elements WHERE project_id = ?', [selftestProjectId]);
          await execute('DELETE FROM sites WHERE project_id = ?', [selftestProjectId]);
        } catch (e) {
          console.warn('Selftest site logging cleanup skipped:', e);
        }

        const entries = query<{ id: string }>('SELECT id FROM entries WHERE project_id = ?', [selftestProjectId]);
        for (const e of entries) {
          const media = mediaRepo.listByEntry(e.id);
          for (const m of media) {
            await deleteBlob(m.blob_key);
          }
          await execute('DELETE FROM media_metadata WHERE entry_id = ?', [e.id]);
          await execute('DELETE FROM actions WHERE entry_id = ?', [e.id]);
          await execute('DELETE FROM quick_log_entries WHERE entry_id = ?', [e.id]);
          await execute('DELETE FROM investigation_logs WHERE entry_id = ?', [e.id]);
          await execute('DELETE FROM mapping_entries WHERE entry_id = ?', [e.id]);
          await execute('DELETE FROM discontinuity_sets WHERE assessment_id IN (SELECT id FROM slope_assessments WHERE entry_id = ?)', [e.id]);
          await execute('DELETE FROM discontinuity_sets WHERE mapping_id IN (SELECT id FROM mapping_entries WHERE entry_id = ?)', [e.id]);
          await execute('DELETE FROM slope_assessment_controls WHERE assessment_id IN (SELECT id FROM slope_assessments WHERE entry_id = ?)', [e.id]);
          await execute('DELETE FROM slope_assessment_indicators WHERE assessment_id IN (SELECT id FROM slope_assessments WHERE entry_id = ?)', [e.id]);
          await execute('DELETE FROM slope_assessments WHERE entry_id = ?', [e.id]);
          await execute('DELETE FROM q_assessments WHERE entry_id = ?', [e.id]);
          await execute('DELETE FROM qa_anchor WHERE entry_id = ?', [e.id]);
          await execute('DELETE FROM qa_bolt WHERE entry_id = ?', [e.id]);
          await execute('DELETE FROM qa_shotcrete WHERE entry_id = ?', [e.id]);
          await execute('DELETE FROM qa_retaining WHERE entry_id = ?', [e.id]);
        }
        await execute('DELETE FROM entries WHERE project_id = ?', [selftestProjectId]);
        if (selftestLocationId) {
          await execute('DELETE FROM locations WHERE id = ?', [selftestLocationId]);
        }
        await execute('DELETE FROM projects WHERE id = ?', [selftestProjectId]);
      }
      setRuntimeErrors(listRuntimeErrors());
      setIsRunning(false);
    }
  };

  const copyReport = () => {
    const report = results.map(r => `${r.id} ${r.name}: ${r.status.toUpperCase()}${r.error ? ` (${r.error})` : ''} - ${r.duration || 0}ms`).join('\n');
    navigator.clipboard.writeText(report);
    alert('Report copied to clipboard');
  };

  const handleClearRuntimeErrors = () => {
    clearRuntimeErrors();
    setRuntimeErrors([]);
  };

  return (
    <Layout title="Diagnostics" showBack>
      <div className="flex flex-col gap-6 p-4">
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-6 shadow-sm border border-zinc-100">
          <h2 className="text-lg font-bold text-zinc-900">System Self-Test</h2>
          <p className="text-sm text-zinc-500">
            Verify end-to-end offline functionality by running a suite of automated tests.
            This will create a temporary project and clean it up afterwards.
          </p>

          <div className="mt-4 flex gap-3">
            <button
              onClick={startDiagnostics}
              disabled={isRunning}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {isRunning ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
              {isRunning ? 'Running Tests...' : 'Run Diagnostics'}
            </button>
            <button
              onClick={copyReport}
              className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 font-bold text-zinc-600 shadow-sm"
            >
              <Copy size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 mt-4">Runtime Error Log</h2>
            <button
              onClick={handleClearRuntimeErrors}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-600 shadow-sm"
            >
              Clear
            </button>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100 flex flex-col gap-3">
            {runtimeErrors.length === 0 ? (
              <p className="text-sm text-zinc-500">No runtime errors recorded.</p>
            ) : (
              runtimeErrors.slice(0, 10).map((error) => (
                <div key={error.id} className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-900">
                  <div className="font-bold">{error.source}</div>
                  <div>{new Date(error.timestamp).toLocaleString()}</div>
                  <div className="mt-1">{error.message}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-zinc-900 mt-4">Regression Checklist</h2>
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-zinc-100 flex flex-col gap-2 text-sm text-zinc-700">
            <p className="font-bold text-zinc-900 mb-2">Engineering Logic</p>
            <ul className="list-disc list-inside space-y-1">
              <li>RMR is primary for overall rock mass quality</li>
              <li>Q is primary for support intensity</li>
              <li>GSI is supplementary</li>
              <li>Structural Assessment raises or lowers support demand</li>
              <li>Groundwater controls drainage need</li>
              <li>All output paragraphs explain the basis of the recommendation</li>
            </ul>
            <p className="font-bold text-zinc-900 mt-4 mb-2">Stability</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Draft persistence on all major forms</li>
              <li>Save flow step separation</li>
              <li>Startup blocking tasks</li>
              <li>Media save isolation</li>
              <li>Back/home navigation consistency</li>
              <li>Location selector consistency</li>
              <li>No raw ET labels</li>
              <li>No undefined location formatting</li>
              <li>No empty summary for generated entries</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {results.map((test, idx) => (
            <motion.div
              key={test.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-zinc-100"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  test.status === 'pass' ? 'bg-emerald-50 text-emerald-600' :
                  test.status === 'fail' ? 'bg-red-50 text-red-600' :
                  test.status === 'running' ? 'bg-blue-50 text-blue-600' :
                  'bg-zinc-50 text-zinc-400'
                }`}>
                  {test.status === 'pass' && <CheckCircle2 size={18} />}
                  {test.status === 'fail' && <XCircle size={18} />}
                  {test.status === 'running' && <Loader2 className="animate-spin" size={18} />}
                  {test.status === 'pending' && <div className="h-2 w-2 rounded-full bg-zinc-300" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-800">{test.id}: {test.name}</span>
                  {test.error && <span className="text-[10px] text-red-500 font-medium">{test.error}</span>}
                </div>
              </div>
              {test.duration !== undefined && (
                <span className="text-[10px] font-mono text-zinc-400">{test.duration}ms</span>
              )}
            </motion.div>
          ))}
        </div>

        {results.some(r => r.status === 'fail') && (
          <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 border border-red-100">
            <AlertTriangle className="text-red-600 shrink-0" size={20} />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-red-900">Diagnostics Failed</span>
              <p className="text-[10px] text-red-700 leading-relaxed">
                One or more tests failed. This could indicate database corruption or a regression in the application logic.
                Try resetting the local database if the issue persists.
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

