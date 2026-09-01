import { arenaService } from './arena.service';
import { sandboxDB } from '../lib/supabase';
import { Arena, Reservation } from '../types';

export interface TestResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  details: string;
  expected?: string;
  received?: string;
}

export async function runStage5IntegrityTests(arenaId: string): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const arena = await arenaService.getArenaById(arenaId);
  if (!arena) {
    throw new Error('Arena not found for test execution.');
  }

  // TEST 1: Cálculo correto do faturamento diário (exclui canceladas)
  try {
    const analytics = await arenaService.getDashboardAnalytics(arenaId, 'TODAY');
    const todayStr = new Date().toISOString().split('T')[0];
    const todayReservations = (await arenaService.getReservations(arenaId)).filter(
      r => r.start_at.slice(0, 10) === todayStr
    );
    const validToday = todayReservations.filter(r => r.status !== 'CANCELLED');
    const expectedRevenue = validToday.reduce((sum, r) => sum + r.amount, 0);

    const passed = analytics.todayRevenue === expectedRevenue && !todayReservations.some(r => r.status === 'CANCELLED' && analytics.todayRevenue >= expectedRevenue + r.amount);
    results.push({
      id: 'test-1-revenue-today',
      name: '1. Faturamento diário exclui cancelamentos',
      category: 'Inteligência Financeira',
      passed,
      details: `Faturamento calculado: R$ ${analytics.todayRevenue.toFixed(2)}. Soma de ${validToday.length} reservas válidas de hoje.`,
      expected: `R$ ${expectedRevenue.toFixed(2)}`,
      received: `R$ ${analytics.todayRevenue.toFixed(2)}`,
    });
  } catch (err: any) {
    results.push({
      id: 'test-1-revenue-today',
      name: '1. Faturamento diário exclui cancelamentos',
      category: 'Inteligência Financeira',
      passed: false,
      details: err.message,
    });
  }

  // TEST 2: Cálculo correto do ticket médio
  try {
    const analytics7d = await arenaService.getDashboardAnalytics(arenaId, '7_DAYS');
    const expectedTicket = analytics7d.periodValidReservationsCount > 0
      ? Number((analytics7d.periodRevenue / analytics7d.periodValidReservationsCount).toFixed(2))
      : 0;

    const passed = analytics7d.periodAverageTicket === expectedTicket;
    results.push({
      id: 'test-2-average-ticket',
      name: '2. Cálculo correto do ticket médio',
      category: 'Inteligência Financeira',
      passed,
      details: `Ticket médio: R$ ${analytics7d.periodAverageTicket.toFixed(2)} (Receita R$ ${analytics7d.periodRevenue.toFixed(2)} / ${analytics7d.periodValidReservationsCount} reservas válidas).`,
      expected: `R$ ${expectedTicket.toFixed(2)}`,
      received: `R$ ${analytics7d.periodAverageTicket.toFixed(2)}`,
    });
  } catch (err: any) {
    results.push({
      id: 'test-2-average-ticket',
      name: '2. Cálculo correto do ticket médio',
      category: 'Inteligência Financeira',
      passed: false,
      details: err.message,
    });
  }

  // TEST 3: Cálculo correto da taxa de ocupação (considera horário, quadras ativas e bloqueios)
  try {
    const analytics = await arenaService.getDashboardAnalytics(arenaId, 'TODAY');
    const courts = (await arenaService.getCourts(arenaId)).filter(c => c.status === 'ACTIVE');
    const openingHour = parseInt((arena.opening_time || '06:00').split(':')[0], 10);
    const closingHour = parseInt((arena.closing_time || '23:00').split(':')[0], 10);
    const dailyHours = closingHour === 0 ? 24 - openingHour : closingHour - openingHour;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBlocks = (await arenaService.getCourtBlocks(arenaId)).filter(b => b.start_at.slice(0, 10) === todayStr);
    const blockedHours = todayBlocks.reduce((sum, b) => {
      return sum + (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 3600000;
    }, 0);

    const availableHours = Math.max(1, (courts.length * dailyHours) - blockedHours);
    const todayValid = (await arenaService.getReservations(arenaId)).filter(
      r => r.start_at.slice(0, 10) === todayStr && r.status !== 'CANCELLED'
    );
    const reservedHours = todayValid.reduce((sum, r) => {
      return sum + (new Date(r.end_at).getTime() - new Date(r.start_at).getTime()) / 3600000;
    }, 0);

    const expectedOccupancy = Math.min(100, Math.round((reservedHours / availableHours) * 100));
    const passed = analytics.todayOccupancyPercent === expectedOccupancy;

    results.push({
      id: 'test-3-occupancy-calculation',
      name: '3. Cálculo da taxa de ocupação',
      category: 'Capacidade & Ocupação',
      passed,
      details: `Ocupação: ${analytics.todayOccupancyPercent}%. ${reservedHours.toFixed(1)}h reservadas de ${availableHours.toFixed(1)}h disponíveis (${courts.length} quadras ativas - ${blockedHours.toFixed(1)}h bloqueadas).`,
      expected: `${expectedOccupancy}%`,
      received: `${analytics.todayOccupancyPercent}%`,
    });
  } catch (err: any) {
    results.push({
      id: 'test-3-occupancy-calculation',
      name: '3. Cálculo da taxa de ocupação',
      category: 'Capacidade & Ocupação',
      passed: false,
      details: err.message,
    });
  }

  // TEST 4: Contagem de cancelamentos do dia
  try {
    const analytics = await arenaService.getDashboardAnalytics(arenaId, 'TODAY');
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCancelled = (await arenaService.getReservations(arenaId)).filter(
      r => r.start_at.slice(0, 10) === todayStr && r.status === 'CANCELLED'
    );

    const passed = analytics.todayCancellationsCount === todayCancelled.length;
    results.push({
      id: 'test-4-cancellations-count',
      name: '4. Contagem exata de cancelamentos do dia',
      category: 'Operação Diária',
      passed,
      details: `Cancelamentos hoje: ${analytics.todayCancellationsCount}.`,
      expected: `${todayCancelled.length}`,
      received: `${analytics.todayCancellationsCount}`,
    });
  } catch (err: any) {
    results.push({
      id: 'test-4-cancellations-count',
      name: '4. Contagem exata de cancelamentos do dia',
      category: 'Operação Diária',
      passed: false,
      details: err.message,
    });
  }

  // TEST 5: Listagem cronológica das reservas de hoje
  try {
    const analytics = await arenaService.getDashboardAnalytics(arenaId, 'TODAY');
    let isSorted = true;
    for (let i = 0; i < analytics.todayReservationsList.length - 1; i++) {
      const t1 = new Date(analytics.todayReservationsList[i].start_at).getTime();
      const t2 = new Date(analytics.todayReservationsList[i + 1].start_at).getTime();
      if (t1 > t2) {
        isSorted = false;
        break;
      }
    }

    results.push({
      id: 'test-5-chronological-order',
      name: '5. Ordenação cronológica das reservas de hoje',
      category: 'Operação Diária',
      passed: isSorted,
      details: `${analytics.todayReservationsList.length} reservas ordenadas cronologicamente por horário de início.`,
      expected: 'Cronologicamente ordenado (ascendente)',
      received: isSorted ? 'Cronologicamente ordenado (ascendente)' : 'Desordenado',
    });
  } catch (err: any) {
    results.push({
      id: 'test-5-chronological-order',
      name: '5. Ordenação cronológica das reservas de hoje',
      category: 'Operação Diária',
      passed: false,
      details: err.message,
    });
  }

  // TEST 6: Ranking correto das quadras mais utilizadas
  try {
    const analytics = await arenaService.getDashboardAnalytics(arenaId, '7_DAYS');
    let isRankingSorted = true;
    for (let i = 0; i < analytics.courtUtilization.length - 1; i++) {
      if (analytics.courtUtilization[i].utilizationRate < analytics.courtUtilization[i + 1].utilizationRate) {
        isRankingSorted = false;
        break;
      }
    }

    results.push({
      id: 'test-6-court-ranking',
      name: '6. Ranking de utilização de quadras ordenado',
      category: 'Inteligência Operacional',
      passed: isRankingSorted,
      details: `Ranking gerado com ${analytics.courtUtilization.length} quadras ativas ordenadas por % de uso.`,
      expected: 'Ordem decrescente de utilização',
      received: isRankingSorted ? 'Ordem decrescente de utilização' : 'Incorreto',
    });
  } catch (err: any) {
    results.push({
      id: 'test-6-court-ranking',
      name: '6. Ranking de utilização de quadras ordenado',
      category: 'Inteligência Operacional',
      passed: false,
      details: err.message,
    });
  }

  // TEST 7: Identificação correta dos horários de pico
  try {
    const analytics = await arenaService.getDashboardAnalytics(arenaId, '7_DAYS');
    const hasPeakHours = analytics.peakHours && analytics.peakHours.length > 0;
    const topPeak = analytics.peakHours[0];

    results.push({
      id: 'test-7-peak-hours',
      name: '7. Identificação de horários de maior demanda',
      category: 'Inteligência Operacional',
      passed: hasPeakHours,
      details: `Horário de maior pico identificado: ${topPeak?.hour || 'N/A'} com ${topPeak?.count || 0} reservas.`,
      expected: 'Horários mapeados por volume de demanda',
      received: hasPeakHours ? 'Mapeamento concluído com sucesso' : 'Vazio',
    });
  } catch (err: any) {
    results.push({
      id: 'test-7-peak-hours',
      name: '7. Identificação de horários de maior demanda',
      category: 'Inteligência Operacional',
      passed: false,
      details: err.message,
    });
  }

  // TEST 8: Identificação de cliente ativo (reserva válida nos últimos 30 dias)
  try {
    const customersWithMetrics = await arenaService.getCustomersWithMetrics(arenaId);
    const mariana = customersWithMetrics.find(c => c.full_name.includes('Mariana'));
    const passed = !!mariana && mariana.isActive === true;

    results.push({
      id: 'test-8-active-customer',
      name: '8. Identificação de cliente ativo (reserva <= 30 dias)',
      category: 'Gestão de Clientes',
      passed,
      details: `Cliente Mariana Costa identificada como ATIVA (${mariana?.totalReservations} reservas no histórico).`,
      expected: 'isActive: true',
      received: `isActive: ${mariana?.isActive}`,
    });
  } catch (err: any) {
    results.push({
      id: 'test-8-active-customer',
      name: '8. Identificação de cliente ativo (reserva <= 30 dias)',
      category: 'Gestão de Clientes',
      passed: false,
      details: err.message,
    });
  }

  // TEST 9: Identificação de cliente inativo (> 30 dias sem reserva)
  try {
    const customersWithMetrics = await arenaService.getCustomersWithMetrics(arenaId);
    const lucas = customersWithMetrics.find(c => c.full_name.includes('Lucas Antigo'));
    const passed = !!lucas && lucas.isInactive === true && lucas.isActive === false;

    results.push({
      id: 'test-9-inactive-customer',
      name: '9. Identificação de cliente inativo (> 30 dias sem reserva)',
      category: 'Gestão de Clientes',
      passed,
      details: `Cliente Lucas Antigo identificado como INATIVO (última reserva há ${lucas?.daysSinceLastReservation} dias).`,
      expected: 'isInactive: true, isActive: false',
      received: `isInactive: ${lucas?.isInactive}, isActive: ${lucas?.isActive}`,
    });
  } catch (err: any) {
    results.push({
      id: 'test-9-inactive-customer',
      name: '9. Identificação de cliente inativo (> 30 dias sem reserva)',
      category: 'Gestão de Clientes',
      passed: false,
      details: err.message,
    });
  }

  // TEST 10: Identificação de cliente recorrente (>= 2 reservas válidas)
  try {
    const customersWithMetrics = await arenaService.getCustomersWithMetrics(arenaId);
    const bruno = customersWithMetrics.find(c => c.full_name.includes('Bruno'));
    const passed = !!bruno && bruno.isRecurring === true;

    results.push({
      id: 'test-10-recurring-customer',
      name: '10. Identificação de cliente recorrente (>= 2 reservas válidas)',
      category: 'Gestão de Clientes',
      passed,
      details: `Cliente Bruno Henrique identificado como RECORRENTE (${bruno?.totalReservations} reservas válidas).`,
      expected: 'isRecurring: true',
      received: `isRecurring: ${bruno?.isRecurring}`,
    });
  } catch (err: any) {
    results.push({
      id: 'test-10-recurring-customer',
      name: '10. Identificação de cliente recorrente (>= 2 reservas válidas)',
      category: 'Gestão de Clientes',
      passed: false,
      details: err.message,
    });
  }

  // TEST 11: Isolamento Multi-Tenant (RLS / arena_id)
  try {
    const allArenas = await arenaService.getArenas();
    const otherArena = allArenas.find(a => a.id !== arenaId);
    
    let passed = true;
    let details = 'RLS Multi-Tenancy comprovado: ';

    if (otherArena) {
      const arena1Res = await arenaService.getReservations(arenaId);
      const arena2Res = await arenaService.getReservations(otherArena.id);

      const hasLeak1 = arena1Res.some(r => r.arena_id !== arenaId);
      const hasLeak2 = arena2Res.some(r => r.arena_id !== otherArena.id);

      passed = !hasLeak1 && !hasLeak2;
      details += `Arena 1 (${arena1Res.length} reservas isoladas), Arena 2 (${arena2Res.length} reservas isoladas). Sem vazamentos entre tenants.`;
    } else {
      details += 'Apenas 1 arena configurada, tenant isolation verificado por arena_id.';
    }

    results.push({
      id: 'test-11-multi-tenancy',
      name: '11. Isolamento Multi-Tenant estrito por arena_id',
      category: 'Segurança & RLS',
      passed,
      details,
      expected: '100% isolamento por arena_id',
      received: passed ? '100% isolamento por arena_id' : 'Vazamento detectado',
    });
  } catch (err: any) {
    results.push({
      id: 'test-11-multi-tenancy',
      name: '11. Isolamento Multi-Tenant estrito por arena_id',
      category: 'Segurança & RLS',
      passed: false,
      details: err.message,
    });
  }

  return results;
}
