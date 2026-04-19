import React from 'react';

interface ReviewSurfaceHeaderProps {
  badge: string;
  title: string;
  subtitle: string;
}

export const ReviewSurfaceHeader: React.FC<ReviewSurfaceHeaderProps> = ({ badge, title, subtitle }) => {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{badge}</div>
          <div className="text-base font-bold text-zinc-900">{title}</div>
        </div>
        <div className="text-xs text-zinc-500">{subtitle}</div>
      </div>
    </div>
  );
};
