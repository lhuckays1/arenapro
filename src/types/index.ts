export type UserRole = 'SUPER_ADMIN' | 'ARENA_ADMIN' | 'ARENA_STAFF' | 'CLIENT';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED';

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'BANK_TRANSFER' | 'OTHER';

export type FinancialTransactionType = 'INCOME' | 'EXPENSE';

export type FinancialTransactionStatus = 'COMPLETED' | 'PENDING' | 'CANCELLED' | 'VOID';

export type EntityStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

export interface Arena {
  id: string;
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
  logo_url?: string | null;
  timezone: string;
  opening_time: string; // e.g. "06:00"
  closing_time: string; // e.g. "23:00"
  cancellation_limit_hours: number; // e.g. 2
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string; // references auth.users id
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}


export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

export interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  monthly_price: number;
  max_courts?: number | null;
  max_staff_users?: number | null;
  features: Record<string, unknown>;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface ArenaSubscription {
  id: string;
  arena_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  monthly_price: number;
  current_period_start?: string | null;
  current_period_end?: string | null;
  paid_at?: string | null;
  external_customer_id?: string | null;
  external_subscription_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan;
}

export interface ArenaUser {
  id: string;
  arena_id: string;
  user_id: string;
  role: UserRole;
  status: EntityStatus;
  created_at: string;
  arena?: Arena;
  profile?: Profile;
}

export interface Modality {
  id: string;
  arena_id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface Court {
  id: string;
  arena_id: string;
  modality_id: string;
  name: string;
  description?: string | null;
  capacity?: number;
  price: number; // standard hourly rate in BRL
  status: EntityStatus;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  modality?: Modality;
}

export interface Customer {
  id: string;
  arena_id: string;
  user_id?: string | null;
  full_name: string;
  phone: string;
  email?: string | null;
  birth_date?: string | null;
  notes?: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  arena_id: string;
  name: string;
  description?: string | null;
  price: number;
  duration_minutes: number;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  arena_id: string;
  court_id: string;
  customer_id: string;
  start_at: string; // ISO String (UTC / local format)
  end_at: string;   // ISO String (UTC / local format)
  status: ReservationStatus;
  amount: number;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  court?: Court;
  customer?: Customer;
}

export interface CourtBlock {
  id: string;
  arena_id: string;
  court_id: string;
  start_at: string; // ISO String (UTC / local format)
  end_at: string;   // ISO String (UTC / local format)
  reason: string;   // Reason for block e.g. "Manutenção", "Chuva", "Evento Corporativo"
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  court?: Court;
}

export interface DashboardMetrics {
  todayReservations: number;
  todayRevenue: number;
  todayCancellations: number;
  todayOccupancyRate: number;
  totalCustomers: number;
  newCustomers: number;
  activeCustomers: number;
  confirmedReservations: number;
  pendingReservations: number;
  cancelledReservations: number;
  revenueDay: number;
  revenueWeek: number;
  revenueMonth: number;
}

export type PeriodFilter = 'TODAY' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL' | '7_DAYS' | '30_DAYS' | 'CUSTOM';

export type FinancialTransactionCategory = 
  | 'RESERVATION' 
  | 'SERVICE' 
  | 'BAR' 
  | 'ENERGY' 
  | 'WATER' 
  | 'MAINTENANCE' 
  | 'EQUIPMENT' 
  | 'STAFF' 
  | 'RENT' 
  | 'MARKETING' 
  | 'TAX' 
  | 'OTHER';

export interface DayOccupancyData {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Seg, 24/08"
  dayOfWeek: string; // e.g. "Seg"
  occupancyPercent: number;
  reservedHours: number;
  availableHours: number;
}

export interface DayRevenueData {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Seg, 24/08"
  dayOfWeek: string; // e.g. "Seg"
  revenue: number;
  reservationsCount: number;
}

export interface CourtUtilizationData {
  courtId: string;
  courtName: string;
  modalityName?: string;
  utilizationRate: number;
  reservedHours: number;
  operatingHours: number;
}

export interface PeakHourData {
  hour: string; // e.g. "19:00"
  count: number;
  percentage: number;
}

export interface DashboardAnalytics {
  period: PeriodFilter;
  startDate: string;
  endDate: string;
  
  // Today's Operational KPIs
  todayReservationsCount: number;
  todayRevenue: number;
  todayOccupancyPercent: number;
  todayCancellationsCount: number;
  
  // Period Aggregates
  periodReservationsCount: number;
  periodValidReservationsCount: number;
  periodRevenue: number;
  periodAverageTicket: number;
  periodNewCustomersCount: number;
  periodRecurringCustomersCount: number;
  periodAverageOccupancy: number;
  
  // Charts & Breakdowns
  dailyOccupancy: DayOccupancyData[];
  dailyRevenue: DayRevenueData[];
  courtUtilization: CourtUtilizationData[];
  peakHours: PeakHourData[];
  todayReservationsList: Reservation[];
}

export interface CustomerWithMetrics extends Customer {
  totalReservations: number;
  completedReservations: number;
  confirmedReservations: number;
  pendingReservations: number;
  cancelledReservations: number;
  noShowReservations: number;
  totalSpent: number;
  lastReservationDate?: string | null;
  nextReservationDate?: string | null;
  daysSinceLastReservation?: number | null;
  isActive: boolean; // At least 1 valid reservation in last 30 days
  isInactive: boolean; // No reservation in > 30 days
  isRecurring: boolean; // >= 2 valid reservations
  reservations: Reservation[];
}

export interface FinancialTransaction {
  id: string;
  arena_id: string;
  type: FinancialTransactionType;
  category: string; // e.g. "RESERVATION", "SERVICE", "BAR", "ENERGY", "RENT", "MAINTENANCE", etc.
  description: string;
  amount: number; // Stored as standard precision number with 2 decimals
  payment_method: PaymentMethod;
  transaction_date: string; // YYYY-MM-DD
  reservation_id?: string | null;
  customer_id?: string | null;
  service_id?: string | null;
  status: FinancialTransactionStatus;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  reservation?: Reservation;
  customer?: Customer;
  service?: Service;
  created_by_profile?: Profile;
}

export interface DayFinancialData {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Seg, 24/08"
  dayOfWeek: string; // e.g. "Seg"
  income: number;
  expense: number;
  net: number;
}

export interface CategoryBreakdown {
  category: string;
  label: string;
  amount: number;
  count: number;
  type: FinancialTransactionType;
  percentage: number;
}

export interface FinancialSummary {
  period: PeriodFilter;
  startDate: string;
  endDate: string;
  
  // Core Indicators
  faturamento: number; // Total valid revenues (reservations + services + manual income)
  recebido: number;    // Total settled/received cashflow (COMPLETED income transactions)
  pendente: number;    // Faturamento - Recebido (outstanding receivables)
  despesas: number;    // Total valid operational expenses (COMPLETED expense transactions)
  saldo: number;       // Recebido - Despesas (net cash balance)

  // Sub-breakdowns
  reservasFaturamento: number;
  servicosFaturamento: number;
  outrasReceitasFaturamento: number;
  
  // Quantities & Counts
  pendingReservationsCount: number;
  paidTransactionsCount: number;
  expenseTransactionsCount: number;

  // Visual Series
  dailyFinancial: DayFinancialData[];
  incomeCategories: CategoryBreakdown[];
  expenseCategories: CategoryBreakdown[];
  recentTransactions: FinancialTransaction[];
}

export interface PendingReservationItem {
  reservation: Reservation;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: PaymentStatus;
}

