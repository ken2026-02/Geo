import React, { useEffect, useState } from 'react';
import { locationRepo, Location } from '../repositories/locationRepo';
import { Plus, X, History, Star, Search } from 'lucide-react';
import { formatLocationShort } from '../utils/formatters';

interface LocationSelectorProps {
  value: string;
  onChange: (id: string, isNew: boolean, data?: any, isValid?: boolean) => void;
}

const VALID_SIDES = new Set(['LHS', 'RHS', 'CL']);
const VALID_POSITIONS = new Set(['Toe', 'Mid', 'Crest', 'Face', 'Bench']);

export const LocationSelector: React.FC<LocationSelectorProps> = ({ value, onChange }) => {
  const [pinned, setPinned] = useState<Location[]>([]);
  const [recent, setRecent] = useState<Location[]>([]);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newData, setNewData] = useState({
    chainage_start: '',
    chainage_end: '',
    side: 'CL',
    position: 'Mid',
    description: '',
  });

  const refreshLists = () => {
    setPinned(locationRepo.listPinned());
    setRecent(locationRepo.getRecent(20));
  };

  useEffect(() => {
    refreshLists();
  }, []);

  useEffect(() => {
    if (searchTerm.trim()) {
      setSearchResults(locationRepo.search(searchTerm));
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const buildLocationDraft = (data: typeof newData) => ({
    ...data,
    chainage_end: data.chainage_end || data.chainage_start,
    side: VALID_SIDES.has(data.side) ? data.side : 'CL',
    position: VALID_POSITIONS.has(data.position) ? data.position : 'Mid',
  });

  const validate = (data: any) => {
    const start = parseFloat(data.chainage_start);
    const end = parseFloat(data.chainage_end);
    if (isNaN(start) || isNaN(end)) return false;
    if (end < start) return false;
    if (!VALID_SIDES.has(data.side)) return false;
    if (!VALID_POSITIONS.has(data.position)) return false;
    return true;
  };

  const handleCreateToggle = () => {
    const nextCreating = !isCreating;
    setIsCreating(nextCreating);
    if (nextCreating) {
      const dataToPass = buildLocationDraft(newData);
      onChange('', true, dataToPass, validate(dataToPass));
    } else {
      onChange(value, false, undefined, !!value);
    }
  };

  const handleNewDataChange = (field: string, val: any) => {
    const updated = { ...newData, [field]: val };
    setNewData(updated);
    const dataToPass = buildLocationDraft(updated);
    onChange('', true, dataToPass, validate(dataToPass));
  };

  const applyPreset = (type: 'point' | 10 | 20 | 50) => {
    const start = parseFloat(newData.chainage_start);
    if (isNaN(start)) return;

    let end = start;
    if (type !== 'point') {
      end = start + type;
    }

    handleNewDataChange('chainage_end', end.toString());
  };

  const handleTogglePin = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await locationRepo.togglePin(id);
    refreshLists();
  };

  const handleSelect = (id: string) => {
    onChange(id, false, undefined, true);
    setSearchTerm('');
  };

  const clusterKey = isCreating
    ? `${newData.chainage_start || '?'}-${newData.chainage_end || newData.chainage_start || '?'}-${newData.side || 'CL'}-${newData.position || 'Mid'}`
    : '';

  const isInvalid = isCreating && newData.chainage_start && newData.chainage_end && parseFloat(newData.chainage_end) < parseFloat(newData.chainage_start);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Location</label>
        <button
          type="button"
          onClick={handleCreateToggle}
          className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
        >
          {isCreating ? <><X size={14} /> Cancel</> : <><Plus size={14} /> New Location</>}
        </button>
      </div>

      {!isCreating ? (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Search chainage, side, position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {searchTerm && (
            <div className="flex flex-col gap-1">
              <div className="text-[10px] font-bold text-zinc-400 uppercase px-1">Search Results</div>
              {searchResults.length === 0 ? (
                <div className="text-xs text-zinc-400 px-1 italic">No matches found</div>
              ) : (
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {searchResults.map(loc => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => handleSelect(loc.id)}
                      className={`flex items-center justify-between rounded-lg border p-2 text-left transition-colors ${
                        value === loc.id ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-100 bg-white hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-800">{formatLocationShort(loc)}</span>
                        {loc.description && <span className="text-[10px] text-zinc-500">{loc.description}</span>}
                      </div>
                      <Star
                        size={14}
                        className={loc.is_pinned ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}
                        onClick={(e) => handleTogglePin(e, loc.id)}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {pinned.length > 0 && !searchTerm && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500 uppercase px-1">
                <Star size={10} className="fill-amber-500" /> Pinned
              </div>
              <div className="flex flex-wrap gap-2">
                {pinned.map(loc => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelect(loc.id)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      value === loc.id ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <span>{formatLocationShort(loc)}</span>
                    <Star
                      size={12}
                      className="fill-amber-400 text-amber-400"
                      onClick={(e) => handleTogglePin(e, loc.id)}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {recent.length > 0 && !searchTerm && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase px-1">
                <History size={10} /> Recent
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map(loc => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelect(loc.id)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      value === loc.id ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <span>{formatLocationShort(loc)}</span>
                    <Star
                      size={12}
                      className={loc.is_pinned ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}
                      onClick={(e) => handleTogglePin(e, loc.id)}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {!searchTerm && pinned.length === 0 && recent.length === 0 && (
            <div className="flex flex-col gap-1">
              <div className="text-[10px] font-bold text-zinc-400 uppercase px-1">All Locations</div>
              <select
                value={value}
                onChange={(e) => handleSelect(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Select Existing Location...</option>
                {locationRepo.getAll().map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {formatLocationShort(loc)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">CH Start *</label>
            <input
              type="number"
              value={newData.chainage_start}
              onChange={(e) => handleNewDataChange('chainage_start', e.target.value)}
              className="rounded-lg border border-zinc-200 p-2 text-sm"
              placeholder="e.g. 10200"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">CH End *</label>
            <input
              type="number"
              value={newData.chainage_end}
              onChange={(e) => handleNewDataChange('chainage_end', e.target.value)}
              className={`rounded-lg border p-2 text-sm ${isInvalid ? 'border-red-500' : 'border-zinc-200'}`}
              placeholder="e.g. 10250"
            />
          </div>

          <div className="col-span-2 flex gap-2">
            <button type="button" onClick={() => applyPreset('point')} className="rounded bg-zinc-200 px-2 py-1 text-[10px] font-bold uppercase text-zinc-600 hover:bg-zinc-300">Point</button>
            <button type="button" onClick={() => applyPreset(10)} className="rounded bg-zinc-200 px-2 py-1 text-[10px] font-bold uppercase text-zinc-600 hover:bg-zinc-300">+10m</button>
            <button type="button" onClick={() => applyPreset(20)} className="rounded bg-zinc-200 px-2 py-1 text-[10px] font-bold uppercase text-zinc-600 hover:bg-zinc-300">+20m</button>
            <button type="button" onClick={() => applyPreset(50)} className="rounded bg-zinc-200 px-2 py-1 text-[10px] font-bold uppercase text-zinc-600 hover:bg-zinc-300">+50m</button>
          </div>

          {isInvalid && (
            <div className="col-span-2 text-[10px] font-bold text-red-500">
              End chainage must be greater than or equal to start.
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Side *</label>
            <select
              value={newData.side}
              onChange={(e) => handleNewDataChange('side', e.target.value)}
              className="rounded-lg border border-zinc-200 p-2 text-sm"
            >
              <option value="">Select Side...</option>
              <option value="LHS">LHS</option>
              <option value="RHS">RHS</option>
              <option value="CL">CL</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Position *</label>
            <select
              value={newData.position}
              onChange={(e) => handleNewDataChange('position', e.target.value)}
              className="rounded-lg border border-zinc-200 p-2 text-sm"
            >
              <option value="">Select Position...</option>
              <option value="Toe">Toe</option>
              <option value="Mid">Mid</option>
              <option value="Crest">Crest</option>
              <option value="Face">Face</option>
              <option value="Bench">Bench</option>
            </select>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Cluster Key (Preview)</label>
            <input
              type="text"
              value={clusterKey}
              readOnly
              className="rounded-lg border border-zinc-100 bg-zinc-100 p-2 text-xs text-zinc-500"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Description</label>
            <input
              type="text"
              value={newData.description}
              onChange={(e) => handleNewDataChange('description', e.target.value)}
              className="rounded-lg border border-zinc-200 p-2 text-sm"
              placeholder="e.g. Batter 4 North"
            />
          </div>
        </div>
      )}
    </div>
  );
};
