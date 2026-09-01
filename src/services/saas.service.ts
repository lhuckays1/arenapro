import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Arena, ArenaSubscription, SubscriptionPlan } from '../types';

export interface CreateArenaOwnerPayload {
  arena: {
    name: string;
    slug: string;
    description?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  };
  owner: {
    full_name: string;
    email: string;
    phone?: string | null;
  };
  plan_id: string;
}

export const saasService = {
  async getPlans(): Promise<SubscriptionPlan[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('monthly_price');
    if (error) throw error;
    return (data || []) as SubscriptionPlan[];
  },

  async getSubscriptions(): Promise<ArenaSubscription[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('arena_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ArenaSubscription[];
  },

  async getSubscription(arenaId: string): Promise<ArenaSubscription | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('arena_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('arena_id', arenaId)
      .maybeSingle();
    if (error) throw error;
    return data as ArenaSubscription | null;
  },

  async createArenaOwner(payload: CreateArenaOwnerPayload) {
    if (!isSupabaseConfigured) {
      throw new Error('O onboarding de proprietários exige Supabase configurado.');
    }
    const { data, error } = await supabase.functions.invoke('create-arena-owner', {
      body: payload,
    });
    if (error) {
      throw new Error(error.message || 'Não foi possível criar a arena/proprietário.');
    }
    if (!data?.success) {
      throw new Error(data?.error || 'Não foi possível criar a arena/proprietário.');
    }
    return data;
  },

  async getArenaOwners(): Promise<Array<{ arena_id: string; user_id: string; role: string; profile?: any }>> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('arena_users')
      .select('arena_id, user_id, role, profile:profiles(*)')
      .eq('role', 'ARENA_ADMIN');
    if (error) throw error;
    return (data || []) as Array<{ arena_id: string; user_id: string; role: string; profile?: any }>;
  },

  async updateSubscriptionStatus(
    subscriptionId: string,
    status: ArenaSubscription['status'],
    periodEnd?: string | null
  ): Promise<ArenaSubscription> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');

    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'ACTIVE' && !periodEnd) {
      const start = new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      updates.current_period_start = start.toISOString().slice(0, 10);
      updates.current_period_end = end.toISOString().slice(0, 10);
      updates.paid_at = new Date().toISOString();
    } else if (periodEnd !== undefined) {
      updates.current_period_end = periodEnd;
    }

    const { data, error } = await supabase
      .from('arena_subscriptions')
      .update(updates)
      .eq('id', subscriptionId)
      .select('*, plan:subscription_plans(*)')
      .single();

    if (error) throw error;
    return data as ArenaSubscription;
  },

  async getArenaWithSubscription(arenaId: string): Promise<{
    arena: Arena | null;
    subscription: ArenaSubscription | null;
  }> {
    const [arena, subscription] = await Promise.all([
      supabase.from('arenas').select('*').eq('id', arenaId).maybeSingle(),
      this.getSubscription(arenaId),
    ]);
    if (arena.error) throw arena.error;
    return { arena: arena.data as Arena | null, subscription };
  },
};
