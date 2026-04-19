import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { reportRepo, HandoverItem } from '../repositories/reportRepo';
import { actionRepo, Action } from '../repositories/actionRepo';
import { locationJudgementRepo, LocationJudgement } from '../repositories/locationJudgementRepo';
import { handoverRepo, HandoverNotes, HandoverItemOverride } from '../repositories/handoverRepo';
import { formatLocationShort } from '../utils/formatters';
import { getEngineeringSummary, EngineeringSummary } from '../engineering/rockEngineeringBrain';
import { getSoilEngineeringSummary, SoilEngineeringSummary } from '../engineering/soilEngineeringBrain';
import { getActiveProjectId } from '../state/activeProject';
import { 
  ChevronUp, ChevronDown, EyeOff, Circle, Clock, AlertTriangle 
} from 'lucide-react';
import { HandoverHeaderPanel } from '../components/HandoverHeaderPanel';
import { entryDetailRoute, locationOverviewRoute } from '../routes';

export const Handover: React.FC = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<Omit<HandoverNotes, 'id'>>({
    date: '',
    site_coverage: '',
    geotech_assessment: '',
    qa_hold_points: '',
    risk_bullets: ''
  });
  
  const [items, setItems] = useState<HandoverItem[]>([]);
  const [overrides, setOverrides] = useState<HandoverItemOverride[]>([]);
  const [openActions, setOpenActions] = useState<Action[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [newActionText, setNewActionText] = useState('');
  
  const [engineeringSummaries, setEngineeringSummaries] = useState<Record<string, { rock: EngineeringSummary | null, soil: SoilEngineeringSummary | null }>>({});
  const [selectedEngineeringSummaries, setSelectedEngineeringSummaries] = useState<Record<string, { rock: boolean, soil: boolean }>>({});
  const [judgements, setJudgements] = useState<(LocationJudgement & { chainage_start?: number; chainage_end?: number; side?: string; position?: string })[]>([]);

  const toggleEngineeringSummary = (locId: string, type: 'rock' | 'soil') => {
    setSelectedEngineeringSummaries(prev => ({
      ...prev,
      [locId]: {
        ...prev[locId],
        [type]: !prev[locId]?.[type]
      }
    }));
  };
  useEffect(() => {
    try {
      const loadedNotes = handoverRepo.getNotes(date);
      if (loadedNotes) {
        setNotes(loadedNotes);
      } else {
        setNotes({
          date: date,
          site_coverage: '',
          geotech_assessment: '',
          qa_hold_points: '',
          risk_bullets: ''
        });
      }

      const rawItems = reportRepo.getDailyHandover(date, getActiveProjectId() || undefined);
      setItems(rawItems);

      const loadedOverrides = handoverRepo.getOverrides(date);
      setOverrides(loadedOverrides);

      const actions = actionRepo.openActions(date);
      setOpenActions(actions);

      setJudgements(locationJudgementRepo.getForHandover() as any);
    } catch (error) {
      console.error('Failed to load handover data', error);
      setItems([]);
      setOverrides([]);
      setOpenActions([]);
      setJudgements([]);
    }
  }, [date]);

  const locationIds = useMemo(() => Array.from(new Set(items.map(i => i.location_id))), [items]);
  const activeProjectId = getActiveProjectId();

  useEffect(() => {
    const fetchSummaries = async () => {
      const summaries: Record<string, { rock: EngineeringSummary | null, soil: SoilEngineeringSummary | null }> = {};
      if (activeProjectId) {
        for (const locId of locationIds) {
          const rock = await getEngineeringSummary(activeProjectId, locId);
          const soil = await getSoilEngineeringSummary(activeProjectId, locId);
          summaries[locId] = { rock, soil };
        }
      }
      setEngineeringSummaries(summaries);
      setSelectedEngineeringSummaries(prev => {
        const next = { ...prev };
        for (const locId of Object.keys(summaries)) {
          next[locId] = {
            rock: prev[locId]?.rock ?? !!summaries[locId].rock,
            soil: prev[locId]?.soil ?? !!summaries[locId].soil,
          };
        }
        return next;
      });
    };
    if (locationIds.length > 0) fetchSummaries();
  }, [locationIds, activeProjectId]);

  // Merge items with overrides
  const processedItems = useMemo(() => {
    const merged = items.map(item => {
      const ov = overrides.find(o => o.entry_id === item.id);
      return {
        ...item,
        sort_order: ov?.sort_order ?? 999,
        is_hidden: ov?.is_hidden ?? 0,
        manual_bullets: ov?.manual_bullets ?? ''
      };
    });

    const result = merged
      .filter(i => i.is_hidden === 0)
      .sort((a, b) => a.sort_order - b.sort_order);
    
    const ids = result.map(i => i.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      console.error('Duplicate IDs found in processedItems:', ids);
    }
    
    return result;
  }, [items, overrides]);

  const highRiskCount = processedItems.filter(i => i.risk_level === 'High' || i.risk_level === 'Critical').length;
  const visibleLocationCount = new Set(processedItems.map(i => i.location_id)).size;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await handoverRepo.saveNotes(notes);
      await handoverRepo.saveAllOverrides(date, overrides);
      alert('Draft saved successfully.');
    } catch (e) {
      console.error(e);
      alert('Failed to save draft.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleHide = (entryId: string) => {
    setOverrides(prev => {
      const existing = prev.find(o => o.entry_id === entryId);
      if (existing) {
        return prev.map(o => o.entry_id === entryId ? { ...o, is_hidden: o.is_hidden === 1 ? 0 : 1 } : o);
      } else {
        return [...prev, { date, entry_id: entryId, sort_order: 999, is_hidden: 1, manual_bullets: '' }];
      }
    });
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...processedItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Update overrides with new sort orders
    const newOverrides = [...overrides];
    newItems.forEach((item, idx) => {
      const ovIdx = newOverrides.findIndex(o => o.entry_id === item.id);
      if (ovIdx >= 0) {
        newOverrides[ovIdx].sort_order = idx;
      } else {
        newOverrides.push({ date, entry_id: item.id, sort_order: idx, is_hidden: 0, manual_bullets: item.manual_bullets });
      }
    });
    setOverrides(newOverrides);
  };

  const updateManualBullets = (entryId: string, bullets: string) => {
    setOverrides(prev => {
      const existing = prev.find(o => o.entry_id === entryId);
      if (existing) {
        return prev.map(o => o.entry_id === entryId ? { ...o, manual_bullets: bullets } : o);
      } else {
        return [...prev, { date, entry_id: entryId, sort_order: 999, is_hidden: 0, manual_bullets: bullets }];
      }
    });
  };

  const getEntryTypeHandoverLabel = (item: HandoverItem) => {
    switch (item.entry_type_id) {
      case 'ET7': return 'Field observation';
      case 'ET1': return 'Rock mapping';
      case 'ET12': return 'Soil / fill log';
      case 'ET6': return 'Slope check';
      case 'ET15': return 'Structural assessment';
      case 'ET25': return 'Wedge check';
      default: return item.entry_type;
    }
  };

  const getLocationLabel = (locationId: string) => {
    const match = items.find(item => item.location_id === locationId);
    return match ? formatLocationShort(match) : locationId;
  };

  const generateOutputText = () => {
    let text = `DAILY HANDOVER - ${date}\n\n`;
    
    text += `1 Site Coverage\n${notes.site_coverage || 'N/A'}\n\n`;
    
    const generalItems = processedItems.filter(i => !['ET13', 'ET14', 'ET15', 'ET16', 'ET17'].includes(i.entry_type_id));
    const rockEngItems = processedItems.filter(i => ['ET13', 'ET14', 'ET15', 'ET25'].includes(i.entry_type_id));
    const supportItems = processedItems.filter(i => ['ET16', 'ET17'].includes(i.entry_type_id));

    text += `2 Key field observations\n`;
    if (processedItems.length === 0) {
      text += `No key observations recorded.\n`;
    } else {
      if (generalItems.length > 0) {
        generalItems.forEach(item => {
          const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          text += `- [${formatLocationShort(item)}] ${getEntryTypeHandoverLabel(item)} at ${time}. Risk ${item.risk_level}. ${item.summary || ''}\n`;
          if (item.manual_bullets) {
            item.manual_bullets.split('\n').forEach(b => {
              if (b.trim()) text += `  * ${b.trim()}\n`;
            });
          }
        });
      }
      
      if (rockEngItems.length > 0) {
        if (generalItems.length > 0) text += `\n`;
        text += `Rock Engineering Assessments:\n`;
        rockEngItems.forEach(item => {
          const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          text += `- [${formatLocationShort(item)}] ${getEntryTypeHandoverLabel(item)} at ${time}. ${item.summary || ''}\n`;
          if (item.manual_bullets) {
            item.manual_bullets.split('\n').forEach(b => {
              if (b.trim()) text += `  * ${b.trim()}\n`;
            });
          }
        });
      }

      if (supportItems.length > 0) {
        if (generalItems.length > 0 || rockEngItems.length > 0) text += `\n`;
        text += `Ground Support:\n`;
        supportItems.forEach(item => {
          const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          text += `- [${formatLocationShort(item)}] ${getEntryTypeHandoverLabel(item)} at ${time}. ${item.summary || ''}\n`;
          if (item.manual_bullets) {
            item.manual_bullets.split('\n').forEach(b => {
              if (b.trim()) text += `  * ${b.trim()}\n`;
            });
          }
        });
      }
    }
    text += `\n`;

    text += `3 Engineering summaries\n`;
    let hasSummaries = false;
    for (const locId of locationIds) {
      const selection = selectedEngineeringSummaries[locId];
      const summaries = engineeringSummaries[locId];
      if (selection?.rock && summaries?.rock) {
        hasSummaries = true;
        text += `Rock engineering [${getLocationLabel(locId)}]: ${summaries.rock.interpretation}\n`;
        text += `  Support / control: ${summaries.rock.indicativeSupport}\n`;
        text += `  Shift action: ${summaries.rock.fieldAction}\n`;
      }
      if (selection?.soil && summaries?.soil) {
        hasSummaries = true;
        text += `Soil engineering [${getLocationLabel(locId)}]: ${summaries.soil.interpretation}\n`;
        text += `  Primary monitoring: ${summaries.soil.monitoring[0] || 'Routine inspection'}\n`;
      }
    }
    if (!hasSummaries) text += `No engineering summaries included.\n`;
    text += `\n`;

    text += `4 Engineering judgement\n`;
    if (judgements.length === 0) {
      text += `No engineering judgements included.\n`;
    } else {
      judgements.forEach(j => {
        text += `[${formatLocationShort(j as any)}] Status: ${j.status}\n`;
        text += `  Concern: ${j.concern_note}\n`;
        text += `  Next Step: ${j.recommended_step}\n`;
      });
    }
    text += `\n`;

    text += `5 Geotechnical assessment / shift note\n${notes.geotech_assessment || 'N/A'}\n\n`;
    
    text += `6 Risks / constraints\n`;
    const risks = processedItems.filter(i => i.risk_level === 'High' || i.risk_level === 'Critical' || i.status !== 'Closed');
    if (risks.length === 0 && !notes.risk_bullets) {
      text += `No significant risks identified.\n`;
    } else {
      risks.forEach(r => {
        text += `- ${formatLocationShort(r)}: ${r.risk_level} risk, status ${r.status}.\n`;
      });
      if (notes.risk_bullets) {
        notes.risk_bullets.split('\n').forEach(b => {
          if (b.trim()) text += `- ${b.trim()}\n`;
        });
      }
    }
    text += `\n`;

    text += `7 Actions / follow-up\n`;
    if (openActions.length === 0) {
      text += `No open actions.\n`;
    } else {
      openActions.forEach(a => {
        text += `- [${a.priority_id}] ${a.description} (Due: ${a.due_date})\n`;
      });
    }
    text += `\n`;

    text += `8 QA / hold points\n${notes.qa_hold_points || 'N/A'}\n\n`;
    
    text += `9 Photo references\n`;
    const photoEntries = processedItems.filter(i => i.photo_count > 0);
    if (photoEntries.length === 0) {
      text += `No photos recorded.\n`;
    } else {
      photoEntries.forEach(p => {
        text += `- ${formatLocationShort(p)} (${p.entry_type}): ${p.photo_count} photos\n`;
      });
    }

    return text;
  };

  const handleCopy = () => {
    const text = generateOutputText();
    navigator.clipboard.writeText(text);
    alert('Handover copied to clipboard.');
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PageHeader title="Daily Handover" showBack={true} />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-6 pb-20 print:p-0">
        {/* Header / Controls */}
        <HandoverHeaderPanel
          date={date}
          isSaving={isSaving}
          processedCount={processedItems.length}
          locationCount={visibleLocationCount}
          highRiskCount={highRiskCount}
          openActionCount={openActions.length}
          onDateChange={setDate}
          onSave={handleSave}
          onCopy={handleCopy}
          onExport={handleExportPDF}
        />

        {/* Section 1: Site Coverage */}
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">1 Site Coverage</h2>
          <textarea
            value={notes.site_coverage}
            onChange={(e) => setNotes(prev => ({ ...prev, site_coverage: e.target.value }))}
            placeholder="Describe areas covered today..."
            className="h-24 w-full rounded-2xl border border-zinc-200 bg-white p-4 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </section>

        {/* Section 2: Key Observations */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">2 Key field observations</h2>
            <span className="text-[10px] font-bold text-zinc-400">{processedItems.length} Items</span>
          </div>
          <div className="flex flex-col gap-3">
            {processedItems.map((item, index) => {
              const ov = overrides.find(o => o.entry_id === item.id);
              const isRockEng = ['ET13', 'ET14', 'ET15', 'ET25'].includes(item.entry_type_id);
              const isSupport = ['ET16', 'ET17'].includes(item.entry_type_id);

              return (
                <div key={index} className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-400">{formatLocationShort(item)}</span>
                        {(!isRockEng && !isSupport) && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            item.risk_level === 'Critical' ? 'bg-red-100 text-red-600' :
                            item.risk_level === 'High' ? 'bg-orange-100 text-orange-600' :
                            'bg-zinc-100 text-zinc-600'
                          }`}>
                            {item.risk_level}
                          </span>
                        )}
                        {isRockEng && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-600">
                            Rock Engineering
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-zinc-800">{item.entry_type}</span>
                    </div>
                    <div className="flex gap-1 print:hidden">
                      <button onClick={() => moveItem(index, 'up')} className="p-1 text-zinc-400 hover:text-zinc-600"><ChevronUp size={16} /></button>
                      <button onClick={() => moveItem(index, 'down')} className="p-1 text-zinc-400 hover:text-zinc-600"><ChevronDown size={16} /></button>
                      <button onClick={() => toggleHide(item.id)} className="p-1 text-zinc-400 hover:text-zinc-600"><EyeOff size={16} /></button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-600 italic">{item.summary || 'No summary provided.'}</p>
                  <textarea
                    value={ov?.manual_bullets || ''}
                    onChange={(e) => updateManualBullets(item.id, e.target.value)}
                    placeholder="Add manual bullets for this item..."
                    className="mt-2 h-16 w-full rounded-lg border border-zinc-100 bg-zinc-50 p-2 text-[10px] focus:outline-none"
                  />
                </div>
              );
            })}
            {processedItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-400">
                No observations for this date.
              </div>
            )}
          </div>
        </section>

        {/* Section: Engineering summaries */}
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">3 Engineering summaries</h2>
          <div className="flex flex-col gap-2">
            {locationIds.map((locId, index) => {
              const summaries = engineeringSummaries[locId];
              if (!summaries) return null;
              return (
                <div key={`${locId}-${index}`} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <span className="text-xs font-bold text-zinc-800">Location: {locId}</span>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={selectedEngineeringSummaries[locId]?.rock || false} onChange={() => toggleEngineeringSummary(locId, 'rock')} />
                      Include Rock Summary
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={selectedEngineeringSummaries[locId]?.soil || false} onChange={() => toggleEngineeringSummary(locId, 'soil')} />
                      Include Soil Summary
                    </label>
                  </div>
                </div>
              );
            })}
            {locationIds.length === 0 && <div className="text-xs text-zinc-400 italic px-1">No locations with engineering data.</div>}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">4 Engineering judgement</h2>
          <div className="flex flex-col gap-2">
            {judgements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-xs italic text-zinc-400">
                No engineering judgements included.
              </div>
            ) : (
              judgements.map((judgement) => (
                <div key={judgement.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-zinc-800">{formatLocationShort(judgement as any)}</span>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                      {judgement.status}
                    </span>
                  </div>
                  {judgement.concern_note && <p className="mt-2 text-xs text-zinc-700"><span className="font-bold">Concern:</span> {judgement.concern_note}</p>}
                  {judgement.recommended_step && <p className="mt-1 text-xs text-zinc-700"><span className="font-bold">Next step:</span> {judgement.recommended_step}</p>}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Section 3: Geotechnical Assessment */}
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">5 Geotechnical assessment / shift note</h2>
          <textarea
            value={notes.geotech_assessment}
            onChange={(e) => setNotes(prev => ({ ...prev, geotech_assessment: e.target.value }))}
            placeholder="Overall assessment of ground conditions..."
            className="h-32 w-full rounded-2xl border border-zinc-200 bg-white p-4 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </section>

        {/* Section 4: Risks / Constraints */}
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">6 Risks / constraints</h2>
          <div className="flex flex-col gap-2 rounded-2xl bg-orange-50 p-4 border border-orange-100">
            {processedItems.filter(i => i.risk_level === 'High' || i.risk_level === 'Critical' || i.status !== 'Closed').map((r, index) => (
              <div key={index} className="flex items-center gap-2 text-xs text-orange-800">
                <AlertTriangle size={14} className="shrink-0" />
                <span className="font-bold">{formatLocationShort(r)}:</span>
                <span>{r.risk_level} risk. {r.status}</span>
              </div>
            ))}
            <textarea
              value={notes.risk_bullets}
              onChange={(e) => setNotes(prev => ({ ...prev, risk_bullets: e.target.value }))}
              placeholder="Add manual risk bullets..."
              className="mt-2 h-20 w-full rounded-lg border border-orange-200 bg-white p-2 text-xs focus:outline-none"
            />
          </div>
        </section>

        {/* Section 5: Actions / Follow-ups */}
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">7 Actions / follow-up</h2>
          <div className="flex flex-col gap-2">
            {openActions.map((action, index) => (
              <div key={index} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm border border-zinc-100">
                <div className="flex items-center gap-3">
                  <button onClick={() => actionRepo.updateStatus(action.id, true).then(() => setOpenActions(prev => prev.filter(a => a.id !== action.id)))}>
                    <Circle size={20} className="text-zinc-300" />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-800">{action.description}</span>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                      <Clock size={10} />
                      <span>Due: {action.due_date}</span>
                      <span className={`rounded-full px-1.5 py-0.5 font-bold uppercase ${
                        action.priority_id === 'P1' ? 'bg-red-50 text-red-600' : 'bg-zinc-50 text-zinc-500'
                      }`}>
                        {action.priority_id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                placeholder="New action description..."
                className="flex-1 rounded-xl border border-zinc-200 bg-white p-3 text-xs focus:outline-none"
              />
              <button 
                onClick={async () => {
                  if (!newActionText.trim()) return;
                  await actionRepo.create({
                    entry_id: 'handover-manual',
                    priority_id: 'P3',
                    description: newActionText,
                    assigned_to: 'TBA',
                    due_date: new Date().toISOString().split('T')[0],
                    is_closed: 0
                  });
                  setNewActionText('');
                  setOpenActions(actionRepo.openActions(date));
                }}
                className="rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white"
              >
                Add
              </button>
            </div>
          </div>
        </section>

        {/* Section 6: QA / Hold Points */}
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">8 QA / hold points</h2>
          <textarea
            value={notes.qa_hold_points}
            onChange={(e) => setNotes(prev => ({ ...prev, qa_hold_points: e.target.value }))}
            placeholder="Record any hold points or QA results..."
            className="h-24 w-full rounded-2xl border border-zinc-200 bg-white p-4 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </section>

        {/* Section 7: Photo References */}
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">9 Photo references</h2>
          <div className="grid grid-cols-2 gap-2">
            {processedItems.filter(i => i.photo_count > 0).map((p, index) => (
              <div key={index} className="flex flex-col rounded-xl bg-zinc-100 p-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">{formatLocationShort(p)}</span>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-600">{p.entry_type}</span>
                  <span className="text-[10px] font-bold text-emerald-600">{p.photo_count} photos</span>
                </div>
              </div>
            ))}
            {processedItems.filter(i => i.photo_count > 0).length === 0 && (
              <div className="col-span-2 text-xs text-zinc-400 italic px-1">No photos recorded today.</div>
            )}
          </div>
        </section>
      </div>
      </div>

      {/* Printable Area (Hidden in UI) */}
      <div className="hidden print:block print:p-8">
        <div className="mb-6 border-b border-zinc-300 pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900">Daily Handover Report</h1>
          <div className="mt-1 text-sm text-zinc-600">Shift date: {date}</div>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="rounded-lg border border-zinc-300 p-3"><div className="text-[10px] font-bold uppercase text-zinc-500">Key items</div><div className="mt-1 text-lg font-bold text-zinc-900">{processedItems.length}</div></div>
          <div className="rounded-lg border border-zinc-300 p-3"><div className="text-[10px] font-bold uppercase text-zinc-500">Locations</div><div className="mt-1 text-lg font-bold text-zinc-900">{visibleLocationCount}</div></div>
          <div className="rounded-lg border border-zinc-300 p-3"><div className="text-[10px] font-bold uppercase text-zinc-500">High risks</div><div className="mt-1 text-lg font-bold text-zinc-900">{highRiskCount}</div></div>
          <div className="rounded-lg border border-zinc-300 p-3"><div className="text-[10px] font-bold uppercase text-zinc-500">Open actions</div><div className="mt-1 text-lg font-bold text-zinc-900">{openActions.length}</div></div>
        </div>
        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-900">
          {generateOutputText()}
        </pre>
      </div>
    </div>
  );
};






