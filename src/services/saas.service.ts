import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Arena, ArenaSubscription, ArenaSubscriptionPayment, SubscriptionPlan } from '../types';

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
  async getPlans(includeInactive = false): Promise<SubscriptionPlan[]> {
    if (!isSupabaseConfigured) return [];
    let query = supabase.from('subscription_plans').select('*');
    if (!includeInactive) query = query.eq('status', 'ACTIVE');
    const { data, error } = await query.order('monthly_price');
    if (error) throw error;
    return (data || []) as SubscriptionPlan[];
  },

  async updatePlanMonthlyPrice(planId: string, monthlyPrice: number): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
    if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) throw new Error('Informe um valor mensal maior que zero.');
    const { error } = await supabase
      .from('subscription_plans')
      .update({ monthly_price: Math.round(monthlyPrice * 100) / 100, updated_at: new Date().toISOString() })
      .eq('id', planId);
    if (error) throw error;
  },

  async updateSubscriptionPlan(planId: string, updates: Pick<SubscriptionPlan, 'name' | 'code' | 'monthly_price' | 'max_courts' | 'max_staff_users' | 'features' | 'status'>): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
    if (!updates.name.trim() || !updates.code.trim()) throw new Error('Nome e código do plano são obrigatórios.');
    if (!Number.isFinite(updates.monthly_price) || updates.monthly_price <= 0) throw new Error('Informe um valor mensal maior que zero.');
    for (const [label, value] of [['quadras', updates.max_courts], ['usuários da equipe', updates.max_staff_users]] as const) {
      if (value !== null && value !== undefined && (!Number.isInteger(value) || value < 0)) {
        throw new Error(`O limite de ${label} deve ser um número inteiro igual ou maior que zero.`);
      }
    }
    const { error } = await supabase
      .from('subscription_plans')
      .update({
        ...updates,
        name: updates.name.trim(),
        code: updates.code.trim().toUpperCase(),
        monthly_price: Math.round(updates.monthly_price * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId);
    if (error) throw error;
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

    // ==========================================================
    // 1. BUSCAR A ASSINATURA
    // ==========================================================

    const { data: subscription, error: subscriptionError } = await supabase
      .from('arena_subscriptions')
      .select('*')
      .eq('arena_id', arenaId)
      .maybeSingle();

    if (subscriptionError) {
      console.error(
        '[SaaS] Erro ao buscar assinatura:',
        subscriptionError
      );

      throw subscriptionError;
    }

    if (!subscription) {
      console.warn(
        '[SaaS] Nenhuma assinatura encontrada para a arena:',
        arenaId
      );

      return null;
    }

    // ==========================================================
    // 2. BUSCAR O PLANO SE EXISTIR plan_id
    // ==========================================================

    let plan: SubscriptionPlan | null = null;

    if (subscription.plan_id) {
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', subscription.plan_id)
        .maybeSingle();

      if (planError) {
        console.error(
          '[SaaS] Erro ao buscar plano:',
          planError
        );

        throw planError;
      }

      plan = planData as SubscriptionPlan | null;
    }

    // ==========================================================
    // 3. RETORNAR OBJETO COMPLETO
    // ==========================================================

    return {
      ...subscription,
      plan,
    } as ArenaSubscription;
  },

  async createAsaasCheckout(arenaId: string): Promise<{ checkout_url: string; reused: boolean }> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
    const { data, error } = await supabase.functions.invoke('create-asaas-subscription-checkout', {
      body: { arena_id: arenaId },
    });
    if (error) throw new Error(error.message || 'Não foi possível preparar o checkout.');
    if (!data?.success || typeof data.checkout_url !== 'string') {
      throw new Error(data?.error || 'Não foi possível preparar o checkout do Asaas.');
    }
    return { checkout_url: data.checkout_url, reused: Boolean(data.reused) };
  },

  async recordManualSubscriptionRenewal(input: {
    subscriptionId: string;
    paymentMethod: 'PIX' | 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'OTHER';
    reference?: string;
    notes: string;
  }): Promise<{ current_period_end: string; amount_cents: number }> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
    const { data, error } = await supabase.functions.invoke('record-manual-subscription-renewal', {
      body: {
        subscription_id: input.subscriptionId,
        payment_method: input.paymentMethod,
        reference: input.reference || null,
        notes: input.notes,
        confirmed_payment_received: true,
      },
    });
    if (error) {
      const response = (error as any).context;
      const responseBody = response instanceof Response
        ? await response.clone().json().catch(() => null)
        : null;
      throw new Error(responseBody?.error || error.message || 'Não foi possível registrar a renovação manual.');
    }
    if (!data?.success || !data?.renewal?.current_period_end) {
      throw new Error(data?.error || 'Não foi possível registrar a renovação manual.');
    }
    return data.renewal;
  },

  async getSubscriptionPayments(subscriptionId: string): Promise<ArenaSubscriptionPayment[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('arena_subscription_payments')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(12);
    if (error) throw error;
    return (data || []) as ArenaSubscriptionPayment[];
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

