import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { EntityStatus, Modality, Teacher, TeacherStudent } from '../../types';
import {
  UsersRound,
  Search,
  Plus,
  Pencil,
  UserCheck,
  UserX,
  Phone,
  Mail,
  Volleyball,
  X,
  Save,
  Users,
  Trash2,
} from 'lucide-react';

interface TeachersPageProps {
  onNavigate: (path: string) => void;
}

const emptyForm = {
  full_name: '',
  phone: '',
  email: '',
  cpf: '',
  modality_id: '',
  status: 'ACTIVE' as EntityStatus,
  notes: '',
};

export const TeachersPage: React.FC<TeachersPageProps> = ({ onNavigate }) => {
  const { activeArena } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [links, setLinks] = useState<TeacherStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const loadData = async () => {
    if (!activeArena) return;
    setLoading(true);
    try {
      const [teacherData, modalityData, linkData] = await Promise.all([
        arenaService.getTeachers(activeArena.id),
        arenaService.getModalities(activeArena.id),
        arenaService.getTeacherStudents(activeArena.id),
      ]);
      setTeachers(teacherData);
      setModalities(modalityData);
      setLinks(linkData);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os professores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [activeArena]);

  const filteredTeachers = useMemo(() => teachers.filter((teacher) => {
    const term = search.toLowerCase().trim();
    const matchesSearch = !term ||
      teacher.full_name.toLowerCase().includes(term) ||
      (teacher.phone || '').toLowerCase().includes(term) ||
      (teacher.email || '').toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'ALL' || teacher.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [teachers, search, statusFilter]);

  const stats = useMemo(() => ({
    total: teachers.length,
    active: teachers.filter(t => t.status === 'ACTIVE').length,
    inactive: teachers.filter(t => t.status === 'INACTIVE').length,
  }), [teachers]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEdit = (teacher: Teacher) => {
    setEditing(teacher);
    setForm({
      full_name: teacher.full_name,
      phone: teacher.phone || '',
      email: teacher.email || '',
      cpf: teacher.cpf || '',
      modality_id: teacher.modality_id || '',
      status: teacher.status,
      notes: teacher.notes || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeArena || !form.full_name.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await arenaService.updateTeacher(editing.id, {
          full_name: form.full_name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          cpf: form.cpf || null,
          modality_id: form.modality_id || null,
          status: form.status,
          notes: form.notes || null,
        });
      } else {
        await arenaService.createTeacher({
          arena_id: activeArena.id,
          full_name: form.full_name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          cpf: form.cpf || null,
          modality_id: form.modality_id || null,
          status: form.status,
          notes: form.notes || null,
        });
      }
      setShowModal(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar professor.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTeacher = async (teacher: Teacher) => {
    const confirmed = window.confirm(`Excluir o professor "${teacher.full_name}"?\n\nEsta ação é permanente. Se houver mensalidades vinculadas, o banco impedirá a exclusão para preservar o histórico financeiro.`);
    if (!confirmed) return;
    setError('');
    try {
      await arenaService.deleteTeacher(teacher.id);
      await loadData();
    } catch (err: any) {
      const message = err?.message || '';
      setError(message.includes('violates foreign key') || message.includes('student_payments')
        ? 'Não é possível excluir este professor porque existem mensalidades vinculadas. Inative o professor para preservar o histórico financeiro.'
        : message || 'Não foi possível excluir o professor.');
    }
  };

  const toggleStatus = async (teacher: Teacher) => {
    try {
      await arenaService.updateTeacher(teacher.id, {
        status: teacher.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Erro ao alterar status.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Professores</h1>
          <p className="text-xs text-slate-400">Cadastre professores e acompanhe os alunos vinculados a cada profissional.</p>
        </div>
        <button onClick={openCreate} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer">
          <Plus className="w-4 h-4" /> NOVO PROFESSOR
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4"><span className="text-xs text-slate-400 font-semibold">Total</span><div className="text-2xl font-black text-white mt-1">{stats.total}</div></div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4"><span className="text-xs text-slate-400 font-semibold">Ativos</span><div className="text-2xl font-black text-emerald-400 mt-1">{stats.active}</div></div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4"><span className="text-xs text-slate-400 font-semibold">Inativos</span><div className="text-2xl font-black text-amber-400 mt-1">{stats.inactive}</div></div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar professor por nome, telefone ou e-mail..." className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
        </div>
        <div className="flex gap-1.5">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(filter => (
            <button key={filter} onClick={() => setStatusFilter(filter)} className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${statusFilter === filter ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
              {filter === 'ALL' ? `Todos (${stats.total})` : filter === 'ACTIVE' ? `Ativos (${stats.active})` : `Inativos (${stats.inactive})`}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 px-4 py-3 text-xs">{error}</div>}

      {loading ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs">Carregando professores...</div>
      ) : filteredTeachers.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs">Nenhum professor encontrado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTeachers.map(teacher => {
            const studentCount = links.filter(l => l.teacher_id === teacher.id && l.status === 'ACTIVE').length;
            return (
              <div key={teacher.id} className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0"><UsersRound className="w-5 h-5 text-emerald-400" /></div>
                    <div className="min-w-0"><h3 className="text-sm font-bold text-white truncate">{teacher.full_name}</h3><p className="text-[11px] text-slate-400 mt-0.5">{teacher.modality?.name || 'Sem modalidade'}</p></div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${teacher.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>{teacher.status === 'ACTIVE' ? 'ATIVO' : 'INATIVO'}</span>
                </div>
                <div className="space-y-2 text-[11px] text-slate-400">
                  {teacher.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{teacher.phone}</div>}
                  {teacher.email && <div className="flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5 shrink-0" />{teacher.email}</div>}
                  <div className="flex items-center gap-2 text-slate-300"><Users className="w-3.5 h-3.5 text-emerald-400" />{studentCount} aluno{studentCount === 1 ? '' : 's'}</div>
                </div>
                <div className="pt-3 border-t border-slate-800 flex gap-2">
                  <button onClick={() => onNavigate(`/admin/professores/${teacher.id}`)} className="flex-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer">Alunos</button>
                  <button onClick={() => openEdit(teacher)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => toggleStatus(teacher)} className={`p-2 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer ${teacher.status === 'ACTIVE' ? 'text-amber-300' : 'text-emerald-300'}`} title={teacher.status === 'ACTIVE' ? 'Inativar' : 'Ativar'}>{teacher.status === 'ACTIVE' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}</button><button onClick={() => deleteTeacher(teacher)} className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/10 text-rose-300 cursor-pointer" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTeacher && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedTeacher(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div><h3 className="text-lg font-black text-white">{selectedTeacher.full_name}</h3><p className="text-xs text-slate-400 mt-1">Alunos vinculados atualmente</p></div>
              <button onClick={() => setSelectedTeacher(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="mt-5 space-y-2">
              {links.filter(l => l.teacher_id === selectedTeacher.id && l.status === 'ACTIVE').map(link => (
                <div key={link.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div><p className="text-sm font-bold text-slate-200">{link.student?.full_name || 'Aluno'}</p><p className="text-[11px] text-slate-500">Vínculo desde {new Date(link.start_date).toLocaleDateString('pt-BR')}</p></div>
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                </div>
              ))}
              {links.filter(l => l.teacher_id === selectedTeacher.id && l.status === 'ACTIVE').length === 0 && <p className="text-center text-xs text-slate-500 py-8">Nenhum aluno vinculado a este professor.</p>}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div><h3 className="text-lg font-black text-white">{editing ? 'Editar Professor' : 'Novo Professor'}</h3><p className="text-xs text-slate-400 mt-1">Dados cadastrais e modalidade de atuação.</p></div>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4 mt-5">
              <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Nome completo *</label><input required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Telefone</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" /></div>
                <div><label className="block text-xs font-bold text-slate-300 mb-1.5">CPF</label><input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-slate-300 mb-1.5">E-mail</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" /></div>
                <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Modalidade</label><select value={form.modality_id} onChange={e => setForm({...form, modality_id: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"><option value="">Sem modalidade</option>{modalities.filter(m => m.status === 'ACTIVE').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
              </div>
              <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value as EntityStatus})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select></div>
              <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Observações</label><textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 resize-none" /></div>
              {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 px-3 py-2 text-xs">{error}</div>}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer">Cancelar</button><button disabled={saving} type="submit" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Cadastrar Professor'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
