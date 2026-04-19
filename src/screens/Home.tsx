import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { entryRepo } from '../repositories/entryRepo';
import { reportRepo, HandoverItem } from '../repositories/reportRepo';
import { projectRepo, Project } from '../repositories/projectRepo';
import { getActiveProjectId, setActiveProjectId } from '../state/activeProject';
import { isAutoBackupEnabled, setAutoBackupEnabledPreference } from '../state/userPreferences';
import { PlusCircle, Map as MapIcon, ChevronRight, Clock, ClipboardList, RefreshCw, FileText, AlertOctagon, Calculator, Database, Briefcase, Brain, BookOpen } from 'lucide-react';
import { resetDatabase, getDb } from '../db/db';
import { formatLocationShort } from '../utils/formatters';
import { locationRepo } from '../repositories/locationRepo';
import { getEntryTypeLabel } from '../utils/entryTypes';
import { shouldAutoBackup, saveAutoBackupZip, listAutoBackups } from '../utils/autoBackup';
import { OBSERVATION_TEMPLATES } from '../utils/observationTemplates';
import { exportEntriesCSV, exportActionsCSV, generateProjectSummary, exportPhotoSheet } from '../utils/exportBundle';
import { Zap, Download, Image as ImageIcon, ShieldCheck, History, Trash2, Activity, Loader2, HardDrive, ShieldAlert } from 'lucide-react';
import { TimeoutSafety } from '../components/TimeoutSafety';
import { checkPersisted, requestPersist, estimateStorage } from '../utils/storageSafety';

