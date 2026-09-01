import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PersonaSwitcher } from '../components/common/PersonaSwitcher';
import { IntegrityTestSuiteModal } from '../components/common/IntegrityTestSuiteModal';
import {
  Home,
  CalendarDays,
  BookmarkCheck,
  User,
  Shield,
  Building2,
  ChevronDown,
  LogOut,
} from 'lucide-react';

interface ClientLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export const ClientLayout: React.FC<ClientLayoutProps> = ({ currentPath, onNavigate, children }) => {
  const { profile, activeArena, arenas, setActiveArena, signOut } = useAuth();
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const clientNavItems = [
    { name: 'Início', path: '/app/inicio', icon: <Home className="w-5 h-5" /> },
    { name: 'Reservar', path: '/app/reservar', icon: <CalendarDays className="w-5 h-5" /> },
    { name: 'Minhas Reservas', path: '/app/minhas-reservas', icon: <BookmarkCheck className="w-5 h-5" /> },
    { name: 'Perfil', path: '/app/perfil', icon: <User className="w-5 h-5" /> },
  ];

  const canAccessAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ARENA_ADMIN' || profile?.role === 'ARENA_STAFF';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-20 md:pb-0">
      {/* Top Testing Persona Switcher Bar */}
      <PersonaSwitcher onOpenTestSuite={() => setIsTestModalOpen(true)} />

      {/* Integrity Test Suite Modal */}
      <IntegrityTestSuiteModal isOpen={isTestModalOpen} onClose={() => setIsTestModalOpen(false)} />

      {/* Client Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Brand & Active Arena Selector */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 shadow-md">
              A
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-white">Arena<span className="text-emerald-400">Pro</span></span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                <Building2 className="w-3 h-3 text-emerald-400" />
                <select
                  id="client-arena-select"
                  value={activeArena?.id || ''}
                  onChange={(e) => {
                    const matched = arenas.find(a => a.id === e.target.value);
                    if (matched) setActiveArena(matched);
                  }}
                  className="bg-transparent border-0 text-slate-200 font-semibold focus:ring-0 p-0 cursor-pointer"
                >
                  {arenas.map(a => (
                    <option key={a.id} value={a.id} className="bg-slate-900 text-slate-100">{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Desktop Nav & Admin Backlink */}
          <div className="flex items-center gap-2">
            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
              {clientNavItems.map((item) => {
                const isActive = currentPath === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => onNavigate(item.path)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Admin Switch Link (if permitted) */}
            {canAccessAdmin && (
              <button
                id="client-to-admin-btn"
                onClick={() => onNavigate('/admin/dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl transition cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Painel Admin</span>
              </button>
            )}

            <button
              onClick={signOut}
              title="Sair"
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6">
        {children}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-2 py-1.5 flex items-center justify-around">
        {clientNavItems.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.path}
              id={`client-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => onNavigate(item.path)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition cursor-pointer ${
                isActive
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-lg ${isActive ? 'bg-emerald-500/15' : ''}`}>
                {item.icon}
              </div>
              <span className="text-[10px] font-semibold mt-0.5">{item.name}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
