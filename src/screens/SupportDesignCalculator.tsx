import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { entryRepo } from '../repositories/entryRepo';
import { supportDesignCalculatorRepo, SupportDesignCalculation } from '../repositories/supportDesignCalculatorRepo';
import { projectRepo } from '../repositories/projectRepo';
import { getActiveProjectId } from '../state/activeProject';
import { locationRepo } from '../repositories/locationRepo';
import { phraseBuilder } from '../phrases/phraseBuilder';
import { Calculator, Save, AlertTriangle, Info } from 'lucide-react';
import { engineeringDataService, EngineeringSnapshot } from '../services/engineeringDataService';

export default function SupportDesignCalculator() {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [snapshot, setSnapshot] = useState<EngineeringSnapshot | null>(null);

  // Inputs
  const [qValue, setQValue] = useState<string>('');
  const [rmrValue, setRmrValue] = useState<string>('');
  const [gsiValue, setGsiValue] = useState<string>('');
  const [failureMode, setFailureMode] = useState<string>('none');
  const [groundwater, setGroundwater] = useState<string>('dry');
  const [span, setSpan] = useState<string>('');
  const [batterHeight, setBatterHeight] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Outputs
  const [supportClass, setSupportClass] = useState<string>('Unknown');
  const [boltLength, setBoltLength] = useState<number>(0);
  const [boltSpacing, setBoltSpacing] = useState<number>(0);
  const [meshRequired, setMeshRequired] = useState<boolean>(false);
  const [shotcreteThickness, setShotcreteThickness] = useState<number>(0);
  const [drainageRequired, setDrainageRequired] = useState<boolean>(false);

  // Fetch projects
  useEffect(() => {
    setProjects(projectRepo.getAll());
    const activeId = getActiveProjectId();
    if (activeId) {
      setProjectId(activeId);
    }
  }, []);

  // Fetch locations
  useEffect(() => {
    if (projectId) {
      setLocations(locationRepo.listLocationsForProject(projectId));
    } else {
      setLocations([]);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId && locationId) {
      setSnapshot(engineeringDataService.getEngineeringSnapshotByLocation(locationId));
    } else {
      setSnapshot(null);
    }
  }, [projectId, locationId]);

  // Calculator Logic
  useEffect(() => {
    let baseClass = 'Unknown';
    let bLen = 0;
    let bSpace = 0;
    let mesh = false;
    let shotcrete = 0;
    let drainage = false;

    // 1) Base support demand
    let rockQualityScore = 0; // 5: Very Good, 4: Good, 3: Fair, 2: Poor, 1: Very Poor

    const q = parseFloat(qValue);
    const rmr = parseInt(rmrValue);
    const gsi = parseInt(gsiValue);

    if (!isNaN(q)) {
      if (q > 40) rockQualityScore = 5;
      else if (q > 10) rockQualityScore = 4;
      else if (q > 4) rockQualityScore = 3;
      else if (q > 1) rockQualityScore = 2;
      else rockQualityScore = 1;
    } else if (!isNaN(rmr)) {
      if (rmr > 80) rockQualityScore = 5;
      else if (rmr > 60) rockQualityScore = 4;
      else if (rmr > 40) rockQualityScore = 3;
      else if (rmr > 20) rockQualityScore = 2;
      else rockQualityScore = 1;
    } else if (!isNaN(gsi)) {
      if (gsi > 75) rockQualityScore = 5;
      else if (gsi > 55) rockQualityScore = 4;
      else if (gsi > 35) rockQualityScore = 3;
      else if (gsi > 15) rockQualityScore = 2;
      else rockQualityScore = 1;
    }

    // Apply base support
    if (rockQualityScore === 5) {
      baseClass = 'Light';
      bLen = 0;
      bSpace = 0;
      mesh = false;
      shotcrete = 0;
    } else if (rockQualityScore === 4) {
      baseClass = 'Spot Bolting';
      bLen = 2.0;
      bSpace = 3.0;
      mesh = false;
      shotcrete = 0;
    } else if (rockQualityScore === 3) {
      baseClass = 'Systematic Bolting';
      bLen = 2.4;
      bSpace = 2.0;
      mesh = true;
      shotcrete = 50;
    } else if (rockQualityScore === 2) {
      baseClass = 'Bolts + Mesh + Shotcrete';
      bLen = 3.0;
      bSpace = 1.5;
      mesh = true;
      shotcrete = 75;
    } else if (rockQualityScore === 1) {
      baseClass = 'Heavy Support';
      bLen = 4.0;
      bSpace = 1.0;
      mesh = true;
      shotcrete = 100;
    }

    // 4) Adjustment rules
    if (failureMode !== 'none' && rockQualityScore > 0) {
      // Increase support demand
      if (rockQualityScore > 1) {
        bLen += 0.5;
        bSpace = Math.max(1.0, bSpace - 0.5);
        mesh = true;
        if (shotcrete === 0) shotcrete = 50;
      }
    }

    if (['wet', 'dripping', 'flowing'].includes(groundwater)) {
      drainage = true;
      if (shotcrete > 0) shotcrete += 25; // Extra shotcrete for wet conditions
    }

    const s = parseFloat(span);
    const b = parseFloat(batterHeight);

    if (!isNaN(s) && s > 10 && rockQualityScore > 0) {
      bLen += 1.0;
    }
    if (!isNaN(b) && b > 10 && rockQualityScore > 0) {
      bLen += 1.0;
    }

    setSupportClass(baseClass);
    setBoltLength(bLen);
    setBoltSpacing(bSpace);
    setMeshRequired(mesh);
    setShotcreteThickness(shotcrete);
    setDrainageRequired(drainage);

  }, [qValue, rmrValue, gsiValue, failureMode, groundwater, span, batterHeight]);

  const handleSave = async () => {
    if (!projectId || !locationId) {
      alert('Please select a project and location.');
      return;
    }

    setIsSaving(true);
    try {
      const dataToSave: Omit<SupportDesignCalculation, 'id' | 'entry_id'> = {
        source_q_value: qValue ? parseFloat(qValue) : null,
        source_rmr: rmrValue ? parseInt(rmrValue) : null,
        source_gsi: gsiValue ? parseInt(gsiValue) : null,
        source_failure_mode: failureMode,
        groundwater_severity: groundwater,
        excavation_span: span ? parseFloat(span) : null,
        batter_height: batterHeight ? parseFloat(batterHeight) : null,
        support_class: supportClass,
        bolt_length_m: boltLength,
        bolt_spacing_m: boltSpacing,
        mesh_required: meshRequired ? 1 : 0,
        shotcrete_thickness_mm: shotcreteThickness,
        drainage_required: drainageRequired ? 1 : 0,
        design_note: notes
      };

      const summary = phraseBuilder.buildSupportCalculatorParagraph(dataToSave);

      const entryId = await entryRepo.create({
        project_id: projectId,
        location_id: locationId,
        entry_type_id: 'ET17',
        status_id: 'ST_OPEN',
        risk_level_id: 'R1',
        summary: summary,
        is_handover_item: 0,
        author: 'Field Engineer'
      });

      await supportDesignCalculatorRepo.create({
        entry_id: entryId,
        ...dataToSave
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigate(-1);
      }, 1500);

    } catch (error) {
      console.error('Error saving support calculator:', error);
      alert('Failed to save support calculator.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatQ = (val: number | null) => {
    if (val === null || isNaN(val)) return "Not available";
    return `Q = ${val.toFixed(2)}`;
  };

  const formatRMR = (val: number | null) => {
    if (val === null || isNaN(val)) return "Not available";
    return `RMR = ${val}`;
  };

  const formatGSI = (val: number | null, range: { min: number; max: number } | null) => {
    if (val === null || isNaN(val)) return "Not available";
    return `GSI = ${val}${range ? ` (Range: ${range.min}–${range.max})` : ''}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PageHeader title="Support Calculator" />

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="mx-auto max-w-2xl flex flex-col gap-6">
          
          <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col gap-4">
            <ProjectSelector
              value={projectId}
              onChange={(id) => {
                setProjectId(id);
                setLocationId('');
              }}
            />
            <LocationSelector
              value={locationId}
              onChange={(id) => setLocationId(id)}
            />
          </div>

          {/* Reference Inputs */}
          {snapshot && (
            <div className="bg-slate-100 p-4 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Info size={16} />
                Reference Data
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-700">
                <div><span className="font-bold">Latest Q:</span> {formatQ(snapshot.q)}</div>
                <div><span className="font-bold">Latest RMR:</span> {formatRMR(snapshot.rmr)}</div>
                <div><span className="font-bold">Latest GSI:</span> {formatGSI(snapshot.gsi_mid, snapshot.gsi_range)}</div>
                <div><span className="font-bold">Failure Mode:</span> {snapshot.structural_mode || 'None'}</div>
              </div>
              <div className="mt-3">
                <button
                  onClick={() => {
                    if (window.confirm('Use these reference values?')) {
                      if (snapshot.q !== null) setQValue(snapshot.q.toString());
                      if (snapshot.rmr !== null) setRmrValue(snapshot.rmr.toString());
                      if (snapshot.gsi_mid !== null) setGsiValue(snapshot.gsi_mid.toString());
                      if (snapshot.structural_mode) {
                        const mode = snapshot.structural_mode.toLowerCase();
                        if (mode.includes('planar')) setFailureMode('planar');
                        else if (mode.includes('wedge')) setFailureMode('wedge');
                        else if (mode.includes('toppling')) setFailureMode('toppling');
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-200 text-slate-800 font-medium rounded-lg text-xs hover:bg-slate-300"
                >
                  Apply Reference Values
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col gap-4">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <Calculator size={20} className="text-emerald-600" />
              Inputs
            </h2>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Q Value</label>
                <input type="text" inputMode="decimal" value={qValue} onChange={e => setQValue(e.target.value)} className="rounded-lg border border-zinc-200 p-3 text-sm" placeholder="e.g. 12.5" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">RMR</label>
                <input type="text" inputMode="decimal" value={rmrValue} onChange={e => setRmrValue(e.target.value)} className="rounded-lg border border-zinc-200 p-3 text-sm" placeholder="e.g. 65" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">GSI</label>
                <input type="text" inputMode="decimal" value={gsiValue} onChange={e => setGsiValue(e.target.value)} className="rounded-lg border border-zinc-200 p-3 text-sm" placeholder="e.g. 55" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Failure Mode</label>
                <select value={failureMode} onChange={e => setFailureMode(e.target.value)} className="rounded-lg border border-zinc-200 p-3 text-sm bg-white">
                  <option value="none">None / Unknown</option>
                  <option value="planar">Planar</option>
                  <option value="wedge">Wedge</option>
                  <option value="toppling">Toppling</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Groundwater</label>
                <select value={groundwater} onChange={e => setGroundwater(e.target.value)} className="rounded-lg border border-zinc-200 p-3 text-sm bg-white">
                  <option value="dry">Dry</option>
                  <option value="damp">Damp</option>
                  <option value="wet">Wet</option>
                  <option value="dripping">Dripping</option>
                  <option value="flowing">Flowing</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Excavation Span (m)</label>
                <input type="text" inputMode="decimal" value={span} onChange={e => setSpan(e.target.value)} className="rounded-lg border border-zinc-200 p-3 text-sm" placeholder="e.g. 8.5" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500 uppercase">Batter Height (m)</label>
                <input type="text" inputMode="decimal" value={batterHeight} onChange={e => setBatterHeight(e.target.value)} className="rounded-lg border border-zinc-200 p-3 text-sm" placeholder="e.g. 15" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-zinc-500 uppercase">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="rounded-lg border border-zinc-200 p-3 text-sm min-h-[80px]" placeholder="Any additional context..." />
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-6 shadow-sm flex flex-col gap-4">
            <h2 className="text-lg font-bold text-emerald-900">Indicative Output</h2>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-700 uppercase">Support Class</span>
                <span className="text-lg font-bold text-emerald-950">{supportClass}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-700 uppercase">Bolting</span>
                <span className="text-sm font-medium text-emerald-900">
                  {boltLength > 0 ? `${boltLength}m @ ${boltSpacing}m spacing` : 'None'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-700 uppercase">Surface Support</span>
                <span className="text-sm font-medium text-emerald-900">
                  {shotcreteThickness > 0 ? `${shotcreteThickness}mm Shotcrete` : 'None'}
                  {meshRequired ? ' + Mesh' : ''}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-700 uppercase">Drainage</span>
                <span className="text-sm font-medium text-emerald-900">
                  {drainageRequired ? 'Required' : 'Not Required'}
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-start gap-2 rounded-lg bg-emerald-100/50 p-3 text-xs text-emerald-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <p>Indicative support guidance only. Final support design requires engineering verification.</p>
            </div>
          </div>

        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200 bg-white p-4 shadow-lg">
        <div className="mx-auto flex max-w-2xl gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 rounded-xl bg-zinc-100 py-3 font-bold text-zinc-700 hover:bg-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex flex-2 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save size={20} />
            {isSaving ? 'Saving...' : 'Save Calculation'}
          </button>
        </div>
      </div>

      {showSuccess && <SaveSuccessModal />}
    </div>
  );
}
