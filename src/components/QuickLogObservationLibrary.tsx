import React from 'react';

interface ObservationCategoryItem {
  label: string;
}

interface ObservationCategory {
  label: string;
  items: ObservationCategoryItem[];
}

interface CustomObservation {
  label: string;
}

interface QuickLogObservationLibraryProps {
  activeTab: 'Rock' | 'Soil';
  onTabChange: (tab: 'Rock' | 'Soil') => void;
  categories: ObservationCategory[];
  selectedObservations: string[];
  customObservations: CustomObservation[];
  onToggleObservation: (label: string) => void;
  onAddCustomObservation: () => void;
  onRemoveCustomObservation: (label: string) => void;
}

export const QuickLogObservationLibrary: React.FC<QuickLogObservationLibraryProps> = ({
  activeTab,
  onTabChange,
  categories,
  selectedObservations,
  customObservations,
  onToggleObservation,
  onAddCustomObservation,
  onRemoveCustomObservation,
}) => {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Observation Library</h2>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onTabChange('Rock')}
          className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'Rock' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}
        >
          Rock
        </button>
        <button
          type="button"
          onClick={() => onTabChange('Soil')}
          className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'Soil' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}
        >
          Soil
        </button>
      </div>

      {categories.map(category => (
        <div key={category.label} className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-zinc-400 uppercase">{category.label}</h3>
          <div className="flex flex-wrap gap-2">
            {category.items.map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => onToggleObservation(item.label)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  selectedObservations.includes(item.label)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-bold text-zinc-400 uppercase">My Observation Library</h3>
        <div className="flex flex-wrap gap-2">
          {customObservations.map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onToggleObservation(item.label)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  selectedObservations.includes(item.label)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {item.label}
              </button>
              <button type="button" onClick={() => onRemoveCustomObservation(item.label)} className="text-zinc-400 hover:text-red-500">
                x
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onAddCustomObservation}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          >
            Add Custom
          </button>
        </div>
      </div>
    </div>
  );
};
