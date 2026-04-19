import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';
import { StorageBanner } from './StorageBanner';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack = false }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-50 pb-10 font-sans text-zinc-900">
      <StorageBanner />
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center">
          {showBack && (
            <button onClick={() => navigate(-1)} className="flex items-center text-zinc-600 hover:text-zinc-900 transition-colors">
              <ChevronLeft size={20} className="mr-1" />
              <span className="text-sm font-bold uppercase tracking-wider">Back</span>
            </button>
          )}
        </div>
        <h1 className="text-sm font-bold uppercase tracking-wider text-zinc-800 truncate px-4 text-center flex-1">{title}</h1>
        <div className="flex items-center">
          <button onClick={() => navigate('/')} className="flex items-center text-zinc-600 hover:text-zinc-900 transition-colors">
            <span className="text-sm font-bold uppercase tracking-wider mr-1">Home</span>
            <Home size={20} />
          </button>
        </div>
      </header>
      <main className="px-4 pt-4">{children}</main>
    </div>
  );
};
