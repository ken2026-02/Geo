import React, { useState, useEffect } from 'react';
import { refRepo, RefItem } from '../repositories/refRepo';
import { Check, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

interface MultiSelectProps {
  label: string;
  tableName: string;
  value: string[];
  onChange: (value: string[]) => void;
  required?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ label, tableName, value, onChange, required }) => {
  const [options, setOptions] = useState<RefItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    refRepo.getRefList(tableName).then(setOptions);
  }, [tableName]);

  const toggleOption = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const selectedLabels = options
    .filter(o => value.includes(o.id))
    .map(o => o.label)
    .join(', ');

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
        {label} {required && '*'}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 text-left text-sm focus:border-emerald-500 focus:outline-none"
        >
          <span className={clsx("truncate", !value.length && "text-zinc-400")}>
            {selectedLabels || `Select ${label}...`}
          </span>
          <ChevronDown size={16} className={clsx("text-zinc-400 transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
            {options.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleOption(option.id)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-50"
              >
                <span>{option.label}</span>
                {value.includes(option.id) && <Check size={16} className="text-emerald-600" />}
              </button>
            ))}
          </div>
        )}
      </div>
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
