import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { PaymentMethod, Student, StudentPayment, Teacher, TeacherStudent } from '../../types';
import { ArrowLeft, CalendarDays, CheckCircle2, CircleDollarSign, CreditCard, Mail, Phone, Plus, ReceiptText, Save, Trash2, UserPlus, UserRound, UsersRound, X, XCircle } from 'lucide-react';

interface TeacherDetailsPageProps { teacherId: string; onNavigate: (path: string) => void; }

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value?: string | null) => value ? new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR') : '-';
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => `${today().slice(0, 7)}-01`;
const methodLabel: Record<PaymentMethod, string> = { PIX: 'PIX', CREDIT_CARD: 'Cartão de crédito', DEBIT_CARD: 'Cartão de débito', CASH: 'Dinheiro', BANK_TRANSFER: 'Transferência', OTHER: 'Outro' };

export const TeacherDetailsPage: React.FC<TeacherDetailsPageProps> = ({ teacherId, onNavigate }) => {
  const { activeArena } = useAuth();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [links, setLinks] = useState<TeacherStudent[]>([]);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allLinks, setAllLinks] = useState<TeacherStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<'student' | 'payment' | 'receive' | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<StudentPayment | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [paymentForm, setPaymentForm] = useState({ student_id: '', reference_month: currentMonth(), due_date: today(), amount: '', notes: '' });
  const [receiveMethod, setReceiveMethod] = useState<PaymentMethod>('PIX');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    if (!activeArena) return;
    setLoading(true); setError('');
    try {
      const [teachers, linkData, paymentData, students, allLinkData] = await Promise.all([
        arenaService.getTeachers(activeArena.id),
        arenaService.getTeacherStudents(activeArena.id, teacherId),
        arenaService.getStudentPayments(activeArena.id, { teacherId }),
        arenaService.getStudents(activeArena.id),
        arenaService.getTeacherStudents(activeArena.id),
      ]);
      setTeacher(teachers.find(item => item.id === teacherId) || null);
      setLinks(linkData.filter(item => item.status === 'ACTIVE'));
      setPayments(paymentData);
      setAllStudents(students.filter(s => s.status === 'ACTIVE'));
      setAllLinks(allLinkData);
    } catch (err: any) { setError(err?.message || 'Não foi possível carregar os dados do professor.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [activeArena, teacherId]);

  const stats = useMemo(() => {
    const paid = payments.filter(p => p.status === 'PAID');
    const open = payments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE');
    return { students: links.length, paid: paid.reduce((sum, p) => sum + Number(p.amount || 0), 0), open: open.reduce((sum, p) => sum + Number(p.amount || 0), 0), overdue: payments.filter(p => p.status === 'OVERDUE').length };
  }, [links, payments]);

  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    links.forEach(link => { if (link.student) map.set(link.student.id, link.student); });
    return map;
  }, [links]);

  const availableStudents = useMemo(() => {
    const activeByStudent = new Map<string, TeacherStudent>();
    allLinks.filter(l => l.status === 'ACTIVE').forEach(l => activeByStudent.set(l.student_id, l));
    return allStudents.filter(s => !activeByStudent.has(s.id) || activeByStudent.get(s.id)?.teacher_id === teacherId);
  }, [allStudents, allLinks, teacherId]);

  const openStudentModal = () => { setError(''); setSelectedStudentId(''); setModal('student'); };
  const openPaymentModal = (studentId?: string) => { setError(''); setPaymentForm({ student_id: studentId || links[0]?.student_id || '', reference_month: currentMonth(), due_date: today(), amount: '', notes: '' }); setModal('payment'); };
  const openReceive = (payment: StudentPayment) => { setSelectedPayment(payment); setReceiveMethod(payment.payment_method || 'PIX'); setError(''); setModal('receive'); };

  const linkStudent = async () => {
    if (!activeArena || !selectedStudentId) { setError('Selecione um aluno.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const existing = allLinks.find(l => l.teacher_id === teacherId && l.student_id === selectedStudentId);
      const activeOther = allLinks.find(l => l.student_id === selectedStudentId && l.status === 'ACTIVE' && l.teacher_id !== teacherId);
      if (activeOther) await arenaService.updateTeacherStudent(activeOther.id, { status: 'INACTIVE', end_date: today() });
      if (existing) {
        await arenaService.updateTeacherStudent(existing.id, { status: 'ACTIVE', start_date: today(), end_date: null });
      } else {
        await arenaService.createTeacherStudent({ arena_id: activeArena.id, teacher_id: teacherId, student_id: selectedStudentId, start_date: today(), end_date: null, status: 'ACTIVE', notes: null });
      }
      setModal(null); setSuccess('Aluno vinculado ao professor.'); await load();
    } catch (err: any) { setError(err?.message || 'Não foi possível vincular o aluno.'); }
    finally { setSaving(false); }
  };

  const createPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeArena || !paymentForm.student_id || !paymentForm.amount) { setError('Aluno e valor são obrigatórios.'); return; }
    const amount = Number(paymentForm.amount.replace(',', '.'));
    if (!(amount > 0)) { setError('Informe um valor maior que zero.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await arenaService.createStudentPayment({ arena_id: activeArena.id, teacher_id: teacherId, student_id: paymentForm.student_id, reference_month: paymentForm.reference_month.slice(0, 7) + '-01', due_date: paymentForm.due_date, amount, status: 'PENDING', paid_at: null, payment_method: null, financial_transaction_id: null, notes: paymentForm.notes.trim() || null });
      setModal(null); setSuccess('Mensalidade criada com sucesso.'); await load();
    } catch (err: any) { setError(err?.message?.includes('uq_student_payments') ? 'Já existe uma mensalidade deste aluno para essa competência.' : err?.message || 'Não foi possível criar a mensalidade.'); }
    finally { setSaving(false); }
  };

  const receivePayment = async () => {
    if (!selectedPayment) return;
    setSaving(true); setError(''); setSuccess('');
    try { await arenaService.registerStudentPayment(selectedPayment, { paymentMethod: receiveMethod }); setModal(null); setSuccess('Pagamento registrado e lançado no financeiro.'); await load(); }
    catch (err: any) { setError(err?.message || 'Não foi possível registrar o pagamento.'); }
    finally { setSaving(false); }
  };

  const unlinkStudent = async (link: TeacherStudent) => {
    if (!window.confirm(`Remover ${link.student?.full_name || 'este aluno'} deste professor?`)) return;
    setSaving(true); setError('');
    try { await arenaService.updateTeacherStudent(link.id, { status: 'INACTIVE', end_date: today() }); setSuccess('Vínculo encerrado.'); await load(); }
    catch (err: any) { setError(err?.message || 'Não foi possível encerrar o vínculo.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-12 text-center text-xs text-slate-400">Carregando professor...</div>;
  if (error && !teacher) return <div className="space-y-4"><button onClick={() => onNavigate('/admin/professores')} className="text-xs text-slate-300 flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</button><div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 px-4 py-3 text-xs">{error}</div></div>;
  if (!teacher) return <div className="space-y-4"><button onClick={() => onNavigate('/admin/professores')} className="text-xs text-slate-300 flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</button><div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-xs text-slate-400">Professor não encontrado.</div></div>;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3"><button onClick={() => onNavigate('/admin/professores')} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"><ArrowLeft className="w-4 h-4" /></button><div><h1 className="text-2xl font-black text-white tracking-tight">{teacher.full_name}</h1><p className="text-xs text-slate-400">Visão operacional do professor, alunos e mensalidades.</p></div></div>
        <div className="flex gap-2"><button onClick={openStudentModal} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black cursor-pointer"><UserPlus className="w-4 h-4" /> ADICIONAR ALUNO</button><button onClick={() => openPaymentModal()} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"><Plus className="w-4 h-4" /> GERAR MENSALIDADE</button></div>
      </div>

      {success && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 px-4 py-3 text-xs font-semibold">{success}</div>}
      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 px-4 py-3 text-xs">{error}</div>}

      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5"><div className="flex flex-col md:flex-row md:items-center gap-5"><div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0"><UsersRound className="w-7 h-7 text-emerald-400" /></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1"><div><p className="text-[10px] uppercase font-bold text-slate-500">Modalidade</p><p className="text-sm font-bold text-white mt-1">{teacher.modality?.name || 'Sem modalidade'}</p></div><div><p className="text-[10px] uppercase font-bold text-slate-500">Telefone</p><p className="text-sm text-slate-300 mt-1 flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{teacher.phone || '-'}</p></div><div><p className="text-[10px] uppercase font-bold text-slate-500">E-mail</p><p className="text-sm text-slate-300 mt-1 flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5 shrink-0" />{teacher.email || '-'}</p></div><div><p className="text-[10px] uppercase font-bold text-slate-500">CPF</p><p className="text-sm text-slate-300 mt-1">{teacher.cpf || '-'}</p></div></div></div></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4"><UsersRound className="w-4 h-4 text-emerald-400" /><p className="text-xs text-slate-500 mt-3">Alunos ativos</p><p className="text-2xl font-black text-white mt-1">{stats.students}</p></div><div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4"><CircleDollarSign className="w-4 h-4 text-emerald-400" /><p className="text-xs text-slate-500 mt-3">Recebido</p><p className="text-xl font-black text-emerald-400 mt-1">{money(stats.paid)}</p></div><div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4"><ReceiptText className="w-4 h-4 text-amber-400" /><p className="text-xs text-slate-500 mt-3">Em aberto</p><p className="text-xl font-black text-amber-300 mt-1">{money(stats.open)}</p></div><div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4"><XCircle className="w-4 h-4 text-rose-400" /><p className="text-xs text-slate-500 mt-3">Vencidas</p><p className="text-2xl font-black text-rose-400 mt-1">{stats.overdue}</p></div></div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden"><div className="p-5 border-b border-slate-800 flex items-center justify-between"><div><h2 className="text-sm font-black text-white">Alunos vinculados</h2><p className="text-[11px] text-slate-500 mt-1">Gerencie os alunos deste professor.</p></div><UserRound className="w-5 h-5 text-emerald-400" /></div><div className="p-4 space-y-2">{links.map(link => <div key={link.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800"><div className="min-w-0"><p className="text-xs font-bold text-slate-200 truncate">{link.student?.full_name || 'Aluno'}</p><p className="text-[10px] text-slate-500 mt-1">Vínculo desde {date(link.start_date)}</p></div><div className="flex items-center gap-2"><button onClick={() => openPaymentModal(link.student_id)} className="px-2.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-black cursor-pointer">MENSALIDADE</button><button disabled={saving} onClick={() => unlinkStudent(link)} className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/10 text-rose-300 cursor-pointer" title="Encerrar vínculo"><Trash2 className="w-3.5 h-3.5" /></button></div></div>)}{links.length === 0 && <p className="py-8 text-center text-xs text-slate-500">Nenhum aluno vinculado.</p>}</div></section>

        <section className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden"><div className="p-5 border-b border-slate-800 flex items-center justify-between"><div><h2 className="text-sm font-black text-white">Mensalidades</h2><p className="text-[11px] text-slate-500 mt-1">Crie e receba cobranças sem sair do professor.</p></div><CreditCard className="w-5 h-5 text-emerald-400" /></div><div className="p-4 space-y-2 max-h-[460px] overflow-y-auto">{payments.map(payment => { const student = studentMap.get(payment.student_id) || payment.student; const status = payment.status === 'PAID' ? { label: 'PAGO', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 } : payment.status === 'OVERDUE' ? { label: 'VENCIDO', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/20', icon: XCircle } : { label: payment.status === 'CANCELLED' ? 'CANCELADO' : 'PENDENTE', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/20', icon: CalendarDays }; const Icon = status.icon; return <div key={payment.id} className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-slate-200 truncate">{student?.full_name || 'Aluno'}</p><p className="text-[10px] text-slate-500 mt-1">Competência {payment.reference_month.slice(0,7)} · vence {date(payment.due_date)}</p></div><div className="text-right shrink-0"><p className="text-xs font-black text-white">{money(Number(payment.amount))}</p><span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full border text-[9px] font-bold ${status.cls}`}><Icon className="w-3 h-3" />{status.label}</span></div></div>{payment.status !== 'PAID' && payment.status !== 'CANCELLED' && <div className="mt-2 flex justify-end"><button disabled={saving} onClick={() => openReceive(payment)} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-[9px] font-black cursor-pointer">RECEBER {money(Number(payment.amount))}</button></div>}</div>})}{payments.length === 0 && <p className="py-8 text-center text-xs text-slate-500">Nenhuma mensalidade encontrada.</p>}</div><div className="p-4 border-t border-slate-800"><button onClick={() => onNavigate('/admin/mensalidades')} className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer">ABRIR TODAS AS MENSALIDADES</button></div></section>
      </div>

      {modal === 'student' && <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setModal(null)}><div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between mb-5"><div><h3 className="text-lg font-black text-white">Adicionar aluno</h3><p className="text-xs text-slate-400 mt-1">Vincule um aluno ativo a {teacher.full_name}.</p></div><button onClick={() => !saving && setModal(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button></div><label className="text-[11px] font-semibold text-slate-400">Aluno</label><select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"><option value="">Selecione...</option>{availableStudents.map(s => <option key={s.id} value={s.id}>{s.full_name}{s.phone ? ` — ${s.phone}` : ''}</option>)}</select><div className="flex justify-end gap-2 mt-5"><button onClick={() => setModal(null)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button><button disabled={saving} onClick={linkStudent} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black cursor-pointer"><UserPlus className="w-4 h-4" />{saving ? 'VINCULANDO...' : 'VINCULAR ALUNO'}</button></div></div></div>}

      {modal === 'payment' && <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setModal(null)}><div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between mb-5"><div><h3 className="text-lg font-black text-white">Gerar mensalidade</h3><p className="text-xs text-slate-400 mt-1">Crie uma cobrança para este professor.</p></div><button onClick={() => !saving && setModal(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button></div><form onSubmit={createPayment} className="space-y-4"><div><label className="text-[11px] font-semibold text-slate-400">Aluno *</label><select value={paymentForm.student_id} onChange={e => setPaymentForm(f => ({...f, student_id: e.target.value}))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200"><option value="">Selecione...</option>{links.map(l => <option key={l.student_id} value={l.student_id}>{l.student?.full_name || l.student_id}</option>)}</select></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div><label className="text-[11px] font-semibold text-slate-400">Competência *</label><input type="month" value={paymentForm.reference_month.slice(0,7)} onChange={e => setPaymentForm(f => ({...f, reference_month: `${e.target.value}-01`}))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200" /></div><div><label className="text-[11px] font-semibold text-slate-400">Vencimento *</label><input type="date" value={paymentForm.due_date} onChange={e => setPaymentForm(f => ({...f, due_date: e.target.value}))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200" /></div><div><label className="text-[11px] font-semibold text-slate-400">Valor *</label><input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({...f, amount: e.target.value}))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200" placeholder="0,00" /></div></div><div><label className="text-[11px] font-semibold text-slate-400">Observações</label><textarea value={paymentForm.notes} onChange={e => setPaymentForm(f => ({...f, notes: e.target.value}))} rows={3} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 resize-none" /></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setModal(null)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button><button disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black cursor-pointer"><Save className="w-4 h-4" />{saving ? 'SALVANDO...' : 'GERAR MENSALIDADE'}</button></div></form></div></div>}

      {modal === 'receive' && selectedPayment && <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setModal(null)}><div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between mb-5"><div><h3 className="text-lg font-black text-white">Registrar pagamento</h3><p className="text-xs text-slate-400 mt-1">{selectedPayment.student?.full_name || 'Aluno'} · {money(Number(selectedPayment.amount))}</p></div><button onClick={() => !saving && setModal(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button></div><label className="text-[11px] font-semibold text-slate-400">Forma de pagamento</label><select value={receiveMethod} onChange={e => setReceiveMethod(e.target.value as PaymentMethod)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200">{Object.entries(methodLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><div className="mt-5 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-slate-300">Ao confirmar, a mensalidade será marcada como <strong className="text-emerald-300">PAGA</strong> e o valor será lançado no financeiro.</div><div className="flex justify-end gap-2 mt-5"><button onClick={() => setModal(null)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button><button disabled={saving} onClick={receivePayment} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black cursor-pointer"><CheckCircle2 className="w-4 h-4" />{saving ? 'PROCESSANDO...' : 'CONFIRMAR RECEBIMENTO'}</button></div></div></div>}
    </div>
  );
};
