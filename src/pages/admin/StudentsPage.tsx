import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { EntityStatus, Student, Teacher, TeacherStudent } from '../../types';
import { Plus, Search, Pencil, UserCheck, UserX, X, GraduationCap, Phone, Mail, CalendarDays, UserRound, Trash2 } from 'lucide-react';

interface StudentsPageProps { onNavigate: (path: string) => void; }

type StudentForm = {
  full_name: string;
  phone: string;
  email: string;
  birth_date: string;
  status: EntityStatus;
  notes: string;
  teacher_id: string;
  start_date: string;
  duration_value: string;
  duration_unit: 'MONTHS' | 'WEEKS';
  monthly_amount: string;
};

const emptyForm: StudentForm = {
  full_name: '', phone: '', email: '', birth_date: '', status: 'ACTIVE', notes: '', teacher_id: '',
  start_date: new Date().toISOString().slice(0, 10), duration_value: '1', duration_unit: 'MONTHS', monthly_amount: '',
};

export const StudentsPage: React.FC<StudentsPageProps> = () => {
  const { activeArena, profile } = useAuth();
  const isArenaAdmin = profile?.role === 'ARENA_ADMIN' || profile?.role === 'SUPER_ADMIN';
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [links, setLinks] = useState<TeacherStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EntityStatus>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    if (!activeArena) return;
    setLoading(true); setError('');
    try {
      const [studentData, teacherData, linkData] = await Promise.all([
        arenaService.getStudents(activeArena.id),
        arenaService.getTeachers(activeArena.id),
        arenaService.getTeacherStudents(activeArena.id),
      ]);
      setStudents(studentData); setTeachers(teacherData); setLinks(linkData);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar alunos.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [activeArena]);

  const activeTeacherByStudent = useMemo(() => {
    const map: Record<string, TeacherStudent> = {};
    links.forEach(link => { if (link.status === 'ACTIVE') map[link.student_id] = link; });
    return map;
  }, [links]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter(student => {
      const link = activeTeacherByStudent[student.id];
      const teacherName = link?.teacher?.full_name?.toLowerCase() || '';
      const matchesSearch = !term || [student.full_name, student.phone, student.email, teacherName].some(v => (v || '').toLowerCase().includes(term));
      return matchesSearch && (statusFilter === 'ALL' || student.status === statusFilter);
    });
  }, [students, search, statusFilter, activeTeacherByStudent]);

  const stats = useMemo(() => ({
    total: students.length,
    active: students.filter(s => s.status === 'ACTIVE').length,
    inactive: students.filter(s => s.status === 'INACTIVE').length,
    linked: students.filter(s => !!activeTeacherByStudent[s.id]).length,
  }), [students, activeTeacherByStudent]);

  const openCreate = () => { setEditingStudent(null); setForm(emptyForm); setError(''); setSuccess(''); setIsModalOpen(true); };

  const openEdit = (student: Student) => {
    const link = activeTeacherByStudent[student.id];
    setEditingStudent(student);
    setForm({
      full_name: student.full_name,
      phone: student.phone || '', email: student.email || '', birth_date: student.birth_date || '',
      status: student.status, notes: student.notes || '', teacher_id: link?.teacher_id || '',
      start_date: link?.start_date || new Date().toISOString().slice(0, 10),
      duration_value: link?.duration_value ? String(link.duration_value) : '1',
      duration_unit: link?.duration_unit || 'MONTHS',
      monthly_amount: link?.monthly_amount ? String(link.monthly_amount) : '',
    });
    setError(''); setSuccess(''); setIsModalOpen(true);
  };

  const syncTeacher = async (studentId: string, teacherId: string) => {
    const current = links.find(l => l.student_id === studentId && l.status === 'ACTIVE');
    if (current?.teacher_id === teacherId) {
      if (teacherId) {
        const durationValue = Math.max(1, Number(form.duration_value) || 1);
        const startDate = form.start_date || new Date().toISOString().slice(0, 10);
        const end = new Date(`${startDate}T00:00:00`);
        if (form.duration_unit === 'MONTHS') { end.setMonth(end.getMonth() + durationValue); end.setDate(end.getDate() - 1); }
        else end.setDate(end.getDate() + durationValue * 7 - 1);
        await arenaService.updateTeacherStudent(current.id, {
          start_date: startDate, end_date: end.toISOString().slice(0, 10),
          duration_value: durationValue, duration_unit: form.duration_unit,
          monthly_amount: Number(form.monthly_amount) > 0 ? Number(form.monthly_amount) : null,
        });
      }
      return;
    }

    if (current) {
      await arenaService.updateTeacherStudent(current.id, { status: 'INACTIVE', end_date: new Date().toISOString().slice(0, 10) });
    }
    if (teacherId && activeArena) {
      const previous = links.find(l => l.student_id === studentId && l.teacher_id === teacherId);
      const durationValue = Math.max(1, Number(form.duration_value) || 1);
      const startDate = form.start_date || new Date().toISOString().slice(0, 10);
      const end = new Date(`${startDate}T00:00:00`);
      if (form.duration_unit === 'MONTHS') { end.setMonth(end.getMonth() + durationValue); end.setDate(end.getDate() - 1); }
      else end.setDate(end.getDate() + durationValue * 7 - 1);
      const enrollment = {
        status: 'ACTIVE' as EntityStatus, start_date: startDate, end_date: end.toISOString().slice(0, 10),
        duration_value: durationValue, duration_unit: form.duration_unit,
        monthly_amount: Number(form.monthly_amount) > 0 ? Number(form.monthly_amount) : null,
      };
      if (previous) {
        await arenaService.updateTeacherStudent(previous.id, enrollment);
      } else {
        await arenaService.createTeacherStudent({
          arena_id: activeArena.id, teacher_id: teacherId, student_id: studentId,
          ...enrollment, notes: null,
        });
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeArena || !form.full_name.trim()) { setError('O nome do aluno é obrigatório.'); return; }
    setActionLoading(true); setError(''); setSuccess('');
    try {
      let saved: Student;
      const payload = {
        arena_id: activeArena.id,
        full_name: form.full_name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null,
        birth_date: form.birth_date || null, status: form.status, notes: form.notes.trim() || null,
      };
      if (editingStudent) {
        saved = await arenaService.updateStudent(editingStudent.id, payload);
      } else {
        saved = await arenaService.createStudent(payload);
      }
      await syncTeacher(saved.id, form.teacher_id);
      setSuccess(editingStudent ? 'Aluno atualizado com sucesso!' : 'Aluno cadastrado com sucesso!');
      setIsModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar o aluno.');
    } finally { setActionLoading(false); }
  };

  const deleteStudent = async (student: Student) => {
    const confirmed = window.confirm(`Excluir o aluno "${student.full_name}"?\n\nEsta ação é permanente. Se houver mensalidades vinculadas, o banco impedirá a exclusão para preservar o histórico financeiro.`);
    if (!confirmed) return;
    setActionLoading(true); setError('');
    try {
      await arenaService.deleteStudent(student.id);
      await load();
      setSuccess('Aluno excluído com sucesso.');
    } catch (err: any) {
      const message = err?.message || '';
      setError(message.includes('violates foreign key') || message.includes('student_payments')
        ? 'Não é possível excluir este aluno porque existem mensalidades vinculadas. Inative o aluno para preservar o histórico financeiro.'
        : message || 'Não foi possível excluir o aluno.');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleStatus = async (student: Student) => {
    setActionLoading(true); setError('');
    try {
      await arenaService.updateStudent(student.id, { status: student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      await load();
    } catch (err: any) { setError(err?.message || 'Não foi possível alterar o status.'); }
    finally { setActionLoading(false); }
  };

  if (!isArenaAdmin) {
    return <div className="p-8 text-sm text-slate-400">Você não possui permissão para gerenciar alunos.</div>;
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Alunos</h1>
          <p className="text-xs text-slate-400 mt-1">Cadastre alunos e vincule cada aluno ao professor responsável.</p>
        </div>
        <button onClick={openCreate} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer">
          <Plus className="w-4 h-4" /> NOVO ALUNO
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4"><span className="text-xs text-slate-400 font-semibold">Total</span><div className="text-2xl font-black text-white mt-1">{stats.total}</div></div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4"><span className="text-xs text-slate-400 font-semibold">Ativos</span><div className="text-2xl font-black text-emerald-400 mt-1">{stats.active}</div></div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4"><span className="text-xs text-slate-400 font-semibold">Inativos</span><div className="text-2xl font-black text-amber-400 mt-1">{stats.inactive}</div></div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4"><span className="text-xs text-slate-400 font-semibold">Com professor</span><div className="text-2xl font-black text-sky-400 mt-1">{stats.linked}</div></div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar aluno ou professor..." className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" /></div>
        <div className="flex gap-1.5">{(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(filter => <button key={filter} onClick={() => setStatusFilter(filter)} className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${statusFilter === filter ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>{filter === 'ALL' ? 'Todos' : filter === 'ACTIVE' ? 'Ativos' : 'Inativos'}</button>)}</div>
      </div>

      {error && !isModalOpen && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 px-4 py-3 text-xs">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-4 py-3 text-xs">{success}</div>}

      {loading ? <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs">Carregando alunos...</div> : filtered.length === 0 ? <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 text-xs">Nenhum aluno encontrado.</div> : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-950/70"><tr className="text-[10px] uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Aluno</th><th className="px-4 py-3">Professor</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Nascimento</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-800/80">{filtered.map(student => { const link = activeTeacherByStudent[student.id]; return <tr key={student.id} className="hover:bg-slate-800/20"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center"><GraduationCap className="w-4 h-4 text-sky-400" /></div><div><p className="text-xs font-bold text-white">{student.full_name}</p><p className="text-[10px] text-slate-500">{student.email || 'Sem e-mail'}</p></div></div></td><td className="px-4 py-4 text-xs text-slate-300">{link?.teacher?.full_name || <span className="text-slate-600">Sem professor</span>}</td><td className="px-4 py-4 text-[11px] text-slate-400">{student.phone || '—'}</td><td className="px-4 py-4 text-[11px] text-slate-400">{student.birth_date ? new Date(`${student.birth_date}T00:00:00`).toLocaleDateString('pt-BR') : '—'}</td><td className="px-4 py-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${student.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>{student.status === 'ACTIVE' ? 'ATIVO' : 'INATIVO'}</span></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button onClick={() => openEdit(student)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer" title="Editar"><Pencil className="w-3.5 h-3.5" /></button><button disabled={actionLoading} onClick={() => toggleStatus(student)} className={`p-2 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer ${student.status === 'ACTIVE' ? 'text-amber-300' : 'text-emerald-300'}`} title={student.status === 'ACTIVE' ? 'Inativar' : 'Ativar'}>{student.status === 'ACTIVE' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}</button><button disabled={actionLoading} onClick={() => deleteStudent(student)} className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/10 text-rose-300 cursor-pointer" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button></div></td></tr>; })}</tbody></table></div>
        </div>
      )}

      {isModalOpen && <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !actionLoading && setIsModalOpen(false)}><div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between pb-4 border-b border-slate-800"><div><h3 className="text-lg font-black text-white">{editingStudent ? 'Editar aluno' : 'Novo aluno'}</h3><p className="text-xs text-slate-400 mt-1">Dados cadastrais e professor responsável.</p></div><button onClick={() => !actionLoading && setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button></div>
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 px-3 py-2 text-xs">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="Nome completo *" value={form.full_name} onChange={v => setForm(f => ({...f, full_name:v}))} placeholder="Nome do aluno" /><Field label="Telefone" value={form.phone} onChange={v => setForm(f => ({...f, phone:v}))} placeholder="(00) 00000-0000" /><Field label="E-mail" value={form.email} onChange={v => setForm(f => ({...f, email:v}))} placeholder="aluno@email.com" type="email" /><Field label="Data de nascimento" value={form.birth_date} onChange={v => setForm(f => ({...f, birth_date:v}))} type="date" /><div><label className="text-[11px] font-semibold text-slate-400">Professor responsável</label><select value={form.teacher_id} onChange={e => setForm(f => ({...f, teacher_id:e.target.value}))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"><option value="">Sem professor</option>{teachers.filter(t => t.status === 'ACTIVE').map(t => <option key={t.id} value={t.id}>{t.full_name}{t.modality?.name ? ` — ${t.modality.name}` : ''}</option>)}</select></div><div><label className="text-[11px] font-semibold text-slate-400">Status</label><select value={form.status} onChange={e => setForm(f => ({...f, status:e.target.value as EntityStatus}))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select></div></div>
          {form.teacher_id && <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4"><div className="flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4 text-sky-300"/><div><p className="text-xs font-bold text-sky-200">Período das aulas</p><p className="text-[10px] text-slate-500">Defina por quanto tempo este aluno fará aulas com o professor.</p></div></div><div className="grid grid-cols-1 sm:grid-cols-4 gap-3"><Field label="Início" value={form.start_date} onChange={v => setForm(f => ({...f, start_date:v}))} type="date" /><Field label="Duração" value={form.duration_value} onChange={v => setForm(f => ({...f, duration_value:v.replace(/\D/g,'')}))} type="number" /><div><label className="text-[11px] font-semibold text-slate-400">Unidade</label><select value={form.duration_unit} onChange={e => setForm(f => ({...f, duration_unit:e.target.value as 'MONTHS'|'WEEKS'}))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"><option value="MONTHS">Meses</option><option value="WEEKS">Semanas</option></select></div><Field label="Valor mensal" value={form.monthly_amount} onChange={v => setForm(f => ({...f, monthly_amount:v}))} type="number" /></div></div>}
          <div><label className="text-[11px] font-semibold text-slate-400">Observações</label><textarea value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} rows={3} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" placeholder="Observações sobre o aluno..." /></div>
          <div className="flex justify-end gap-2 pt-2"><button type="button" disabled={actionLoading} onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button><button disabled={actionLoading} type="submit" className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer">{actionLoading ? 'SALVANDO...' : 'SALVAR ALUNO'}</button></div>
        </form>
      </div></div>}
    </div>
  );
};

const Field = ({label, value, onChange, placeholder, type='text'}: {label:string; value:string; onChange:(v:string)=>void; placeholder?:string; type?:string}) => <div><label className="text-[11px] font-semibold text-slate-400">{label}</label><div className="relative mt-1">{type === 'date' ? <CalendarDays className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /> : type === 'email' ? <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /> : label === 'Telefone' ? <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /> : <UserRound className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />}<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" /></div></div>;
