import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminLayout } from './layouts/AdminLayout';
import { ClientLayout } from './layouts/ClientLayout';

// ============================================================
// PUBLIC / AUTH PAGES
// ============================================================
import { PublicHomePage } from './pages/client/PublicHomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';

// ============================================================
// ADMIN PAGES
// ============================================================
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

// ============================================================
// CLIENT / PUBLIC ARENA PAGES
// ============================================================
import { ArenaSelectionPage } from './pages/client/ArenaSelectionPage';
import { PublicArenaPortalPage } from './pages/client/PublicArenaPortalPage';
import { ClientHomePage } from './pages/client/ClientHomePage';
import { ClientBookingPage } from './pages/client/ClientBookingPage';
import { ClientMyReservationsPage } from './pages/client/ClientMyReservationsPage';
import { ClientProfilePage } from './pages/client/ClientProfilePage';


// ============================================================
// APP CONTENT
// ============================================================

const AppContent: React.FC = () => {

  const {
    user,
    profile,
    activeArena,
    activeSubscription,
    subscriptionLoading,
    loading,
  } = useAuth();


  // ==========================================================
  // ROTA INICIAL
  //
  // A rota vem diretamente da URL do navegador.
  // ==========================================================

  const [currentPath, setCurrentPath] = useState<string>(
    window.location.pathname || '/'
  );


  // ==========================================================
  // NAVEGAÇÃO
  //
  // Mantém React + URL do navegador sincronizados.
  // ==========================================================

  const navigate = useCallback(
    (path: string, replace = false) => {

      if (!path) {
        path = '/';
      }

      if (window.location.pathname !== path) {

        if (replace) {
          window.history.replaceState({}, '', path);
        } else {
          window.history.pushState({}, '', path);
        }

      }

      setCurrentPath(path);
    },
    []
  );


  // ==========================================================
  // BOTÃO VOLTAR / AVANÇAR DO NAVEGADOR
  // ==========================================================

  useEffect(() => {

    const handlePopState = () => {

      setCurrentPath(
        window.location.pathname || '/'
      );

    };

    window.addEventListener(
      'popstate',
      handlePopState
    );

    return () => {

      window.removeEventListener(
        'popstate',
        handlePopState
      );

    };

  }, []);


  // ==========================================================
  // REDIRECIONAMENTO AUTOMÁTICO APÓS LOGIN
  // ==========================================================

  useEffect(() => {

    if (
      loading ||
      !user ||
      !profile
    ) {
      return;
    }


    // --------------------------------------------------------
    // CLIENT
    // --------------------------------------------------------

    if (
      profile.role === 'CLIENT' &&
      currentPath.startsWith('/admin')
    ) {

      navigate(
        '/app/inicio',
        true
      );

      return;
    }


    // --------------------------------------------------------
    // SUPER ADMIN
    // --------------------------------------------------------

    if (
      profile.role === 'SUPER_ADMIN' &&
      currentPath === '/login'
    ) {

      navigate(
        '/admin/saas',
        true
      );

      return;
    }


    // --------------------------------------------------------
    // ARENA ADMIN / ARENA STAFF
    // --------------------------------------------------------

    if (
      profile.role !== 'CLIENT' &&
      profile.role !== 'SUPER_ADMIN' &&
      currentPath === '/login'
    ) {

      navigate(
        '/admin/agenda',
        true
      );

      return;
    }

  }, [
    user,
    profile,
    loading,
    currentPath,
    navigate,
  ]);


  // ==========================================================
  // LOADING INICIAL
  // ==========================================================

  if (loading) {

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">

        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-2xl shadow-xl shadow-emerald-500/20 animate-pulse">
          A
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">

          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />

          <span>
            Iniciando ArenaPro SaaS...
          </span>

        </div>

      </div>
    );
  }


  // ==========================================================
  // HOME PÚBLICA
  //
  // /
  // ==========================================================

  if (currentPath === '/') {

    return (
      <PublicHomePage
        onNavigate={navigate}
      />
    );
  }


  // ==========================================================
  // ROTAS PÚBLICAS DA ARENA
  //
  // /arena/:slug
  // /arena/:slug/reservar
  //
  // Essas rotas NÃO exigem login.
  // ==========================================================

  if (currentPath.startsWith('/arena/')) {

    const arenaPath = currentPath
      .replace('/arena/', '')
      .split('?')[0]
      .replace(/\/+$/, '');


    const pathParts = arenaPath.split('/');

    const slug = pathParts[0];


    // ========================================================
    // RESERVA PÚBLICA
    //
    // /arena/:slug/reservar
    // ========================================================

    if (
      pathParts.length >= 2 &&
      pathParts[1] === 'reservar'
    ) {

      return (
        <ClientLayout
          currentPath={currentPath}
          onNavigate={navigate}
        >

          <ClientBookingPage
            onNavigate={navigate}
            arenaSlug={slug}
          />

        </ClientLayout>
      );
    }


    // ========================================================
    // PORTAL PÚBLICO DA ARENA
    //
    // /arena/:slug
    // ========================================================

    return (
      <PublicArenaPortalPage
        slug={slug}
        onNavigate={navigate}
      />
    );
  }


  // ==========================================================
  // USUÁRIO NÃO AUTENTICADO
  // ==========================================================

  if (!user) {

    // --------------------------------------------------------
    // LOGIN
    // --------------------------------------------------------

    if (currentPath === '/login') {

      return (
        <LoginPage
          onNavigate={navigate}
        />
      );
    }


    // --------------------------------------------------------
    // CADASTRO
    // --------------------------------------------------------

    if (currentPath === '/register') {

      return (
        <RegisterPage
          onNavigate={navigate}
        />
      );
    }


    // --------------------------------------------------------
    // RECUPERAÇÃO DE SENHA
    // --------------------------------------------------------

    if (
      currentPath === '/forgot-password'
    ) {

      return (
        <ForgotPasswordPage
          onNavigate={navigate}
        />
      );
    }


    // --------------------------------------------------------
    // ROTA DESCONHECIDA
    //
    // Volta para a Home pública.
    // --------------------------------------------------------

    navigate(
      '/',
      true
    );

    return null;
  }


  // ==========================================================
  // ROTAS ADMINISTRATIVAS
  //
  // /admin/*
  // ==========================================================

  const isAdminRoute =
    currentPath.startsWith('/admin');


  if (isAdminRoute) {


    // ========================================================
    // CLIENT NÃO PODE ACESSAR ADMIN
    // ========================================================

    if (
      profile?.role === 'CLIENT'
    ) {

      navigate(
        '/app/inicio',
        true
      );

      return null;
    }


    // ========================================================
    // GESTÃO SaaS
    //
    // SOMENTE SUPER_ADMIN
    // ========================================================

    if (
      currentPath === '/admin/saas'
    ) {

      if (
        profile?.role !== 'SUPER_ADMIN'
      ) {

        if (activeArena) {

          navigate(
            '/admin/agenda',
            true
          );

        } else {

          navigate(
            '/app/inicio',
            true
          );

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


    // ========================================================
    // CONTROLE DE ASSINATURA
    //
    // SUPER_ADMIN não depende de assinatura.
    //
    // ARENA_ADMIN / ARENA_STAFF precisam de ACTIVE.
    // ========================================================

    if (
      profile?.role !== 'SUPER_ADMIN'
    ) {


      // ------------------------------------------------------
      // Nenhuma arena vinculada
      // ------------------------------------------------------

      if (!activeArena) {

        return (
          <SubscriptionBlockedPage />
        );
      }


      // ------------------------------------------------------
      // Verificando assinatura
      // ------------------------------------------------------

      if (subscriptionLoading) {

        return (
          <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">

            Verificando assinatura da arena...

          </div>
        );
      }


      // ------------------------------------------------------
      // Assinatura inexistente ou não ativa
      // ------------------------------------------------------

      if (
        !activeSubscription ||
        activeSubscription.status !== 'ACTIVE'
      ) {

        return (
          <SubscriptionBlockedPage />
        );
      }
    }


    // ========================================================
    // PAINEL ADMINISTRATIVO
    // ========================================================

    return (
      <AdminLayout
        currentPath={currentPath}
        onNavigate={navigate}
      >

        {currentPath === '/admin/dashboard' && (
          <DashboardPage
            onNavigate={navigate}
          />
        )}


        {currentPath === '/admin/agenda' && (
          <AgendaPage
            onNavigate={navigate}
          />
        )}


        {currentPath === '/admin/reservas' && (
          <ReservationsPage
            onNavigate={navigate}
          />
        )}


        {currentPath === '/admin/quadras' && (
          <CourtsPage
            onNavigate={navigate}
          />
        )}


        {currentPath === '/admin/modalidades' && (
          <ModalitiesPage
            onNavigate={navigate}
          />
        )}


        {currentPath === '/admin/clientes' && (
          <CustomersPage
            onNavigate={navigate}
          />
        )}


        {currentPath === '/admin/servicos' && (
          <ServicesPage
            onNavigate={navigate}
          />
        )}


        {currentPath === '/admin/financeiro' && (
          <FinancePage
            onNavigate={navigate}
          />
        )}


        {currentPath === '/admin/configuracoes' && (
          <SettingsPage
            onNavigate={navigate}
          />
        )}


        {currentPath === '/admin/usuarios' && (
          <UsersPage
            onNavigate={navigate}
          />
        )}

      </AdminLayout>
    );
  }


  // ==========================================================
  // ÁREA DO CLIENTE
  //
  // /app/*
  // ==========================================================


  // ----------------------------------------------------------
  // HOME DO CLIENTE
  // ----------------------------------------------------------

  if (
    currentPath === '/app' ||
    currentPath === '/app/inicio'
  ) {

    return (
      <ClientLayout
        currentPath={currentPath}
        onNavigate={navigate}
      >

        <ClientHomePage
          onNavigate={navigate}
        />

      </ClientLayout>
    );
  }

  // ----------------------------------------------------------
  // ESCOLHA DA ARENA PARA RESERVA
  // ----------------------------------------------------------

  if (
    currentPath === '/app/escolher-arena'
  ) {

    return (
      <ClientLayout
        currentPath={currentPath}
        onNavigate={navigate}
      >

        <ArenaSelectionPage
          onNavigate={navigate}
        />

      </ClientLayout>
    );
  }


  // ----------------------------------------------------------
  // RESERVAS DO CLIENTE
  // ----------------------------------------------------------

  if (
    currentPath.startsWith('/app/reservar')
  ) {

    return (
      <ClientLayout
        currentPath={currentPath}
        onNavigate={navigate}
      >

        <ClientBookingPage
          onNavigate={navigate}
        />

      </ClientLayout>
    );
  }


  // ----------------------------------------------------------
  // MINHAS RESERVAS
  // ----------------------------------------------------------

  if (
    currentPath === '/app/minhas-reservas' ||
    currentPath === '/app/reservas'
  ) {

    return (
      <ClientLayout
        currentPath={currentPath}
        onNavigate={navigate}
      >

        <ClientMyReservationsPage
          onNavigate={navigate}
        />

      </ClientLayout>
    );
  }


  // ----------------------------------------------------------
  // PERFIL
  // ----------------------------------------------------------

  if (
    currentPath === '/app/perfil'
  ) {

    return (
      <ClientLayout
        currentPath={currentPath}
        onNavigate={navigate}
      >

        <ClientProfilePage
          onNavigate={navigate}
        />

      </ClientLayout>
    );
  }


  // ==========================================================
  // FALLBACK PARA USUÁRIO AUTENTICADO
  // ==========================================================

  if (
    profile?.role === 'CLIENT'
  ) {

    navigate(
      '/app/inicio',
      true
    );

  } else if (
    profile?.role === 'SUPER_ADMIN'
  ) {

    navigate(
      '/admin/saas',
      true
    );

  } else {

    navigate(
      '/admin/agenda',
      true
    );
  }


  return null;
};


// ============================================================
// APP ROOT
// ============================================================

export default function App() {

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}