import React, { createContext, useContext, useEffect, useState } from 'react';
import { Arena, ArenaSubscription, Profile, UserRole } from '../types';
import { authService } from '../services/auth.service';
import { arenaService } from '../services/arena.service';
import { saasService } from '../services/saas.service';
import { isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  activeArena: Arena | null;
  arenas: Arena[];
  activeSubscription: ArenaSubscription | null;
  subscriptionLoading: boolean;
  loading: boolean;
  isConfigured: boolean;
  setActiveArena: (arena: Arena) => void;
  signIn: (
    email: string,
    pass: string
  ) => Promise<AuthSession>;

  signUp: (
    name: string,
    email: string,
    pass: string,
    role?: UserRole
  ) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  switchPersona: (role: UserRole) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [activeArena, setActiveArenaState] = useState<Arena | null>(null);
  const [arenas, setArenas] = useState<Arena[]>([]);

  const [activeSubscription, setActiveSubscription] =
    useState<ArenaSubscription | null>(null);

  const [subscriptionLoading, setSubscriptionLoading] =
    useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);

  // ==========================================================
  // CARREGAR ARENAS PERMITIDAS PARA O USUÃRIO
  // ==========================================================

  const loadUserArenas = async (
    userId: string,
    userRole: UserRole
  ): Promise<Arena[]> => {
    if (userRole === 'SUPER_ADMIN') {
      return await arenaService.getArenas();
    }

    if (
      userRole === 'ARENA_ADMIN' ||
      userRole === 'ARENA_STAFF'
    ) {
      return await arenaService.getManagedArenas(userId);
    }

    // CLIENT
    return await arenaService.getArenas();
  };

  // ==========================================================
  // DEFINIR ARENA ATIVA
  // ==========================================================

  const selectInitialArena = (
    loadedArenas: Arena[]
  ): Arena | null => {
    if (loadedArenas.length === 0) {
      localStorage.removeItem('arenapro_active_arena_id');
      return null;
    }

    const savedArenaId = localStorage.getItem(
      'arenapro_active_arena_id'
    );

    // --------------------------------------------------------
    // Se existe uma arena salva E ela pertence Ã  lista atual,
    // podemos reutilizÃ¡-la.
    // --------------------------------------------------------

    if (savedArenaId) {
      const savedArena = loadedArenas.find(
        arena => arena.id === savedArenaId
      );

      if (savedArena) {
        return savedArena;
      }
    }

    // --------------------------------------------------------
    // Caso a arena salva nÃ£o pertenÃ§a ao usuÃ¡rio atual,
    // usamos a primeira arena permitida.
    // --------------------------------------------------------

    const firstArena = loadedArenas[0];

    localStorage.setItem(
      'arenapro_active_arena_id',
      firstArena.id
    );

    return firstArena;
  };

  // ==========================================================
  // CARREGAR CONTEXTO COMPLETO DO USUÃRIO
  // ==========================================================

  const loadAuthenticatedContext = async (
    userId: string,
    userRole: UserRole
  ) => {
    const loadedArenas = await loadUserArenas(
      userId,
      userRole
    );

    setArenas(loadedArenas);

    const selectedArena =
      selectInitialArena(loadedArenas);

    setActiveArenaState(selectedArena);

    return selectedArena;
  };

  // ==========================================================
  // INICIALIZAÃ‡ÃƒO
  // ==========================================================

  const init = async () => {
    try {
      setLoading(true);

      const session = await authService.getInitialSession();

      // ------------------------------------------------------
      // NÃƒO AUTENTICADO
      // ------------------------------------------------------

      if (!session) {
        setUser(null);
        setProfile(null);
        setArenas([]);
        setActiveArenaState(null);
        setActiveSubscription(null);

        return;
      }

      // ------------------------------------------------------
      // USUÃRIO AUTENTICADO
      // ------------------------------------------------------

      setUser(session.user);
      setProfile(session.profile);

      const selectedArena =
        await loadAuthenticatedContext(
          session.user.id,
          session.profile.role
        );

      console.log(
        '[Auth] UsuÃ¡rio autenticado:',
        session.profile.email || session.user.email
      );

      console.log(
        '[Auth] Perfil:',
        session.profile.role
      );

      console.log(
        '[Auth] Arenas disponÃveis:',
        selectedArena?.name || 'Nenhuma'
      );

    } catch (err) {
      console.error(
        'Error initializing AuthContext',
        err
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  // ==========================================================
  // CARREGAR ASSINATURA DA ARENA ATIVA
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    const loadSubscription = async () => {
      if (
        !activeArena ||
        !profile ||
        profile.role === 'CLIENT' ||
        profile.role === 'SUPER_ADMIN'
      ) {
        if (!cancelled) {
          setActiveSubscription(null);
          setSubscriptionLoading(false);
        }

        return;
      }

      setSubscriptionLoading(true);

      try {
        console.log(
          '[SaaS] Verificando assinatura da arena:',
          activeArena.name,
          activeArena.id
        );

        const subscription =
          await saasService.getSubscription(
            activeArena.id
          );

        if (!cancelled) {
          setActiveSubscription(subscription);

          console.log(
            '[SaaS] Assinatura carregada:',
            subscription
          );
        }

      } catch (error) {
        console.error(
          '[SaaS] Erro ao carregar assinatura da arena:',
          error
        );

        if (!cancelled) {
          setActiveSubscription(null);
        }

      } finally {
        if (!cancelled) {
          setSubscriptionLoading(false);
        }
      }
    };

    loadSubscription();

    return () => {
      cancelled = true;
    };
  }, [
    activeArena?.id,
    profile?.id,
    profile?.role
  ]);

  // ==========================================================
  // TROCAR ARENA
  // ==========================================================

  const setActiveArena = (arena: Arena) => {
    setActiveArenaState(arena);

    localStorage.setItem(
      'arenapro_active_arena_id',
      arena.id
    );
  };

  // ==========================================================
  // LOGIN
  // ==========================================================

  const signIn = async (
    email: string,
    pass: string
  ) => {
    setLoading(true);

    // Evita reutilizar uma assinatura da sessão anterior
    // enquanto o novo usuário ainda está carregando o contexto.
    setActiveSubscription(null);

    try {
      const session =
        await authService.signInWithEmail(
          email,
          pass
        );

      setUser({
        id: session.user.id,
        email: session.user.email,
      });

      setProfile(session.profile);

      // IMPORTANTE:
      // O login antigo apenas carregava user/profile.
      // A arena ativa ficava para uma etapa posterior.
      // Isso fazia o App enxergar temporariamente:
      //
      //   profile = ARENA_ADMIN
      //   activeArena = null
      //
      // e exibir "Assinatura necessária".
      //
      // Agora carregamos as arenas imediatamente durante o login.
      // Para ARENA_ADMIN/STAFF também deixamos subscriptionLoading
      // ativo antes de liberar o App, evitando o flash da tela
      // de assinatura enquanto o useEffect consulta o banco.
      const requiresSubscription =
        session.profile.role === 'ARENA_ADMIN' ||
        session.profile.role === 'ARENA_STAFF';

      if (requiresSubscription) {
        setSubscriptionLoading(true);
      } else {
        setSubscriptionLoading(false);
      }

      const selectedArena =
        await loadAuthenticatedContext(
          session.user.id,
          session.profile.role
        );

      // Se o usuário precisa de assinatura, o useEffect de assinatura
      // será disparado assim que activeArena for atualizado.
      // Caso não exista arena vinculada, não há consulta a fazer.
      if (
        requiresSubscription &&
        !selectedArena
      ) {
        setSubscriptionLoading(false);
      }

      return session;
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // CADASTRO
  // ==========================================================

  const signUp = async (
    name: string,
    email: string,
    pass: string
  ) => {
    setLoading(true);

    try {
      const session =
        await authService.signUpWithEmail(
          name,
          email,
          pass,
          'CLIENT'
        );

      console.log(
        '[AUTH CONTEXT] Cadastro autenticado:',
        session
      );

      setUser({
        id: session.user.id,
        email: session.user.email,
      });

      setProfile(session.profile);

      return session;
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const signOut = async () => {
    setLoading(true);

    try {
      await authService.signOut();

      setUser(null);
      setProfile(null);

      setArenas([]);
      setActiveArenaState(null);
      setActiveSubscription(null);

      // ------------------------------------------------------
      // IMPORTANTE:
      // nÃ£o mantemos a arena do usuÃ¡rio anterior
      // ------------------------------------------------------

      localStorage.removeItem(
        'arenapro_active_arena_id'
      );

    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // RESET PASSWORD
  // ==========================================================

  const resetPassword = async (
    email: string
  ) => {
    await authService.resetPassword(email);
  };

  // ==========================================================
  // PERSONA DEMO
  // ==========================================================

  const switchPersona = async (
    role: UserRole
  ) => {
    setLoading(true);

    try {
      const session =
        await authService.switchDemoPersona(
          role
        );

      setUser(session.user);
      setProfile(session.profile);

      setActiveSubscription(null);

      const loadedArenas =
        await loadUserArenas(
          session.user.id,
          session.profile.role
        );

      setArenas(loadedArenas);

      const selectedArena =
        selectInitialArena(
          loadedArenas
        );

      setActiveArenaState(
        selectedArena
      );

    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // ATUALIZAR PERFIL
  // ==========================================================

  const refreshProfile = async () => {
    const session =
      await authService.getInitialSession();

    if (!session) return;

    setUser(session.user);
    setProfile(session.profile);

    setActiveSubscription(null);

    const loadedArenas =
      await loadUserArenas(
        session.user.id,
        session.profile.role
      );

    setArenas(loadedArenas);

    const selectedArena =
      selectInitialArena(
        loadedArenas
      );

    setActiveArenaState(
      selectedArena
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        activeArena,
        arenas,
        activeSubscription,
        subscriptionLoading,
        loading,
        isConfigured:
          isSupabaseConfigured,
        setActiveArena,
        signIn,
        signUp,
        signOut,
        resetPassword,
        switchPersona,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
};
