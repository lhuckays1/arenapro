import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { arenaService } from '../src/services/arena.service';
import { sandboxDB } from '../src/lib/supabase';
import { buildArenaDateTime, getArenaTime, getArenaDate } from '../src/utils/agendaDate';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
} });
const results: { name: string; status: string; evidence: string }[] = [];
async function check(name: string, action: () => Promise<void> | void) {
  memory.clear();
  try { await action(); results.push({ name, status: 'PASS', evidence: 'Resultado esperado confirmado.' }); }
  catch (error: any) { results.push({ name, status: 'FAIL', evidence: error.message }); }
}
const arenas = sandboxDB.getArenas();
const arenaId = arenas[0].id;
const court = sandboxDB.getCourts(arenaId)[0];
const customer = sandboxDB.getCustomers(arenaId)[0];
const reservation = {
  id: 'audit-reservation', arena_id: arenaId, court_id: court.id, customer_id: customer.id,
  start_at: buildArenaDateTime('2026-10-23', '18:00'), end_at: buildArenaDateTime('2026-10-23', '19:00'),
  status: 'CONFIRMED', amount: 100, payment_status: 'PENDING', payment_method: null,
  notes: null, created_by: null, created_at: '', updated_at: '',
} as any;
function seedReservation() {
  sandboxDB.setReservations([{ ...reservation }]);
  sandboxDB.setCourtBlocks([]);
  sandboxDB.setFinancialTransactions([]);
}
await check('Timezone: 18h Sao Paulo = 21h UTC e roundtrip', () => {
  assert.equal(reservation.start_at, '2026-10-23T21:00:00.000Z');
  assert.equal(getArenaTime(reservation.start_at), '18:00');
  assert.equal(getArenaDate('2026-10-24T01:30:00.000Z'), '2026-10-23');
});
await check('Conflito, intervalo adjacente e cancelamento', async () => {
  seedReservation();
  await assert.rejects(arenaService.createReservation({ ...reservation, id: undefined }), /Conflito/);
  assert.equal(arenaService.checkReservationOverlap([reservation], court.id, reservation.end_at, buildArenaDateTime('2026-10-23','20:00')), false);
  await arenaService.cancelReservation(reservation.id, arenaId);
  assert.equal(arenaService.checkReservationOverlap(await arenaService.getReservations(arenaId), court.id, reservation.start_at, reservation.end_at), false);
});
await check('Pagamento parcial e total da reserva', async () => {
  seedReservation();
  const first = await arenaService.registerReservationPayment({ reservationId: reservation.id, amount: 40, paymentMethod: 'PIX' });
  assert.equal(first.reservation.payment_status, 'PARTIAL');
  const second = await arenaService.registerReservationPayment({ reservationId: reservation.id, amount: 60, paymentMethod: 'CASH' });
  assert.equal(second.reservation.payment_status, 'PAID');
  assert.equal((await arenaService.getReservationPayments(reservation.id)).reduce((sum, item) => sum + item.amount, 0), 100);
});
await check('Reserva deve rejeitar recebimento acima do saldo', async () => {
  seedReservation();
  await assert.rejects(arenaService.registerReservationPayment({ reservationId: reservation.id, amount: 101, paymentMethod: 'PIX' }));
});
await check('Falha na atualizacao da reserva deve reverter receita', async () => {
  seedReservation();
  const original = arenaService.updateReservation;
  arenaService.updateReservation = async () => { throw new Error('Falha simulada depois da receita'); };
  try { await assert.rejects(arenaService.registerReservationPayment({ reservationId: reservation.id, amount: 40, paymentMethod: 'PIX' })); }
  finally { arenaService.updateReservation = original; }
  assert.equal((await arenaService.getReservationPayments(reservation.id)).length, 0, 'Receita permaneceu gravada apesar do erro no pagamento');
});
await check('Criar reserva em A deve preservar reservas em B no sandbox', async () => {
  seedReservation();
  const other = { ...reservation, id: 'arena-b-reservation', arena_id: arenas[1].id, court_id: sandboxDB.getCourts(arenas[1].id)[0].id };
  sandboxDB.setReservations([other]);
  await arenaService.createReservation({ ...reservation, id: undefined });
  assert.equal((await arenaService.getReservations(arenas[1].id)).length, 1, 'Reserva da segunda arena desapareceu do armazenamento local');
});
await check('Mensalidade: falha ao atualizar deve reverter receita', async () => {
  seedReservation();
  const payment = { id:'audit-student-payment', arena_id:arenaId, amount:100, status:'PENDING', reference_month:'2026-10-01' } as any;
  localStorage.setItem(`arenapro_student_payments_${arenaId}`, JSON.stringify([payment]));
  const original = arenaService.updateStudentPayment;
  arenaService.updateStudentPayment = async () => { throw new Error('Falha simulada depois da receita'); };
  try { await assert.rejects(arenaService.registerStudentPayment(payment, { paymentMethod:'PIX' })); }
  finally { arenaService.updateStudentPayment = original; }
  assert.equal((await arenaService.getFinancialTransactions(arenaId)).length, 0, 'Receita da mensalidade permaneceu gravada apesar da falha');
});
await check('Contrato de um mes deve gerar uma competencia', async () => {
  const originals = { getTeacherStudents:arenaService.getTeacherStudents, getStudentPayments:arenaService.getStudentPayments, createStudentPayment:arenaService.createStudentPayment };
  const generated: any[] = [];
  arenaService.getTeacherStudents = async () => [{ id:'link', arena_id:arenaId, teacher_id:'teacher', student_id:'student', status:'ACTIVE', start_date:'2026-10-01', duration_value:1, duration_unit:'MONTHS', monthly_amount:100, student:{status:'ACTIVE'}, teacher:{status:'ACTIVE'} }] as any;
  arenaService.getStudentPayments = async () => [];
  arenaService.createStudentPayment = async (payment) => { generated.push(payment); return payment as any; };
  try { await arenaService.generateRecurringStudentPayments(arenaId, { referenceMonth:'2026-10', dueDay:10 }); }
  finally { Object.assign(arenaService, originals); }
  assert.equal(generated.length, 1, `Competencias geradas: ${generated.map(item => item.reference_month).join(', ')}`);
});
await check('Financeiro deve incluir reserva 22h30 no dia Sao Paulo', async () => {
  seedReservation();
  sandboxDB.setReservations([{ ...reservation, start_at:'2026-10-24T01:30:00.000Z', end_at:'2026-10-24T02:30:00.000Z' }]);
  const summary = await arenaService.getFinancialSummary(arenaId, 'CUSTOM', '2026-10-23', '2026-10-23');
  assert.equal(summary.reservasFaturamento, 100, 'Reserva 23/10 22h30 foi contabilizada em 24/10 UTC');
});
await check('Modalidade, quadra com imagem e cliente: criar e editar localmente', async () => {
  const modality = await arenaService.createModality({ arena_id:arenaId, name:'Auditoria', status:'ACTIVE', description:null, icon:null } as any);
  const createdCourt = await arenaService.createCourt({ arena_id:arenaId, modality_id:modality.id, name:'Quadra auditoria', price:80, capacity:4, status:'ACTIVE', image_url:'https://example.com/quadra.png' } as any);
  const updatedCourt = await arenaService.updateCourt(createdCourt.id, { name:'Quadra editada' });
  assert.equal(updatedCourt.name, 'Quadra editada');
  assert.equal(updatedCourt.image_url, 'https://example.com/quadra.png');
  const createdCustomer = await arenaService.createCustomer({ arena_id:arenaId, full_name:'Cliente auditoria', phone:'00000000000', user_id:null, status:'ACTIVE' } as any);
  const updatedCustomer = await arenaService.updateCustomer(createdCustomer.id, { full_name:'Cliente editado' });
  assert.equal(updatedCustomer.full_name, 'Cliente editado');
});
await check('Professores e alunos: criar, editar e isolar listas locais', async () => {
  const teacher = await arenaService.createTeacher({ arena_id:arenaId, full_name:'Professor auditoria', status:'ACTIVE' } as any);
  const student = await arenaService.createStudent({ arena_id:arenaId, full_name:'Aluno auditoria', status:'ACTIVE' } as any);
  assert.equal((await arenaService.updateTeacher(teacher.id, { full_name:'Professor editado' })).full_name, 'Professor editado');
  assert.equal((await arenaService.updateStudent(student.id, { full_name:'Aluno editado' })).full_name, 'Aluno editado');
  assert.equal((await arenaService.getTeachers(arenas[1].id)).length, 0);
  assert.equal((await arenaService.getStudents(arenas[1].id)).length, 0);
});
await check('Recebimentos concorrentes devem respeitar saldo da reserva', async () => {
  seedReservation();
  await Promise.allSettled([
    arenaService.registerReservationPayment({ reservationId:reservation.id, amount:60, paymentMethod:'PIX' }),
    arenaService.registerReservationPayment({ reservationId:reservation.id, amount:60, paymentMethod:'PIX' }),
  ]);
  const total = (await arenaService.getReservationPayments(reservation.id)).reduce((sum, item) => sum + item.amount, 0);
  assert.ok(total <= reservation.amount, `Recebido ${total} para reserva de ${reservation.amount}`);
});
await check('Aluno, vinculo e tres mensalidades salvos sem duplicar competencias', async () => {
  const teacher = await arenaService.createTeacher({ arena_id:arenaId, full_name:'Professor', status:'ACTIVE' } as any);
  const student = { arena_id:arenaId, full_name:'Aluno contrato', status:'ACTIVE' } as any;
  const enrollment = { teacher_id:teacher.id, start_date:'2026-10-15', duration_value:3, duration_unit:'MONTHS' as const, monthly_amount:100 };
  const saved = await arenaService.saveStudentEnrollment(null,student,enrollment,{generate:true,dueDay:10});
  await arenaService.saveStudentEnrollment(saved.id,student,enrollment,{generate:true,dueDay:10});
  const payments = await arenaService.getStudentPayments(arenaId);
  assert.equal(payments.length,3);
  assert.equal(payments[0].due_date,'2026-10-15');
  assert.equal((await arenaService.getTeacherStudents(arenaId))[0].teacher?.full_name,'Professor');
});
await check('Falha na atribuicao de mensalidade reverte aluno e vinculo', async () => {
  const teacher = await arenaService.createTeacher({ arena_id:arenaId, full_name:'Professor', status:'ACTIVE' } as any);
  const original = arenaService.createStudentPayment;
  arenaService.createStudentPayment = async () => { throw new Error('Falha simulada na cobrança'); };
  try {
    await assert.rejects(arenaService.saveStudentEnrollment(null,{arena_id:arenaId,full_name:'Não persistir',status:'ACTIVE'} as any,{teacher_id:teacher.id,start_date:'2026-10-01',duration_value:1,duration_unit:'MONTHS',monthly_amount:100},{generate:true,dueDay:10}));
  } finally { arenaService.createStudentPayment = original; }
  assert.equal((await arenaService.getStudents(arenaId)).length,0);
  assert.equal((await arenaService.getTeacherStudents(arenaId)).length,0);
  assert.equal((await arenaService.getStudentPayments(arenaId)).length,0);
});
await check('Semana financeira cruza meses sem alterar o mes final', () => {
  assert.deepEqual(arenaService.calculateDateRange('WEEK',undefined,undefined,'2026-11-01'), {startDate:'2026-10-26',endDate:'2026-11-01'});
});
console.log(JSON.stringify(results, null, 2));
mkdirSync('audit', { recursive:true });
writeFileSync('audit/results-after.json', JSON.stringify(results, null, 2));
process.exitCode = results.some(result => result.status === 'FAIL') ? 1 : 0;
