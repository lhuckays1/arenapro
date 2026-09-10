import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PersonaSwitcher } from '../components/common/PersonaSwitcher';
import {
  LayoutDashboard,
  Calendar,
  BookmarkCheck,
  Layers,
  Volleyball,
  Users,
  Briefcase,
  DollarSign,
  Settings,
  UserCheck,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Building2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface AdminLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentPath,
  onNavigate,
  children,
}) => {
  const {
    user,
    profile,
    activeArena,
    arenas,
    setActiveArena,
    signOut,
  } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [arenaDropdownOpen, setArenaDropdownOpen] =
    useState(false);

  const operationalMenuItems = [
    {
      name: 'Dashboard',
      path: '/admin/dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      name: 'Agenda',
      path: '/admin/agenda',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      name: 'Reservas',
      path: '/admin/reservas',
      icon: <BookmarkCheck className="w-4 h-4" />,
    },
    {
      name: 'Quadras',
      path: '/admin/quadras',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      name: 'Modalidades',
      path: '/admin/modalidades',
      icon: <Volleyball className="w-4 h-4" />,
    },
    {
      name: 'Clientes',
      path: '/admin/clientes',
      icon: <Users className="w-4 h-4" />,
    },
    {
      name: 'Serviços',
      path: '/admin/servicos',
      icon: <Briefcase className="w-4 h-4" />,
    },
    {
      name: 'Financeiro',
      path: '/admin/financeiro',
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      name: 'Configurações',
      path: '/admin/configuracoes',
      icon: <Settings className="w-4 h-4" />,
    },
    {
      name: 'Usuários da Arena',
      path: '/admin/usuarios',
      icon: <UserCheck className="w-4 h-4" />,
    },
  ];

  const menuItems =
    profile?.role === 'SUPER_ADMIN'
      ? [
          {
            name: 'Gestão SaaS',
            path: '/admin/saas',
            icon: (
              <ShieldCheck className="w-4 h-4" />
            ),
          },
          ...operationalMenuItems,
        ]
      : operationalMenuItems;

  const handleNavClick = (
    path: string,
  ) => {
    onNavigate(path);
    setMobileMenuOpen(false);
  };

  const getRoleLabel = (
    role?: string,
  ) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Super Admin';

      case 'ARENA_ADMIN':
        return 'Administrador';

      case 'ARENA_STAFF':
        return 'Funcionário';

      case 'CLIENT':
        return 'Cliente';

      default:
        return 'Usuário';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">

      {/* Top Testing Persona Switcher Bar */}
      <PersonaSwitcher />

      <div className="flex-1 flex overflow-hidden">

        {/* =====================================================
            DESKTOP SIDEBAR
        ===================================================== */}

        <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-slate-900/95 border-r border-slate-800 shrink-0">

          {/* Brand Header */}

          <div className="p-4 border-b border-slate-800">

            <div className="flex items-center gap-3">

              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-slate-950 text-lg shadow-lg shadow-emerald-500/20">
                A
              </div>

              <div>

                <div className="flex items-center gap-1.5">

                  <span className="font-extrabold text-base tracking-tight text-white">
                    Arena
                    <span className="text-emerald-400">
                      Pro
                    </span>
                  </span>

                  <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    SaaS
                  </span>

                </div>

                <p className="text-[11px] text-slate-400 font-medium">
                  Gestão Multi-Arena
                </p>

              </div>

            </div>

            {/* Tenant Selector */}

            <div className="mt-4 relative">

              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Arena Ativa
              </label>

              <button
                id="arena-selector-btn"
                onClick={() =>
                  setArenaDropdownOpen(
                    !arenaDropdownOpen,
                  )
                }
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 rounded-xl text-left transition cursor-pointer group"
              >

                <div className="flex items-center gap-2 overflow-hidden">

                  <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />

                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {activeArena?.name ||
                      'Selecione uma arena'}
                  </span>

                </div>

                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 shrink-0" />

              </button>

              {/* Arena Dropdown */}

              {arenaDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-30 p-1.5 space-y-1 animate-fadeIn">

                  <div className="text-[10px] font-semibold text-slate-400 px-2 py-1">
                    Alternar Arena (Multi-Tenant)
                  </div>

                  {arenas.map(
                    (arena) => (
                      <button
                        key={arena.id}
                        onClick={() => {
                          setActiveArena(
                            arena,
                          );
                          setArenaDropdownOpen(
                            false,
                          );
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition flex items-center justify-between cursor-pointer ${
                          activeArena?.id ===
                          arena.id
                            ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >

                        <span className="truncate">
                          {arena.name}
                        </span>

                        {activeArena?.id ===
                          arena.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}

                      </button>
                    ),
                  )}

                </div>
              )}

            </div>

          </div>

          {/* Navigation Links */}

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">

            <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Menu Principal
            </div>

            {menuItems.map(
              (item) => {
                const isActive =
                  currentPath ===
                  item.path;

                return (
                  <button
                    key={item.path}
                    id={`admin-nav-${item.name
                      .toLowerCase()
                      .replace(
                        /\s+/g,
                        '-',
                      )}`}
                    onClick={() =>
                      handleNavClick(
                        item.path,
                      )
                    }
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >

                    <span
                      className={
                        isActive
                          ? 'text-emerald-400'
                          : 'text-slate-500'
                      }
                    >
                      {item.icon}
                    </span>

                    <span>
                      {item.name}
                    </span>

                  </button>
                );
              },
            )}

          </nav>

          {/* =================================================
              PROFILE & LOGOUT
              
              Auditoria e SQL/RLS removidos.
          ================================================= */}

          <div className="p-3 border-t border-slate-800">

            <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-between">

              <div className="flex items-center gap-2.5 min-w-0">

                <img
                  src={
                    profile?.avatar_url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80'
                  }
                  alt={
                    profile?.full_name ||
                    'Usuário'
                  }
                  className="w-8 h-8 rounded-full object-cover border border-slate-700"
                />

                <div className="min-w-0">

                  <p className="text-xs font-bold text-slate-200 truncate">
                    {profile?.full_name ||
                      'Usuário'}
                  </p>

                  <p className="text-[10px] text-emerald-400 font-medium">
                    {getRoleLabel(
                      profile?.role,
                    )}
                  </p>

                </div>

              </div>

              <button
                id="admin-logout-btn"
                onClick={signOut}
                title="Sair"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >

                <LogOut className="w-4 h-4" />

              </button>

            </div>

          </div>

        </aside>

        {/* =====================================================
            MAIN CONTENT AREA
        ===================================================== */}

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

          {/* Top Header */}

          <header className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">

            <div className="flex items-center gap-3">

              {/* Mobile Drawer Trigger */}

              <button
                id="mobile-menu-toggle-btn"
                onClick={() =>
                  setMobileMenuOpen(
                    !mobileMenuOpen,
                  )
                }
                className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >

                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}

              </button>

              <div>

                <div className="flex items-center gap-2">

                  <h1 className="text-base font-bold text-white tracking-tight">
                    {menuItems.find(
                      (m) =>
                        m.path ===
                        currentPath,
                    )?.name ||
                      'ArenaPro Gestão'}
                  </h1>

                  <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {activeArena?.name}
                  </span>

                </div>

                <p className="text-xs text-slate-400 hidden sm:block">
                  Painel administrativo e operacional
                </p>

              </div>

            </div>

            {/* Quick Actions */}

            <div className="flex items-center gap-2">

              <button
                id="switch-to-client-portal-btn"
                onClick={() =>
                  onNavigate(
                    '/app/inicio',
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-xl transition cursor-pointer"
              >

                <span>
                  Ver App do Cliente
                </span>

                <ExternalLink className="w-3 h-3" />

              </button>

            </div>

          </header>

          {/* =================================================
              MOBILE DRAWER
          ================================================= */}

          {mobileMenuOpen && (
            <div className="lg:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex">

              <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full p-4 animate-slideRight">

                <div className="flex items-center justify-between pb-4 border-b border-slate-800">

                  <div className="flex items-center gap-2">

                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
                      A
                    </div>

                    <span className="font-bold text-slate-100">
                      ArenaPro
                    </span>

                  </div>

                  <button
                    onClick={() =>
                      setMobileMenuOpen(
                        false,
                      )
                    }
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >

                    <X className="w-5 h-5" />

                  </button>

                </div>

                {/* Mobile Arena selector */}

                <div className="py-3 border-b border-slate-800">

                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Arena Ativa
                  </label>

                  <select
                    value={
                      activeArena?.id ||
                      ''
                    }
                    onChange={(e) => {

                      const found =
                        arenas.find(
                          (a) =>
                            a.id ===
                            e.target.value,
                        );

                      if (found) {
                        setActiveArena(
                          found,
                        );
                      }

                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  >

                    {arenas.map(
                      (a) => (
                        <option
                          key={a.id}
                          value={a.id}
                        >
                          {a.name}
                        </option>
                      ),
                    )}

                  </select>

                </div>

                <nav className="flex-1 py-3 space-y-1 overflow-y-auto">

                  {menuItems.map(
                    (item) => {

                      const isActive =
                        currentPath ===
                        item.path;

                      return (
                        <button
                          key={
                            item.path
                          }
                          onClick={() =>
                            handleNavClick(
                              item.path,
                            )
                          }
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'text-slate-400 hover:bg-slate-800'
                          }`}
                        >

                          {item.icon}

                          <span>
                            {item.name}
                          </span>

                        </button>
                      );

                    },
                  )}

                </nav>

                <div className="pt-3 border-t border-slate-800">

                  <button
                    onClick={
                      signOut
                    }
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-semibold"
                  >

                    <LogOut className="w-4 h-4" />

                    <span>
                      Sair da Conta
                    </span>

                  </button>

                </div>

              </div>

            </div>
          )}

          {/* PAGE CONTENT */}

          <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
            {children}
          </main>

        </div>

      </div>

    </div>
  );
};