const resolveEntryDisplayTitle = (entry: any) => {
  if (entry.title) return entry.title;
  
  const typeLabel = getEntryTypeLabel(entry.entry_type_id);
  if (typeLabel && typeLabel !== 'Unknown') return typeLabel;
  
  return 'Field Entry';
};

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [expandedRecent, setExpandedRecent] = useState(false);
  const [handoverPreview, setHandoverPreview] = useState<HandoverItem[]>([]);
  const SHOW_QUICK_OBSERVATIONS = false;
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean>(isAutoBackupEnabled());
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [autoBackupCount, setAutoBackupCount] = useState<number>(0);
  const [storageStatus, setStorageStatus] = useState<'Enabled' | 'Not enabled' | 'Unsupported'>('Unsupported');
  const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });

  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleInstallable = () => setIsInstallable(true);
    window.addEventListener('pwa-installable', handleInstallable);
    
    // Check if prompt was already fired before listener was added
    if ((window as any).deferredPrompt) {
      setIsInstallable(true);
    }

    return () => window.removeEventListener('pwa-installable', handleInstallable);
  }, []);

  const handleExportBackup = async () => {
    const { exportBackupZip } = await import('../utils/backupBundle');
    await exportBackupZip();
  };

  const handleImportBackup = async (file: File) => {
    const { importBackupZip } = await import('../utils/backupBundle');
    await importBackupZip(file);
  };

  const handleInstallClick = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (!promptEvent) return;

    // Show the install prompt
    promptEvent.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await promptEvent.userChoice;
    console.log(`[PWA] User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, throw it away
    (window as any).deferredPrompt = null;
    setIsInstallable(false);
  };

  const handleQuickObservation = async (template: typeof OBSERVATION_TEMPLATES[0]) => {
    console.log("[QO] click template", template.id);
    if (!activeProject) {
      alert('Please select an active project first.');
      return;
    }
    
    const recentLocs = locationRepo.getRecent();
    if (recentLocs.length === 0) {
      alert('Please log at least one location first to use quick observations.');
      return;
    }

    const lastLoc = recentLocs[0];
    
    // Map risk label to ID
    const riskMap: Record<string, string> = {
      'Low': 'R1',
      'Medium': 'R2',
      'High': 'R3',
      'Critical': 'R4'
    };

    console.log("[QO] ensure db ready");
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 5000)
    );

    try {
      console.log("[ENTRY] create start");
      const entryId = await Promise.race([
        entryRepo.create({
          project_id: activeProject.id,
          location_id: lastLoc.id,
          entry_type_id: template.entry_type,
          risk_level_id: riskMap[template.risk] || 'R1',
          status_id: 'ST_OPEN',
          author: 'Field Engineer',
          summary: template.summary,
          is_handover_item: 1
        }),
        timeoutPromise
      ]) as string;

      console.log("[ENTRY] create success", entryId);

      // Trigger auto-backup if enabled (fire-and-forget)
      if (autoBackupEnabled) {
        saveAutoBackupZip().catch(err => console.error('Auto-backup failed:', err));
      }

      console.log("[QO] navigate to entry", entryId);
      navigate(`/entry/${entryId}`);
    } catch (err: any) {
      console.error("[ENTRY] create fail", err);
      if (err.message === 'TIMEOUT') {
        alert("Action timed out. DB may be stuck. Try Reset Local DB.");
      } else {
        alert("Failed to create observation. See console for details.");
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    setTimedOut(false);
    const timeout = setTimeout(() => {
      if (loading) setTimedOut(true);
    }, 5000);

    try {
      const recent = entryRepo.listRecent(10);
      const ids = recent.map(r => r.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        console.error('Duplicate IDs found in recentEntries:', ids);
      }
      setRecentEntries(recent);
      const today = new Date().toISOString().split('T')[0];
      setHandoverPreview(reportRepo.getDailyHandover(today, getActiveProjectId() || undefined).slice(0, 3));

      const p = projectRepo.getActive();
      if (p) {
        setActiveProject(p);
        setActiveProjectId(p.id);
      } else {
        setActiveProject(null);
      }

      // Load backup info
      const backups = await listAutoBackups();
      setAutoBackupCount(backups.length);
      if (backups.length > 0) {
        setLastBackupTime(new Date(backups[0].created_at).toLocaleString());
      }

      // Check storage status
      try {
        const persisted = await checkPersisted();
        if (persisted) {
          setStorageStatus('Enabled');
        } else {
          setStorageStatus('Not enabled');
        }
        const estimate = await estimateStorage();
        setStorageUsage(estimate);
      } catch (err) {
        setStorageStatus('Unsupported');
      }

      // Check for auto-backup on mount
      if (autoBackupEnabled && await shouldAutoBackup()) {
        console.log('Performing scheduled auto-backup...');
        await saveAutoBackupZip();
        const updated = await listAutoBackups();
        setAutoBackupCount(updated.length);
        if (updated.length > 0) {
          setLastBackupTime(new Date(updated[0].created_at).toLocaleString());
        }
      }
    } catch (err) {
      console.error('Error loading home data:', err);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [autoBackupEnabled]);

  useEffect(() => {
    const handleEntriesChanged = () => loadData();
    window.addEventListener('entries-changed', handleEntriesChanged);
    return () => window.removeEventListener('entries-changed', handleEntriesChanged);
  }, []);

  const toggleAutoBackup = () => {
    const newValue = !autoBackupEnabled;
    setAutoBackupEnabled(newValue);
    setAutoBackupEnabledPreference(newValue);
  };

  if (timedOut) {
    return (
      <Layout title="Timeout">
        <div className="p-4">
          <TimeoutSafety onRetry={loadData} />
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout title="GeoField AU">
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="GeoField AU">
      <div className="min-h-screen p-4 flex flex-col gap-5" style={{ background: 'linear-gradient(180deg, #F3F0FF 0%, #F8F6FF 40%, #FFFFFF 100%)' }}>
        {/* Active Project Header */}
        <div className="flex items-center justify-between rounded-[22px] bg-white p-4" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Briefcase size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Active Project</span>
              <span className="text-sm font-bold text-zinc-800">
                {activeProject ? `${activeProject.name} (${activeProject.code})` : 'No Project Selected'}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/projects')}
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-600 hover:bg-zinc-200"
          >
            Change
          </button>
        </div>

        {/* FIELD LOGGING */}
        <div className="rounded-[22px] bg-white p-4 flex flex-col gap-3" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
          <h2 className="flex items-center gap-2 text-[13px] font-[600] uppercase tracking-widest text-zinc-800 px-1 mb-1">
            <PlusCircle size={14} className="text-zinc-400" /> Field Logging
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => navigate('/quick-log')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-quick-log">Quick Log</button>
            <button onClick={() => navigate('/mapping')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-mapping">Mapping</button>
            <button onClick={() => navigate('/investigation-log')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-investigation-log">Investigation</button>
            <button onClick={() => navigate('/slope-assessment')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-slope-assessment">Slope Assessment</button>
            <button onClick={() => navigate('/site-logging')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-site-logging">Site Logging</button>
          </div>
        </div>

        {/* ROCK CLASSIFICATION */}
        <div className="rounded-[22px] bg-white p-4 flex flex-col gap-3" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
          <h2 className="flex items-center gap-2 text-[13px] font-[600] uppercase tracking-widest text-zinc-800 px-1 mb-1">
            <Calculator size={14} className="text-zinc-400" /> Rock Classification
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => navigate('/rock-classification')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-rock-classification">Rock Class (Q)</button>
            <button onClick={() => navigate('/rock-mass-rating')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-rock-mass-rating">Rock Mass Rating</button>
            <button onClick={() => navigate('/gsi-assessment')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-gsi-assessment">GSI</button>
          </div>
        </div>

        {/* ROCK ENGINEERING */}
        <div className="rounded-[22px] bg-white p-4 flex flex-col gap-3" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
          <h2 className="flex items-center gap-2 text-[13px] font-[600] uppercase tracking-widest text-zinc-800 px-1 mb-1">
            <ShieldAlert size={14} className="text-zinc-400" /> Rock Engineering
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => navigate('/structural-assessment')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-structural-assessment">Structural Assessment</button>
            <button onClick={() => navigate('/support-design-calculator')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-support-design-calculator">Support Calculator</button>
            <button onClick={() => navigate('/support-design')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-support-design">Support Design</button>
            <button onClick={() => navigate('/rock-engineering-assistant')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-rock-engineering-assistant">Rock Eng Assistant</button>
            <button onClick={() => navigate('/rock-engineering-brain')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-rock-engineering-brain">Rock Eng Brain</button>
            <button onClick={() => navigate('/wedge-fos')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-wedge-fos-view">Wedge FoS</button>
          </div>
        </div>

        {/* SOIL ENGINEERING */}
        <div className="rounded-[22px] bg-white p-4 flex flex-col gap-3" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
          <h2 className="flex items-center gap-2 text-[13px] font-[600] uppercase tracking-widest text-zinc-800 px-1 mb-1">
            <Activity size={14} className="text-zinc-400" /> Soil Engineering
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => navigate('/bearing-capacity')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-bearing-capacity">Bearing Capacity</button>
            <button onClick={() => navigate('/earth-pressure')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-earth-pressure">Earth Pressure</button>
            <button onClick={() => navigate('/settlement-screening')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-settlement-screening">Settlement</button>
            <button onClick={() => navigate('/retaining-wall-check')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-retaining-wall-check">Retaining Wall</button>
            <button onClick={() => navigate('/soil-slope-stability')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-soil-slope-stability">Soil Slope Stability</button>
            <button onClick={() => navigate('/soil-engineering-dashboard')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-soil-engineering-dashboard">Soil Eng Dashboard</button>
            <button onClick={() => navigate('/soil-engineering-brain')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-soil-engineering-brain">Soil Eng Brain</button>
          </div>
        </div>

        {/* PROJECT REVIEW */}
        <div className="rounded-[22px] bg-white p-4 flex flex-col gap-3" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
          <h2 className="flex items-center gap-2 text-[13px] font-[600] uppercase tracking-widest text-zinc-800 px-1 mb-1">
            <Database size={14} className="text-zinc-400" /> Project Review
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => navigate('/rock-engineering-dashboard')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-rock-engineering-dashboard">Rock Eng Dashboard</button>
            <button onClick={() => navigate('/records')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-records">Records</button>
            <button onClick={() => navigate('/locations')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-locations">Locations</button>
            <button onClick={() => navigate('/projects')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-projects">Projects</button>
            <button onClick={() => navigate('/handover')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-handover">Daily Handover</button>
            <button onClick={() => navigate('/photo-gallery')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-photo-gallery">Photo Gallery</button>
            <button onClick={() => navigate('/engineering-knowledge')} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-colors theme-engineering-knowledge">Eng Knowledge</button>
          </div>
        </div>

        {/* Quick Observations */}
        {SHOW_QUICK_OBSERVATIONS && (
          <div className="theme-quick-observations rounded-[22px] bg-white p-4 flex flex-col gap-3" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
            <h2 className="flex items-center gap-2 text-[13px] font-[600] uppercase tracking-widest text-zinc-800 px-1 mb-1">
              <Zap size={14} className="text-zinc-400" /> Quick Observations
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {OBSERVATION_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleQuickObservation(template)}
                  className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-opacity"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Client Delivery Bundle */}
        {activeProject && (
          <div className="theme-client-delivery rounded-[22px] bg-white p-4 flex flex-col gap-3" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
            <h2 className="flex items-center gap-2 text-[13px] font-[600] uppercase tracking-widest text-zinc-800 px-1 mb-1">
              <Download size={14} className="text-zinc-400" /> Client Delivery Bundle
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => generateProjectSummary(activeProject.id)} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-opacity">Project Summary</button>
              <button onClick={() => exportEntriesCSV(activeProject.id)} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-opacity">Entries CSV</button>
              <button onClick={() => exportActionsCSV(activeProject.id)} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-opacity">Actions CSV</button>
              <button onClick={() => exportPhotoSheet(activeProject.id)} className="rounded-[14px] bg-[var(--module-accent-bg)] py-2 px-1 text-center text-xs font-semibold text-[var(--module-accent)] hover:opacity-80 transition-opacity">Photo Sheet</button>
            </div>
          </div>
        )}

        {/* Handover Preview */}
        {handoverPreview.length > 0 && (
          <div className="theme-handover rounded-[22px] bg-white p-4 flex flex-col gap-3" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between px-1 mb-1">
              <h2 className="flex items-center gap-2 text-[13px] font-[600] uppercase tracking-widest text-zinc-800">
                <ClipboardList size={14} className="text-[var(--module-accent)]" /> Today's Handover
              </h2>
              <button onClick={() => navigate('/handover')} className="text-[10px] font-[600] text-[var(--module-accent)] uppercase hover:underline">View Full Report</button>
            </div>
            <div className="flex flex-col gap-2 rounded-xl bg-[var(--module-accent-bg)] p-2 border border-[var(--module-accent)]/10">
              {handoverPreview.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/entry/${item.id}`)}
                  className="flex items-center justify-between rounded-[14px] bg-white p-3 text-left shadow-sm border border-[var(--module-accent)]/10 hover:bg-white/50 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[var(--module-accent)]/80 uppercase">{formatLocationShort(item)}</span>
                    <span className="text-xs font-bold text-zinc-800">{resolveEntryDisplayTitle(item)}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    item.risk_level === 'Critical' ? 'bg-red-100 text-red-600' :
                    item.risk_level === 'High' ? 'bg-orange-100 text-orange-600' :
                    'bg-[var(--module-accent-bg)] text-[var(--module-accent)]'
                  }`}>
                    {item.risk_level}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="theme-records rounded-[22px] bg-white p-4 flex flex-col gap-3" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between px-1 mb-1">
            <h2 className="flex items-center gap-2 text-[13px] font-[600] uppercase tracking-widest text-zinc-800">
              <Clock size={14} className="text-[var(--module-accent)]" /> Recent Activity
            </h2>
            {recentEntries.length > 3 && (
              <button onClick={() => setExpandedRecent(!expandedRecent)} className="text-[10px] font-[600] text-[var(--module-accent)] uppercase hover:underline">
                {expandedRecent ? 'Collapse ^' : 'View All >'}
              </button>
            )}
            {recentEntries.length <= 3 && (
              <button onClick={() => navigate('/records')} className="text-[10px] font-[600] text-[var(--module-accent)] uppercase hover:underline">View All</button>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            {recentEntries.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[var(--module-accent)]/20 p-8 text-center text-[var(--module-accent)]/60">
                No recent entries found.
              </div>
            ) : (
              (expandedRecent ? recentEntries : recentEntries.slice(0, 3)).map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => navigate(`/entry/${entry.id}`)}
                  className="flex items-center justify-between rounded-[14px] border border-[var(--module-accent)]/10 bg-white p-4 text-left shadow-sm transition-colors hover:bg-[var(--module-accent-bg)]/30"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--module-accent)]/80">{formatLocationShort(entry)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        entry.risk_label === 'Critical' ? 'bg-red-100 text-red-600' :
                        entry.risk_label === 'High' ? 'bg-orange-100 text-orange-600' :
                        entry.risk_label === 'Medium' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-[var(--module-accent-bg)] text-[var(--module-accent)]'
                      }`}>
                        {entry.risk_label}
                      </span>
                    </div>
                    <span className="font-bold text-zinc-800">
                      {resolveEntryDisplayTitle(entry)}
                    </span>
                    <span className="text-[10px] text-[var(--module-accent)]/60">{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  <ChevronRight size={20} className="text-[var(--module-accent)]/40" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Data Safety & Tools */}
        <div className="rounded-[22px] bg-white p-4 flex flex-col gap-4 mt-2" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[13px] font-[600] uppercase tracking-widest text-zinc-800">Data Safety & Tools</h2>
            {lastBackupTime && (
              <span className="text-[10px] text-zinc-400">Last: {lastBackupTime}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {isInstallable && (
              <button
                onClick={handleInstallClick}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition-transform active:scale-95"
              >
                <Download size={18} />
                Install GeoField App
              </button>
            )}
            <button
              onClick={() => handleExportBackup()}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
            >
              <Download size={14} />
              Export Backup
            </button>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-100">
              <RefreshCw size={14} />
              Restore
              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImportBackup(file).catch(err => { console.error('Restore failed:', err); alert('Failed to restore backup.'); });
                  }
                }}
              />
            </label>
          </div>

          {/* Storage Status */}
          <div className="flex flex-col gap-2 rounded-xl bg-white/80 p-3 border border-black/5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 shadow-sm border border-black/5">
                  <HardDrive size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-800">Persistent Storage</span>
                  <span className={`text-[10px] font-bold ${storageStatus === 'Enabled' ? 'text-emerald-600' : storageStatus === 'Not enabled' ? 'text-orange-500' : 'text-zinc-400'}`}>
                    {storageStatus}
                  </span>
                </div>
              </div>
              {storageStatus === 'Not enabled' && (
                <button
                  onClick={async () => {
                    const granted = await requestPersist();
                    if (granted) setStorageStatus('Enabled');
                    else alert('Storage persistence request denied by browser.');
                  }}
                  className="rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold text-zinc-800 shadow-sm border border-zinc-200"
                >
                  Enable
                </button>
              )}
            </div>
            {storageUsage.quota > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Usage: {(storageUsage.usage / 1024 / 1024).toFixed(2)} MB</span>
                  <span>Quota: {(storageUsage.quota / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                  <div 
                    className={`h-full ${storageUsage.usage / storageUsage.quota > 0.85 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                    style={{ width: `${Math.min(100, (storageUsage.usage / storageUsage.quota) * 100)}%` }}
                  />
                </div>
                {storageUsage.usage / storageUsage.quota > 0.85 && (
                  <span className="text-[10px] font-bold text-red-500 mt-1">Warning: Storage is almost full.</span>
                )}
              </div>
            )}
          </div>

          {/* Auto-backup Toggle */}
          <div className="flex items-center justify-between rounded-xl bg-white/80 p-3 border border-black/5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 shadow-sm border border-black/5">
                <ShieldCheck size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-800">Auto-Backup</span>
                <span className="text-[10px] text-zinc-400">{autoBackupCount} backups stored locally</span>
              </div>
            </div>
            <button
              onClick={toggleAutoBackup}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoBackupEnabled ? 'bg-emerald-500' : 'bg-zinc-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoBackupEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to reset the local database and media? All data will be lost.')) {
                  await resetDatabase();
                }
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-100"
            >
              <Trash2 size={14} />
              Reset Local DB
            </button>
            <button
              onClick={async () => {
                if (confirm('Clear all recent locations?')) {
                  await locationRepo.clearRecent();
                  window.location.reload();
                }
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white/80 py-3 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <History size={14} />
              Clear Recent
            </button>
            <button
              onClick={() => navigate('/diagnostics')}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white/80 py-3 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <Activity size={14} className="text-emerald-600" />
              Diagnostics
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};


