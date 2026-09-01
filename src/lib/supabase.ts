import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Arena, Court, Customer, Modality, Profile, Reservation, Service, UserRole, ArenaUser, CourtBlock, FinancialTransaction } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Environment mode detection
export const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
export const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('http') && 
  supabaseAnonKey.length > 20
);

// Real client (or fallback client to avoid crashes if keys not yet set)
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

// ==============================================================================
// LOCAL REPLICA ENGINE / SANDBOX REPOSITORY
// Keeps database state synchronized in localStorage for development/preview
// ==============================================================================

const STORAGE_PREFIX = 'arenapro_db_';

function getStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to persist to localStorage', e);
  }
}

// Initial Seed Data for Sandbox Demo
const INITIAL_ARENAS: Arena[] = [
  {
    id: 'a1b2c3d4-0000-0000-0000-000000000001',
    name: 'Arena XP Beach Sports',
    slug: 'arena-xp-beach',
    description: 'A melhor e mais completa arena de esportes de areia da região, com quadras cobertas e descobertas.',
    phone: '(11) 98765-4321',
    whatsapp: '(11) 98765-4321',
    email: 'contato@arenaxp.com.br',
    address: 'Av. das Palmeiras, 1500 - Itaim Bibi',
    city: 'São Paulo',
    state: 'SP',
    zip_code: '04578-000',
    logo_url: null,
    timezone: 'America/Sao_Paulo',
    opening_time: '06:00',
    closing_time: '23:00',
    cancellation_limit_hours: 2,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'a2b2c3d4-0000-0000-0000-000000000002',
    name: 'Prime Society Club',
    slug: 'prime-society-club',
    description: 'Campos de futebol society com grama sintética padrão FIFA e churrasqueiras integradas.',
    phone: '(11) 97654-3210',
    whatsapp: '(11) 97654-3210',
    email: 'reservas@primesociety.com.br',
    address: 'Rua do Esporte, 450 - Moema',
    city: 'São Paulo',
    state: 'SP',
    zip_code: '04077-020',
    logo_url: null,
    timezone: 'America/Sao_Paulo',
    opening_time: '07:00',
    closing_time: '00:00',
    cancellation_limit_hours: 4,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const INITIAL_MODALITIES: Modality[] = [
  {
    id: 'm1b2c3d4-0000-0000-0000-000000000001',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    name: 'Beach Tennis',
    description: 'Esporte dinâmico e divertido na areia.',
    icon: 'Sun',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'm1b2c3d4-0000-0000-0000-000000000002',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    name: 'Futevôlei',
    description: 'Tradição brasileira de controle de bola na areia.',
    icon: 'Volleyball',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'm1b2c3d4-0000-0000-0000-000000000003',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    name: 'Vôlei de Areia',
    description: 'Vôlei de praia 2x2 e 4x4 com rede regulamentar.',
    icon: 'Trophy',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'm1b2c3d4-0000-0000-0000-000000000004',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    name: 'Futebol Society',
    description: 'Campo de grama sintética com iluminação LED.',
    icon: 'Shield',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'm2b2c3d4-0000-0000-0000-000000000001',
    arena_id: 'a2b2c3d4-0000-0000-0000-000000000002',
    name: 'Futebol Society 7x7',
    description: 'Campos society com iluminação profissional.',
    icon: 'Shield',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const INITIAL_COURTS: Court[] = [
  {
    id: 'c1b2c3d4-0000-0000-0000-000000000001',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    modality_id: 'm1b2c3d4-0000-0000-0000-000000000001',
    name: 'Quadra 01 - Areia Central (Coberta)',
    description: 'Quadra oficial com areia tratada e iluminação LED profissional.',
    capacity: 4,
    price: 90.0,
    status: 'ACTIVE',
    image_url: 'https://images.unsplash.com/photo-1543351611-58f69d7c1781?w=800&q=80',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c1b2c3d4-0000-0000-0000-000000000002',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    modality_id: 'm1b2c3d4-0000-0000-0000-000000000001',
    name: 'Quadra 02 - Areia Sunset',
    description: 'Quadra aberta ideal para jogos ao entardecer.',
    capacity: 4,
    price: 80.0,
    status: 'ACTIVE',
    image_url: 'https://images.unsplash.com/photo-1628891435222-065925dcb365?w=800&q=80',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c1b2c3d4-0000-0000-0000-000000000003',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    name: 'Quadra 03 - Futevôlei Prime',
    modality_id: 'm1b2c3d4-0000-0000-0000-000000000002',
    description: 'Área com rede oficial e duchas laterais exclusivas.',
    capacity: 4,
    price: 80.0,
    status: 'ACTIVE',
    image_url: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&q=80',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c1b2c3d4-0000-0000-0000-000000000004',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    modality_id: 'm1b2c3d4-0000-0000-0000-000000000004',
    name: 'Campo 01 - Society 7x7',
    description: 'Grama sintética monofilamento padrão FIFA com vestiário anexo.',
    capacity: 14,
    price: 240.0,
    status: 'ACTIVE',
    image_url: 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'c2b2c3d4-0000-0000-0000-000000000001',
    arena_id: 'a2b2c3d4-0000-0000-0000-000000000002',
    modality_id: 'm2b2c3d4-0000-0000-0000-000000000001',
    name: 'Arena Prime - Campo Principal A',
    description: 'Grama sintética alemã 50mm e placar eletrônico.',
    capacity: 14,
    price: 260.0,
    status: 'ACTIVE',
    image_url: 'https://images.unsplash.com/photo-1529900240041-52c3c6f89025?w=800&q=80',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const INITIAL_PROFILES: Profile[] = [
  {
    id: 'u-superadmin',
    full_name: 'Lucas Silva (Super Admin)',
    phone: '(11) 99999-0001',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80',
    role: 'SUPER_ADMIN',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'u-admin-xp',
    full_name: 'Rodrigo Gestor',
    phone: '(11) 98888-0002',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80',
    role: 'ARENA_ADMIN',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'u-staff-xp',
    full_name: 'Carlos Atendente',
    phone: '(11) 97777-0003',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80',
    role: 'ARENA_STAFF',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'u-client-1',
    full_name: 'Mariana Costa',
    phone: '(11) 96666-0004',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80',
    role: 'CLIENT',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    user_id: 'u-client-1',
    full_name: 'Mariana Costa',
    phone: '(11) 96666-0004',
    email: 'mariana.costa@exemplo.com',
    birth_date: '1995-04-12',
    notes: 'Cliente frequente de Beach Tennis nas terças e quintas.',
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-2',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    user_id: null,
    full_name: 'Bruno Henrique Alcantara',
    phone: '(11) 95555-0005',
    email: 'bruno.alcantara@exemplo.com',
    birth_date: '1989-11-23',
    notes: 'Organizador da turma de Futevôlei aos sábados.',
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-3',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    user_id: null,
    full_name: 'Time Galáticos FC',
    phone: '(11) 94444-0006',
    email: 'galaticos@exemplo.com',
    birth_date: null,
    notes: 'Mensalista de Society quarta-feira 20h.',
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-4',
    arena_id: 'a2b2c3d4-0000-0000-0000-000000000002',
    user_id: null,
    full_name: 'Renato Prime',
    phone: '(11) 93333-0007',
    email: 'renato@prime.com',
    birth_date: '1985-02-10',
    notes: 'Cliente exclusivo da Prime Society.',
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-5',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    user_id: null,
    full_name: 'Lucas Antigo (Inativo)',
    phone: '(11) 92222-0008',
    email: 'lucas.antigo@exemplo.com',
    birth_date: '1992-06-15',
    notes: 'Atleta que jogava Beach Tennis há mais de um mês.',
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-6',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    user_id: null,
    full_name: 'Camila Nova (Recém Cadastrada)',
    phone: '(11) 91111-0009',
    email: 'camila.nova@exemplo.com',
    birth_date: '1998-03-20',
    notes: 'Novo cadastro realizado esta semana.',
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const INITIAL_SERVICES: Service[] = [
  {
    id: 'srv-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    name: 'Aluguel Raquete Beach Tennis (Profissional)',
    description: 'Raquete carbono 3K acompanha capa protetora.',
    price: 20.0,
    duration_minutes: 60,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'srv-2',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    name: 'Kit Bolinhas Oficial (Tubo c/ 3)',
    description: 'Tubo de bolas homologadas ITF.',
    price: 15.0,
    duration_minutes: 60,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'srv-3',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    name: 'Uso de Churrasqueira Gourmet',
    description: 'Área com grelha, freezer e mesas privativas.',
    price: 150.0,
    duration_minutes: 240,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

// Helper to format ISO date strings relative to today
const getDateDaysAgo = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const todayStr = getDateDaysAgo(0);
const d1Ago = getDateDaysAgo(1);
const d2Ago = getDateDaysAgo(2);
const d3Ago = getDateDaysAgo(3);
const d4Ago = getDateDaysAgo(4);
const d5Ago = getDateDaysAgo(5);
const d6Ago = getDateDaysAgo(6);
const d35Ago = getDateDaysAgo(35);

const INITIAL_RESERVATIONS: Reservation[] = [
  // --- TODAY RESERVATIONS (Arena XP) ---
  {
    id: 'res-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000001',
    customer_id: 'cust-1',
    start_at: `${todayStr}T18:00:00.000Z`,
    end_at: `${todayStr}T19:00:00.000Z`,
    status: 'CONFIRMED',
    amount: 90.0,
    payment_status: 'PAID',
    payment_method: 'PIX',
    notes: 'Reserva confirmada via app.',
    created_by: 'u-client-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'res-2',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000001',
    customer_id: 'cust-2',
    start_at: `${todayStr}T20:00:00.000Z`,
    end_at: `${todayStr}T21:00:00.000Z`,
    status: 'CONFIRMED',
    amount: 90.0,
    payment_status: 'PENDING',
    payment_method: 'PIX',
    notes: 'Pagamento a acertar no balcão.',
    created_by: 'u-admin-xp',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'res-3',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000003',
    customer_id: 'cust-2',
    start_at: `${todayStr}T19:00:00.000Z`,
    end_at: `${todayStr}T20:00:00.000Z`,
    status: 'CONFIRMED',
    amount: 80.0,
    payment_status: 'PAID',
    payment_method: 'CREDIT_CARD',
    notes: 'Treino de futevôlei.',
    created_by: 'u-staff-xp',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'res-4',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000004',
    customer_id: 'cust-3',
    start_at: `${todayStr}T20:00:00.000Z`,
    end_at: `${todayStr}T21:00:00.000Z`,
    status: 'CONFIRMED',
    amount: 240.0,
    payment_status: 'PAID',
    payment_method: 'PIX',
    notes: 'Jogo da rodada Galáticos.',
    created_by: 'u-admin-xp',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'res-today-cancelled',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000002',
    customer_id: 'cust-6',
    start_at: `${todayStr}T15:00:00.000Z`,
    end_at: `${todayStr}T16:00:00.000Z`,
    status: 'CANCELLED',
    amount: 80.0,
    payment_status: 'REFUNDED',
    payment_method: 'PIX',
    notes: 'Cliente solicitou cancelamento devido à chuva.',
    created_by: 'u-admin-xp',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  // --- HISTORICAL 7 DAYS (Arena XP) ---
  {
    id: 'res-d1-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000001',
    customer_id: 'cust-1',
    start_at: `${d1Ago}T19:00:00.000Z`,
    end_at: `${d1Ago}T20:00:00.000Z`,
    status: 'COMPLETED',
    amount: 90.0,
    payment_status: 'PAID',
    payment_method: 'PIX',
    notes: 'Partida concluída.',
    created_by: 'u-client-1',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'res-d1-2',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000002',
    customer_id: 'cust-2',
    start_at: `${d1Ago}T18:00:00.000Z`,
    end_at: `${d1Ago}T19:00:00.000Z`,
    status: 'COMPLETED',
    amount: 80.0,
    payment_status: 'PAID',
    payment_method: 'CASH',
    notes: 'Partida realizada.',
    created_by: 'u-staff-xp',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'res-d2-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000004',
    customer_id: 'cust-3',
    start_at: `${d2Ago}T19:00:00.000Z`,
    end_at: `${d2Ago}T21:00:00.000Z`,
    status: 'COMPLETED',
    amount: 480.0,
    payment_status: 'PAID',
    payment_method: 'PIX',
    notes: '2 horas de society.',
    created_by: 'u-admin-xp',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'res-d3-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000001',
    customer_id: 'cust-1',
    start_at: `${d3Ago}T18:00:00.000Z`,
    end_at: `${d3Ago}T19:00:00.000Z`,
    status: 'COMPLETED',
    amount: 90.0,
    payment_status: 'PAID',
    payment_method: 'CREDIT_CARD',
    notes: 'Jogo normal.',
    created_by: 'u-client-1',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'res-d4-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000003',
    customer_id: 'cust-2',
    start_at: `${d4Ago}T19:00:00.000Z`,
    end_at: `${d4Ago}T20:00:00.000Z`,
    status: 'COMPLETED',
    amount: 80.0,
    payment_status: 'PAID',
    payment_method: 'PIX',
    notes: 'Futevôlei noturno.',
    created_by: 'u-admin-xp',
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'res-d5-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000001',
    customer_id: 'cust-1',
    start_at: `${d5Ago}T20:00:00.000Z`,
    end_at: `${d5Ago}T21:00:00.000Z`,
    status: 'COMPLETED',
    amount: 90.0,
    payment_status: 'PAID',
    payment_method: 'PIX',
    notes: 'Beach tennis.',
    created_by: 'u-client-1',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'res-d6-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000002',
    customer_id: 'cust-2',
    start_at: `${d6Ago}T17:00:00.000Z`,
    end_at: `${d6Ago}T18:00:00.000Z`,
    status: 'COMPLETED',
    amount: 80.0,
    payment_status: 'PAID',
    payment_method: 'DEBIT_CARD',
    notes: 'Partida fim de tarde.',
    created_by: 'u-admin-xp',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },

  // --- INACTIVE CLIENT HISTORICAL (35 days ago - for inactive client test) ---
  {
    id: 'res-inactive-cust',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000001',
    customer_id: 'cust-5',
    start_at: `${d35Ago}T18:00:00.000Z`,
    end_at: `${d35Ago}T19:00:00.000Z`,
    status: 'COMPLETED',
    amount: 90.0,
    payment_status: 'PAID',
    payment_method: 'PIX',
    notes: 'Última reserva há mais de 30 dias.',
    created_by: 'u-admin-xp',
    created_at: new Date(Date.now() - 35 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },

  // --- ARENA B RESERVATION (For Multi-Tenancy testing) ---
  {
    id: 'res-arena2-1',
    arena_id: 'a2b2c3d4-0000-0000-0000-000000000002',
    court_id: 'c2b2c3d4-0000-0000-0000-000000000001',
    customer_id: 'cust-4',
    start_at: `${todayStr}T19:00:00.000Z`,
    end_at: `${todayStr}T20:00:00.000Z`,
    status: 'CONFIRMED',
    amount: 260.0,
    payment_status: 'PAID',
    payment_method: 'PIX',
    notes: 'Jogo exclusivo Arena Prime.',
    created_by: 'u-superadmin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const INITIAL_COURT_BLOCKS: CourtBlock[] = [
  {
    id: 'block-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    court_id: 'c1b2c3d4-0000-0000-0000-000000000002',
    start_at: `${todayStr}T14:00:00.000Z`,
    end_at: `${todayStr}T16:00:00.000Z`,
    reason: 'Manutenção / Nivelamento da Areia',
    notes: 'Trabalho de reposição de areia tratada nas quadras abertas.',
    created_by: 'u-admin-xp',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const INITIAL_TRANSACTIONS: FinancialTransaction[] = [
  // Settled Reservation Income (Today)
  {
    id: 'tx-res-today-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'INCOME',
    category: 'RESERVATION',
    description: 'Pagamento Reserva - Lucas Silva (Quadra 01)',
    amount: 90.0,
    payment_method: 'PIX',
    transaction_date: todayStr,
    reservation_id: 'res-today-1',
    customer_id: 'cust-1',
    status: 'COMPLETED',
    notes: 'Pagamento total via PIX.',
    created_by: 'u-admin-xp',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-res-today-3',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'INCOME',
    category: 'RESERVATION',
    description: 'Pagamento Reserva - Beatriz Lima (Quadra 02)',
    amount: 80.0,
    payment_method: 'DEBIT_CARD',
    transaction_date: todayStr,
    reservation_id: 'res-today-3',
    customer_id: 'cust-3',
    status: 'COMPLETED',
    notes: 'Pagamento no balcão da arena.',
    created_by: 'u-admin-xp',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Additional Income: Bar & Lanchonete (Today)
  {
    id: 'tx-bar-today-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'INCOME',
    category: 'BAR',
    description: 'Consumo Bar & Lanchonete - Bebidas e Açaí',
    amount: 240.0,
    payment_method: 'PIX',
    transaction_date: todayStr,
    status: 'COMPLETED',
    notes: 'Consumo pós-treino atletas.',
    created_by: 'u-admin-xp',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Operational Expenses (Today)
  {
    id: 'tx-exp-today-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'EXPENSE',
    category: 'ENERGY',
    description: 'Conta de Energia Elétrica - Iluminação LED Quadras',
    amount: 1250.0,
    payment_method: 'PIX',
    transaction_date: todayStr,
    status: 'COMPLETED',
    notes: 'Fatura ENEL do mês com iluminação noturna.',
    created_by: 'u-admin-xp',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-exp-today-2',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'EXPENSE',
    category: 'WATER',
    description: 'Galões de Água Mineral e Gelo para Bebedouros',
    amount: 180.0,
    payment_method: 'PIX',
    transaction_date: todayStr,
    status: 'COMPLETED',
    notes: 'Fornecedor Água Cristalina.',
    created_by: 'u-admin-xp',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Historical Revenues (Past days)
  {
    id: 'tx-res-d1-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'INCOME',
    category: 'RESERVATION',
    description: 'Pagamento Reserva - Lucas Silva (Quadra 01)',
    amount: 90.0,
    payment_method: 'PIX',
    transaction_date: d1Ago,
    reservation_id: 'res-d1-1',
    customer_id: 'cust-1',
    status: 'COMPLETED',
    notes: 'PIX online.',
    created_by: 'u-client-1',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-bar-d1-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'INCOME',
    category: 'BAR',
    description: 'Consumo Bar & Lanchonete',
    amount: 180.0,
    payment_method: 'CREDIT_CARD',
    transaction_date: d1Ago,
    status: 'COMPLETED',
    notes: 'Venda de isotônicos e água de coco.',
    created_by: 'u-admin-xp',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-res-d2-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'INCOME',
    category: 'RESERVATION',
    description: 'Pagamento Reserva - Mariana Costa (Quadra 02)',
    amount: 80.0,
    payment_method: 'CREDIT_CARD',
    transaction_date: d2Ago,
    reservation_id: 'res-d2-1',
    customer_id: 'cust-2',
    status: 'COMPLETED',
    notes: 'Cartão de Crédito 1x.',
    created_by: 'u-admin-xp',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-exp-d2-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'EXPENSE',
    category: 'MAINTENANCE',
    description: 'Manutenção e Nivelamento das Quadras de Areia',
    amount: 450.0,
    payment_method: 'PIX',
    transaction_date: d2Ago,
    status: 'COMPLETED',
    notes: 'Equipe de manutenção especializada.',
    created_by: 'u-admin-xp',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-res-d3-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'INCOME',
    category: 'RESERVATION',
    description: 'Pagamento Reserva - Beatriz Lima (Quadra 01)',
    amount: 90.0,
    payment_method: 'PIX',
    transaction_date: d3Ago,
    reservation_id: 'res-d3-1',
    customer_id: 'cust-3',
    status: 'COMPLETED',
    notes: 'PIX.',
    created_by: 'u-client-1',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-exp-d3-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'EXPENSE',
    category: 'EQUIPMENT',
    description: 'Reposição de Bolinhas Beach Tennis e Redes de Vôlei',
    amount: 320.0,
    payment_method: 'DEBIT_CARD',
    transaction_date: d3Ago,
    status: 'COMPLETED',
    notes: 'Kona & Shark Beach Sports.',
    created_by: 'u-admin-xp',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-res-d4-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'INCOME',
    category: 'RESERVATION',
    description: 'Pagamento Reserva - Lucas Silva (Quadra 02)',
    amount: 80.0,
    payment_method: 'PIX',
    transaction_date: d4Ago,
    reservation_id: 'res-d4-1',
    customer_id: 'cust-1',
    status: 'COMPLETED',
    notes: 'PIX.',
    created_by: 'u-admin-xp',
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-res-d5-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'INCOME',
    category: 'RESERVATION',
    description: 'Pagamento Reserva - Lucas Silva (Quadra 01)',
    amount: 90.0,
    payment_method: 'PIX',
    transaction_date: d5Ago,
    reservation_id: 'res-d5-1',
    customer_id: 'cust-1',
    status: 'COMPLETED',
    notes: 'PIX.',
    created_by: 'u-client-1',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tx-res-d6-1',
    arena_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    type: 'INCOME',
    category: 'RESERVATION',
    description: 'Pagamento Reserva - Mariana Costa (Quadra 02)',
    amount: 80.0,
    payment_method: 'DEBIT_CARD',
    transaction_date: d6Ago,
    reservation_id: 'res-d6-1',
    customer_id: 'cust-2',
    status: 'COMPLETED',
    notes: 'Cartão de débito.',
    created_by: 'u-admin-xp',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Arena B Multi-tenant Transaction
  {
    id: 'tx-arena2-1',
    arena_id: 'a2b2c3d4-0000-0000-0000-000000000002',
    type: 'INCOME',
    category: 'RESERVATION',
    description: 'Pagamento Reserva - Diego Rocha (Society 7x7)',
    amount: 260.0,
    payment_method: 'PIX',
    transaction_date: todayStr,
    reservation_id: 'res-arena2-1',
    customer_id: 'cust-4',
    status: 'COMPLETED',
    notes: 'Arena Prime Club.',
    created_by: 'u-superadmin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const sandboxDB = {
  getArenas: (): Arena[] => getStorage('arenas', INITIAL_ARENAS),
  setArenas: (data: Arena[]) => setStorage('arenas', data),
  updateArena: (id: string, updates: Partial<Arena>): Arena => {
    const arenas = sandboxDB.getArenas();
    const index = arenas.findIndex(a => a.id === id);
    if (index === -1) throw new Error('Arena não encontrada');
    const updated = {
      ...arenas[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    arenas[index] = updated;
    sandboxDB.setArenas(arenas);
    return updated;
  },

  getModalities: (arenaId?: string): Modality[] => {
    const list = getStorage('modalities', INITIAL_MODALITIES);
    return arenaId ? list.filter(m => m.arena_id === arenaId) : list;
  },
  setModalities: (data: Modality[]) => setStorage('modalities', data),
  createModality: (data: Omit<Modality, 'id' | 'created_at' | 'updated_at'>): Modality => {
    const list = getStorage('modalities', INITIAL_MODALITIES);
    const newMod: Modality = {
      ...data,
      id: `m-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.push(newMod);
    sandboxDB.setModalities(list);
    return newMod;
  },
  updateModality: (id: string, updates: Partial<Modality>): Modality => {
    const list = getStorage('modalities', INITIAL_MODALITIES);
    const idx = list.findIndex(m => m.id === id);
    if (idx === -1) throw new Error('Modalidade não encontrada.');
    const updated = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
    list[idx] = updated;
    sandboxDB.setModalities(list);
    return updated;
  },
  deleteModality: (id: string): void => {
    const courts = sandboxDB.getCourts();
    const inUse = courts.some(c => c.modality_id === id);
    if (inUse) {
      throw new Error('Não é possível excluir esta modalidade pois existem quadras vinculadas a ela.');
    }
    const list = getStorage('modalities', INITIAL_MODALITIES).filter(m => m.id !== id);
    sandboxDB.setModalities(list);
  },

  getCourts: (arenaId?: string): Court[] => {
    const list = getStorage('courts', INITIAL_COURTS);
    const filtered = arenaId ? list.filter(c => c.arena_id === arenaId) : list;
    const modalities = sandboxDB.getModalities(arenaId);
    return filtered.map(c => ({
      ...c,
      modality: modalities.find(m => m.id === c.modality_id)
    }));
  },
  setCourts: (data: Court[]) => setStorage('courts', data),
  createCourt: (data: Omit<Court, 'id' | 'created_at' | 'updated_at' | 'modality'>): Court => {
    // Check integrity: modality must belong to same arena
    const modalities = sandboxDB.getModalities(data.arena_id);
    const mod = modalities.find(m => m.id === data.modality_id);
    if (!mod) {
      throw new Error('A modalidade selecionada não pertence a esta arena.');
    }

    const list = getStorage('courts', INITIAL_COURTS);
    const newCourt: Court = {
      ...data,
      id: `c-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.push(newCourt);
    sandboxDB.setCourts(list);
    return { ...newCourt, modality: mod };
  },
  updateCourt: (id: string, updates: Partial<Court>): Court => {
    const list = getStorage('courts', INITIAL_COURTS);
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Quadra não encontrada.');

    // If changing modality, ensure it belongs to the same arena
    if (updates.modality_id) {
      const modalities = sandboxDB.getModalities(list[idx].arena_id);
      const mod = modalities.find(m => m.id === updates.modality_id);
      if (!mod) throw new Error('A modalidade selecionada não pertence a esta arena.');
    }

    const updated = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
    list[idx] = updated;
    sandboxDB.setCourts(list);
    const modalities = sandboxDB.getModalities(updated.arena_id);
    return { ...updated, modality: modalities.find(m => m.id === updated.modality_id) };
  },
  deleteCourt: (id: string): void => {
    const reservations = sandboxDB.getReservations();
    const hasActiveRes = reservations.some(r => r.court_id === id && (r.status === 'CONFIRMED' || r.status === 'PENDING'));
    if (hasActiveRes) {
      throw new Error('Não é possível excluir uma quadra com reservas ativas.');
    }
    const list = getStorage('courts', INITIAL_COURTS).filter(c => c.id !== id);
    sandboxDB.setCourts(list);
  },

  getCustomers: (arenaId?: string): Customer[] => {
    const list = getStorage('customers', INITIAL_CUSTOMERS);
    return arenaId ? list.filter(c => c.arena_id === arenaId) : list;
  },
  setCustomers: (data: Customer[]) => setStorage('customers', data),
  createCustomer: (data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Customer => {
    const list = getStorage('customers', INITIAL_CUSTOMERS);
    const newCustomer: Customer = {
      ...data,
      id: `cust-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.push(newCustomer);
    sandboxDB.setCustomers(list);
    return newCustomer;
  },
  updateCustomer: (id: string, updates: Partial<Customer>): Customer => {
    const list = getStorage('customers', INITIAL_CUSTOMERS);
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Cliente não encontrado.');
    const updated = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
    list[idx] = updated;
    sandboxDB.setCustomers(list);
    return updated;
  },

  getServices: (arenaId?: string): Service[] => {
    const list = getStorage('services', INITIAL_SERVICES);
    return arenaId ? list.filter(s => s.arena_id === arenaId) : list;
  },
  setServices: (data: Service[]) => setStorage('services', data),
  createService: (data: Omit<Service, 'id' | 'created_at' | 'updated_at'>): Service => {
    const list = getStorage('services', INITIAL_SERVICES);
    const newService: Service = {
      ...data,
      id: `svc-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.push(newService);
    sandboxDB.setServices(list);
    return newService;
  },
  updateService: (id: string, updates: Partial<Service>): Service => {
    const list = getStorage('services', INITIAL_SERVICES);
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Serviço não encontrado.');
    const updated = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
    list[idx] = updated;
    sandboxDB.setServices(list);
    return updated;
  },
  deleteService: (id: string): void => {
    const list = getStorage('services', INITIAL_SERVICES).filter(s => s.id !== id);
    sandboxDB.setServices(list);
  },

  // FINANCIAL TRANSACTIONS
  getFinancialTransactions: (arenaId?: string): FinancialTransaction[] => {
    const list = getStorage('financial_transactions', INITIAL_TRANSACTIONS);
    const filtered = arenaId ? list.filter(t => t.arena_id === arenaId) : list;
    const reservations = sandboxDB.getReservations(arenaId);
    const customers = sandboxDB.getCustomers(arenaId);
    const services = sandboxDB.getServices(arenaId);
    const profiles = sandboxDB.getProfiles();
    return filtered.map(t => ({
      ...t,
      reservation: t.reservation_id ? reservations.find(r => r.id === t.reservation_id) : undefined,
      customer: t.customer_id ? customers.find(c => c.id === t.customer_id) : undefined,
      service: t.service_id ? services.find(s => s.id === t.service_id) : undefined,
      created_by_profile: t.created_by ? profiles.find(p => p.id === t.created_by) : undefined,
    }));
  },
  setFinancialTransactions: (data: FinancialTransaction[]) => setStorage('financial_transactions', data),
  createFinancialTransaction: (data: Omit<FinancialTransaction, 'id' | 'created_at' | 'updated_at'>): FinancialTransaction => {
    const list = getStorage('financial_transactions', INITIAL_TRANSACTIONS);
    const newTx: FinancialTransaction = {
      ...data,
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.push(newTx);
    sandboxDB.setFinancialTransactions(list);
    const reservations = sandboxDB.getReservations(data.arena_id);
    const customers = sandboxDB.getCustomers(data.arena_id);
    const services = sandboxDB.getServices(data.arena_id);
    return {
      ...newTx,
      reservation: newTx.reservation_id ? reservations.find(r => r.id === newTx.reservation_id) : undefined,
      customer: newTx.customer_id ? customers.find(c => c.id === newTx.customer_id) : undefined,
      service: newTx.service_id ? services.find(s => s.id === newTx.service_id) : undefined,
    };
  },
  updateFinancialTransaction: (id: string, updates: Partial<FinancialTransaction>): FinancialTransaction => {
    const list = getStorage('financial_transactions', INITIAL_TRANSACTIONS);
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Transação financeira não encontrada.');
    const updated = {
      ...list[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    list[idx] = updated;
    sandboxDB.setFinancialTransactions(list);
    const reservations = sandboxDB.getReservations(updated.arena_id);
    const customers = sandboxDB.getCustomers(updated.arena_id);
    return {
      ...updated,
      reservation: updated.reservation_id ? reservations.find(r => r.id === updated.reservation_id) : undefined,
      customer: updated.customer_id ? customers.find(c => c.id === updated.customer_id) : undefined,
    };
  },
  deleteFinancialTransaction: (id: string): void => {
    const list = getStorage('financial_transactions', INITIAL_TRANSACTIONS).filter(t => t.id !== id);
    sandboxDB.setFinancialTransactions(list);
  },

  getReservations: (arenaId?: string): Reservation[] => {
    const list = getStorage('reservations', INITIAL_RESERVATIONS);
    const filtered = arenaId ? list.filter(r => r.arena_id === arenaId) : list;
    const courts = sandboxDB.getCourts(arenaId);
    const customers = sandboxDB.getCustomers(arenaId);
    return filtered.map(r => ({
      ...r,
      court: courts.find(c => c.id === r.court_id),
      customer: customers.find(c => c.id === r.customer_id)
    }));
  },
  setReservations: (data: Reservation[]) => setStorage('reservations', data),
  updateReservation: (id: string, updates: Partial<Reservation>): Reservation => {
    const list = getStorage('reservations', INITIAL_RESERVATIONS);
    const idx = list.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Reserva não encontrada.');
    const updated = {
      ...list[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    list[idx] = updated;
    sandboxDB.setReservations(list);
    const courts = sandboxDB.getCourts(updated.arena_id);
    const customers = sandboxDB.getCustomers(updated.arena_id);
    return {
      ...updated,
      court: courts.find(c => c.id === updated.court_id),
      customer: customers.find(c => c.id === updated.customer_id),
    };
  },
  deleteReservation: (id: string): void => {
    const list = getStorage('reservations', INITIAL_RESERVATIONS).filter(r => r.id !== id);
    sandboxDB.setReservations(list);
  },

  // COURT BLOCKS
  getCourtBlocks: (arenaId?: string): CourtBlock[] => {
    const list = getStorage('court_blocks', INITIAL_COURT_BLOCKS);
    const filtered = arenaId ? list.filter(b => b.arena_id === arenaId) : list;
    const courts = sandboxDB.getCourts(arenaId);
    return filtered.map(b => ({
      ...b,
      court: courts.find(c => c.id === b.court_id),
    }));
  },
  setCourtBlocks: (data: CourtBlock[]) => setStorage('court_blocks', data),
  createCourtBlock: (data: Omit<CourtBlock, 'id' | 'created_at' | 'updated_at' | 'court'>): CourtBlock => {
    const list = getStorage('court_blocks', INITIAL_COURT_BLOCKS);
    const newBlock: CourtBlock = {
      ...data,
      id: `block-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.push(newBlock);
    sandboxDB.setCourtBlocks(list);
    const courts = sandboxDB.getCourts(data.arena_id);
    return {
      ...newBlock,
      court: courts.find(c => c.id === data.court_id),
    };
  },
  deleteCourtBlock: (id: string): void => {
    const list = getStorage('court_blocks', INITIAL_COURT_BLOCKS).filter(b => b.id !== id);
    sandboxDB.setCourtBlocks(list);
  },

  getProfiles: (): Profile[] => getStorage('profiles', INITIAL_PROFILES),
  setProfiles: (data: Profile[]) => setStorage('profiles', data),
  updateProfile: (id: string, updates: Partial<Profile>): Profile => {
    const list = getStorage('profiles', INITIAL_PROFILES);
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Perfil não encontrado.');
    const updated = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
    list[idx] = updated;
    sandboxDB.setProfiles(list);
    return updated;
  },

  resetToDefault: () => {
    setStorage('arenas', INITIAL_ARENAS);
    setStorage('modalities', INITIAL_MODALITIES);
    setStorage('courts', INITIAL_COURTS);
    setStorage('customers', INITIAL_CUSTOMERS);
    setStorage('services', INITIAL_SERVICES);
    setStorage('reservations', INITIAL_RESERVATIONS);
    setStorage('court_blocks', INITIAL_COURT_BLOCKS);
    setStorage('financial_transactions', INITIAL_TRANSACTIONS);
    setStorage('profiles', INITIAL_PROFILES);
  }
};
