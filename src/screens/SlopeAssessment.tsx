import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { Dropdown } from '../components/Dropdown';
import { MultiSelect } from '../components/MultiSelect';
import { projectRepo, Project } from '../repositories/projectRepo';
import { locationRepo } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { slopeRepo } from '../repositories/slopeRepo';
import { saveAutoBackupZip } from '../utils/autoBackup';
import { refRepo, RefItem } from '../repositories/refRepo';
import { phraseBuilder } from '../phrases/phraseBuilder';
import { predictFailureModes } from '../rules/failureRules';
import { getSuggestedControls } from '../repositories/slopeRules';
import { formatLocationShort } from '../utils/formatters';
import { Save, AlertTriangle, Check, Plus, Info, Zap, ShieldAlert, Trash2, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { TimeoutSafety } from '../components/TimeoutSafety';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { DRAFT_KEYS, loadFormDraft, saveFormDraft, clearFormDraft, hasFormDraft } from '../state/formDrafts';
import { getFieldAuthor, isAutoBackupEnabled } from '../state/userPreferences';

const parseNumericInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const SlopeAssessment: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [likelihoods, setLikelihoods] = useState<RefItem[]>([]);
  const [consequences, setConsequences] = useState<RefItem[]>([]);
  const [riskLevels, setRiskLevels] = useState<RefItem[]>([]);
  const [allControls, setAllControls] = useState<RefItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  const [formData, setFormData] = useState({
    project_id: '',
    location_id: '',
    isNewLocation: false,
    newLocationData: null as any,
    isValidLocation: false,
    risk_level_id: 'R2', // Default to Medium
    status_id: 'ST_OPEN', // Default to Open
    slope_type_id: '',
    height: '0',
    angle: '0',
    dip_direction: '0',
    failure_mode_id: '',
    likelihood_id: '',
    consequence_id: '',
    bench_condition_id: '',
    toe_condition_id: '',
    drainage_condition_id: '',
    indicators: [] as string[],
    controls: [] as string[],
    discontinuitySets: [] as { dip: string, dipDirection: string }[],
    notes: '',
    is_handover_item: 0,
  });

  const [suggestedControlIds, setSuggestedControlIds] = useState<string[]>([]);
  const [autoAction, setAutoAction] = useState<{ description: string, priority_id: string } | null>(null);
  const [locationPreview, setLocationPreview] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const author = getFieldAuthor();

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  /**
   * ALGORITHM SPECIFICATION: Slope Assessment (Geometry Screening)
   * 
   * PURPOSE:
   * Provides a preliminary geometric screening for potential failure modes 
   * in a rock slope based on slope geometry and discontinuity sets.
   * 
   * INPUTS:
   * - Slope Geometry (Dip, Dip Direction)
   * - Discontinuity Sets (Dip, Dip Direction)
   * 
   * ENGINEERING RULES:
   * - Uses predictFailureModes() from failureRules.ts.
   * - Flags potential Planar, Wedge, and Toppling modes based on geometric daylighting.
   * 
   * OUTPUTS:
   * - Preliminary failure mode suggestions.
   * - Risk level estimation based on likelihood and consequence.
   * 
   * ASSUMPTIONS:
   * - Preliminary screening only.
   * - Assumed friction angle of 20 degrees for screening purposes.
   * 
   * LIMITATIONS:
   * - Does not replace rigorous kinematic analysis (Structural Assessment).
   * - Intended as a geometry-screening tool only.
   */

  const loadData = async () => {
    setLoading(true);
    setTimedOut(false);
    const timeout = setTimeout(() => {
      if (loading) setTimedOut(true);
    }, 5000);

    try {
      const [projs, liks, cons, risks, ctrls] = await Promise.all([
        projectRepo.list(),
        refRepo.getRefList('ref_likelihood'),
        refRepo.getRefList('ref_consequence'),
        refRepo.getRefList('ref_risk_level'),
        refRepo.getRefList('ref_controls')
      ]);

      setProjects(projs);
      setLikelihoods(liks);
      setConsequences(cons);
      setRiskLevels(risks);
      setAllControls(ctrls);
    } catch (err) {
      console.error('Error loading slope assessment data:', err);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const draft = loadFormDraft(DRAFT_KEYS.slopeAssessment);
    if (draft) {
      setFormData(draft);
    }
  }, []);

  useEffect(() => {
    const navState = location.state as { projectId?: string; locationId?: string } | null;
    if (!navState) return;
    setFormData((prev) => ({
      ...prev,
      project_id: prev.project_id || navState.projectId || '',
      location_id: prev.location_id || navState.locationId || '',
      isValidLocation: prev.isValidLocation || !!navState.locationId,
    }));
  }, [location.state]);

  useEffect(() => {
    saveFormDraft(DRAFT_KEYS.slopeAssessment, formData);
  }, [formData]);

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setFormData({
        project_id: '',
        location_id: '',
        isNewLocation: false,
        newLocationData: null as any,
        isValidLocation: false,
        risk_level_id: 'R2',
        status_id: 'ST_OPEN',
        slope_type_id: '',
        height: '0',
        angle: '0',
        dip_direction: '0',
        failure_mode_id: '',
        likelihood_id: '',
        consequence_id: '',
        bench_condition_id: '',
        toe_condition_id: '',
        drainage_condition_id: '',
        indicators: [],
        controls: [],
        discontinuitySets: [],
        notes: '',
        is_handover_item: 0,
      });
      clearFormDraft(DRAFT_KEYS.slopeAssessment);
    }
  };

  const riskInfo = useMemo(() => {
    const l = likelihoods.find(i => i.id === formData.likelihood_id);
    const c = consequences.find(i => i.id === formData.consequence_id);
    if (!l || !c) return null;

    const score = (l.weight || 0) * (c.weight || 0);
    let label = 'Low';
    let colorClass = 'bg-emerald-100 text-emerald-700';
    let suggestedRiskId = 'R1';

    if (score >= 17) {
      label = 'Critical';
      colorClass = 'bg-red-100 text-red-700';
      suggestedRiskId = 'R4';
    } else if (score >= 10) {
      label = 'High';
      colorClass = 'bg-orange-100 text-orange-700';
      suggestedRiskId = 'R3';
    } else if (score >= 5) {
      label = 'Medium';
      colorClass = 'bg-yellow-100 text-yellow-700';
      suggestedRiskId = 'R2';
    }

    return { score, label, colorClass, suggestedRiskId };
  }, [formData.likelihood_id, formData.consequence_id, likelihoods, consequences]);

  const parsedDiscontinuitySets = useMemo(() => formData.discontinuitySets.map((set) => ({
    dip: parseNumericInput(set.dip) ?? 0,
    dipDirection: parseNumericInput(set.dipDirection) ?? 0
  })), [formData.discontinuitySets]);

  const predictedFailures = useMemo(() => {
    return predictFailureModes(
      { dip: parseNumericInput(formData.angle) ?? 0, dipDirection: parseNumericInput(formData.dip_direction) ?? 0 },
      parsedDiscontinuitySets
    );
  }, [formData.angle, formData.dip_direction, parsedDiscontinuitySets]);

  // Update suggestions
  useEffect(() => {
    const suggested = getSuggestedControls(formData.indicators);
    // Filter out those already in formData.controls
    setSuggestedControlIds(suggested.filter(id => !formData.controls.includes(id)));
  }, [formData.indicators, formData.controls]);

  // Update action preview
  useEffect(() => {
    if (riskInfo && riskInfo.score >= 10) {
      const priority = riskInfo.score >= 17 ? 'P1' : 'P2';
      const locStr = locationPreview || 'this location';
      setAutoAction(prev => ({
        description: prev?.description || `Inspect and stabilise slope at ${locStr}. Implement recommended controls.`,
        priority_id: priority
      }));
    } else {
      setAutoAction(null);
    }
  }, [riskInfo, locationPreview]);

  if (timedOut) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <PageHeader title="Timeout" />
        <div className="flex-1 overflow-y-auto p-4">
          <TimeoutSafety onRetry={loadData} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <PageHeader title="Slope Assessment" />
        <div className="flex-1 overflow-y-auto flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
        </div>
      </div>
    );
  }

  const handleLocationChange = (id: string, isNew: boolean, data: any, isValid: boolean) => {
    setFormData({ ...formData, location_id: id, isNewLocation: isNew, newLocationData: data, isValidLocation: !!isValid });
    if (isValid) {
      if (isNew) {
        setLocationPreview(formatLocationShort(data));
      } else {
        const loc = locationRepo.getById(id);
        setLocationPreview(formatLocationShort(loc));
      }
    } else {
      setLocationPreview('');
    }
  };

  const addSuggestedControl = (id: string) => {
    setFormData(prev => ({
      ...prev,
      controls: [...prev.controls, id]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_id || !formData.isValidLocation) {
      alert('Please fill in required fields and ensure location is valid');
      return;
    }

    setIsSaving(true);
    try {
      let finalLocationId = formData.location_id;
      if (formData.isNewLocation) {
        finalLocationId = await locationRepo.create(formData.newLocationData);
      }

      // Pre-fetch all labels needed for the paragraph
      const [
        typeLabel, modeLabel, benchLabel, toeLabel, drainageLabel, 
        likelihoodLabel, consequenceLabel, indicatorLabels, controlLabels
      ] = await Promise.all([
        refRepo.getLabel('ref_slope_type', formData.slope_type_id),
        refRepo.getLabel('ref_failure_mode', formData.failure_mode_id),
        refRepo.getLabel('ref_bench_condition', formData.bench_condition_id),
        refRepo.getLabel('ref_toe_condition', formData.toe_condition_id),
        refRepo.getLabel('ref_drainage_condition', formData.drainage_condition_id),
        refRepo.getLabel('ref_likelihood', formData.likelihood_id),
        refRepo.getLabel('ref_consequence', formData.consequence_id),
        Promise.all(formData.indicators.map(id => refRepo.getLabel('ref_instability_indicator', id))),
        Promise.all(formData.controls.map(id => refRepo.getLabel('ref_controls', id)))
      ]);

      const finalLookup = {
        getLabel: (table: string, id: string | null | undefined): string => {
          if (id === formData.slope_type_id) return typeLabel;
          if (id === formData.failure_mode_id) return modeLabel;
          if (id === formData.bench_condition_id) return benchLabel;
          if (id === formData.toe_condition_id) return toeLabel;
          if (id === formData.drainage_condition_id) return drainageLabel;
          if (id === formData.likelihood_id) return likelihoodLabel;
          if (id === formData.consequence_id) return consequenceLabel;
          return id || '';
        }
      };

      const parsedFormData = { ...formData, height: parseNumericInput(formData.height) ?? 0, angle: parseNumericInput(formData.angle) ?? 0, dip_direction: parseNumericInput(formData.dip_direction) ?? 0, discontinuitySets: parsedDiscontinuitySets };
      let summary = phraseBuilder.buildSlopeParagraph(parsedFormData, controlLabels, indicatorLabels, finalLookup);
      if (formData.notes) {
        summary += ` Notes: ${formData.notes}`;
      }

      const entryId = await entryRepo.create({
        project_id: formData.project_id,
        location_id: finalLocationId,
        entry_type_id: 'ET6', // Slope Failure
        risk_level_id: formData.risk_level_id,
        status_id: formData.status_id,
        author: author,
        summary: summary,
        is_handover_item: formData.is_handover_item,
      });

      await slopeRepo.save({
        entry_id: entryId,
        slope_type_id: formData.slope_type_id,
        height: parseNumericInput(formData.height) ?? 0,
        angle: parseNumericInput(formData.angle) ?? 0,
        dip_direction: parseNumericInput(formData.dip_direction) ?? 0,
        failure_mode_id: formData.failure_mode_id,
        likelihood_id: formData.likelihood_id,
        consequence_id: formData.consequence_id,
        bench_condition_id: formData.bench_condition_id,
        toe_condition_id: formData.toe_condition_id,
        drainage_condition_id: formData.drainage_condition_id,
        recommended_controls_text: formData.notes
      }, formData.indicators, formData.controls, parsedDiscontinuitySets, autoAction || undefined);

      try {
        await locationRepo.touch(finalLocationId);
      } catch (touchErr) {
        console.error('Failed to touch location after slope save:', touchErr);
      }

      // Trigger auto-backup if enabled (fire-and-forget)
      if (isAutoBackupEnabled()) {
        saveAutoBackupZip().catch(err => console.error('Auto-backup failed:', err));
      }

      clearFormDraft(DRAFT_KEYS.slopeAssessment);
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (err) {
      console.error(err);
      alert('Failed to save assessment');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="theme-slope-assessment flex flex-col h-screen bg-gray-50">
      <PageHeader title="Slope Assessment" />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-end mb-6">
            <button
              onClick={handleClearForm}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear Form
            </button>
          </div>
          <form onSubmit={handleSave} className="flex flex-col gap-6 pb-10">
            {/* Field Context */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <ProjectSelector
            value={formData.project_id}
            onChange={(id) => setFormData({ ...formData, project_id: id })}
          />

          <LocationSelector
            value={formData.location_id}
            onChange={handleLocationChange}
          />
        </div>

        {/* Entry Metadata */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Record Settings</h3>
            {riskInfo && (
              <div className={clsx("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", riskInfo.colorClass)}>
                <AlertTriangle size={10} />
                <span>Calculated: {riskInfo.label} ({riskInfo.score})</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Dropdown
              label="Risk Level"
              tableName="ref_risk_level"
              value={formData.risk_level_id}
              onChange={(val) => setFormData({ ...formData, risk_level_id: val })}
              required
            />
            <Dropdown
              label="Status"
              tableName="ref_status"
              value={formData.status_id}
              onChange={(val) => setFormData({ ...formData, status_id: val })}
              required
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 border border-zinc-100">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-800">Handover Item</span>
              <span className="text-[10px] text-zinc-400">Include in daily report</span>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_handover_item: formData.is_handover_item ? 0 : 1 })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.is_handover_item ? 'bg-emerald-500' : 'bg-zinc-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_handover_item ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          
          {riskInfo && formData.risk_level_id !== riskInfo.suggestedRiskId && (
            <button
              type="button"
              onClick={() => setFormData({ ...formData, risk_level_id: riskInfo.suggestedRiskId })}
              className="text-left text-[10px] font-bold text-emerald-600 uppercase hover:underline"
            >
              Apply calculated risk: {riskInfo.label}
            </button>
          )}
        </div>

        {/* Observed Geometry */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Observed Slope Geometry</h3>
          <Dropdown
            label="Slope Type"
            tableName="ref_slope_type"
            value={formData.slope_type_id}
            onChange={(val) => setFormData({ ...formData, slope_type_id: val })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Height (m)</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Angle (deg)</label>
              <input
                type="text"
                inputMode="decimal"
                min="0"
                max="90"
                value={formData.angle}
                onChange={(e) => setFormData({ ...formData, angle: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Dip Direction (deg)</label>
            <input
              type="text"
              inputMode="decimal"
              min="0"
              max="359"
              value={formData.dip_direction}
              onChange={(e) => setFormData({ ...formData, dip_direction: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="0-359"
            />
          </div>
        </div>

        {/* Observed Discontinuities */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Observed Discontinuities</h3>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ 
                ...prev, 
                discontinuitySets: [...prev.discontinuitySets, { dip: '45', dipDirection: '0' }] 
              }))}
              className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-600 hover:bg-zinc-200"
            >
              <Plus size={10} />
              Add Set
            </button>
          </div>
          
          {formData.discontinuitySets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400">
              No discontinuity sets added. Add measured sets if structural controls are visible on site.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {formData.discontinuitySets.map((set, idx) => (
                <div key={idx} className="flex items-end gap-3 rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-400">Set {idx + 1} Dip</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={set.dip}
                      onChange={(e) => {
                        const newSets = [...formData.discontinuitySets];
                        newSets[idx].dip = e.target.value;
                        setFormData({ ...formData, discontinuitySets: newSets });
                      }}
                      className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-400">Set {idx + 1} Dip Dir</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={set.dipDirection}
                      onChange={(e) => {
                        const newSets = [...formData.discontinuitySets];
                        newSets[idx].dipDirection = e.target.value;
                        setFormData({ ...formData, discontinuitySets: newSets });
                      }}
                      className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newSets = formData.discontinuitySets.filter((_, i) => i !== idx);
                      setFormData({ ...formData, discontinuitySets: newSets });
                    }}
                    className="mb-1 rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preliminary Screening Output */}
        {predictedFailures.length > 0 && (
          <div className="flex flex-col gap-4 rounded-2xl bg-indigo-50 p-4 shadow-sm border border-indigo-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700">
              <ShieldAlert size={16} />
              <span>Preliminary Geometric Screening</span>
            </div>
            <div className="flex flex-col gap-3">
              {predictedFailures.map((failure, idx) => (
                <div key={idx} className="flex flex-col gap-1 rounded-xl bg-white p-3 shadow-sm border-l-4 border-indigo-500">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-800">{failure.label}</span>
                    <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", 
                      failure.severity === 'High' ? 'bg-red-100 text-red-700' : 
                      failure.severity === 'Moderate' ? 'bg-orange-100 text-orange-700' : 
                      'bg-blue-100 text-blue-700'
                    )}>
                      {failure.severity} Risk
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">{failure.description}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-indigo-100/50 p-2 text-[10px] text-indigo-600 italic">
              <Info size={12} className="shrink-0" />
              <span>Screening output only. Use Structural Assessment for kinematic verification and formal structural review.</span>
            </div>
          </div>
        )}

        {/* Screening Assessment */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Screening Assessment</h3>
          <Dropdown
            label="Screening Failure Mode"
            tableName="ref_failure_mode"
            value={formData.failure_mode_id}
            onChange={(val) => setFormData({ ...formData, failure_mode_id: val })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Dropdown
              label="Likelihood"
              tableName="ref_likelihood"
              value={formData.likelihood_id}
              onChange={(val) => setFormData({ ...formData, likelihood_id: val })}
              required
            />
            <Dropdown
              label="Consequence"
              tableName="ref_consequence"
              value={formData.consequence_id}
              onChange={(val) => setFormData({ ...formData, consequence_id: val })}
              required
            />
          </div>
        </div>

        {/* Observed Site Conditions */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Observed Site Conditions</h3>
          <Dropdown
            label="Bench Condition"
            tableName="ref_bench_condition"
            value={formData.bench_condition_id}
            onChange={(val) => setFormData({ ...formData, bench_condition_id: val })}
            required
          />
          <Dropdown
            label="Toe Condition"
            tableName="ref_toe_condition"
            value={formData.toe_condition_id}
            onChange={(val) => setFormData({ ...formData, toe_condition_id: val })}
            required
          />
          <Dropdown
            label="Drainage Condition"
            tableName="ref_drainage_condition"
            value={formData.drainage_condition_id}
            onChange={(val) => setFormData({ ...formData, drainage_condition_id: val })}
            required
          />
        </div>

        {/* Indicators and Controls */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Observed Indicators and Proposed Controls</h3>
          <MultiSelect
            label="Instability Indicators"
            tableName="ref_instability_indicator"
            value={formData.indicators}
            onChange={(val) => setFormData({ ...formData, indicators: val })}
          />
          
          <MultiSelect
            label="Selected Controls"
            tableName="ref_controls"
            value={formData.controls}
            onChange={(val) => setFormData({ ...formData, controls: val })}
          />

          {suggestedControlIds.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl bg-emerald-50 p-3 border border-emerald-100">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-emerald-700">
                <Zap size={12} />
                <span>Suggested Controls</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedControlIds.map(id => {
                  const label = allControls.find(c => c.id === id)?.label || id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => addSuggestedControl(id)}
                      className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-emerald-600 border border-emerald-200 shadow-sm hover:bg-emerald-100"
                    >
                      <Plus size={10} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Suggested Action */}
        {autoAction && (
          <div className="flex flex-col gap-4 rounded-2xl bg-orange-50 p-4 shadow-sm border border-orange-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-700">
                <Info size={14} />
                <span>Suggested Follow-up Action</span>
              </div>
              <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", 
                autoAction.priority_id === 'P1' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
              )}>
                {autoAction.priority_id} Priority
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-orange-600">Action Description</label>
              <textarea
                value={autoAction.description}
                onChange={(e) => setAutoAction({ ...autoAction, description: e.target.value })}
                className="w-full rounded-lg border border-orange-200 bg-white p-3 text-sm focus:border-orange-500 focus:outline-none"
                rows={2}
              />
            </div>
            <div className="text-[10px] text-orange-600 italic">
              This preview helps field handover. It does not replace engineering review.
            </div>
          </div>
        )}

        {/* Notes and Handover Context */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Notes and Handover Context</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="min-h-[100px] w-full rounded-lg border border-zinc-200 p-3 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="Enter any additional details..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--module-accent)] py-4 font-bold text-white shadow-lg shadow-emerald-100 disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <Save size={20} />
          {isSaving ? 'Saving...' : 'Save Slope Log'}
        </button>
      </form>
        </div>
      </div>
      <SaveSuccessModal 
        isOpen={showSuccessModal} 
        entryId={savedEntryId}
        onContinue={() => {
          setShowSuccessModal(false);
          setSavedEntryId(null);
          handleClearForm();
        }}
      />
    </div>
  );
};


