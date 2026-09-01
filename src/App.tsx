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
  const { user, profile, activeArena, activeSubscription, subscriptionLoading, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>('/admin/dashboard');

  // Auto route adjustment based on role and auth state
  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === 'CLIENT' && currentPath.startsWith('/admin')) {
        setCurrentPath('/app/inicio');
      } else if (profile.role === 'SUPER_ADMIN' && currentPath === '/login') {
        setCurrentPath('/admin/saas');
      } else if (profile.role !== 'CLIENT' && currentPath === '/login') {
        setCurrentPath('/admin/dashboard');
      }
    }
  }, [user, profile, loading]);

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

  // Check if current route is a public arena portal (/arena/:slug)
  if (currentPath.startsWith('/arena/')) {
    const slug = currentPath.replace('/arena/', '').split('?')[0];
    return <PublicArenaPortalPage slug={slug} onNavigate={setCurrentPath} />;
  }

  // Not logged in -> Auth routes
  if (!user) {
    if (currentPath === '/register') {
      return <RegisterPage onNavigate={setCurrentPath} />;
    }
    if (currentPath === '/forgot-password') {
      return <ForgotPasswordPage onNavigate={setCurrentPath} />;
    }
    return <LoginPage onNavigate={setCurrentPath} />;
  }

  // Authenticated: Route matching
  const isAdminRoute = currentPath.startsWith('/admin');

  if (isAdminRoute) {
    // CLIENT never enters the administrative surface.
    if (profile?.role === 'CLIENT') {
      if (currentPath !== '/app/inicio') setCurrentPath('/app/inicio');
      return null;
    }

    // SaaS management is exclusive to SUPER_ADMIN.
    if (currentPath === '/admin/saas') {
      if (profile?.role !== 'SUPER_ADMIN') {
        if (activeArena) setCurrentPath('/admin/dashboard');
        else setCurrentPath('/app/inicio');
        return null;
      }
      return (
        <AdminLayout currentPath={currentPath} onNavigate={setCurrentPath}>
          <SaaSPage onNavigate={setCurrentPath} />
        </AdminLayout>
      );
    }

    // SUPER_ADMIN can inspect an arena without a tenant subscription gate.
    // ARENA_ADMIN/ARENA_STAFF require an active paid subscription.
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
      if (!activeSubscription || activeSubscription.status !== 'ACTIVE') {
        return <SubscriptionBlockedPage />;
      }
    }

    return (
      <AdminLayout currentPath={currentPath} onNavigate={setCurrentPath}>
        {currentPath === '/admin/dashboard' && <DashboardPage onNavigate={setCurrentPath} />}
        {currentPath === '/admin/agenda' && <AgendaPage onNavigate={setCurrentPath} />}
        {currentPath === '/admin/reservas' && <ReservationsPage onNavigate={setCurrentPath} />}
        {currentPath === '/admin/quadras' && <CourtsPage onNavigate={setCurrentPath} />}
        {currentPath === '/admin/modalidades' && <ModalitiesPage onNavigate={setCurrentPath} />}
        {currentPath === '/admin/clientes' && <CustomersPage onNavigate={setCurrentPath} />}
        {currentPath === '/admin/servicos' && <ServicesPage onNavigate={setCurrentPath} />}
        {currentPath === '/admin/financeiro' && <FinancePage onNavigate={setCurrentPath} />}
        {currentPath === '/admin/configuracoes' && <SettingsPage onNavigate={setCurrentPath} />}
        {currentPath === '/admin/usuarios' && <UsersPage onNavigate={setCurrentPath} />}
      </AdminLayout>
    );
  }

  // Client Area Routes (/app/*)
  return (
    <ClientLayout currentPath={currentPath} onNavigate={setCurrentPath}>
      {(currentPath === '/app' || currentPath === '/app/inicio') && (
        <ClientHomePage onNavigate={setCurrentPath} />
      )}
      {currentPath.startsWith('/app/reservar') && (
        <ClientBookingPage onNavigate={setCurrentPath} />
      )}
      {(currentPath === '/app/minhas-reservas' || currentPath === '/app/reservas') && (
        <ClientMyReservationsPage onNavigate={setCurrentPath} />
      )}
      {currentPath === '/app/perfil' && (
        <ClientProfilePage onNavigate={setCurrentPath} />
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
