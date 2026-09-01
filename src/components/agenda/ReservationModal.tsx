import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  CreditCard, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Ban, 
  Search,
  Phone,
  Mail,
  FileText
} from 'lucide-react';
import { Court, Customer, PaymentMethod, PaymentStatus, Reservation, ReservationStatus } from '../../types';
import { arenaService } from '../../services/arena.service';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  arenaId: string;
  courts: Court[];
  customers: Customer[];
  initialData?: Partial<Reservation> | null;
  mode?: 'create' | 'edit' | 'view';
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  arenaId,
  courts,
  customers: initialCustomers,
  initialData,
  mode: initialMode = 'create',
}) => {
  const [mode, setMode] = useState<'create' | 'edit' | 'view'>(initialMode);
  const [customersList, setCustomersList] = useState<Customer[]>(initialCustomers);

  // Form fields
  const [courtId, setCourtId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('18:00');
  const [endTime, setEndTime] = useState<string>('19:00');
  const [customerId, setCustomerId] = useState<string>('');
  const [status, setStatus] = useState<ReservationStatus>('CONFIRMED');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PENDING');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [notes, setNotes] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<string>('');

  // Quick Customer Creation
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');

  // Search customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    setCustomersList(initialCustomers);
  }, [initialCustomers]);

  // Sync state when initialData or mode changes
  useEffect(() => {
    if (!isOpen) return;

    setMode(initialMode);
    setErrorMessage(null);
    setConflictWarning(null);
    setConfirmCancel(false);
    setIsCreatingNewCustomer(false);

    if (initialData) {
      if (initialData.court_id) setCourtId(initialData.court_id);
      else if (courts.length > 0) setCourtId(courts[0].id);

      if (initialData.customer_id) {
        setCustomerId(initialData.customer_id);
        const matched = initialCustomers.find(c => c.id === initialData.customer_id);
        if (matched) setCustomerSearch(matched.full_name);
      } else {
        setCustomerId('');
        setCustomerSearch('');
      }

      if (initialData.start_at) {
        const d = new Date(initialData.start_at);
        setDate(d.toISOString().split('T')[0]);
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        setStartTime(`${hh}:${mm}`);
      } else {
        setDate(new Date().toISOString().split('T')[0]);
        setStartTime('18:00');
      }

      if (initialData.end_at) {
        const d = new Date(initialData.end_at);
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        setEndTime(`${hh}:${mm}`);
      } else {
        setEndTime('19:00');
      }

      if (initialData.status) setStatus(initialData.status);
      if (initialData.payment_status) setPaymentStatus(initialData.payment_status);
      if (initialData.payment_method) setPaymentMethod(initialData.payment_method);
      if (initialData.notes !== undefined) setNotes(initialData.notes || '');
      if (initialData.amount !== undefined) setCustomAmount(String(initialData.amount));
      else setCustomAmount('');
    } else {
      if (courts.length > 0) setCourtId(courts[0].id);
      setDate(new Date().toISOString().split('T')[0]);
      setStartTime('18:00');
      setEndTime('19:00');
      setCustomerId('');
      setCustomerSearch('');
      setStatus('CONFIRMED');
      setPaymentStatus('PENDING');
      setPaymentMethod('PIX');
      setNotes('');
      setCustomAmount('');
    }
  }, [isOpen, initialData, initialMode, courts, initialCustomers]);

  // Selected Court Info
  const selectedCourt = useMemo(() => {
    return courts.find(c => c.id === courtId);
  }, [courts, courtId]);

  // Calculate Duration in hours
  const calculatedDurationHours = useMemo(() => {
    if (!startTime || !endTime) return 1;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const diff = (endH * 60 + endM) - (startH * 60 + startM);
    if (diff <= 0) return 0;
    return diff / 60;
  }, [startTime, endTime]);

  // Suggested Amount
  const calculatedAmount = useMemo(() => {
    if (customAmount !== '') return parseFloat(customAmount) || 0;
    if (!selectedCourt) return 0;
    return selectedCourt.price * (calculatedDurationHours > 0 ? calculatedDurationHours : 1);
  }, [customAmount, selectedCourt, calculatedDurationHours]);

  // ISO timestamps
  const startAtISO = useMemo(() => {
    if (!date || !startTime) return '';
    return `${date}T${startTime}:00.000Z`;
  }, [date, startTime]);

  const endAtISO = useMemo(() => {
    if (!date || !endTime) return '';
    return `${date}T${endTime}:00.000Z`;
  }, [date, endTime]);

  // Real-time conflict validation
  useEffect(() => {
    if (!isOpen || !arenaId || !courtId || !startAtISO || !endAtISO || calculatedDurationHours <= 0) {
      setConflictWarning(null);
      return;
    }

    let isMounted = true;
    const checkConflict = async () => {
      try {
        const [reservations, blocks] = await Promise.all([
          arenaService.getReservations(arenaId),
          arenaService.getCourtBlocks(arenaId),
        ]);

        const conflict = arenaService.checkReservationOverlap(
          reservations,
          courtId,
          startAtISO,
          endAtISO,
          initialData?.id,
          blocks
        );

        if (isMounted) {
          if (conflict) {
            setConflictWarning('Atenção: A quadra selecionada já possui uma reserva ou bloqueio neste intervalo de horário.');
          } else {
            setConflictWarning(null);
          }
        }
      } catch (e) {
        console.error('Error checking conflict:', e);
      }
    };

    checkConflict();
    return () => { isMounted = false; };
  }, [isOpen, arenaId, courtId, startAtISO, endAtISO, calculatedDurationHours, initialData?.id]);

  // Customer Filtering
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customersList.slice(0, 5);
    return customersList
      .filter(c => 
        c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone.includes(customerSearch)
      )
      .slice(0, 6);
  }, [customersList, customerSearch]);

  const handleSelectCustomer = (cust: Customer) => {
    setCustomerId(cust.id);
    setCustomerSearch(cust.full_name);
    setShowCustomerDropdown(false);
  };

  const handleQuickCreateCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      setErrorMessage('Informe ao menos o Nome e Telefone do novo cliente.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const created = await arenaService.createCustomer({
        arena_id: arenaId,
        full_name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        email: newCustomerEmail.trim() || null,
        status: 'ACTIVE',
      });
      setCustomersList(prev => [created, ...prev]);
      setCustomerId(created.id);
      setCustomerSearch(created.full_name);
      setIsCreatingNewCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao cadastrar cliente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!courtId) {
      setErrorMessage('Selecione uma quadra.');
      return;
    }
    if (!date || !startTime || !endTime) {
      setErrorMessage('Preencha a data e horários de início e término.');
      return;
    }
    if (calculatedDurationHours <= 0) {
      setErrorMessage('O horário de término deve ser posterior ao horário de início.');
      return;
    }

    let targetCustomerId = customerId;
    if (isCreatingNewCustomer) {
      if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
        setErrorMessage('Informe o Nome e Telefone do novo cliente.');
        return;
      }
      setLoading(true);
      try {
        const created = await arenaService.createCustomer({
          arena_id: arenaId,
          full_name: newCustomerName.trim(),
          phone: newCustomerPhone.trim(),
          email: newCustomerEmail.trim() || null,
          status: 'ACTIVE',
        });
        targetCustomerId = created.id;
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao criar cliente');
        setLoading(false);
        return;
      }
    } else if (!targetCustomerId) {
      setErrorMessage('Selecione ou cadastre um cliente para esta reserva.');
      return;
    }

    if (conflictWarning) {
      setErrorMessage('Não é possível salvar: conflito de horário com outra reserva ou bloqueio na quadra.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'edit' && initialData?.id) {
        await arenaService.updateReservation(
          initialData.id,
          {
            court_id: courtId,
            customer_id: targetCustomerId,
            start_at: startAtISO,
            end_at: endAtISO,
            status,
            amount: calculatedAmount,
            payment_status: paymentStatus,
            payment_method: paymentMethod,
            notes: notes.trim() || null,
          },
          arenaId
        );
      } else {
        await arenaService.createReservation({
          arena_id: arenaId,
          court_id: courtId,
          customer_id: targetCustomerId,
          start_at: startAtISO,
          end_at: endAtISO,
          status,
          amount: calculatedAmount,
          payment_status: paymentStatus,
          payment_method: paymentMethod,
          notes: notes.trim() || null,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar reserva.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!initialData?.id) return;
    setLoading(true);
    try {
      await arenaService.cancelReservation(initialData.id, arenaId);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao cancelar reserva.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReservation = async () => {
    if (!initialData?.id) return;
    if (!window.confirm('Tem certeza que deseja excluir permanentemente esta reserva?')) return;
    setLoading(true);
    try {
      await arenaService.deleteReservation(initialData.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao excluir reserva.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-scaleUp max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
              mode === 'view' 
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : mode === 'edit'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {mode === 'view' && 'Detalhes da Reserva'}
                {mode === 'edit' && 'Editar Reserva'}
                {mode === 'create' && 'Nova Reserva na Grade'}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'view' && 'Visualização completa dos dados da reserva'}
                {mode === 'edit' && 'Altere os dados, horários ou status'}
                {mode === 'create' && 'Agende um horário para um cliente com validação anti-conflito'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error / Conflict Banners */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {conflictWarning && (
          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{conflictWarning}</span>
          </div>
        )}

        {/* Form Body */}
        <form id="reservation-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Court Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Quadra / Campo *</span>
              {selectedCourt && (
                <span className="text-[11px] text-emerald-400 font-normal">
                  R$ {selectedCourt.price.toFixed(2)}/hora • {selectedCourt.modality?.name}
                </span>
              )}
            </label>
            <select
              id="res-court-select"
              disabled={mode === 'view'}
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
            >
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.name} ({court.modality?.name || 'Modalidade'}) — R$ {court.price.toFixed(2)}/h
                </option>
              ))}
            </select>
          </div>

          {/* Date and Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Data *</label>
              <input
                id="res-date-input"
                type="date"
                disabled={mode === 'view'}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Início *</label>
              <input
                id="res-start-time"
                type="time"
                step="1800"
                disabled={mode === 'view'}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Término *</label>
              <input
                id="res-end-time"
                type="time"
                step="1800"
                disabled={mode === 'view'}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Customer Selection or Quick Create */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cliente *</span>
              </label>

              {mode !== 'view' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewCustomer(!isCreatingNewCustomer);
                    setCustomerId('');
                    setCustomerSearch('');
                  }}
                  className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isCreatingNewCustomer ? 'Buscar Existente' : '+ Novo Cliente'}</span>
                </button>
              )}
            </div>

            {isCreatingNewCustomer ? (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <input
                      id="new-customer-name"
                      type="text"
                      placeholder="Nome completo *"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <input
                      id="new-customer-phone"
                      type="tel"
                      placeholder="WhatsApp / Telefone *"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <input
                    id="new-customer-email"
                    type="email"
                    placeholder="E-mail (opcional)"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="customer-search-input"
                    type="text"
                    disabled={mode === 'view'}
                    placeholder="Digite o nome ou telefone do cliente..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!e.target.value) setCustomerId('');
                    }}
                    onFocus={() => mode !== 'view' && setShowCustomerDropdown(true)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-70"
                  />
                </div>

                {showCustomerDropdown && mode !== 'view' && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-800">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 text-center">
                        Nenhum cliente encontrado. Clique em "+ Novo Cliente" acima.
                      </div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          className="p-2.5 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <div className="font-semibold text-slate-200">{c.full_name}</div>
                            <div className="text-[10px] text-slate-400">{c.phone} {c.email ? `• ${c.email}` : ''}</div>
                          </div>
                          {customerId === c.id && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pricing and Payment Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Valor Total (R$)</span>
              </label>
              <input
                id="res-amount-input"
                type="number"
                step="0.01"
                disabled={mode === 'view'}
                value={calculatedAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Status Pagamento</label>
              <select
                id="res-payment-status"
                disabled={mode === 'view'}
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              >
                <option value="PENDING">Pendente (A Pagar)</option>
                <option value="PAID">Pago Integralmente</option>
                <option value="PARTIAL">Parcial / Sinal</option>
                <option value="REFUNDED">Estornado</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Forma Pagamento</label>
              <select
                id="res-payment-method"
                disabled={mode === 'view'}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              >
                <option value="PIX">PIX</option>
                <option value="CREDIT_CARD">Cartão de Crédito</option>
                <option value="DEBIT_CARD">Cartão de Débito</option>
                <option value="CASH">Dinheiro / Espécie</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>
          </div>

          {/* Reservation Status & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Status da Reserva</label>
              <select
                id="res-status-select"
                disabled={mode === 'view'}
                value={status}
                onChange={(e) => setStatus(e.target.value as ReservationStatus)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              >
                <option value="CONFIRMED">Confirmada</option>
                <option value="PENDING">Pendente</option>
                <option value="COMPLETED">Concluída (Jogo Realizado)</option>
                <option value="CANCELLED">Cancelada</option>
                <option value="NO_SHOW">Não Compareceu (No-Show)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Observações</span>
              </label>
              <input
                id="res-notes-input"
                type="text"
                disabled={mode === 'view'}
                placeholder="Ex: Aluguel de raquetes, mensalista..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {mode === 'view' ? (
            <div className="flex items-center gap-2 w-full justify-between">
              <div className="flex items-center gap-2">
                {initialData?.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Cancelar Reserva</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDeleteReservation}
                  className="p-2 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  Editar Dados
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              {mode === 'edit' && initialData?.status !== 'CANCELLED' ? (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancelar Reserva</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  form="reservation-form"
                  disabled={loading || Boolean(conflictWarning)}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  {loading ? 'Salvando...' : mode === 'edit' ? 'Salvar Alterações' : 'Confirmar Reserva'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cancel Confirmation Dialog */}
        {confirmCancel && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-4 z-30">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Ban className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Cancelar esta Reserva?</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                O horário será liberado imediatamente na grade da arena para novas reservas.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelReservation}
                disabled={loading}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-rose-500/20"
              >
                {loading ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
