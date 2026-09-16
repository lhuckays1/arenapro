import React, { useEffect, useState } from 'react';
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

  /*
   * Mantemos a rota atual somente em estado.
   * A navegação do AdminLayout usa diretamente esta função.
   */
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return '/admin/dashboard';
  });

  /*
   * Navegação centralizada.
   *
   * O uso de uma função própria evita que diferentes componentes
   * manipulem currentPath de maneiras diferentes.
   */
  const navigate = (path: string) => {
    console.log('[ArenaPro] Navegando para:', path);
    setCurrentPath(path);
  };

  /*
   * Redirecionamentos SOMENTE relacionados à autenticação.
   *
   * Importante:
   * Não devemos alterar a rota quando o usuário simplesmente
   * clica em Dashboard, Agenda, Reservas etc.
   */
  useEffect(() => {
    if (loading || !user || !profile) {
      return;
    }

    // Cliente não pode acessar o painel administrativo.
    if (profile.role === 'CLIENT') {
      if (currentPath.startsWith('/admin')) {
        setCurrentPath('/app/inicio');
      }

      return;
    }

    /*
     * Após login:
     *
     * SUPER_ADMIN → Gestão SaaS
     * Demais administradores → Dashboard
     *
     * Esse redirecionamento só acontece se ainda estivermos
     * em uma rota de autenticação.
     */
    if (
      currentPath === '/login' ||
      currentPath === '/' ||
      currentPath === ''
    ) {
      if (profile.role === 'SUPER_ADMIN') {
        setCurrentPath('/admin/saas');
      } else {
        setCurrentPath('/admin/dashboard');
      }
    }
  }, [user, profile, loading]);

  /*
   * Tela de carregamento inicial
   */
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

  /*
   * Portal público da arena
   *
   * Exemplo:
   * /arena/terceiro-tempo
   */
  if (currentPath.startsWith('/arena/')) {
    const slug = currentPath
      .replace('/arena/', '')
      .split('?')[0];

    return (
      <PublicArenaPortalPage
        slug={slug}
        onNavigate={navigate}
      />
    );
  }

  /*
   * Usuário não autenticado
   */
  if (!user) {
    if (currentPath === '/register') {
      return (
        <RegisterPage
          onNavigate={navigate}
        />
      );
    }

    if (currentPath === '/forgot-password') {
      return (
        <ForgotPasswordPage
          onNavigate={navigate}
        />
      );
    }

    return (
      <LoginPage
        onNavigate={navigate}
      />
    );
  }

  /*
   * ============================================================
   * ÁREA ADMINISTRATIVA
   * ============================================================
   */
  const isAdminRoute = currentPath.startsWith('/admin');

  if (isAdminRoute) {

    /*
     * CLIENT nunca entra no painel administrativo.
     */
    if (profile?.role === 'CLIENT') {
      if (currentPath !== '/app/inicio') {
        setCurrentPath('/app/inicio');
      }

      return null;
    }

    /*
     * ========================================================
     * GESTÃO SaaS
     * ========================================================
     */
    if (currentPath === '/admin/saas') {

      if (profile?.role !== 'SUPER_ADMIN') {

        if (activeArena) {
          setCurrentPath('/admin/dashboard');
        } else {
          setCurrentPath('/app/inicio');
        }

        return null;
      }

      return (
        <AdminLayout
          currentPath={currentPath}
          onNavigate={navigate}
        >
          <SaaSPage
            onNavigate={navigate}
          />
        </AdminLayout>
      );
    }

    /*
     * ========================================================
     * ASSINATURA
     * ========================================================
     *
     * SUPER_ADMIN pode acessar qualquer arena sem assinatura.
     *
     * ARENA_ADMIN / ARENA_STAFF precisam de assinatura ACTIVE.
     */
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

    /*
     * ========================================================
     * PAINEL OPERACIONAL
     * ========================================================
     */
    return (
      <AdminLayout
        currentPath={currentPath}
        onNavigate={navigate}
      >

        {/* DASHBOARD */}
        {currentPath === '/admin/dashboard' && (
          <DashboardPage
            onNavigate={navigate}
          />
        )}

        {/* AGENDA */}
        {currentPath === '/admin/agenda' && (
          <AgendaPage
            onNavigate={navigate}
          />
        )}

        {/* RESERVAS */}
        {currentPath === '/admin/reservas' && (
          <ReservationsPage
            onNavigate={navigate}
          />
        )}

        {/* QUADRAS */}
        {currentPath === '/admin/quadras' && (
          <CourtsPage
            onNavigate={navigate}
          />
        )}

        {/* MODALIDADES */}
        {currentPath === '/admin/modalidades' && (
          <ModalitiesPage
            onNavigate={navigate}
          />
        )}

        {/* CLIENTES */}
        {currentPath === '/admin/clientes' && (
          <CustomersPage
            onNavigate={navigate}
          />
        )}

        {/* SERVIÇOS */}
        {currentPath === '/admin/servicos' && (
          <ServicesPage
            onNavigate={navigate}
          />
        )}

        {/* FINANCEIRO */}
        {currentPath === '/admin/financeiro' && (
          <FinancePage
            onNavigate={navigate}
          />
        )}

        {/* CONFIGURAÇÕES */}
        {currentPath === '/admin/configuracoes' && (
          <SettingsPage
            onNavigate={navigate}
          />
        )}

        {/* USUÁRIOS */}
        {currentPath === '/admin/usuarios' && (
          <UsersPage
            onNavigate={navigate}
          />
        )}

      </AdminLayout>
    );
  }

  /*
   * ============================================================
   * ÁREA DO CLIENTE
   * ============================================================
   */
  return (
    <ClientLayout
      currentPath={currentPath}
      onNavigate={navigate}
    >

      {(currentPath === '/app' ||
        currentPath === '/app/inicio') && (
        <ClientHomePage
          onNavigate={navigate}
        />
      )}

      {currentPath.startsWith('/app/reservar') && (
        <ClientBookingPage
          onNavigate={navigate}
        />
      )}

      {(currentPath === '/app/minhas-reservas' ||
        currentPath === '/app/reservas') && (
        <ClientMyReservationsPage
          onNavigate={navigate}
        />
      )}

      {currentPath === '/app/perfil' && (
        <ClientProfilePage
          onNavigate={navigate}
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