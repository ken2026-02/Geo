import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

interface PageHeaderProps {
  title: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white border-b border-zinc-200 p-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
      <button onClick={() => navigate(-1)} className="flex items-center text-zinc-600 hover:text-zinc-900 transition-colors">
        <ArrowLeft className="w-5 h-5 mr-1" />
        <span className="text-sm font-bold uppercase tracking-wider">Back</span>
      </button>
      <h1 className="text-sm font-bold uppercase tracking-wider text-zinc-800 truncate px-4 text-center flex-1">{title}</h1>
      <button onClick={() => navigate('/')} className="flex items-center text-zinc-600 hover:text-zinc-900 transition-colors">
        <span className="text-sm font-bold uppercase tracking-wider mr-1">Home</span>
        <Home className="w-5 h-5" />
      </button>
    </div>
  );
}
