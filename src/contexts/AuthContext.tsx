import React, { createContext, useContext, useEffect, useState } from 'react';
import { Arena, ArenaSubscription, Profile, UserRole } from '../types';
import { authService, AuthSession } from '../services/auth.service';
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
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (name: string, email: string, pass: string, role?: UserRole) => Promise<void>;
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
  const [activeSubscription, setActiveSubscription] = useState<ArenaSubscription | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const init = async () => {
    try {
      setLoading(true);

      const session = await authService.getInitialSession();

      let loadedArenas: Arena[] = [];
      if (session?.profile?.role === 'SUPER_ADMIN') {
        loadedArenas = await arenaService.getArenas();
      } else if (
        session?.profile?.role === 'ARENA_ADMIN' ||
        session?.profile?.role === 'ARENA_STAFF'
      ) {
        loadedArenas = await arenaService.getManagedArenas(session.user.id);
      } else {
        // CLIENT can discover active public arenas for booking.
        loadedArenas = await arenaService.getArenas();
      }

      setArenas(loadedArenas);

      if (loadedArenas.length > 0) {
        const savedArenaId = localStorage.getItem('arenapro_active_arena_id');
        const matched = loadedArenas.find(a => a.id === savedArenaId) || loadedArenas[0];
        setActiveArenaState(matched);
      } else {
        setActiveArenaState(null);
      }

      if (session) {
        setUser(session.user);
        setProfile(session.profile);
      }
    } catch (err) {
      console.error('Error initializing AuthContext', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSubscription = async () => {
      if (!activeArena || !profile || profile.role === 'CLIENT' || profile.role === 'SUPER_ADMIN') {
        if (!cancelled) {
          setActiveSubscription(null);
          setSubscriptionLoading(false);
        }
        return;
      }

      setSubscriptionLoading(true);
      try {
        const subscription = await saasService.getSubscription(activeArena.id);
        if (!cancelled) setActiveSubscription(subscription);
      } catch (error) {
        console.error('Erro ao carregar assinatura da arena:', error);
        if (!cancelled) setActiveSubscription(null);
      } finally {
        if (!cancelled) setSubscriptionLoading(false);
      }
    };

    loadSubscription();
    return () => {
      cancelled = true;
    };
  }, [activeArena?.id, profile?.id, profile?.role]);

  const setActiveArena = (arena: Arena) => {
    setActiveArenaState(arena);
    localStorage.setItem('arenapro_active_arena_id', arena.id);
  };

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const session = await authService.signInWithEmail(email, pass);
      setUser(session.user);
      setProfile(session.profile);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (name: string, email: string, pass: string) => {
    setLoading(true);
    try {
      const session = await authService.signUpWithEmail(name, email, pass, 'CLIENT');
      setUser(session.user);
      setProfile(session.profile);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    await authService.resetPassword(email);
  };

  const switchPersona = async (role: UserRole) => {
    setLoading(true);
    try {
      const session = await authService.switchDemoPersona(role);
      setUser(session.user);
      setProfile(session.profile);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    const session = await authService.getInitialSession();
    if (session) {
      setUser(session.user);
      setProfile(session.profile);
    }
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
        isConfigured: isSupabaseConfigured,
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
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
