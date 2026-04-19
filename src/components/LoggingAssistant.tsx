import React from 'react';
import { LoggingStyle, QUALIFIERS } from '../utils/loggingStyle';
import { RotateCcw, Type as TypeIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface LoggingAssistantProps {
  style: LoggingStyle;
  qualifiers: string[];
  generatedText: string;
  onStyleChange: (style: LoggingStyle) => void;
  onQualifiersChange: (qualifiers: string[]) => void;
  onTextEdit: (text: string) => void;
  onReset: () => void;
}

export const LoggingAssistant: React.FC<LoggingAssistantProps> = ({
  style,
  qualifiers,
  generatedText,
  onStyleChange,
  onQualifiersChange,
  onTextEdit,
  onReset
}) => {
  const toggleQualifier = (q: string) => {
    if (qualifiers.includes(q)) {
      onQualifiersChange(qualifiers.filter(item => item !== q));
    } else {
      onQualifiersChange([...qualifiers, q]);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-zinc-50 p-4 border border-zinc-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TypeIcon className="h-5 w-5 text-zinc-500" />
          <h3 className="font-semibold text-zinc-900 italic serif">Logging Assistant</h3>
        </div>
        
        <div className="flex bg-zinc-200 p-1 rounded-lg">
          <button
            onClick={() => onStyleChange('SHORT')}
            className={clsx(
              "px-3 py-1 text-xs font-medium rounded-md transition-all",
              style === 'SHORT' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            SHORT
          </button>
          <button
            onClick={() => onStyleChange('FULL')}
            className={clsx(
              "px-3 py-1 text-xs font-medium rounded-md transition-all",
              style === 'FULL' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            FULL
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(QUALIFIERS).map(([category, options]) => (
            <div key={category} className="flex flex-wrap gap-1">
              {options.map(q => (
                <button
                  key={q}
                  onClick={() => toggleQualifier(q)}
                  className={clsx(
                    "px-2 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-full border transition-all",
                    qualifiers.includes(q)
                      ? "bg-zinc-900 border-zinc-900 text-white"
                      : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400"
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="relative">
          <textarea
            value={generatedText}
            onChange={(e) => onTextEdit(e.target.value)}
            rows={4}
            className="w-full rounded-xl border-zinc-200 bg-white p-3 text-sm text-zinc-800 shadow-inner focus:border-zinc-900 focus:ring-zinc-900 font-mono leading-relaxed"
            placeholder="Generated logging paragraph..."
          />
          <button
            onClick={onReset}
            className="absolute bottom-3 right-3 p-2 rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
            title="Reset to Generated"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
