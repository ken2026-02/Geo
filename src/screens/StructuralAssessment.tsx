import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, Trash2, Flag } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { projectRepo } from '../repositories/projectRepo';
import { getActiveProjectId } from '../state/activeProject';
import { locationRepo } from '../repositories/locationRepo';
import { entryRepo } from '../repositories/entryRepo';
import { structuralRepo } from '../repositories/structuralRepo';
import { mappingRepo } from '../repositories/mappingRepo';
import { phraseBuilder } from '../phrases/phraseBuilder';
import { ProjectSelector } from '../components/ProjectSelector';
import { LocationSelector } from '../components/LocationSelector';
import { PageHeader } from '../components/PageHeader';
import { SaveSuccessModal } from '../components/SaveSuccessModal';
import { engineeringStore } from '../state/engineeringStore';
import { structuralAssessmentStore } from '../state/structuralAssessmentStore';
import { JOINT_FRICTION_OPTIONS } from '../config/engineeringParameters';
import { ENGINEERING_LABELS } from '../constants/engineeringLabels';
import { 
  isPlanarKinematicallyAdmissible, 
  isWedgeKinematicallyAdmissible, 
  isTopplingKinematicallyAdmissible 
} from '../utils/rockKinematics';
import {
  isPlanarAdmissibleMarkland,
  isWedgeAdmissibleMarkland,
  isTopplingAdmissibleMarkland
} from '../utils/markland';
import { analyzeKinematics } from '../engineering/kinematicEngine';
import { buildStructuralDefaultsFromMapping } from '../utils/fieldLoggingDefaults';

const DRAFT_KEY = 'structural_assessment';

