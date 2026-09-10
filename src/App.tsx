import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminLayout } from './layouts/AdminLayout';
import { ClientLayout } from './layouts/ClientLayout';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';

// Admin Pages
import { DashboardPage } from './pages/admin/DashboardPage';
import { AgendaPage } from './pages/admin/AgendaPage';
import { ReservationsPage } from './pages/admin/ReservationsPage';
import { CourtsPage } from './pages/admin/CourtsPage';
import { ModalitiesPage } from './pages/admin/ModalitiesPage';
import { CustomersPage } from './pages/admin/CustomersPage';
import { ServicesPage } from './pages/admin/ServicesPage';
import { FinancePage } from './pages/admin/FinancePage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { SaaSPage } from './pages/admin/SaaSPage';
import { SubscriptionBlockedPage } from './pages/admin/SubscriptionBlockedPage';

// Client Pages
import { PublicArenaPortalPage } from './pages/client/PublicArenaPortalPage';
import { ClientHomePage } from './pages/client/ClientHomePage';
import { ClientBookingPage } from './pages/client/ClientBookingPage';
import { ClientMyReservationsPage } from './pages/client/ClientMyReservationsPage';
import { ClientProfilePage } from './pages/client/ClientProfilePage';

const AppContent: React.FC = () => {
  const {
    user,
    profile,
    activeArena,
    activeSubscription,
    subscriptionLoading,
    loading,
  } = useAuth();

  // Rota inicial padrão.
  // Para usuários administrativos, a Agenda será aberta após o login.
  const [currentPath, setCurrentPath] = useState<string>('/admin/agenda');

  // ============================================================
  // REDIRECIONAMENTO AUTOMÁTICO APÓS LOGIN
  // ============================================================
  useEffect(() => {
    if (!loading && user && profile) {

      // CLIENT
      if (profile.role === 'CLIENT') {
        // Cliente não pode acessar o painel administrativo
        if (currentPath.startsWith('/admin')) {
          setCurrentPath('/app/inicio');
        }
        return;
      }

      // SUPER ADMIN
      if (profile.role === 'SUPER_ADMIN') {
        // Após login, SUPER_ADMIN vai para a gestão SaaS
        if (currentPath === '/login' || currentPath === '/admin/dashboard') {
          setCurrentPath('/admin/saas');
        }
        return;
      }

      // ARENA_ADMIN / ARENA_STAFF
      if (
        profile.role === 'ARENA_ADMIN' ||
        profile.role === 'ARENA_STAFF'
      ) {
        // Após login, abre diretamente a Agenda
        if (
          currentPath === '/login' ||
          currentPath === '/admin/dashboard'
        ) {
          setCurrentPath('/admin/agenda');
        }
      }
    }
  }, [user, profile, loading, currentPath]);

  // ============================================================
  // LOADING INICIAL
  // ============================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-2xl shadow-xl shadow-emerald-500/20 animate-pulse">
          A
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Iniciando ArenaPro SaaS...</span>
        </div>
      </div>
    );
  }

  // ============================================================
  // PORTAL PÚBLICO DA ARENA
  // /arena/:slug
  // ============================================================
  if (currentPath.startsWith('/arena/')) {
    const slug = currentPath
      .replace('/arena/', '')
      .split('?')[0];

    return (
      <PublicArenaPortalPage
        slug={slug}
        onNavigate={setCurrentPath}
      />
    );
  }

  // ============================================================
  // USUÁRIO NÃO AUTENTICADO
  // ============================================================
  if (!user) {
    if (currentPath === '/register') {
      return <RegisterPage onNavigate={setCurrentPath} />;
    }

    if (currentPath === '/forgot-password') {
      return <ForgotPasswordPage onNavigate={setCurrentPath} />;
    }

    return <LoginPage onNavigate={setCurrentPath} />;
  }

  // ============================================================
  // ROTAS AUTENTICADAS
  // ============================================================
  const isAdminRoute = currentPath.startsWith('/admin');

  // ============================================================
  // ÁREA ADMINISTRATIVA
  // ============================================================
  if (isAdminRoute) {

    // ----------------------------------------------------------
    // CLIENT NÃO PODE ACESSAR ADMIN
    // ----------------------------------------------------------
    if (profile?.role === 'CLIENT') {
      if (currentPath !== '/app/inicio') {
        setCurrentPath('/app/inicio');
      }

      return null;
    }

    // ----------------------------------------------------------
    // GESTÃO SaaS
    // EXCLUSIVA DO SUPER_ADMIN
    // ----------------------------------------------------------
    if (currentPath === '/admin/saas') {

      if (profile?.role !== 'SUPER_ADMIN') {
        if (activeArena) {
          setCurrentPath('/admin/agenda');
        } else {
          setCurrentPath('/app/inicio');
        }

        return null;
      }

      return (
        <AdminLayout
          currentPath={currentPath}
          onNavigate={setCurrentPath}
        >
          <SaaSPage onNavigate={setCurrentPath} />
        </AdminLayout>
      );
    }

    // ----------------------------------------------------------
    // ACESSO OPERACIONAL DA ARENA
    //
    // SUPER_ADMIN:
    //   acesso liberado
    //
    // ARENA_ADMIN / ARENA_STAFF:
    //   precisam de assinatura ACTIVE
    // ----------------------------------------------------------
    if (profile?.role !== 'SUPER_ADMIN') {

      if (!activeArena) {
        return <SubscriptionBlockedPage />;
      }

      if (subscriptionLoading) {
        return (
          <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
            Verificando assinatura da arena...
          </div>
        );
      }

      if (
        !activeSubscription ||
        activeSubscription.status !== 'ACTIVE'
      ) {
        return <SubscriptionBlockedPage />;
      }
    }

    // ----------------------------------------------------------
    // PAINEL ADMINISTRATIVO
    // ----------------------------------------------------------
    return (
      <AdminLayout
        currentPath={currentPath}
        onNavigate={setCurrentPath}
      >

        {/* Dashboard */}
        {currentPath === '/admin/dashboard' && (
          <DashboardPage onNavigate={setCurrentPath} />
        )}

        {/* Agenda */}
        {currentPath === '/admin/agenda' && (
          <AgendaPage onNavigate={setCurrentPath} />
        )}

        {/* Reservas */}
        {currentPath === '/admin/reservas' && (
          <ReservationsPage onNavigate={setCurrentPath} />
        )}

        {/* Quadras */}
        {currentPath === '/admin/quadras' && (
          <CourtsPage onNavigate={setCurrentPath} />
        )}

        {/* Modalidades */}
        {currentPath === '/admin/modalidades' && (
          <ModalitiesPage onNavigate={setCurrentPath} />
        )}

        {/* Clientes */}
        {currentPath === '/admin/clientes' && (
          <CustomersPage onNavigate={setCurrentPath} />
        )}

        {/* Serviços */}
        {currentPath === '/admin/servicos' && (
          <ServicesPage onNavigate={setCurrentPath} />
        )}

        {/* Financeiro */}
        {currentPath === '/admin/financeiro' && (
          <FinancePage onNavigate={setCurrentPath} />
        )}

        {/* Configurações */}
        {currentPath === '/admin/configuracoes' && (
          <SettingsPage onNavigate={setCurrentPath} />
        )}

        {/* Usuários */}
        {currentPath === '/admin/usuarios' && (
          <UsersPage onNavigate={setCurrentPath} />
        )}

      </AdminLayout>
    );
  }

  // ============================================================
  // ÁREA DO CLIENTE
  // /app/*
  // ============================================================
  return (
    <ClientLayout
      currentPath={currentPath}
      onNavigate={setCurrentPath}
    >

      {/* Início */}
      {(currentPath === '/app' ||
        currentPath === '/app/inicio') && (
        <ClientHomePage
          onNavigate={setCurrentPath}
        />
      )}

      {/* Reservar */}
      {currentPath.startsWith('/app/reservar') && (
        <ClientBookingPage
          onNavigate={setCurrentPath}
        />
      )}

      {/* Minhas reservas */}
      {(currentPath === '/app/minhas-reservas' ||
        currentPath === '/app/reservas') && (
        <ClientMyReservationsPage
          onNavigate={setCurrentPath}
        />
      )}

      {/* Perfil */}
      {currentPath === '/app/perfil' && (
        <ClientProfilePage
          onNavigate={setCurrentPath}
        />
      )}

    </ClientLayout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}