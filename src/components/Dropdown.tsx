import React, { useEffect, useState } from 'react';
import { refRepo, RefItem } from '../repositories/refRepo';

interface DropdownProps {
  label: string;
  tableName: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  tableName,
  value,
  onChange,
  required = false,
  disabled = false,
}) => {
  const [options, setOptions] = useState<RefItem[]>([]);

  useEffect(() => {
    refRepo.getRefList(tableName).then(setOptions);
  }, [tableName]);

  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || options.length === 0}
        className={`w-full rounded-lg border p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-50 ${
          options.length === 0 ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-white'
        }`}
        required={required}
      >
        {options.length === 0 ? (
          <option value="">No options found. Check seed for {tableName}.</option>
        ) : (
          <>
            <option value="">Select {label}...</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} {opt.code ? `(${opt.code})` : ''}
              </option>
            ))}
          </>
        )}
      </select>
      {options.length === 0 && (
        <span className="text-[10px] font-bold text-amber-600 uppercase">
          Table {tableName} is empty
        </span>
      )}
    </div>
  );
};
