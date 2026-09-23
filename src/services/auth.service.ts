import { supabase, isSupabaseConfigured, sandboxDB } from '../lib/supabase';
import { Profile, UserRole } from '../types';

export interface AuthSession {
  user: {
    id: string;
    email: string;
  };
  profile: Profile;
}

export const authService = {
  // ==========================================================
  // CARREGAR SESSÃO ATUAL
  // ==========================================================

  async getInitialSession(): Promise<AuthSession | null> {
    if (isSupabaseConfigured) {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('[AUTH] Erro ao recuperar sessão:', error);
        return null;
      }

      if (!session?.user) {
        return null;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error(
          '[AUTH] Erro ao carregar profile:',
          profileError
        );

        return null;
      }

      if (!profile) {
        console.warn(
          '[AUTH] Usuário autenticado sem profile:',
          session.user.id
        );

        return null;
      }

      return {
        user: {
          id: session.user.id,
          email: session.user.email || '',
        },
        profile: profile as Profile,
      };
    }

    // ========================================================
    // SANDBOX
    // ========================================================

    const saved = localStorage.getItem('arenapro_auth_session');

    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        localStorage.removeItem('arenapro_auth_session');
      }
    }

    const defaultProfile =
      sandboxDB
        .getProfiles()
        .find(p => p.role === 'ARENA_ADMIN') ||
      sandboxDB.getProfiles()[0];

    if (!defaultProfile) {
      return null;
    }

    const initial: AuthSession = {
      user: {
        id: defaultProfile.id,
        email: 'admin@arenaxp.com',
      },
      profile: defaultProfile,
    };

    localStorage.setItem(
      'arenapro_auth_session',
      JSON.stringify(initial)
    );

    return initial;
  },

  // ==========================================================
  // LOGIN
  // ==========================================================

  async signInWithEmail(
    email: string,
    password: string
  ): Promise<AuthSession> {
    if (isSupabaseConfigured) {
      const {
        data,
        error,
      } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user || !data.session) {
        throw new Error(
          'Falha ao estabelecer a sessão do usuário.'
        );
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile) {
        throw new Error(
          'Perfil de usuário não localizado.'
        );
      }

      return {
        user: {
          id: data.user.id,
          email: data.user.email || '',
        },
        profile: profile as Profile,
      };
    }

    // ========================================================
    // SANDBOX
    // ========================================================

    const profiles = sandboxDB.getProfiles();

    let matchedProfile = profiles.find(
      p => p.id === 'u-admin-xp'
    );

    if (email.toLowerCase().includes('super')) {
      matchedProfile = profiles.find(
        p => p.role === 'SUPER_ADMIN'
      );
    } else if (
      email.toLowerCase().includes('staff')
    ) {
      matchedProfile = profiles.find(
        p => p.role === 'ARENA_STAFF'
      );
    } else if (
      email.toLowerCase().includes('client') ||
      email.toLowerCase().includes('cliente')
    ) {
      matchedProfile = profiles.find(
        p => p.role === 'CLIENT'
      );
    }

    if (!matchedProfile) {
      matchedProfile = profiles[0];
    }

    if (!matchedProfile) {
      throw new Error(
        'Nenhum perfil disponível no ambiente de demonstração.'
      );
    }

    const session: AuthSession = {
      user: {
        id: matchedProfile.id,
        email,
      },
      profile: matchedProfile,
    };

    localStorage.setItem(
      'arenapro_auth_session',
      JSON.stringify(session)
    );

    return session;
  },

  // ==========================================================
  // CADASTRO DE CLIENTE
  // ==========================================================

  async signUpWithEmail(
    fullName: string,
    email: string,
    password: string,
    _role: UserRole = 'CLIENT'
  ): Promise<AuthSession> {
    // IMPORTANTE:
    // Cadastro público sempre cria CLIENT.
    const safeRole: UserRole = 'CLIENT';

    if (isSupabaseConfigured) {
      console.log('[AUTH] Iniciando cadastro:', email);

      const {
        data,
        error,
      } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: safeRole,
          },
        },
      });

      if (error) {
        console.error(
          '[AUTH] Erro no signUp:',
          error
        );

        throw error;
      }

      if (!data.user) {
        throw new Error(
          'O Supabase não retornou o usuário criado.'
        );
      }

      console.log(
        '[AUTH] Usuário criado:',
        data.user.id
      );

      // ======================================================
      // VERIFICAR SE O SUPABASE ENTREGOU UMA SESSÃO
      // ======================================================

      let session = data.session;

      if (!session) {
        const {
          data: sessionData,
        } = await supabase.auth.getSession();

        session = sessionData.session;
      }

      // Se não existe sessão, provavelmente a confirmação
      // de e-mail está habilitada.
      if (!session) {
        throw new Error(
          'Conta criada com sucesso. Confirme seu e-mail para ativar o acesso e depois faça login.'
        );
      }

      console.log(
        '[AUTH] Sessão confirmada:',
        session.user.id
      );

      // ======================================================
      // CARREGAR PROFILE
      // ======================================================

      let profile: Profile | null = null;

      // O trigger do banco pode levar alguns milissegundos
      // para criar o profile. Fazemos algumas tentativas.
      for (let attempt = 1; attempt <= 5; attempt++) {
        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError) {
          console.error(
            `[AUTH] Erro ao consultar profile (tentativa ${attempt}):`,
            profileError
          );
        }

        if (profileData) {
          profile = profileData as Profile;
          break;
        }

        // Aguarda antes de tentar novamente.
        if (attempt < 5) {
          await new Promise(resolve =>
            setTimeout(resolve, 300)
          );
        }
      }

      if (!profile) {
        throw new Error(
          'A conta foi criada, mas o perfil do cliente não foi localizado. Verifique o trigger de criação de profiles no Supabase.'
        );
      }

      // Segurança adicional:
      // cadastro público nunca pode retornar outro papel.
      if (profile.role !== 'CLIENT') {
        console.error(
          '[AUTH] Perfil criado com papel inesperado:',
          profile.role
        );

        throw new Error(
          'O cadastro do cliente não foi configurado corretamente.'
        );
      }

      console.log(
        '[AUTH] Cadastro concluído:',
        {
          userId: data.user.id,
          email: data.user.email,
          role: profile.role,
        }
      );

      return {
        user: {
          id: data.user.id,
          email: data.user.email || '',
        },
        profile,
      };
    }

    // ========================================================
    // SANDBOX
    // ========================================================

    const newId = `u-${Date.now()}`;

    const newProfile: Profile = {
      id: newId,
      full_name: fullName,
      phone: null,
      avatar_url:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80',
      role: safeRole,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const profiles = sandboxDB.getProfiles();

    profiles.push(newProfile);

    sandboxDB.setProfiles(profiles);

    const session: AuthSession = {
      user: {
        id: newId,
        email,
      },
      profile: newProfile,
    };

    localStorage.setItem(
      'arenapro_auth_session',
      JSON.stringify(session)
    );

    return session;
  },

  // ==========================================================
  // RESET DE SENHA
  // ==========================================================

  async resetPassword(
    email: string
  ): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email
        );

      if (error) {
        throw error;
      }
    } else {
      await new Promise(resolve =>
        setTimeout(resolve, 800)
      );
    }
  },

  // ==========================================================
  // LOGOUT
  // ==========================================================

  async signOut(): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    }

    localStorage.removeItem(
      'arenapro_auth_session'
    );
  },

  // ==========================================================
  // PERSONA DE DEMONSTRAÇÃO
  // ==========================================================

  async switchDemoPersona(
    role: UserRole
  ): Promise<AuthSession> {
    const profiles = sandboxDB.getProfiles();

    const profile =
      profiles.find(p => p.role === role) ||
      profiles[0];

    if (!profile) {
      throw new Error(
        'Nenhum perfil disponível.'
      );
    }

    const emails: Record<
      UserRole,
      string
    > = {
      SUPER_ADMIN:
        'superadmin@arenapro.com',
      ARENA_ADMIN:
        'admin@arenaxp.com',
      ARENA_STAFF:
        'staff@arenaxp.com',
      CLIENT:
        'mariana.costa@exemplo.com',
    };

    const session: AuthSession = {
      user: {
        id: profile.id,
        email: emails[role],
      },
      profile,
    };

    localStorage.setItem(
      'arenapro_auth_session',
      JSON.stringify(session)
    );

    return session;
  },
};