import React from 'react';
import { projectRepo, Project } from '../repositories/projectRepo';

interface ProjectSelectorProps {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ value, onChange, label = "Project" }) => {
  const projects = projectRepo.getAll();

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm focus:border-emerald-500 focus:outline-none"
      >
        <option value="">Select Project...</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.code})
          </option>
        ))}
      </select>
    </div>
  );
};
