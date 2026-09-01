import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { Court, Modality, Reservation, CourtBlock } from '../../types';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Sparkles,
  User,
  Mail,
  Lock,
  Phone,
  Building2,
  DollarSign,
  ShieldCheck
} from 'lucide-react';

interface ClientBookingPageProps {
  onNavigate: (path: string) => void;
  preselectedModalityId?: string;
  preselectedCourtId?: string;
}

export const ClientBookingPage: React.FC<ClientBookingPageProps> = ({
  onNavigate,
  preselectedModalityId,
  preselectedCourtId,
}) => {
  const { activeArena, user, profile, signIn, signUp } = useAuth();
  
  // Data states
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courtBlocks, setCourtBlocks] = useState<CourtBlock[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking Flow Steps: 1 (Modality) -> 2 (Court) -> 3 (Date & Time) -> 4 (Summary & Confirm)
  const [step, setStep] = useState<number>(1);
  const [selectedModalityId, setSelectedModalityId] = useState<string>(preselectedModalityId || '');
  const [selectedCourtId, setSelectedCourtId] = useState<string>(preselectedCourtId || '');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedHour, setSelectedHour] = useState<string>('');

  // Authentication interceptor state
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdReservation, setCreatedReservation] = useState<Reservation | null>(null);

  // Load Arena Data
  useEffect(() => {
    if (!activeArena) return;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [loadedMods, loadedCourts, loadedRes, loadedBlocks] = await Promise.all([
          arenaService.getModalities(activeArena.id),
          arenaService.getCourts(activeArena.id),
          arenaService.getReservations(activeArena.id),
          arenaService.getCourtBlocks(activeArena.id),
        ]);

        const activeMods = loadedMods.filter(m => m.status === 'ACTIVE');
        const activeCrts = loadedCourts.filter(c => c.status === 'ACTIVE');

        setModalities(activeMods);
        setCourts(activeCrts);
        setReservations(loadedRes);
        setCourtBlocks(loadedBlocks);

        // Pre-selection handling
        if (preselectedModalityId && activeMods.some(m => m.id === preselectedModalityId)) {
          setSelectedModalityId(preselectedModalityId);
          setStep(2);
        } else if (activeMods.length > 0 && !selectedModalityId) {
          setSelectedModalityId(activeMods[0].id);
        }

        if (preselectedCourtId && activeCrts.some(c => c.id === preselectedCourtId)) {
          setSelectedCourtId(preselectedCourtId);
          setStep(3);
        }
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar disponibilidade da arena.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeArena?.id]);

  // Filter courts by active selected modality
  const filteredCourts = courts.filter(c => c.modality_id === selectedModalityId && c.status === 'ACTIVE');
  const selectedModality = modalities.find(m => m.id === selectedModalityId);
  const selectedCourt = courts.find(c => c.id === selectedCourtId);

  // Generate next 14 days for mobile pill selector
  const todayDateObj = new Date();
  todayDateObj.setHours(0, 0, 0, 0);
  const todayStr = todayDateObj.toISOString().split('T')[0];

  const datePills = Array.from({ length: 14 }).map((_, index) => {
    const d = new Date();
    d.setDate(d.getDate() + index);
    const iso = d.toISOString().split('T')[0];
    const dayOfWeek = d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');
    const dayNumber = d.getDate();
    return { iso, dayOfWeek, dayNumber, dateObj: d };
  });

  // Calculate available time slots for selected court and date
  const timeSlots = (activeArena && selectedCourtId)
    ? arenaService.calculateCourtSlots(selectedCourtId, selectedDate, activeArena, reservations, courtBlocks)
    : [];

  // Handler for selecting date
  const handleSelectDate = (isoDate: string) => {
    if (isoDate < todayStr) return; // Prevent past dates
    setSelectedDate(isoDate);
    setSelectedHour(''); // Reset hour when date changes
  };

  // Handler to Proceed to Summary
  const handleSelectSlot = (hour: string) => {
    setSelectedHour(hour);
    setError(null);
    setStep(4);
  };

  // Auth interceptor submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authMode === 'LOGIN') {
        await signIn(authEmail, authPassword);
      } else {
        if (authPassword !== authConfirmPassword) {
          throw new Error('As senhas digitadas não coincidem.');
        }
        if (authPassword.length < 6) {
          throw new Error('A senha deve ter no mínimo 6 caracteres.');
        }
        await signUp(authFullName, authEmail, authPassword, 'CLIENT');
      }
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError(err?.message || 'Falha na autenticação.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Final Reservation Confirmation with Double Validation
  const handleConfirmBooking = async () => {
    if (!user || !profile) {
      setShowAuthModal(true);
      return;
    }

    if (!activeArena || !selectedCourtId || !selectedHour) {
      setError('Por favor, selecione a quadra, data e horário.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const startAt = `${selectedDate}T${selectedHour}:00.000Z`;
      const hourNum = parseInt(selectedHour.split(':')[0], 10);
      const nextHourNum = hourNum + 1;
      const endHourStr = nextHourNum < 10 ? `0${nextHourNum}:00` : nextHourNum === 24 ? '00:00' : `${nextHourNum}:00`;
      const endAt = `${selectedDate}T${endHourStr}:00.000Z`;

      // 1. Double check / validation against live database
      const [freshReservations, freshBlocks] = await Promise.all([
        arenaService.getReservations(activeArena.id),
        arenaService.getCourtBlocks(activeArena.id),
      ]);

      const hasConflict = arenaService.checkReservationOverlap(
        freshReservations,
        selectedCourtId,
        startAt,
        endAt,
        undefined,
        freshBlocks
      );

      if (hasConflict) {
        throw new Error('Este horário acabou de ser reservado. Escolha outro horário.');
      }

      // 2. Associate or create Customer without duplication
      const customer = await arenaService.getOrCreateCustomerForUser(activeArena.id, {
        id: user.id,
        email: user.email,
        full_name: profile.full_name,
        phone: profile.phone || '(11) 99999-9999',
      });

      // 3. Create reservation with status CONFIRMED and payment_status PENDING
      const newReservation = await arenaService.createReservation({
        arena_id: activeArena.id,
        court_id: selectedCourtId,
        customer_id: customer.id,
        start_at: startAt,
        end_at: endAt,
        status: 'CONFIRMED',
        amount: selectedCourt?.price || 80.0,
        payment_status: 'PENDING',
        payment_method: null,
        notes: 'Reserva realizada via Portal do Cliente Online.',
        created_by: user.id,
      });

      setCreatedReservation(newReservation);
      setStep(5); // Success step
    } catch (err: any) {
      setError(err?.message || 'Erro ao processar reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center animate-pulse">
          <CalendarDays className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-slate-400">Carregando quadras e disponibilidade...</p>
      </div>
    );
  }

  // STEP 5: SUCCESS STATE
  if (step === 5 && createdReservation) {
    const formattedDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    return (
      <div className="max-w-lg mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-fadeIn">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-black text-white tracking-tight">Reserva Confirmada com Sucesso!</h2>
          <p className="text-xs text-slate-300">
            Sua partida está garantida na agenda da arena.
          </p>
        </div>

        {/* Confirmation Details Card */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-3 text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-slate-400">Arena</span>
            <span className="font-bold text-white">{activeArena?.name}</span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-slate-400">Quadra / Modalidade</span>
            <span className="font-bold text-emerald-400">
              {selectedCourt?.name} • {selectedModality?.name}
            </span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-slate-400">Data</span>
            <span className="font-semibold text-slate-200 capitalize">{formattedDate}</span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-slate-400">Horário</span>
            <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md">
              {selectedHour} → {parseInt(selectedHour.split(':')[0], 10) + 1}:00
            </span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-slate-400">Valor Total</span>
            <span className="font-black text-emerald-400 text-sm">
              R$ {(selectedCourt?.price || 80).toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Pagamento</span>
            <span className="text-amber-300 font-bold bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30 text-[11px]">
              Pagar na arena (Pendente)
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            id="view-my-reservations-btn"
            onClick={() => onNavigate('/app/minhas-reservas')}
            className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            Ver Minhas Reservas
          </button>
          <button
            id="book-another-btn"
            onClick={() => {
              setStep(1);
              setSelectedHour('');
              setCreatedReservation(null);
            }}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition cursor-pointer"
          >
            Fazer Outra Reserva
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn pb-8">
      {/* Top Breadcrumb & Step Navigator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Reservar Quadra</h1>
          <p className="text-xs text-slate-400">
            {activeArena?.name} • Agendamento online instantâneo
          </p>
        </div>

        {step > 1 && (
          <button
            id="booking-step-back-btn"
            onClick={() => setStep(step - 1)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Voltar</span>
          </button>
        )}
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-4 gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 text-center">
        {[
          { num: 1, label: 'Modalidade' },
          { num: 2, label: 'Quadra' },
          { num: 3, label: 'Data/Hora' },
          { num: 4, label: 'Confirmar' },
        ].map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <div
              key={s.num}
              onClick={() => {
                if (isDone) setStep(s.num);
              }}
              className={`py-1.5 px-1 rounded-xl text-[11px] font-bold transition ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : isDone
                  ? 'bg-slate-950 text-emerald-400 cursor-pointer'
                  : 'text-slate-500'
              }`}
            >
              <span className="hidden sm:inline">{s.num}. </span>{s.label}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: MODALIDADE */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200">1. Escolha a Modalidade</h2>
            <span className="text-xs text-slate-400">{modalities.length} disponíveis</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {modalities.map((m) => {
              const count = courts.filter(c => c.modality_id === m.id && c.status === 'ACTIVE').length;
              const isSelected = selectedModalityId === m.id;
              return (
                <div
                  key={m.id}
                  id={`select-modality-${m.id}`}
                  onClick={() => {
                    setSelectedModalityId(m.id);
                    const matchingCourts = courts.filter(c => c.modality_id === m.id && c.status === 'ACTIVE');
                    if (matchingCourts.length > 0) {
                      setSelectedCourtId(matchingCourts[0].id);
                    } else {
                      setSelectedCourtId('');
                    }
                    setStep(2);
                  }}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-lg'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-lg font-bold">
                      ⚽
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">{m.name}</h3>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{m.description || 'Esporte na areia'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {count} {count === 1 ? 'quadra ativa' : 'quadras ativas'}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                      <span>SELECIONAR</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: QUADRA */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-200">2. Escolha a Quadra</h2>
              <p className="text-[11px] text-slate-400">
                Mostrando quadras ativas para <strong className="text-emerald-400">{selectedModality?.name}</strong>
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-emerald-400 hover:underline"
            >
              Trocar modalidade
            </button>
          </div>

          {filteredCourts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400 space-y-2">
              <p>Nenhuma quadra ativa disponível para esta modalidade no momento.</p>
              <button
                onClick={() => setStep(1)}
                className="px-3 py-1.5 bg-slate-800 text-slate-200 rounded-xl font-bold text-xs"
              >
                Voltar para Modalidades
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredCourts.map((court) => {
                const isSelected = selectedCourtId === court.id;
                return (
                  <div
                    key={court.id}
                    id={`select-court-${court.id}`}
                    onClick={() => {
                      setSelectedCourtId(court.id);
                      setStep(3);
                    }}
                    className={`bg-slate-900 border rounded-2xl overflow-hidden transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {court.image_url && (
                        <div className="h-32 w-full overflow-hidden relative">
                          <img
                            src={court.image_url}
                            alt={court.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-black text-emerald-400">
                            R$ {court.price.toFixed(2)}/h
                          </div>
                        </div>
                      )}
                      <div className="p-4 space-y-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white">{court.name}</h3>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">{court.description}</p>
                        <p className="text-[11px] text-slate-500 pt-1">
                          Capacidade: até {court.capacity || 4} jogadores
                        </p>
                      </div>
                    </div>

                    <div className="p-4 pt-0">
                      <button
                        className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 font-black'
                            : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        <span>Escolher Data &amp; Horário</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: DATA & HORÁRIO */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Selected Court Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                ⚽
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">{selectedCourt?.name}</h3>
                <p className="text-[11px] text-emerald-400">
                  {selectedModality?.name} • R$ {selectedCourt?.price.toFixed(2)}/hora
                </p>
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              className="text-xs text-slate-400 hover:text-slate-200 font-semibold"
            >
              Trocar quadra
            </button>
          </div>

          {/* Date Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-emerald-400" />
                <span>Escolha o Dia do Jogo</span>
              </label>

              {/* Full Calendar Picker Input */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 hidden sm:inline">Calendário:</span>
                <input
                  id="booking-date-picker"
                  type="date"
                  min={todayStr}
                  value={selectedDate}
                  onChange={(e) => handleSelectDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-xs text-slate-200 font-semibold px-2.5 py-1 rounded-xl cursor-pointer"
                />
              </div>
            </div>

            {/* Horizontal Date Pills (Mobile-First) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {datePills.map((p) => {
                const isSelected = selectedDate === p.iso;
                return (
                  <button
                    key={p.iso}
                    id={`date-pill-${p.iso}`}
                    onClick={() => handleSelectDate(p.iso)}
                    className={`flex-shrink-0 w-16 py-2.5 rounded-2xl border text-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="block text-[10px] font-semibold opacity-80 uppercase tracking-tight">
                      {p.dayOfWeek}
                    </span>
                    <span className="block text-base font-black leading-tight mt-0.5">
                      {p.dayNumber}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hours Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Horários Disponíveis</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Funcionamento: {activeArena?.opening_time} às {activeArena?.closing_time}
              </span>
            </div>

            {timeSlots.length === 0 ? (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-slate-400">
                Nenhum horário disponível para a data selecionada.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {timeSlots.map((slot) => {
                  const isAvailable = slot.status === 'AVAILABLE';
                  const isSelected = selectedHour === slot.hour;
                  return (
                    <button
                      key={slot.hour}
                      id={`slot-btn-${slot.hour.replace(':', '')}`}
                      disabled={!isAvailable}
                      onClick={() => handleSelectSlot(slot.hour)}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-xl shadow-emerald-500/25'
                          : isAvailable
                          ? 'bg-slate-900 border-slate-800 text-white hover:border-emerald-500/50 hover:bg-slate-800'
                          : slot.status === 'BLOCKED'
                          ? 'bg-slate-950 border-slate-900 text-slate-600 opacity-50'
                          : 'bg-slate-950 border-slate-900 text-slate-600 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-black ${isSelected ? 'text-slate-950' : 'text-white'}`}>
                          {slot.hour}
                        </span>
                        <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-950' : 'text-slate-500'}`} />
                      </div>

                      <div className="mt-2 text-[10px] font-bold">
                        {isAvailable ? (
                          <span className={isSelected ? 'text-slate-900 font-extrabold' : 'text-emerald-400'}>
                            Disponível
                          </span>
                        ) : slot.status === 'BLOCKED' ? (
                          <span className="text-amber-500/70">Bloqueado</span>
                        ) : (
                          <span className="text-rose-500/70">Reservado</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: RESUMO & CONFIRMAÇÃO */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Confirmar Dados da Reserva</h2>
            <p className="text-xs text-slate-400">Verifique os detalhes antes de concluir o agendamento</p>
          </div>

          {/* Summary Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-base">
                  A
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">{activeArena?.name}</h3>
                  <p className="text-xs text-slate-400">{activeArena?.city} - {activeArena?.state}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Reserva Online
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 block text-[11px] mb-0.5">Modalidade &amp; Quadra</span>
                <span className="font-bold text-white text-sm">{selectedCourt?.name}</span>
                <span className="text-emerald-400 block text-xs mt-0.5">{selectedModality?.name}</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 block text-[11px] mb-0.5">Data &amp; Horário</span>
                <span className="font-bold text-white text-sm">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                </span>
                <span className="text-slate-300 block text-xs mt-0.5">
                  {selectedHour} → {parseInt(selectedHour.split(':')[0], 10) + 1}:00 (1 hora)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-slate-300 text-xs block font-semibold">Valor Total:</span>
                <span className="text-2xl font-black text-emerald-400">
                  R$ {(selectedCourt?.price || 80).toFixed(2)}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Forma de Pagamento:</span>
                <span className="text-xs font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg inline-block mt-0.5">
                  Pagar na arena
                </span>
              </div>
            </div>

            {/* Policy notice */}
            <div className="text-[11px] text-slate-400 flex items-start gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Cancelamento gratuito permitido com até <strong>{activeArena?.cancellation_limit_hours || 2} horas</strong> de antecedência pelo aplicativo.
              </span>
            </div>

            {/* Submit / Confirm Action */}
            <div className="pt-2">
              <button
                id="confirm-booking-btn"
                disabled={submitting}
                onClick={handleConfirmBooking}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Confirmando reserva...' : 'CONFIRMAR RESERVA'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTH INTERCEPTION MODAL (If Guest / Not Logged In) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-fadeIn">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-2">
                <User className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">Quase lá! Entre ou Cadastre-se</h3>
              <p className="text-xs text-slate-400">
                Para concluir sua reserva, entre ou crie sua conta no ArenaPro.
              </p>
            </div>

            {/* Tab switch */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                id="auth-tab-login"
                onClick={() => { setAuthMode('LOGIN'); setAuthError(null); }}
                className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  authMode === 'LOGIN' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                ENTRAR
              </button>
              <button
                type="button"
                id="auth-tab-register"
                onClick={() => { setAuthMode('REGISTER'); setAuthError(null); }}
                className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  authMode === 'REGISTER' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                CRIAR CONTA
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
              {authMode === 'REGISTER' && (
                <>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Nome Completo</label>
                    <input
                      id="auth-name-input"
                      type="text"
                      required
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Telefone / WhatsApp</label>
                    <input
                      id="auth-phone-input"
                      type="tel"
                      required
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">E-mail</label>
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Senha</label>
                <input
                  id="auth-password-input"
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs"
                />
              </div>

              {authMode === 'REGISTER' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Confirmar Senha</label>
                  <input
                    id="auth-confirm-password-input"
                    type="password"
                    required
                    value={authConfirmPassword}
                    onChange={(e) => setAuthConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="auth-modal-submit-btn"
                  type="submit"
                  disabled={authLoading}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? 'Processando...' : authMode === 'LOGIN' ? 'Entrar e Continuar' : 'Cadastrar e Continuar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
