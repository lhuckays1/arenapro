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
  async getInitialSession(): Promise<AuthSession | null> {
    if (isSupabaseConfigured) {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!profile) return null;

      return {
        user: {
          id: session.user.id,
          email: session.user.email || '',
        },
        profile,
      };
    } else {
      // Return saved local session or null
      const saved = localStorage.getItem('arenapro_auth_session');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
      // Default to Arena Admin for instant seamless exploration
      const defaultProfile = sandboxDB.getProfiles().find(p => p.role === 'ARENA_ADMIN') || sandboxDB.getProfiles()[0];
      const initial: AuthSession = {
        user: {
          id: defaultProfile.id,
          email: 'admin@arenaxp.com',
        },
        profile: defaultProfile,
      };
      localStorage.setItem('arenapro_auth_session', JSON.stringify(initial));
      return initial;
    }
  },

  async signInWithEmail(email: string, password: string): Promise<AuthSession> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Falha ao autenticar usuário.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Perfil de usuário não localizado.');
      }

      return {
        user: { id: data.user.id, email: data.user.email || '' },
        profile,
      };
    } else {
      // Sandbox validation
      const profiles = sandboxDB.getProfiles();
      let matchedProfile = profiles.find(p => p.id === 'u-admin-xp');
      
      if (email.toLowerCase().includes('super')) {
        matchedProfile = profiles.find(p => p.role === 'SUPER_ADMIN');
      } else if (email.toLowerCase().includes('staff')) {
        matchedProfile = profiles.find(p => p.role === 'ARENA_STAFF');
      } else if (email.toLowerCase().includes('client') || email.toLowerCase().includes('cliente')) {
        matchedProfile = profiles.find(p => p.role === 'CLIENT');
      }

      if (!matchedProfile) {
        matchedProfile = profiles[0];
      }

      const session: AuthSession = {
        user: { id: matchedProfile.id, email },
        profile: matchedProfile,
      };
      localStorage.setItem('arenapro_auth_session', JSON.stringify(session));
      return session;
    }
  },

  async signUpWithEmail(fullName: string, email: string, password: string, _role: UserRole = 'CLIENT'): Promise<AuthSession> {
    const safeRole: UserRole = 'CLIENT';

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: safeRole,
          }
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error('Erro no cadastro.');

      // The database trigger `handle_new_user` creates the CLIENT profile.
      // Do not write roles from the browser and do not upsert profiles here.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        throw new Error('A conta foi criada, mas o perfil ainda não foi criado. Verifique se a migration de autenticação foi executada no Supabase.');
      }

      // If email confirmation is enabled, Supabase returns a user without a session.
      // Do not pretend the user is logged in.
      if (!data.session) {
        throw new Error('Conta criada com sucesso. Confirme seu e-mail para ativar o acesso e depois faça login.');
      }

      return {
        user: { id: data.user.id, email: data.user.email || '' },
        profile: profile as Profile,
      };
    } else {
      const newId = `u-${Date.now()}`;
      const newProfile: Profile = {
        id: newId,
        full_name: fullName,
        phone: null,
        avatar_url: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80`,
        role: safeRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const profiles = sandboxDB.getProfiles();
      profiles.push(newProfile);
      sandboxDB.setProfiles(profiles);

      const session: AuthSession = {
        user: { id: newId, email },
        profile: newProfile,
      };
      localStorage.setItem('arenapro_auth_session', JSON.stringify(session));
      return session;
    }
  },

  async resetPassword(email: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    } else {
      // Simulates sending reset email
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  },

  async signOut(): Promise<void> {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('arenapro_auth_session');
  },

  async switchDemoPersona(role: UserRole): Promise<AuthSession> {
    const profiles = sandboxDB.getProfiles();
    const profile = profiles.find(p => p.role === role) || profiles[0];
    const emails: Record<UserRole, string> = {
      SUPER_ADMIN: 'superadmin@arenapro.com',
      ARENA_ADMIN: 'admin@arenaxp.com',
      ARENA_STAFF: 'staff@arenaxp.com',
      CLIENT: 'mariana.costa@exemplo.com'
    };

    const session: AuthSession = {
      user: { id: profile.id, email: emails[role] },
      profile,
    };
    localStorage.setItem('arenapro_auth_session', JSON.stringify(session));
    return session;
  }
};
