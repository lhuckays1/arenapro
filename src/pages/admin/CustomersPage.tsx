import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { CustomerWithMetrics, Reservation } from '../../types';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  Calendar, 
  Plus, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Repeat, 
  ChevronRight, 
  Eye, 
  Activity, 
  UserCheck, 
  UserX,
  Filter
} from 'lucide-react';

export const CustomersPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { activeArena } = useAuth();
  const [customers, setCustomers] = useState<CustomerWithMetrics[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'RECURRING'>('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithMetrics | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    if (!activeArena) return;
    setLoading(true);
    try {
      const data = await arenaService.getCustomersWithMetrics(activeArena.id);
      setCustomers(data);
    } catch (err) {
      console.error('Error loading customer metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeArena]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // Search term
      const matchesSearch = 
        c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'ACTIVE') return c.isActive;
      if (statusFilter === 'INACTIVE') return c.isInactive;
      if (statusFilter === 'RECURRING') return c.isRecurring;
      return true;
    });
  }, [customers, searchTerm, statusFilter]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(c => c.isActive).length;
    const inactive = customers.filter(c => c.isInactive).length;
    const recurring = customers.filter(c => c.isRecurring).length;
    const totalSpentSum = customers.reduce((sum, c) => sum + c.totalSpent, 0);

    return { total, active, inactive, recurring, totalSpentSum };
  }, [customers]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeArena) return;
    setErrorMsg('');

    try {
      await arenaService.createCustomer({
        arena_id: activeArena.id,
        user_id: null,
        full_name: newCustomerForm.fullName,
        phone: newCustomerForm.phone,
        email: newCustomerForm.email || null,
        notes: newCustomerForm.notes || null,
        status: 'ACTIVE',
      });
      setShowCreateModal(false);
      setNewCustomerForm({ fullName: '', phone: '', email: '', notes: '' });
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao cadastrar cliente.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Gestão de Clientes</h1>
          <p className="text-xs text-slate-400">
            Inteligência de base: clientes ativos, inativos, histórico e recorrência.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>NOVO CLIENTE</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400">Total de Clientes</span>
          <div className="mt-2 text-2xl font-black text-white">{stats.total}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Cadastrados na arena</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400">Clientes Ativos</span>
          <div className="mt-2 text-2xl font-black text-emerald-400">{stats.active}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Reserva nos últimos 30 dias</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400">Clientes Inativos</span>
          <div className="mt-2 text-2xl font-black text-amber-400">{stats.inactive}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">&gt; 30 dias sem reserva</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400">Recorrentes</span>
          <div className="mt-2 text-2xl font-black text-purple-400">{stats.recurring}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">&ge; 2 reservas válidas</span>
        </div>
      </div>

      {/* Search & Filter Tabs */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-emerald-300'
            }`}
          >
            Ativos ({stats.active})
          </button>
          <button
            onClick={() => setStatusFilter('INACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'INACTIVE'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            Inativos ({stats.inactive})
          </button>
          <button
            onClick={() => setStatusFilter('RECURRING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'RECURRING'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-purple-300'
            }`}
          >
            Recorrentes ({stats.recurring})
          </button>
        </div>
      </div>

      {/* Customer Cards Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs">
          Nenhum cliente encontrado com os filtros aplicados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => {
            const formattedLastRes = customer.lastReservationDate 
              ? new Date(customer.lastReservationDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : 'Nenhuma';

            const formattedNextRes = customer.nextReservationDate
              ? new Date(customer.nextReservationDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              : null;

            return (
              <div
                key={customer.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg space-y-4 transition flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges & Name */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{customer.full_name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{customer.phone}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {customer.isActive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          ATIVO
                        </span>
                      )}
                      {customer.isInactive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          INATIVO
                        </span>
                      )}
                      {customer.isRecurring && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          RECORRENTE
                        </span>
                      )}
                    </div>
                  </div>

                  {customer.email && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
                      <Mail className="w-3 h-3 text-slate-500" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}

                  {/* Metrics Block */}
                  <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Total de Reservas</span>
                      <span className="text-xs font-black text-slate-200">
                        {customer.totalReservations} ({customer.completedReservations + customer.confirmedReservations} válidas)
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Total Gasto</span>
                      <span className="text-xs font-black text-emerald-400">
                        R$ {customer.totalSpent.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Dates info */}
                  <div className="mt-3 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Última reserva:</span>
                      <span className="font-semibold text-slate-300">
                        {formattedLastRes} {customer.daysSinceLastReservation !== null && `(há ${customer.daysSinceLastReservation} dias)`}
                      </span>
                    </div>
                    {formattedNextRes && (
                      <div className="flex items-center justify-between text-emerald-400 font-semibold">
                        <span>Próxima reserva:</span>
                        <span>{formattedNextRes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => setSelectedCustomer(customer)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ver Histórico &amp; Detalhes</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: HISTÓRICO & DETALHES DO CLIENTE */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">{selectedCustomer.full_name}</h3>
                  {selectedCustomer.isActive && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      ATIVO
                    </span>
                  )}
                  {selectedCustomer.isInactive && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      INATIVO (&gt;30d)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Telefone: <span className="text-slate-200">{selectedCustomer.phone}</span>
                  {selectedCustomer.email && ` • E-mail: ${selectedCustomer.email}`}
                </p>
              </div>

              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Metrics Overview */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div>
                <span className="text-[10px] font-semibold text-slate-400">Total Gasto</span>
                <p className="text-base font-black text-emerald-400">
                  R$ {selectedCustomer.totalSpent.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400">Reservas Válidas</span>
                <p className="text-base font-black text-slate-200">
                  {selectedCustomer.completedReservations + selectedCustomer.confirmedReservations} de {selectedCustomer.totalReservations}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400">Cancelamentos</span>
                <p className="text-base font-black text-rose-400">
                  {selectedCustomer.cancelledReservations}
                </p>
              </div>
            </div>

            {selectedCustomer.notes && (
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-300 italic">
                "{selectedCustomer.notes}"
              </div>
            )}

            {/* Reservation History List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Histórico de Reservas ({selectedCustomer.reservations.length})
              </h4>

              {selectedCustomer.reservations.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Nenhuma reserva registrada para este cliente.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedCustomer.reservations.map((res) => {
                    const dateStr = new Date(res.start_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const timeStart = new Date(res.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const timeEnd = new Date(res.end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const isPaid = res.payment_status === 'PAID';
                    const isCancelled = res.status === 'CANCELLED';

                    return (
                      <div
                        key={res.id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-200">
                            {res.court?.name || 'Quadra'} • {dateStr}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {timeStart} às {timeEnd} • {res.notes || 'Sem observações'}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-slate-200 block">
                            R$ {res.amount.toFixed(2)}
                          </span>
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                            isCancelled 
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : isPaid 
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}>
                            {isCancelled ? 'CANCELADA' : isPaid ? 'PAGO' : 'PENDENTE'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO CLIENTE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Cadastrar Novo Cliente</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo"
                  value={newCustomerForm.fullName}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Telefone / WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="(11) 99999-8888"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail (opcional)</label>
                <input
                  type="email"
                  placeholder="cliente@exemplo.com"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Observações</label>
                <textarea
                  rows={2}
                  placeholder="Notas adicionais sobre o cliente..."
                  value={newCustomerForm.notes}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
