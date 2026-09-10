import { supabase, isSupabaseConfigured, sandboxDB } from '../lib/supabase';
import { 
  Arena, 
  Court, 
  Customer, 
  Modality, 
  Reservation, 
  Service, 
  CourtBlock, 
  Profile, 
  DashboardAnalytics, 
  PeriodFilter, 
  CustomerWithMetrics, 
  DayOccupancyData, 
  DayRevenueData, 
  CourtUtilizationData, 
  PeakHourData,
  FinancialTransaction,
  FinancialTransactionType,
  FinancialTransactionStatus,
  PaymentMethod,
  FinancialSummary,
  DayFinancialData,
  CategoryBreakdown,
  PendingReservationItem
} from '../types';

export const arenaService = {
  // 1. ARENAS
  async getArenas(): Promise<Arena[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('arenas').select('*').order('name');
      if (error) throw error;
      return data || [];
    }
    return sandboxDB.getArenas();
  },

  async getManagedArenas(userId: string): Promise<Arena[]> {
    if (isSupabaseConfigured) {
      const { data: memberships, error: membershipError } = await supabase
        .from('arena_users')
        .select('arena_id')
        .eq('user_id', userId)
        .in('role', ['ARENA_ADMIN', 'ARENA_STAFF'])
        .eq('status', 'ACTIVE');

      if (membershipError) throw membershipError;

      const arenaIds = (memberships || []).map((m: any) => m.arena_id);
      if (arenaIds.length === 0) return [];

      const { data, error } = await supabase
        .from('arenas')
        .select('*')
        .in('id', arenaIds)
        .order('name');

      if (error) throw error;
      return data || [];
    }

    return sandboxDB.getArenas();
  },

    // ==========================================================
  // PLATFORM USERS
  // Gestão global de usuários - SUPER_ADMIN
  // ==========================================================
  async getPlatformUsers(): Promise<any[]> {
    if (isSupabaseConfigured) {
      const { data, error } =
        await supabase.functions.invoke(
          'manage-platform-user',
          {
            body: {
              action: 'LIST',
            },
          }
        );

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
          'Erro ao carregar usuários da plataforma.'
        );
      }

      return data.users || [];
    }

    // Dados de demonstração somente quando
    // o Supabase não estiver configurado.
    return [
      {
        id: 'demo-super-admin',
        email: 'admin@arenaxp.com',
        full_name: 'Super Administrador',
        phone: null,
        role: 'SUPER_ADMIN',
        profile_status: 'ACTIVE',
        email_confirmed: true,
        last_sign_in_at: null,
        created_at: new Date().toISOString(),
        updated_at: null,
        arena_count: 0,
        arena_memberships: [],
      },
    ];
  },

  async getArenaById(id: string): Promise<Arena | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('arenas').select('*').eq('id', id).single();
      if (error) return null;
      return data;
    }
    return sandboxDB.getArenas().find(a => a.id === id) || null;
  },

  async getArenaBySlug(slug: string): Promise<Arena | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('arenas').select('*').eq('slug', slug).single();
      if (error) return null;
      return data;
    }
    return sandboxDB.getArenas().find(a => a.slug === slug) || null;
  },

  async updateArena(id: string, updates: Partial<Arena>): Promise<Arena> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('arenas')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return sandboxDB.updateArena(id, updates);
  },

  // 2. MODALITIES
  async getModalities(arenaId: string): Promise<Modality[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('modalities')
        .select('*')
        .eq('arena_id', arenaId)
        .order('name');
      if (error) throw error;
      return data || [];
    }
    return sandboxDB.getModalities(arenaId);
  },

  async createModality(modality: Omit<Modality, 'id' | 'created_at' | 'updated_at'>): Promise<Modality> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('modalities')
        .insert([{
          ...modality,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return sandboxDB.createModality(modality);
  },

  async updateModality(id: string, updates: Partial<Modality>): Promise<Modality> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('modalities')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return sandboxDB.updateModality(id, updates);
  },

  async deleteModality(id: string, arenaId: string): Promise<void> {
    // Check if courts are using this modality
    const courts = await this.getCourts(arenaId);
    const inUse = courts.some(c => c.modality_id === id);
    if (inUse) {
      throw new Error('Não é possível excluir esta modalidade pois existem quadras vinculadas a ela.');
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('modalities').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    sandboxDB.deleteModality(id);
  },

  // 3. COURTS
  async getCourts(arenaId: string): Promise<Court[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('courts')
        .select('*, modality:modalities(*)')
        .eq('arena_id', arenaId)
        .order('name');
      if (error) throw error;
      return data || [];
    }
    return sandboxDB.getCourts(arenaId);
  },

  async createCourt(court: Omit<Court, 'id' | 'created_at' | 'updated_at' | 'modality'>): Promise<Court> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('courts')
        .insert([{
          ...court,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select('*, modality:modalities(*)')
        .single();
      if (error) throw error;
      return data;
    }
    return sandboxDB.createCourt(court);
  },

  async updateCourt(id: string, updates: Partial<Court>): Promise<Court> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('courts')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*, modality:modalities(*)')
        .single();
      if (error) throw error;
      return data;
    }
    return sandboxDB.updateCourt(id, updates);
  },

  async deleteCourt(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('courts').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    sandboxDB.deleteCourt(id);
  },

  // 4. CUSTOMERS
  async getCustomers(arenaId: string): Promise<Customer[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('arena_id', arenaId)
        .order('full_name');
      if (error) throw error;
      return data || [];
    }
    return sandboxDB.getCustomers(arenaId);
  },

  async createCustomer(
    customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Customer> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          ...customer,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return sandboxDB.createCustomer(customer);
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('customers')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return sandboxDB.updateCustomer(id, updates);
  },

  async getOrCreateCustomerForUser(
    arenaId: string,
    userData: { id: string; email?: string; full_name?: string; phone?: string }
  ): Promise<Customer> {
    const customers = await this.getCustomers(arenaId);
    // Find customer by user_id or matching email/phone
    const existing = customers.find(c =>
      (c.user_id && c.user_id === userData.id) ||
      (userData.email && c.email && c.email.toLowerCase() === userData.email.toLowerCase()) ||
      (userData.phone && c.phone && c.phone.replace(/\D/g, '') === userData.phone.replace(/\D/g, ''))
    );

    if (existing) {
      // Ensure user_id is linked if it was not
      if (!existing.user_id) {
        return this.updateCustomer(existing.id, { user_id: userData.id });
      }
      return existing;
    }

    // Create new customer for this arena
    return this.createCustomer({
      arena_id: arenaId,
      user_id: userData.id,
      full_name: userData.full_name || 'Cliente ArenaPro',
      phone: userData.phone || '(11) 99999-9999',
      email: userData.email || null,
      birth_date: null,
      notes: 'Cadastrado via Portal do Cliente Online.',
      status: 'ACTIVE',
    });
  },

  // 6. RESERVATIONS & OVERLAP VALIDATION
  async getReservations(arenaId: string): Promise<Reservation[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, court:courts(*), customer:customers(*)')
        .eq('arena_id', arenaId)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    return sandboxDB.getReservations(arenaId);
  },

  async createReservation(
    reservation: Omit<Reservation, 'id' | 'created_at' | 'updated_at' | 'court' | 'customer'>
  ): Promise<Reservation> {
    // Check conflicts against reservations & court blocks
    const [allReservations, allBlocks] = await Promise.all([
      this.getReservations(reservation.arena_id),
      this.getCourtBlocks(reservation.arena_id),
    ]);

    const hasConflict = this.checkReservationOverlap(
      allReservations,
      reservation.court_id,
      reservation.start_at,
      reservation.end_at,
      undefined,
      allBlocks
    );

    if (hasConflict) {
      throw new Error('Conflito de horário: a quadra já possui uma reserva ou bloqueio programado para este intervalo.');
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('reservations')
        .insert([{
          ...reservation,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select('*, court:courts(*), customer:customers(*)')
        .single();
      if (error) throw error;
      return data;
    }

    const list = sandboxDB.getReservations(reservation.arena_id);
    const newRes: Reservation = {
      ...reservation,
      id: `res-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.push(newRes);
    sandboxDB.setReservations(list);
    const courts = sandboxDB.getCourts(reservation.arena_id);
    const customers = sandboxDB.getCustomers(reservation.arena_id);
    return {
      ...newRes,
      court: courts.find(c => c.id === reservation.court_id),
      customer: customers.find(c => c.id === reservation.customer_id),
    };
  },

  async updateReservation(
    id: string,
    updates: Partial<Reservation>,
    arenaId?: string
  ): Promise<Reservation> {
    // If updating court or times or activating, check conflicts
    if (arenaId && (updates.court_id || updates.start_at || updates.end_at || updates.status === 'CONFIRMED' || updates.status === 'PENDING')) {
      const [allReservations, allBlocks] = await Promise.all([
        this.getReservations(arenaId),
        this.getCourtBlocks(arenaId),
      ]);
      const current = allReservations.find(r => r.id === id);
      if (!current) throw new Error('Reserva não encontrada.');

      const targetCourtId = updates.court_id || current.court_id;
      const targetStart = updates.start_at || current.start_at;
      const targetEnd = updates.end_at || current.end_at;

      const hasConflict = this.checkReservationOverlap(
        allReservations,
        targetCourtId,
        targetStart,
        targetEnd,
        id,
        allBlocks
      );

      if (hasConflict) {
        throw new Error('Conflito de horário: a quadra já possui uma reserva ou bloqueio para este intervalo.');
      }
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('reservations')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*, court:courts(*), customer:customers(*)')
        .single();
      if (error) throw error;
      return data;
    }

    return sandboxDB.updateReservation(id, updates);
  },

  async cancelReservation(id: string, arenaId: string): Promise<Reservation> {
    return this.updateReservation(id, { status: 'CANCELLED' }, arenaId);
  },

  async deleteReservation(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('reservations').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    sandboxDB.deleteReservation(id);
  },

  // 7. COURT BLOCKS
  async getCourtBlocks(arenaId: string): Promise<CourtBlock[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('court_blocks')
        .select('*, court:courts(*)')
        .eq('arena_id', arenaId)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    return sandboxDB.getCourtBlocks(arenaId);
  },

  async createCourtBlock(
    block: Omit<CourtBlock, 'id' | 'created_at' | 'updated_at' | 'court'>
  ): Promise<CourtBlock> {
    // Check conflicts: Cannot create block over active reservations
    const allReservations = await this.getReservations(block.arena_id);
    const hasReservationOverlap = allReservations.some(res => {
      if (res.court_id !== block.court_id) return false;
      if (res.status === 'CANCELLED' || res.status === 'NO_SHOW') return false;
      const rStart = new Date(res.start_at).getTime();
      const rEnd = new Date(res.end_at).getTime();
      const bStart = new Date(block.start_at).getTime();
      const bEnd = new Date(block.end_at).getTime();
      return (bStart < rEnd && bEnd > rStart);
    });

    if (hasReservationOverlap) {
      throw new Error('A quadra possui reservas confirmadas ou pendentes no intervalo selecionado. Cancele ou realoque as reservas antes de bloquear.');
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('court_blocks')
        .insert([{
          ...block,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select('*, court:courts(*)')
        .single();
      if (error) throw error;
      return data;
    }

    return sandboxDB.createCourtBlock(block);
  },

  async deleteCourtBlock(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('court_blocks').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    sandboxDB.deleteCourtBlock(id);
  },

  // Check if court has overlapping reservations or blocks
  checkReservationOverlap(
    reservations: Reservation[],
    courtId: string,
    startAt: string,
    endAt: string,
    ignoreReservationId?: string,
    courtBlocks?: CourtBlock[]
  ): boolean {
    const start = new Date(startAt).getTime();
    const end = new Date(endAt).getTime();

    // 1. Check reservations
    const resConflict = reservations.some(res => {
      if (res.id === ignoreReservationId) return false;
      if (res.court_id !== courtId) return false;
      if (res.status === 'CANCELLED' || res.status === 'NO_SHOW') return false;

      const resStart = new Date(res.start_at).getTime();
      const resEnd = new Date(res.end_at).getTime();

      // Standard mathematical interval overlap: (start < resEnd AND end > resStart)
      return (start < resEnd && end > resStart);
    });

    if (resConflict) return true;

    // 2. Check court blocks if provided
    if (courtBlocks && courtBlocks.length > 0) {
      const blockConflict = courtBlocks.some(block => {
        if (block.court_id !== courtId) return false;
        const bStart = new Date(block.start_at).getTime();
        const bEnd = new Date(block.end_at).getTime();
        return (start < bEnd && end > bStart);
      });
      if (blockConflict) return true;
    }

    return false;
  },

  // 8. CLIENT RESERVATIONS & CANCELLATIONS
  async getClientReservations(userId: string, arenaId?: string): Promise<Reservation[]> {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('reservations')
        .select('*, court:courts(*), customer:customers(*)')
        .order('start_at', { ascending: false });

      if (arenaId) {
        query = query.eq('arena_id', arenaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter(r => (r.customer && r.customer.user_id === userId) || r.created_by === userId);
    }

    const allArenas = sandboxDB.getArenas();
    const targetArenas = arenaId ? allArenas.filter(a => a.id === arenaId) : allArenas;
    let clientReservations: Reservation[] = [];

    for (const arena of targetArenas) {
      const resList = sandboxDB.getReservations(arena.id);
      const userRes = resList.filter(r => (r.customer && r.customer.user_id === userId) || r.created_by === userId);
      clientReservations = [...clientReservations, ...userRes];
    }

    return clientReservations.sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
  },

  canCancelReservation(reservation: Reservation, arena: Arena): { allowed: boolean; reason?: string; limitHours: number } {
    const limitHours = arena.cancellation_limit_hours ?? 2;
    if (reservation.status === 'CANCELLED') {
      return { allowed: false, reason: 'Esta reserva já se encontra cancelada.', limitHours };
    }
    if (reservation.status === 'COMPLETED' || reservation.status === 'NO_SHOW') {
      return { allowed: false, reason: 'Não é possível cancelar uma reserva passada ou concluída.', limitHours };
    }

    const startTimestamp = new Date(reservation.start_at).getTime();
    const nowTimestamp = Date.now();
    const deadlineTimestamp = startTimestamp - (limitHours * 60 * 60 * 1000);

    if (nowTimestamp > deadlineTimestamp) {
      return {
        allowed: false,
        reason: `O prazo para cancelamento desta reserva já foi encerrado. A arena permite cancelamentos com até ${limitHours}h de antecedência.`,
        limitHours
      };
    }

    return { allowed: true, limitHours };
  },

  // 9. DYNAMIC TIME SLOTS GENERATION ACCORDING TO OPERATING HOURS
  calculateCourtSlots(
    courtId: string,
    dateStr: string, // YYYY-MM-DD
    arena: Arena,
    reservations: Reservation[],
    blocks: CourtBlock[]
  ): Array<{ hour: string; startAt: string; endAt: string; status: 'AVAILABLE' | 'RESERVED' | 'BLOCKED' | 'PAST' }> {
    const openingHour = parseInt((arena.opening_time || '06:00').split(':')[0], 10);
    const closingHour = parseInt((arena.closing_time || '23:00').split(':')[0], 10);

    const endBoundary = closingHour === 0 ? 24 : closingHour;
    const slots: Array<{ hour: string; startAt: string; endAt: string; status: 'AVAILABLE' | 'RESERVED' | 'BLOCKED' | 'PAST' }> = [];

    const now = new Date();
    const isToday = dateStr === now.toISOString().split('T')[0];
    const currentHour = now.getHours();

    for (let h = openingHour; h < endBoundary; h++) {
      const hourStr = h < 10 ? `0${h}:00` : `${h}:00`;
      const nextHourStr = (h + 1) < 10 ? `0${h + 1}:00` : (h + 1) === 24 ? '00:00' : `${h + 1}:00`;

      const startAt = `${dateStr}T${hourStr}:00.000Z`;
      const endAt = `${dateStr}T${nextHourStr}:00.000Z`;

      const slotStart = new Date(startAt).getTime();
      const slotEnd = new Date(endAt).getTime();

      // Check if in the past
      let status: 'AVAILABLE' | 'RESERVED' | 'BLOCKED' | 'PAST' = 'AVAILABLE';
      if (isToday && h <= currentHour && false) {
        // We can keep future logic lenient for sandbox testing or strict based on ISO
      }

      // Check active reservation overlap
      const hasReservation = reservations.some(r => {
        if (r.court_id !== courtId) return false;
        if (r.status === 'CANCELLED' || r.status === 'NO_SHOW') return false;
        const rStart = new Date(r.start_at).getTime();
        const rEnd = new Date(r.end_at).getTime();
        return (slotStart < rEnd && slotEnd > rStart);
      });

      if (hasReservation) {
        status = 'RESERVED';
      } else {
        // Check court blocks
        const hasBlock = blocks.some(b => {
          if (b.court_id !== courtId) return false;
          const bStart = new Date(b.start_at).getTime();
          const bEnd = new Date(b.end_at).getTime();
          return (slotStart < bEnd && slotEnd > bStart);
        });

        if (hasBlock) {
          status = 'BLOCKED';
        }
      }

      slots.push({
        hour: hourStr,
        startAt,
        endAt,
        status,
      });
    }

    return slots;
  },

  // 10. PROFILE UPDATES
  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return sandboxDB.updateProfile(id, updates);
  },

  // 11. DASHBOARD ANALYTICS & OPERATIONAL INTELLIGENCE
  async getDashboardAnalytics(
    arenaId: string,
    period: PeriodFilter = 'TODAY',
    customStart?: string,
    customEnd?: string
  ): Promise<DashboardAnalytics> {
    const [arena, allReservations, allCourts, allBlocks, allCustomers] = await Promise.all([
      this.getArenaById(arenaId),
      this.getReservations(arenaId),
      this.getCourts(arenaId),
      this.getCourtBlocks(arenaId),
      this.getCustomers(arenaId),
    ]);

    const timezone = arena?.timezone || 'America/Sao_Paulo';
    
    // Format date in arena's timezone
    const getLocalISODate = (d: Date): string => {
      try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        return formatter.format(d);
      } catch {
        return d.toISOString().split('T')[0];
      }
    };

    const now = new Date();
    const todayStr = getLocalISODate(now);

    // Determine date range
    let startDate = todayStr;
    let endDate = todayStr;

    if (period === '7_DAYS') {
      const startD = new Date(now);
      startD.setDate(startD.getDate() - 6);
      startDate = getLocalISODate(startD);
      endDate = todayStr;
    } else if (period === '30_DAYS') {
      const startD = new Date(now);
      startD.setDate(startD.getDate() - 29);
      startDate = getLocalISODate(startD);
      endDate = todayStr;
    } else if (period === 'CUSTOM') {
      startDate = customStart || todayStr;
      endDate = customEnd || todayStr;
      if (startDate > endDate) {
        const tmp = startDate;
        startDate = endDate;
        endDate = tmp;
      }
    }

    const activeCourts = allCourts.filter(c => c.status === 'ACTIVE');
    const openingHour = parseInt((arena?.opening_time || '06:00').split(':')[0], 10);
    const closingHour = parseInt((arena?.closing_time || '23:00').split(':')[0], 10);
    const dailyOperatingHours = closingHour === 0 ? (24 - openingHour) : Math.max(1, closingHour - openingHour);

    // 1. Today's metrics
    const todayReservations = allReservations.filter(r => {
      const rDate = r.start_at.slice(0, 10);
      return rDate === todayStr;
    });

    const todayReservationsCount = todayReservations.length;
    const todayValidReservations = todayReservations.filter(r => r.status !== 'CANCELLED');
    const todayRevenue = todayValidReservations.reduce((sum, r) => sum + (r.amount || 0), 0);
    const todayCancellationsCount = todayReservations.filter(r => r.status === 'CANCELLED').length;

    // Today's reserved duration in hours
    const todayReservedHours = todayValidReservations.reduce((sum, r) => {
      const startMs = new Date(r.start_at).getTime();
      const endMs = new Date(r.end_at).getTime();
      const hours = Math.max(0, (endMs - startMs) / 3600000);
      return sum + hours;
    }, 0);

    // Today's blocked duration in hours
    const todayBlocks = allBlocks.filter(b => b.start_at.slice(0, 10) === todayStr);
    const todayBlockedHours = todayBlocks.reduce((sum, b) => {
      const startMs = new Date(b.start_at).getTime();
      const endMs = new Date(b.end_at).getTime();
      return sum + Math.max(0, (endMs - startMs) / 3600000);
    }, 0);

    const todayAvailableCapacity = Math.max(1, (activeCourts.length * dailyOperatingHours) - todayBlockedHours);
    const todayOccupancyPercent = activeCourts.length === 0
      ? 0
      : Math.min(100, Math.round((todayReservedHours / todayAvailableCapacity) * 100));

    // 2. Period metrics
    const periodReservations = allReservations.filter(r => {
      const rDate = r.start_at.slice(0, 10);
      return rDate >= startDate && rDate <= endDate;
    });

    const periodReservationsCount = periodReservations.length;
    const periodValidReservations = periodReservations.filter(r => r.status !== 'CANCELLED');
    const periodValidReservationsCount = periodValidReservations.length;
    const periodRevenue = periodValidReservations.reduce((sum, r) => sum + (r.amount || 0), 0);
    const periodAverageTicket = periodValidReservationsCount > 0
      ? Number((periodRevenue / periodValidReservationsCount).toFixed(2))
      : 0;

    // New customers in period
    const periodNewCustomersCount = allCustomers.filter(c => {
      const cDate = c.created_at.slice(0, 10);
      return cDate >= startDate && cDate <= endDate;
    }).length;

    // Recurring customers (customers with >= 2 valid reservations overall in this arena)
    const customerReservationCountMap = new Map<string, number>();
    allReservations.forEach(r => {
      if (r.status !== 'CANCELLED') {
        customerReservationCountMap.set(r.customer_id, (customerReservationCountMap.get(r.customer_id) || 0) + 1);
      }
    });

    let periodRecurringCustomersCount = 0;
    customerReservationCountMap.forEach((count) => {
      if (count >= 2) periodRecurringCustomersCount++;
    });

    // 3. Generate Day-by-Day sequence
    const datesList: string[] = [];
    const currD = new Date(startDate + 'T12:00:00Z');
    const endD = new Date(endDate + 'T12:00:00Z');

    while (currD <= endD) {
      datesList.push(currD.toISOString().split('T')[0]);
      currD.setDate(currD.getDate() + 1);
    }

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const dailyOccupancy: DayOccupancyData[] = [];
    const dailyRevenue: DayRevenueData[] = [];
    let totalPeriodReservedHours = 0;
    let totalPeriodAvailableHours = 0;

    for (const dateItem of datesList) {
      const dateObj = new Date(dateItem + 'T12:00:00Z');
      const dayOfWeek = dayNames[dateObj.getUTCDay()];
      const dayParts = dateItem.split('-');
      const label = `${dayOfWeek}, ${dayParts[2]}/${dayParts[1]}`;

      const dayReservations = allReservations.filter(r => r.start_at.slice(0, 10) === dateItem && r.status !== 'CANCELLED');
      const dayRevenue = dayReservations.reduce((sum, r) => sum + (r.amount || 0), 0);

      const dayReservedHours = dayReservations.reduce((sum, r) => {
        const s = new Date(r.start_at).getTime();
        const e = new Date(r.end_at).getTime();
        return sum + Math.max(0, (e - s) / 3600000);
      }, 0);

      const dayBlocks = allBlocks.filter(b => b.start_at.slice(0, 10) === dateItem);
      const dayBlockedHours = dayBlocks.reduce((sum, b) => {
        const s = new Date(b.start_at).getTime();
        const e = new Date(b.end_at).getTime();
        return sum + Math.max(0, (e - s) / 3600000);
      }, 0);

      const dayAvailableHours = Math.max(1, (activeCourts.length * dailyOperatingHours) - dayBlockedHours);
      const dayOccupancyPercent = activeCourts.length === 0
        ? 0
        : Math.min(100, Math.round((dayReservedHours / dayAvailableHours) * 100));

      totalPeriodReservedHours += dayReservedHours;
      totalPeriodAvailableHours += dayAvailableHours;

      dailyOccupancy.push({
        date: dateItem,
        label,
        dayOfWeek,
        occupancyPercent: dayOccupancyPercent,
        reservedHours: dayReservedHours,
        availableHours: dayAvailableHours,
      });

      dailyRevenue.push({
        date: dateItem,
        label,
        dayOfWeek,
        revenue: dayRevenue,
        reservationsCount: dayReservations.length,
      });
    }

    const periodAverageOccupancy = totalPeriodAvailableHours > 0
      ? Math.min(100, Math.round((totalPeriodReservedHours / totalPeriodAvailableHours) * 100))
      : 0;

    // 4. Court Utilization Ranking
    const daysCount = Math.max(1, datesList.length);
    const courtUtilization: CourtUtilizationData[] = activeCourts.map(court => {
      const courtRes = periodValidReservations.filter(r => r.court_id === court.id);
      const courtReservedHours = courtRes.reduce((sum, r) => {
        const s = new Date(r.start_at).getTime();
        const e = new Date(r.end_at).getTime();
        return sum + Math.max(0, (e - s) / 3600000);
      }, 0);

      const courtBlocks = allBlocks.filter(b => {
        const bDate = b.start_at.slice(0, 10);
        return b.court_id === court.id && bDate >= startDate && bDate <= endDate;
      });

      const courtBlockedHours = courtBlocks.reduce((sum, b) => {
        const s = new Date(b.start_at).getTime();
        const e = new Date(b.end_at).getTime();
        return sum + Math.max(0, (e - s) / 3600000);
      }, 0);

      const courtOperatingHours = Math.max(1, (daysCount * dailyOperatingHours) - courtBlockedHours);
      const utilizationRate = Math.min(100, Math.round((courtReservedHours / courtOperatingHours) * 100));

      return {
        courtId: court.id,
        courtName: court.name,
        modalityName: court.modality?.name,
        utilizationRate,
        reservedHours: courtReservedHours,
        operatingHours: courtOperatingHours,
      };
    }).sort((a, b) => b.utilizationRate - a.utilizationRate);

    // 5. Peak Hours of High Demand
    const hourCounts: { [hour: string]: number } = {};
    for (let h = openingHour; h < (closingHour === 0 ? 24 : closingHour); h++) {
      const hourStr = h < 10 ? `0${h}:00` : `${h}:00`;
      hourCounts[hourStr] = 0;
    }

    periodValidReservations.forEach(r => {
      const startD = new Date(r.start_at);
      const hour = startD.getUTCHours();
      const hourStr = hour < 10 ? `0${hour}:00` : `${hour}:00`;
      if (hourCounts[hourStr] !== undefined) {
        hourCounts[hourStr]++;
      } else {
        hourCounts[hourStr] = (hourCounts[hourStr] || 0) + 1;
      }
    });

    const maxCount = Math.max(1, ...Object.values(hourCounts));
    const peakHours: PeakHourData[] = Object.entries(hourCounts)
      .map(([hour, count]) => ({
        hour,
        count,
        percentage: Math.round((count / maxCount) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // 6. Chronological Today's Reservations
    const todayReservationsList = [...todayReservations].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    return {
      period,
      startDate,
      endDate,
      todayReservationsCount,
      todayRevenue,
      todayOccupancyPercent,
      todayCancellationsCount,
      periodReservationsCount,
      periodValidReservationsCount,
      periodRevenue,
      periodAverageTicket,
      periodNewCustomersCount,
      periodRecurringCustomersCount,
      periodAverageOccupancy,
      dailyOccupancy,
      dailyRevenue,
      courtUtilization,
      peakHours,
      todayReservationsList,
    };
  },

  // 12. CUSTOMERS WITH INTELLIGENT METRICS
  async getCustomersWithMetrics(arenaId: string): Promise<CustomerWithMetrics[]> {
    const [customers, reservations] = await Promise.all([
      this.getCustomers(arenaId),
      this.getReservations(arenaId),
    ]);

    const now = Date.now();

    return customers.map(customer => {
      const custRes = reservations.filter(r => r.customer_id === customer.id);
      const validRes = custRes.filter(r => r.status !== 'CANCELLED');
      const completedRes = custRes.filter(r => r.status === 'COMPLETED');
      const confirmedRes = custRes.filter(r => r.status === 'CONFIRMED');
      const pendingRes = custRes.filter(r => r.status === 'PENDING');
      const cancelledRes = custRes.filter(r => r.status === 'CANCELLED');
      const noShowRes = custRes.filter(r => r.status === 'NO_SHOW');

      const totalSpent = validRes.reduce((sum, r) => sum + (r.amount || 0), 0);

      // Sort reservations by start_at descending for last reservation
      const sortedDesc = [...custRes].sort(
        (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
      );

      const lastRes = sortedDesc[0] || null;
      const lastReservationDate = lastRes ? lastRes.start_at : null;

      // Next reservation in the future
      const futureRes = custRes
        .filter(r => new Date(r.start_at).getTime() >= now && r.status !== 'CANCELLED')
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
      const nextReservationDate = futureRes[0] ? futureRes[0].start_at : null;

      let daysSinceLastReservation: number | null = null;
      if (lastReservationDate) {
        const diffMs = now - new Date(lastReservationDate).getTime();
        daysSinceLastReservation = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }

      // Active rule: At least 1 valid reservation in last 30 days
      const hasValidResIn30Days = validRes.some(r => {
        const diffDays = (now - new Date(r.start_at).getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 30;
      });

      const isActive = hasValidResIn30Days;
      
      // Inactive rule: No reservation in > 30 days
      const isInactive = !hasValidResIn30Days;

      // Recurrent rule: >= 2 valid reservations
      const isRecurring = validRes.length >= 2;

      return {
        ...customer,
        totalReservations: custRes.length,
        completedReservations: completedRes.length,
        confirmedReservations: confirmedRes.length,
        pendingReservations: pendingRes.length,
        cancelledReservations: cancelledRes.length,
        noShowReservations: noShowRes.length,
        totalSpent,
        lastReservationDate,
        nextReservationDate,
        daysSinceLastReservation,
        isActive,
        isInactive,
        isRecurring,
        reservations: sortedDesc,
      };
    });
  },

  async getCustomerDetails(arenaId: string, customerId: string): Promise<CustomerWithMetrics | null> {
    const list = await this.getCustomersWithMetrics(arenaId);
    return list.find(c => c.id === customerId) || null;
  },

  // 12. SERVICES CATALOG (Aulas, Clínicas, Locação de Raquetes, etc.)
  async getServices(arenaId: string): Promise<Service[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('arena_id', arenaId)
        .order('name');
      if (error) throw error;
      return data || [];
    }
    return sandboxDB.getServices(arenaId);
  },

  async createService(
    service: Omit<Service, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Service> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('services')
        .insert([{
          ...service,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return sandboxDB.createService(service);
  },

  async updateService(id: string, updates: Partial<Service>): Promise<Service> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('services')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return sandboxDB.updateService(id, updates);
  },

  async deleteService(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    sandboxDB.deleteService(id);
  },

  // 13. FINANCIAL MANAGEMENT & REAL CASHFLOW
  async getFinancialTransactions(
    arenaId: string,
    filter?: {
      startDate?: string;
      endDate?: string;
      type?: FinancialTransactionType;
      status?: FinancialTransactionStatus;
      category?: string;
      paymentMethod?: PaymentMethod;
      search?: string;
    }
  ): Promise<FinancialTransaction[]> {
    let list: FinancialTransaction[] = [];
    if (isSupabaseConfigured) {
      let query = supabase
        .from('financial_transactions')
        .select('*, reservation:reservations(*), customer:customers(*), service:services(*), created_by_profile:profiles!created_by(*)')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (arenaId) {
        query = query.eq('arena_id', arenaId);
      }
      if (filter?.startDate) query = query.gte('transaction_date', filter.startDate);
      if (filter?.endDate) query = query.lte('transaction_date', filter.endDate);
      if (filter?.type) query = query.eq('type', filter.type);
      if (filter?.status) query = query.eq('status', filter.status);
      if (filter?.category) query = query.eq('category', filter.category);
      if (filter?.paymentMethod) query = query.eq('payment_method', filter.paymentMethod);

      const { data, error } = await query;
      if (error) throw error;
      list = data || [];
    } else {
      list = sandboxDB.getFinancialTransactions(arenaId || undefined);
    }

    if (arenaId) {
      list = list.filter(t => t.arena_id === arenaId);
    }
    if (filter?.startDate) {
      list = list.filter(t => t.transaction_date >= filter.startDate!);
    }
    if (filter?.endDate) {
      list = list.filter(t => t.transaction_date <= filter.endDate!);
    }
    if (filter?.type) {
      list = list.filter(t => t.type === filter.type);
    }
    if (filter?.status) {
      list = list.filter(t => t.status === filter.status);
    }
    if (filter?.category) {
      list = list.filter(t => t.category === filter.category);
    }
    if (filter?.paymentMethod) {
      list = list.filter(t => t.payment_method === filter.paymentMethod);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(t => 
        t.description.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.customer?.full_name && t.customer.full_name.toLowerCase().includes(q))
      );
    }

    // Sort by date descending then created_at descending
    return list.sort((a, b) => {
      const diffDate = new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
      if (diffDate !== 0) return diffDate;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  },

  async createFinancialTransaction(
    tx: Omit<FinancialTransaction, 'id' | 'created_at' | 'updated_at' | 'reservation' | 'customer' | 'service' | 'created_by_profile'>
  ): Promise<FinancialTransaction> {
    if (tx.amount <= 0) {
      throw new Error('O valor da transação deve ser maior que zero.');
    }
    const cleanAmount = Math.round(Number(tx.amount) * 100) / 100;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('financial_transactions')
        .insert([{
          ...tx,
          amount: cleanAmount,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select('*, reservation:reservations(*), customer:customers(*), service:services(*)')
        .single();
      if (error) throw error;
      return data;
    }

    return sandboxDB.createFinancialTransaction({
      ...tx,
      amount: cleanAmount,
    });
  },

  async updateFinancialTransaction(
    id: string,
    updates: Partial<FinancialTransaction>
  ): Promise<FinancialTransaction> {
    if (updates.amount !== undefined) {
      updates.amount = Math.round(Number(updates.amount) * 100) / 100;
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('financial_transactions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*, reservation:reservations(*), customer:customers(*), service:services(*)')
        .single();
      if (error) throw error;
      return data;
    }

    return sandboxDB.updateFinancialTransaction(id, updates);
  },

  async voidFinancialTransaction(id: string, reason?: string): Promise<FinancialTransaction> {
    const noteAppend = reason ? ` [Estornado/Anulado: ${reason}]` : ' [Estornado/Anulado]';
    const txList = await this.getFinancialTransactions('');
    const tx = txList.find(t => t.id === id);
    const existingNotes = tx?.notes || '';

    return this.updateFinancialTransaction(id, {
      status: 'VOID',
      notes: `${existingNotes}${noteAppend}`.trim(),
    });
  },

  async getReservationPayments(reservationId: string): Promise<FinancialTransaction[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    const allTx = sandboxDB.getFinancialTransactions();
    return allTx.filter(t => t.reservation_id === reservationId);
  },

  async registerReservationPayment(params: {
    reservationId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    transactionDate?: string;
    notes?: string;
    createdBy?: string;
  }): Promise<{ transaction: FinancialTransaction; reservation: Reservation }> {
    if (params.amount <= 0) {
      throw new Error('O valor do pagamento deve ser superior a R$ 0,00.');
    }

    const cleanPaymentAmount = Math.round(Number(params.amount) * 100) / 100;
    const allReservations = await this.getReservations('');
    const reservation = allReservations.find(r => r.id === params.reservationId);
    if (!reservation) {
      throw new Error('Reserva não encontrada para registrar pagamento.');
    }

    // Get previous completed payments for this reservation
    const prevPayments = await this.getReservationPayments(params.reservationId);
    const settledPayments = prevPayments.filter(p => p.status === 'COMPLETED' && p.type === 'INCOME');
    const totalPaidBefore = settledPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalPaidAfter = Math.round((totalPaidBefore + cleanPaymentAmount) * 100) / 100;

    const reservationPrice = Math.round(reservation.amount * 100) / 100;
    const newPaymentStatus = totalPaidAfter >= reservationPrice ? 'PAID' : 'PARTIAL';

    const txDate = params.transactionDate || new Date().toISOString().split('T')[0];

    // 1. Create financial transaction
    const customerName = reservation.customer?.full_name || 'Cliente';
    const courtName = reservation.court?.name || 'Quadra';
    const transaction = await this.createFinancialTransaction({
      arena_id: reservation.arena_id,
      type: 'INCOME',
      category: 'RESERVATION',
      description: `Pagamento Reserva - ${customerName} (${courtName})`,
      amount: cleanPaymentAmount,
      payment_method: params.paymentMethod,
      transaction_date: txDate,
      reservation_id: reservation.id,
      customer_id: reservation.customer_id,
      status: 'COMPLETED',
      notes: params.notes || `Pagamento ${newPaymentStatus === 'PAID' ? 'Total' : 'Parcial'} (${params.paymentMethod})`,
      created_by: params.createdBy || 'u-admin-xp',
    });

    // 2. Update reservation status & payment method
    const updatedReservation = await this.updateReservation(reservation.id, {
      payment_status: newPaymentStatus,
      payment_method: params.paymentMethod,
    });

    return { transaction, reservation: updatedReservation };
  },

  async getPendingReservations(arenaId: string): Promise<PendingReservationItem[]> {
    const [reservations, transactions] = await Promise.all([
      this.getReservations(arenaId),
      this.getFinancialTransactions(arenaId),
    ]);

    const activeReservations = reservations.filter(r => r.status !== 'CANCELLED');
    const pendingItems: PendingReservationItem[] = [];

    for (const res of activeReservations) {
      const resTransactions = transactions.filter(
        t => t.reservation_id === res.id && t.status === 'COMPLETED' && t.type === 'INCOME'
      );
      const totalPaid = Math.round(resTransactions.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
      const resAmount = Math.round((res.amount || 0) * 100) / 100;
      const pendingAmount = Math.max(0, Math.round((resAmount - totalPaid) * 100) / 100);

      if (pendingAmount > 0 || res.payment_status === 'PENDING' || res.payment_status === 'PARTIAL') {
        pendingItems.push({
          reservation: res,
          totalAmount: resAmount,
          paidAmount: totalPaid,
          pendingAmount,
          paymentStatus: res.payment_status,
        });
      }
    }

    return pendingItems.sort((a, b) => new Date(b.reservation.start_at).getTime() - new Date(a.reservation.start_at).getTime());
  },

  async getFinancialSummary(
    arenaId: string,
    period: PeriodFilter = 'MONTH',
    customStart?: string,
    customEnd?: string
  ): Promise<FinancialSummary> {
    const { startDate, endDate } = this.calculateDateRange(period, customStart, customEnd);

    const [allTransactions, allReservations] = await Promise.all([
      this.getFinancialTransactions(arenaId),
      this.getReservations(arenaId),
    ]);

    // Filter transactions in date range
    const periodTransactions = allTransactions.filter(
      t => t.transaction_date >= startDate && t.transaction_date <= endDate
    );

    // Valid completed income transactions
    const validCompletedIncome = periodTransactions.filter(
      t => t.type === 'INCOME' && t.status === 'COMPLETED'
    );

    // Valid completed expense transactions
    const validCompletedExpenses = periodTransactions.filter(
      t => t.type === 'EXPENSE' && t.status === 'COMPLETED'
    );

    // Recebido = Soma de transações de entrada COMPLETED no período
    const recebido = Math.round(
      validCompletedIncome.reduce((sum, t) => sum + (t.amount || 0), 0) * 100
    ) / 100;

    // Despesas = Soma de transações de saída COMPLETED no período
    const despesas = Math.round(
      validCompletedExpenses.reduce((sum, t) => sum + (t.amount || 0), 0) * 100
    ) / 100;

    // Faturamento = Soma do valor de todas as reservas válidas não-canceladas da arena no período + receitas avulsas não vinculadas a reservas
    const validReservationsInPeriod = allReservations.filter(r => {
      const rDate = r.start_at.split('T')[0];
      return rDate >= startDate && rDate <= endDate && r.status !== 'CANCELLED';
    });

    const faturamentoReservas = Math.round(
      validReservationsInPeriod.reduce((sum, r) => sum + (r.amount || 0), 0) * 100
    ) / 100;

    const nonReservationIncome = validCompletedIncome.filter(t => !t.reservation_id);
    const outrasReceitas = Math.round(
      nonReservationIncome.reduce((sum, t) => sum + (t.amount || 0), 0) * 100
    ) / 100;

    const faturamento = Math.round((faturamentoReservas + outrasReceitas) * 100) / 100;

    // Pendente = Faturamento - Recebido (não negativo)
    const pendente = Math.max(0, Math.round((faturamento - recebido) * 100) / 100);

    // Saldo = Recebido - Despesas
    const saldo = Math.round((recebido - despesas) * 100) / 100;

    // Sub-breakdowns
    const servicosFaturamento = Math.round(
      validCompletedIncome.filter(t => t.category === 'SERVICE').reduce((sum, t) => sum + t.amount, 0) * 100
    ) / 100;

    // Generate daily financial series
    const dailyMap: Record<string, { income: number; expense: number }> = {};
    const curr = new Date(startDate + 'T12:00:00.000Z');
    const end = new Date(endDate + 'T12:00:00.000Z');

    while (curr <= end) {
      const iso = curr.toISOString().split('T')[0];
      dailyMap[iso] = { income: 0, expense: 0 };
      curr.setDate(curr.getDate() + 1);
    }

    for (const t of validCompletedIncome) {
      if (dailyMap[t.transaction_date]) {
        dailyMap[t.transaction_date].income += t.amount;
      }
    }
    for (const t of validCompletedExpenses) {
      if (dailyMap[t.transaction_date]) {
        dailyMap[t.transaction_date].expense += t.amount;
      }
    }

    const daysShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dailyFinancial: DayFinancialData[] = Object.keys(dailyMap).sort().map(d => {
      const dt = new Date(d + 'T12:00:00.000Z');
      const dayNum = dt.getDate();
      const monthNum = dt.getMonth() + 1;
      const dayOfWeek = daysShort[dt.getDay()];
      const inc = Math.round(dailyMap[d].income * 100) / 100;
      const exp = Math.round(dailyMap[d].expense * 100) / 100;
      return {
        date: d,
        label: `${dayOfWeek}, ${dayNum < 10 ? '0' + dayNum : dayNum}/${monthNum < 10 ? '0' + monthNum : monthNum}`,
        dayOfWeek,
        income: inc,
        expense: exp,
        net: Math.round((inc - exp) * 100) / 100,
      };
    });

    // Income categories breakdown
    const incomeCatMap: Record<string, { amount: number; count: number }> = {};
    for (const t of validCompletedIncome) {
      if (!incomeCatMap[t.category]) {
        incomeCatMap[t.category] = { amount: 0, count: 0 };
      }
      incomeCatMap[t.category].amount += t.amount;
      incomeCatMap[t.category].count += 1;
    }

    const categoryLabels: Record<string, string> = {
      RESERVATION: 'Locação de Quadras',
      SERVICE: 'Aulas / Clínicas',
      BAR: 'Bar & Lanchonete',
      ENERGY: 'Energia Elétrica',
      WATER: 'Água & Gelo',
      MAINTENANCE: 'Manutenção / Areia',
      EQUIPMENT: 'Equipamentos & Redes',
      STAFF: 'Equipe / Folha',
      RENT: 'Aluguel do Espaço',
      MARKETING: 'Marketing & Divulgação',
      TAX: 'Impostos & Taxas',
      OTHER: 'Outros / Diversos',
    };

    const incomeCategories: CategoryBreakdown[] = Object.keys(incomeCatMap).map(cat => {
      const amt = Math.round(incomeCatMap[cat].amount * 100) / 100;
      return {
        category: cat,
        label: categoryLabels[cat] || cat,
        amount: amt,
        count: incomeCatMap[cat].count,
        type: 'INCOME' as const,
        percentage: recebido > 0 ? Math.round((amt / recebido) * 1000) / 10 : 0,
      };
    }).sort((a, b) => b.amount - a.amount);

    // Expense categories breakdown
    const expenseCatMap: Record<string, { amount: number; count: number }> = {};
    for (const t of validCompletedExpenses) {
      if (!expenseCatMap[t.category]) {
        expenseCatMap[t.category] = { amount: 0, count: 0 };
      }
      expenseCatMap[t.category].amount += t.amount;
      expenseCatMap[t.category].count += 1;
    }

    const expenseCategories: CategoryBreakdown[] = Object.keys(expenseCatMap).map(cat => {
      const amt = Math.round(expenseCatMap[cat].amount * 100) / 100;
      return {
        category: cat,
        label: categoryLabels[cat] || cat,
        amount: amt,
        count: expenseCatMap[cat].count,
        type: 'EXPENSE' as const,
        percentage: despesas > 0 ? Math.round((amt / despesas) * 1000) / 10 : 0,
      };
    }).sort((a, b) => b.amount - a.amount);

    // Pending count
    const pendingReservations = await this.getPendingReservations(arenaId);

    return {
      period,
      startDate,
      endDate,
      faturamento,
      recebido,
      pendente,
      despesas,
      saldo,
      reservasFaturamento: faturamentoReservas,
      servicosFaturamento,
      outrasReceitasFaturamento: outrasReceitas,
      pendingReservationsCount: pendingReservations.length,
      paidTransactionsCount: validCompletedIncome.length,
      expenseTransactionsCount: validCompletedExpenses.length,
      dailyFinancial,
      incomeCategories,
      expenseCategories,
      recentTransactions: periodTransactions.slice(0, 10),
    };
  }
};
