import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react';
import { resetDatabase } from '../db/db';

interface TimeoutSafetyProps {
  onRetry?: () => void;
}

export const TimeoutSafety: React.FC<TimeoutSafetyProps> = ({ onRetry }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8 text-center bg-white rounded-3xl border border-red-100 shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle size={32} />
      </div>
      
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-zinc-900">Loading Timeout</h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Data loading timed out. The local database may be stuck or initialization is taking too long.
        </p>
      </div>

      <div className="flex flex-col w-full gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-900 py-3.5 font-bold text-white shadow-lg"
          >
            <RotateCcw size={18} />
            Try Again
          </button>
        )}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-200 bg-white py-3.5 font-bold text-zinc-600"
        >
          <ArrowLeft size={18} />
          Go Back
        </button>
        <button
          onClick={() => {
            if (confirm('This will clear all local data. Continue?')) {
              resetDatabase();
            }
          }}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-red-50 py-3.5 font-bold text-red-600"
        >
          <AlertTriangle size={18} />
          Reset Local DB
        </button>
      </div>
    </div>
  );
};