export default function StructuralAssessment() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');
  
  const [slopeDip, setSlopeDip] = useState<string>('');
  const [slopeDipDir, setSlopeDipDir] = useState<string>('');
  
  const [joint1Dip, setJoint1Dip] = useState<string>('');
  const [joint1DipDir, setJoint1DipDir] = useState<string>('');
  
  const [joint2Dip, setJoint2Dip] = useState<string>('');
  const [joint2DipDir, setJoint2DipDir] = useState<string>('');
  
  const [joint3Dip, setJoint3Dip] = useState<string>('');
  const [joint3DipDir, setJoint3DipDir] = useState<string>('');
  
  const [frictionAngle, setFrictionAngle] = useState<string>('30'); // Default 30 deg
  const [frictionSelection, setFrictionSelection] = useState<number>(30);
  
  const [notes, setNotes] = useState('');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>('');

  // Assessment Results
  const [planarPossible, setPlanarPossible] = useState(false);
  const [wedgePossible, setWedgePossible] = useState(false);
  const [topplingPossible, setTopplingPossible] = useState(false);
  const [dominantMode, setDominantMode] = useState('None');
  const [hazardLevel, setHazardLevel] = useState(ENGINEERING_LABELS.risk.low);
  const [controllingSet, setControllingSet] = useState<string | null>(null);
  const [controllingPair, setControllingPair] = useState<string | null>(null);
  const [wedgePlunge, setWedgePlunge] = useState<number | null>(null);
  const [wedgeTrend, setWedgeTrend] = useState<number | null>(null);
  const [confidenceLevel, setConfidenceLevel] = useState('Low');
  const [engineeringNote, setEngineeringNote] = useState('');
  const [isHandoverItem, setIsHandoverItem] = useState(0);

  const parseNumericInput = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  useEffect(() => {
    setProjects(projectRepo.getAll());
    
    // Load draft or navigation state
    const navState = location.state as any;
    const draft = structuralAssessmentStore.loadDraft();
    
    const initialState = navState || draft;
    
    if (initialState) {
      setProjectId(initialState.projectId || getActiveProjectId() || '');
      setLocationId(initialState.locationId || '');
      setSlopeDip(initialState.slopeDip ?? '');
      setSlopeDipDir(initialState.slopeDipDir ?? '');
      setJoint1Dip(initialState.joint1Dip ?? '');
      setJoint1DipDir(initialState.joint1DipDir ?? '');
      setJoint2Dip(initialState.joint2Dip ?? '');
      setJoint2DipDir(initialState.joint2DipDir ?? '');
      setJoint3Dip(initialState.joint3Dip ?? '');
      setJoint3DipDir(initialState.joint3DipDir ?? '');
      setFrictionAngle(String(initialState.frictionAngle ?? 30));
      setFrictionSelection(initialState.frictionSelection ?? 30);
      setNotes(initialState.notes || '');
      setIsHandoverItem(initialState.isHandoverItem || 0);
      setPlanarPossible(initialState.planarPossible || false);
      setWedgePossible(initialState.wedgePossible || false);
      setTopplingPossible(initialState.topplingPossible || false);
      setDominantMode(initialState.dominantMode || 'None');
      setHazardLevel(initialState.hazardLevel || ENGINEERING_LABELS.risk.low);
      setControllingSet(initialState.controllingSet || null);
      setControllingPair(initialState.controllingPair || null);
      setWedgePlunge(initialState.wedgePlunge || null);
      setWedgeTrend(initialState.wedgeTrend || null);
      setConfidenceLevel(initialState.confidenceLevel || 'Low');
      setEngineeringNote(initialState.engineeringNote || '');
      setDataSource(navState ? 'Using current unsaved Structural Assessment inputs' : 'Using current unsaved Structural Assessment draft');
    } else {
      setProjectId(getActiveProjectId() || '');
      setDataSource('No Structural Assessment data available');
    }
  }, [location.state]);

  // Save draft on change
  useEffect(() => {
    const stateToSave = {
      projectId, locationId, slopeDip, slopeDipDir,
      joint1Dip, joint1DipDir, joint2Dip, joint2DipDir,
      joint3Dip, joint3DipDir, frictionAngle, frictionSelection, notes, isHandoverItem,
      planarPossible, wedgePossible, topplingPossible, dominantMode,
      hazardLevel, controllingSet, controllingPair, wedgePlunge,
      wedgeTrend, confidenceLevel, engineeringNote
    };
    structuralAssessmentStore.saveDraft(stateToSave);
  }, [projectId, locationId, slopeDip, slopeDipDir, joint1Dip, joint1DipDir, joint2Dip, joint2DipDir, joint3Dip, joint3DipDir, frictionAngle, notes, isHandoverItem, planarPossible, wedgePossible, topplingPossible, dominantMode, hazardLevel, controllingSet, controllingPair, wedgePlunge, wedgeTrend, confidenceLevel, engineeringNote]);


  const buildCurrentStatePayload = () => ({
    projectId,
    locationId,
    slopeDip,
    slopeDipDir,
    joint1Dip,
    joint1DipDir,
    joint2Dip,
    joint2DipDir,
    joint3Dip,
    joint3DipDir,
    frictionAngle,
    frictionSelection,
    notes,
    isHandoverItem,
    planarPossible,
    wedgePossible,
    topplingPossible,
    dominantMode,
    hazardLevel,
    controllingSet,
    controllingPair,
    wedgePlunge,
    wedgeTrend,
    confidenceLevel,
    engineeringNote,
  });

  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setProjectId('');
      setLocationId('');
      setSlopeDip('');
      setSlopeDipDir('');
      setJoint1Dip('');
      setJoint1DipDir('');
      setJoint2Dip('');
      setJoint2DipDir('');
      setJoint3Dip('');
      setJoint3DipDir('');
      setFrictionAngle('30');
      setFrictionSelection(30);
      setNotes('');
      setIsHandoverItem(0);
      structuralAssessmentStore.clearDraft();
    }
  };

  const handleViewStereonet = () => {
    navigate('/structural-stereonet', { state: buildCurrentStatePayload() });
  };

  const handleViewWedgeFoS = () => {
    navigate('/wedge-fos', { state: buildCurrentStatePayload() });
  };

  useEffect(() => {
    if (projectId) {
      setLocations(locationRepo.listLocationsForProject(projectId));
    } else {
      setLocations([]);
    }
  }, [projectId]);


  useEffect(() => {
    const navState = location.state as any;
    const draft = structuralAssessmentStore.loadDraft();
    const jointInputsEmpty = !joint1Dip.trim() && !joint1DipDir.trim() && !joint2Dip.trim() && !joint2DipDir.trim() && !joint3Dip.trim() && !joint3DipDir.trim();
    if (!projectId || !locationId || navState || draft || !jointInputsEmpty) return;

    const latestMapping = mappingRepo.getLatestByProjectAndLocation(projectId, locationId);
    if (!latestMapping || !latestMapping.sets?.length) return;

    const defaults = buildStructuralDefaultsFromMapping(latestMapping);
    setJoint1Dip(defaults.joint1Dip);
    setJoint1DipDir(defaults.joint1DipDir);
    setJoint2Dip(defaults.joint2Dip);
    setJoint2DipDir(defaults.joint2DipDir);
    setJoint3Dip(defaults.joint3Dip);
    setJoint3DipDir(defaults.joint3DipDir);
    setDataSource('Using latest Mapping discontinuity sets as Structural Assessment defaults');
  }, [projectId, locationId, location.state, joint1Dip, joint1DipDir, joint2Dip, joint2DipDir, joint3Dip, joint3DipDir]);

  /**
   * ALGORITHM SPECIFICATION: Structural Assessment (Kinematic Analysis)
   * 
   * PURPOSE:
   * Performs formal kinematic failure assessment for rock slopes based on 
   * orientation data (Dip/Dip Direction) of the slope face and up to 3 joint sets.
   * 
   * INPUTS:
   * - Slope Dip (psi_s), Slope Dip Direction (alpha_s)
   * - Joint Dips (psi_j), Joint Dip Directions (alpha_j)
   * - Friction Angle (phi)
   * 
   * ENGINEERING RULES (Rocscience/Dips Style):
   * 1. Planar Failure:
   *    - Daylight: psi_j < psi_s
   *    - Friction: psi_j > phi
   *    - Orientation: |alpha_j - alpha_s| <= 20 degrees
   *    - If friction condition is not satisfied, Planar is No.
   * 
   * 2. Wedge Failure (Vector Intersection):
   *    - Requires two valid joint sets.
   *    - Intersection plunge (psi_i) < psi_s
   *    - Intersection plunge (psi_i) > phi
   *    - Intersection trend (alpha_i) approximately toward slope face (|alpha_i - alpha_s| <= 30 deg).
   *    - Uses vector cross-product math for intersection calculation.
   * 
   * 3. Toppling Failure (Flexural):
   *    - Orientation: |alpha_j - alpha_s - 180| <= 20 degrees (dipping into slope)
   *    - Kinematic: (90 - psi_j) + phi < psi_s
   *    - Steepness: psi_j > 60 degrees to avoid over-triggering.
   * 
   * OUTPUTS:
   * - Boolean flags for Planar, Wedge, Toppling possibility.
   * - Dominant Mode, Hazard Level, Confidence Level, Controlling Set/Pair.
   * 
   * ASSUMPTIONS:
   * - Joints are persistent and planar.
   * - Friction angle is uniform across all sets.
   * - Lateral constraints are not explicitly modeled.
   * 
   * LIMITATIONS:
   * - Screening tool only; does not calculate Factor of Safety (FS).
   * - Simplified flexural toppling screening.
   */

  // Assessment Logic
  useEffect(() => {
    if (parseNumericInput(slopeDip) === null || parseNumericInput(slopeDipDir) === null) {
      setPlanarPossible(false);
      setWedgePossible(false);
      setTopplingPossible(false);
      setDominantMode('None');
      setHazardLevel(ENGINEERING_LABELS.risk.low);
      setControllingSet(null);
      setControllingPair(null);
      setConfidenceLevel('Low');
      setEngineeringNote('Structural control appears limited based on current inputs.');
      return;
    }

    const psi_s = parseNumericInput(slopeDip);
    const alpha_s = parseNumericInput(slopeDipDir);
    const phi = parseNumericInput(frictionAngle) ?? 0;

    if (psi_s === null || alpha_s === null) {
      return;
    }

    const slope = { dip: psi_s, dipDir: alpha_s };

    const joints = [
      { id: 'J1', dip: joint1Dip, dir: joint1DipDir },
      { id: 'J2', dip: joint2Dip, dir: joint2DipDir },
      { id: 'J3', dip: joint3Dip, dir: joint3DipDir }
    ].map(j => ({
      id: j.id,
      dip: parseNumericInput(j.dip),
      dir: parseNumericInput(j.dir)
    })).filter((j): j is { id: string, dip: number, dir: number } => j.dip !== null && j.dir !== null);

    // Internal helper to get joint sets as an array
    const getJointSets = () => joints;
    const currentJointSets = getJointSets();

    let isPlanar = false;
    let isToppling = false;
    let isWedge = false;
    
    let cSet: string | null = null;
    let cPair: string | null = null;

    // 1. Planar Analysis
    // Using kinematicEngine
    const kinematicResult = analyzeKinematics(psi_s, alpha_s, phi, joints.map(j => ({ id: j.id, dip: j.dip, dipDirection: j.dir })));
    
    isPlanar = kinematicResult.planarPossible;
    isToppling = kinematicResult.topplingPossible;
    isWedge = kinematicResult.wedgePossible;
    
    cSet = kinematicResult.controllingSet;
    cPair = kinematicResult.controllingPair || null;

    // Preserve existing Markland-based details as a fallback, but prefer the shared kinematic source of truth.
    if (kinematicResult.wedgePossible && kinematicResult.wedgeTrend != null && kinematicResult.wedgePlunge != null) {
      setWedgeTrend(kinematicResult.wedgeTrend);
      setWedgePlunge(kinematicResult.wedgePlunge);
    } else if (currentJointSets.length >= 2) {
      for (let i = 0; i < currentJointSets.length; i++) {
        for (let k = i + 1; k < currentJointSets.length; k++) {
          const j1 = currentJointSets[i];
          const j2 = currentJointSets[k];
          
          const wedgeResult = isWedgeAdmissibleMarkland(
            { dip: j1.dip, dipDir: j1.dir },
            { dip: j2.dip, dipDir: j2.dir },
            slope,
            phi
          );

          if (wedgeResult.admissible) {
            isWedge = true;
            cPair = `${j1.id} + ${j2.id}`;
            setWedgePlunge(wedgeResult.plunge);
            setWedgeTrend(wedgeResult.trend);
            break;
          }
        }
        if (isWedge) break;
      }
    } else {
      setWedgePlunge(null);
      setWedgeTrend(null);
    }

    setPlanarPossible(isPlanar);
    setTopplingPossible(isToppling);
    setWedgePossible(isWedge);

    const modes: string[] = [];
    if (isPlanar) modes.push(ENGINEERING_LABELS.kinematic.planar);
    if (isToppling) modes.push(ENGINEERING_LABELS.kinematic.toppling);
    if (isWedge) modes.push(ENGINEERING_LABELS.kinematic.wedge);

    const modeCount = modes.length;
    let dominant = ENGINEERING_LABELS.kinematic.none;
    let hazard = ENGINEERING_LABELS.risk.low;
    const conf = kinematicResult.confidenceSummary?.replace('Overall Confidence: ', '') || (joints.length >= 3 ? 'High' : joints.length === 2 ? 'Medium' : 'Low');
    let note = 'Structural control appears limited based on current inputs.';

    if (modeCount === 0) {
      if (joints.length > 0) {
        note = 'Joint set orientation does not currently satisfy planar, wedge, or toppling release criteria.';
      }
    } else if (modeCount === 1) {
      dominant = modes[0];
      if (isWedge) {
        hazard = ENGINEERING_LABELS.risk.high;
        note = `A wedge release is kinematically admissible${cPair ? ` on ${cPair}` : ''}; verify persistence, water, and support demand.`;
      } else if (isPlanar) {
        hazard = ENGINEERING_LABELS.risk.moderate;
        note = `A planar sliding window is present${cSet ? ` on ${cSet}` : ''}; check persistence and surface condition before excavation advances.`;
      } else {
        hazard = ENGINEERING_LABELS.risk.moderate;
        note = 'Flexural toppling kinematics are present; confirm discontinuity persistence and face confinement.';
      }
    } else {
      dominant = ENGINEERING_LABELS.kinematic.multiple;
      hazard = isWedge ? ENGINEERING_LABELS.risk.critical : ENGINEERING_LABELS.risk.high;
      note = 'Multiple kinematic mechanisms are admissible; manage the slope as a structurally controlled excavation face.';
    }

    setDominantMode(dominant);
    setHazardLevel(hazard);
    setControllingSet(cSet);
    setControllingPair(cPair);
    setConfidenceLevel(conf);
    setEngineeringNote(note);

  }, [slopeDip, slopeDipDir, joint1Dip, joint1DipDir, joint2Dip, joint2DipDir, joint3Dip, joint3DipDir, frictionAngle]);

  const handleSave = async () => {
    if (!projectId || !locationId) {
      alert('Please select a project and location.');
      return;
    }

    const structData = {
      id: uuidv4(),
      entry_id: '', // Will be set after entry creation
      slope_dip: slopeDip === '' ? null : Number(slopeDip),
      slope_dip_dir: slopeDipDir === '' ? null : Number(slopeDipDir),
      joint1_dip: joint1Dip === '' ? null : Number(joint1Dip),
      joint1_dip_dir: joint1DipDir === '' ? null : Number(joint1DipDir),
      joint2_dip: joint2Dip === '' ? null : Number(joint2Dip),
      joint2_dip_dir: joint2DipDir === '' ? null : Number(joint2DipDir),
      joint3_dip: joint3Dip === '' ? null : Number(joint3Dip),
      joint3_dip_dir: joint3DipDir === '' ? null : Number(joint3DipDir),
      friction_angle: parseNumericInput(frictionAngle),
      planar_possible: planarPossible ? 1 : 0,
      wedge_possible: wedgePossible ? 1 : 0,
      toppling_possible: topplingPossible ? 1 : 0,
      dominant_failure_mode: dominantMode,
      hazard_level: hazardLevel,
      notes,
      controlling_set: controllingSet,
      controlling_pair: controllingPair,
      confidence_level: confidenceLevel,
      engineering_note: engineeringNote
    };

    const summary = phraseBuilder.buildStructuralParagraph(structData);

    const riskLevelId =
      hazardLevel === ENGINEERING_LABELS.risk.critical ? 'R4' :
      hazardLevel === ENGINEERING_LABELS.risk.high ? 'R3' :
      hazardLevel === ENGINEERING_LABELS.risk.moderate ? 'R2' :
      'R1';

    try {
      const entryId = await entryRepo.create({
        project_id: projectId,
        location_id: locationId,
        entry_type_id: 'ET15', // Structural Assessment
        risk_level_id: riskLevelId,
        status_id: 'ST_OPEN',
        author: 'Field Engineer',
        summary: summary,
        is_handover_item: isHandoverItem
      });

      structData.entry_id = entryId;
      await structuralRepo.saveStructuralAssessment(structData);
      
      // Update engineeringStore with the current structural source-of-truth
      engineeringStore.setState({
        project: projectId,
        location: locationId,
        slopeOrientation: { dip: Number(slopeDip), dipDirection: Number(slopeDipDir) },
        jointSets: [
          { id: 'J1', dip: Number(joint1Dip), dipDirection: Number(joint1DipDir), friction: Number(frictionAngle), cohesion: 0 },
          { id: 'J2', dip: Number(joint2Dip), dipDirection: Number(joint2DipDir), friction: Number(frictionAngle), cohesion: 0 },
          { id: 'J3', dip: Number(joint3Dip), dipDirection: Number(joint3DipDir), friction: Number(frictionAngle), cohesion: 0 },
        ].filter(j => !isNaN(j.dip) && !isNaN(j.dipDirection)),
        friction: Number(frictionAngle),
        cohesion: 0,
        kinematicResult: {
          mechanism: dominantMode as any,
          planarPossible,
          wedgePossible,
          topplingPossible,
          controllingSet,
          controllingPair,
          wedgeTrend,
          wedgePlunge,
          confidenceSummary: confidenceLevel,
        },
        wedgeGeometry: controllingPair ? {
          weight: 0,
          plunge: wedgePlunge ?? 0,
          trend: wedgeTrend ?? 0,
          isAdmissible: wedgePossible,
          controllingPair: controllingPair,
        } : null,
      });
      
      structuralAssessmentStore.clearDraft();
      setSavedEntryId(entryId);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to save Structural Assessment:', error);
      alert('Failed to save Structural Assessment. Check console for details.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <PageHeader title="Structural Assessment" />
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-2xl mx-auto">
          {dataSource && (
            <div className={`mb-4 p-2 rounded text-xs font-bold text-center ${dataSource.includes('No') ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {dataSource}
            </div>
          )}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleClearForm}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 font-medium rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear Form
            </button>
            <button 
              onClick={handleViewStereonet}
              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 font-medium rounded-lg text-sm hover:bg-indigo-100 transition-colors"
            >
              View Stereonet
            </button>
            {wedgePossible && (
              <button 
                onClick={handleViewWedgeFoS}
                className="px-3 py-1.5 bg-violet-50 text-violet-600 font-medium rounded-lg text-sm hover:bg-violet-100 transition-colors"
              >
                Wedge FoS
              </button>
            )}
          </div>

          <div className="space-y-6">
            {/* Context */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Orientations */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800 mb-4 border-b border-zinc-100 pb-2">Orientations (Dip / Dip Dir)</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Slope Dip (°)</label>
                  <input type="text" inputMode="decimal" className="w-full p-2 border border-zinc-200 rounded-lg text-sm" value={slopeDip} onChange={e => setSlopeDip(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Slope Dip Dir (°)</label>
                  <input type="text" inputMode="decimal" className="w-full p-2 border border-zinc-200 rounded-lg text-sm" value={slopeDipDir} onChange={e => setSlopeDipDir(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Joint 1 Dip (°)</label>
                  <input type="text" inputMode="decimal" className="w-full p-2 border border-zinc-200 rounded-lg text-sm" value={joint1Dip} onChange={e => setJoint1Dip(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Joint 1 Dip Dir (°)</label>
                  <input type="text" inputMode="decimal" className="w-full p-2 border border-zinc-200 rounded-lg text-sm" value={joint1DipDir} onChange={e => setJoint1DipDir(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Joint 2 Dip (°)</label>
                  <input type="text" inputMode="decimal" className="w-full p-2 border border-zinc-200 rounded-lg text-sm" value={joint2Dip} onChange={e => setJoint2Dip(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Joint 2 Dip Dir (°)</label>
                  <input type="text" inputMode="decimal" className="w-full p-2 border border-zinc-200 rounded-lg text-sm" value={joint2DipDir} onChange={e => setJoint2DipDir(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Joint 3 Dip (°)</label>
                  <input type="text" inputMode="decimal" className="w-full p-2 border border-zinc-200 rounded-lg text-sm" value={joint3Dip} onChange={e => setJoint3Dip(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Joint 3 Dip Dir (°)</label>
                  <input type="text" inputMode="decimal" className="w-full p-2 border border-zinc-200 rounded-lg text-sm" value={joint3DipDir} onChange={e => setJoint3DipDir(e.target.value)} />
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Friction Angle (°)</label>
                <select 
                  className="w-full p-2 border border-zinc-200 rounded-lg mb-2 text-sm"
                  value={frictionSelection}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFrictionSelection(val);
                    if (val !== -1) setFrictionAngle(String(val));
                  }}
                >
                  <option value="">Select reference value...</option>
                  {JOINT_FRICTION_OPTIONS.map(opt => (
                    <option key={opt.label} value={opt.value}>{opt.label} {opt.value !== -1 ? `(${opt.value}°)` : ''}</option>
                  ))}
                </select>
                {frictionSelection === -1 && (
                  <input type="text" inputMode="decimal" className="w-full p-2 border border-zinc-200 rounded-lg text-sm" value={frictionAngle} onChange={e => setFrictionAngle(e.target.value)} placeholder="Manual override" />
                )}
                <p className="text-[10px] text-zinc-400 mt-1">Typical rock joint friction angles range from 15° to 40°.</p>
              </div>
            </div>

            {/* Live Results */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
              <h3 className="text-sm font-bold text-zinc-800 mb-4 uppercase tracking-wider border-b border-zinc-200 pb-2">Assessment Results</h3>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="text-zinc-500">Planar Possible:</div>
                <div className={`font-bold ${planarPossible ? 'text-orange-600' : 'text-zinc-800'}`}>{planarPossible ? 'YES' : 'NO'}</div>
                
                <div className="text-zinc-500">Wedge Possible:</div>
                <div className={`font-bold ${wedgePossible ? 'text-orange-600' : 'text-zinc-800'}`}>{wedgePossible ? 'YES' : 'NO'}</div>
                
                <div className="text-zinc-500">Toppling Possible:</div>
                <div className={`font-bold ${topplingPossible ? 'text-orange-600' : 'text-zinc-800'}`}>{topplingPossible ? 'YES' : 'NO'}</div>
                
                <div className="text-zinc-500 mt-2">Dominant Mode:</div>
                <div className="font-bold text-zinc-800 mt-2">{dominantMode}</div>
                
                <div className="text-zinc-500">Hazard Level:</div>
                <div className={`font-bold ${hazardLevel === ENGINEERING_LABELS.risk.high ? 'text-red-600' : hazardLevel === ENGINEERING_LABELS.risk.moderate ? 'text-orange-500' : 'text-emerald-600'}`}>
                  {hazardLevel.toUpperCase()}
                </div>

                <div className="text-zinc-500">Confidence Level:</div>
                <div className="font-bold text-zinc-800">{confidenceLevel}</div>

                <div className="text-zinc-500">Controlling Set/Pair:</div>
                <div className="font-bold text-zinc-800">
                  {controllingPair ? controllingPair : controllingSet ? controllingSet : 'None'}
                </div>

                <div className="text-zinc-500 col-span-2 mt-2 border-t border-zinc-200 pt-2">Engineering Interpretation:</div>
                <div className="font-medium text-zinc-700 col-span-2 italic text-sm">{engineeringNote}</div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional observations..."
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm mt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <Flag size={20} />
                </div>
                <div>
                  <div className="font-medium text-slate-800">Handover Item</div>
                  <div className="text-xs text-slate-500">Flag for shift handover</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHandoverItem(isHandoverItem ? 0 : 1)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isHandoverItem ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isHandoverItem ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <button
              onClick={handleSave}
              className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-700 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Assessment
            </button>
          </div>
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
}


