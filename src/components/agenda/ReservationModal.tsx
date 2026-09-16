import React, {
  useState,
  useEffect,
  useMemo,
} from 'react';

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
  FileText,
} from 'lucide-react';

import {
  Court,
  Customer,
  PaymentMethod,
  PaymentStatus,
  Reservation,
  ReservationStatus,
} from '../../types';

import { arenaService } from '../../services/arena.service';

import {
  addCalendarDays,
  buildArenaDateTime,
  getArenaDate,
  getArenaTime,
  getTodayArenaDate,
} from '../../utils/agendaDate';

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

type ModalMode =
  | 'create'
  | 'edit'
  | 'view';

const timeToMinutes = (
  time: string
): number => {
  const [hours, minutes] =
    time.split(':').map(Number);

  return (
    (hours || 0) * 60 +
    (minutes || 0)
  );
};

const calculateDurationMinutes = (
  startTime: string,
  endTime: string
): number => {
  if (
    !startTime ||
    !endTime
  ) {
    return 0;
  }

  const start =
    timeToMinutes(
      startTime
    );

  let end =
    timeToMinutes(
      endTime
    );

  /*
   * Permite:
   *
   * 23:00 -> 00:00
   *
   * como uma reserva que termina
   * no dia seguinte.
   */
  if (
    end <= start &&
    endTime === '00:00'
  ) {
    end += 1440;
  }

  return end - start;
};

export const ReservationModal: React.FC<
  ReservationModalProps
> = ({
  isOpen,
  onClose,
  onSuccess,
  arenaId,
  courts,
  customers: initialCustomers,
  initialData,
  mode: initialMode = 'create',
}) => {
  // ==========================================================
  // MODE
  // ==========================================================

  const [
    mode,
    setMode,
  ] =
    useState<ModalMode>(
      initialMode
    );

  // ==========================================================
  // CUSTOMERS
  // ==========================================================

  const [
    customersList,
    setCustomersList,
  ] =
    useState<Customer[]>(
      initialCustomers
    );

  // ==========================================================
  // FORM
  // ==========================================================

  const [
    courtId,
    setCourtId,
  ] =
    useState<string>('');

  const [
    date,
    setDate,
  ] =
    useState<string>('');

  const [
    startTime,
    setStartTime,
  ] =
    useState<string>(
      '18:00'
    );

  const [
    endTime,
    setEndTime,
  ] =
    useState<string>(
      '19:00'
    );

  const [
    customerId,
    setCustomerId,
  ] =
    useState<string>('');

  const [
    status,
    setStatus,
  ] =
    useState<ReservationStatus>(
      'CONFIRMED'
    );

  const [
    paymentStatus,
    setPaymentStatus,
  ] =
    useState<PaymentStatus>(
      'PENDING'
    );

  const [
    paymentMethod,
    setPaymentMethod,
  ] =
    useState<PaymentMethod>(
      'PIX'
    );

  const [
    notes,
    setNotes,
  ] =
    useState<string>('');

  const [
    customAmount,
    setCustomAmount,
  ] =
    useState<string>('');

  // ==========================================================
  // QUICK CUSTOMER CREATION
  // ==========================================================

  const [
    isCreatingNewCustomer,
    setIsCreatingNewCustomer,
  ] =
    useState<boolean>(
      false
    );

  const [
    newCustomerName,
    setNewCustomerName,
  ] =
    useState<string>('');

  const [
    newCustomerPhone,
    setNewCustomerPhone,
  ] =
    useState<string>('');

  const [
    newCustomerEmail,
    setNewCustomerEmail,
  ] =
    useState<string>('');

  // ==========================================================
  // CUSTOMER SEARCH
  // ==========================================================

  const [
    customerSearch,
    setCustomerSearch,
  ] =
    useState<string>('');

  const [
    showCustomerDropdown,
    setShowCustomerDropdown,
  ] =
    useState<boolean>(
      false
    );

  // ==========================================================
  // UI
  // ==========================================================

  const [
    loading,
    setLoading,
  ] =
    useState<boolean>(
      false
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    conflictWarning,
    setConflictWarning,
  ] =
    useState<
      string | null
    >(null);

  const [
    confirmCancel,
    setConfirmCancel,
  ] =
    useState<boolean>(
      false
    );

  const [
    confirmDelete,
    setConfirmDelete,
  ] =
    useState<boolean>(
      false
    );

  // ==========================================================
  // SYNC CUSTOMERS
  // ==========================================================

  useEffect(() => {
    setCustomersList(
      initialCustomers
    );
  }, [
    initialCustomers,
  ]);

  // ==========================================================
  // SYNC FORM
  // ==========================================================

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setMode(
      initialMode
    );

    setErrorMessage(
      null
    );

    setConflictWarning(
      null
    );

    setConfirmCancel(
      false
    );

    setConfirmDelete(
      false
    );

    setIsCreatingNewCustomer(
      false
    );

    if (initialData) {
      // ------------------------------------------------------
      // COURT
      // ------------------------------------------------------

      if (
        initialData.court_id
      ) {
        setCourtId(
          initialData.court_id
        );
      } else if (
        courts.length > 0
      ) {
        setCourtId(
          courts[0].id
        );
      }

      // ------------------------------------------------------
      // CUSTOMER
      // ------------------------------------------------------

      if (
        initialData.customer_id
      ) {
        setCustomerId(
          initialData.customer_id
        );

        const matched =
          initialCustomers.find(
            (customer) =>
              customer.id ===
              initialData.customer_id
          );

        if (matched) {
          setCustomerSearch(
            matched.full_name
          );
        } else if (
          initialData.customer?.full_name
        ) {
          setCustomerSearch(
            initialData.customer.full_name
          );
        }
      } else {
        setCustomerId('');
        setCustomerSearch('');
      }

      // ------------------------------------------------------
      // START
      // ------------------------------------------------------

      if (
        initialData.start_at
      ) {
        setDate(
          getArenaDate(
            initialData.start_at
          )
        );

        setStartTime(
          getArenaTime(
            initialData.start_at
          )
        );
      } else {
        setDate(
          getTodayArenaDate()
        );

        setStartTime(
          '18:00'
        );
      }

      // ------------------------------------------------------
      // END
      // ------------------------------------------------------

      if (
        initialData.end_at
      ) {
        setEndTime(
          getArenaTime(
            initialData.end_at
          )
        );
      } else {
        setEndTime(
          '19:00'
        );
      }

      // ------------------------------------------------------
      // STATUS
      // ------------------------------------------------------

      setStatus(
        initialData.status ||
          'CONFIRMED'
      );

      setPaymentStatus(
        initialData.payment_status ||
          'PENDING'
      );

      setPaymentMethod(
        initialData.payment_method ||
          'PIX'
      );

      setNotes(
        initialData.notes ||
          ''
      );

      if (
        initialData.amount !==
        undefined &&
        initialData.amount !==
        null
      ) {
        setCustomAmount(
          String(
            initialData.amount
          )
        );
      } else {
        setCustomAmount('');
      }

    } else {
      // ======================================================
      // NEW RESERVATION
      // ======================================================

      if (
        courts.length > 0
      ) {
        setCourtId(
          courts[0].id
        );
      } else {
        setCourtId('');
      }

      setDate(
        getTodayArenaDate()
      );

      setStartTime(
        '18:00'
      );

      setEndTime(
        '19:00'
      );

      setCustomerId('');

      setCustomerSearch('');

      setStatus(
        'CONFIRMED'
      );

      setPaymentStatus(
        'PENDING'
      );

      setPaymentMethod(
        'PIX'
      );

      setNotes('');

      setCustomAmount('');

      setIsCreatingNewCustomer(
        false
      );

      setNewCustomerName(
        ''
      );

      setNewCustomerPhone(
        ''
      );

      setNewCustomerEmail(
        ''
      );
    }
  }, [
    isOpen,
    initialData,
    initialMode,
    courts,
    initialCustomers,
  ]);

  // ==========================================================
  // SELECTED COURT
  // ==========================================================

  const selectedCourt =
    useMemo(() => {
      return courts.find(
        (court) =>
          court.id ===
          courtId
      );
    }, [
      courts,
      courtId,
    ]);

  // ==========================================================
  // DURATION
  // ==========================================================

  const calculatedDurationMinutes =
    useMemo(() => {
      return calculateDurationMinutes(
        startTime,
        endTime
      );
    }, [
      startTime,
      endTime,
    ]);

  const calculatedDurationHours =
    useMemo(() => {
      if (
        calculatedDurationMinutes <=
        0
      ) {
        return 0;
      }

      return (
        calculatedDurationMinutes /
        60
      );
    }, [
      calculatedDurationMinutes,
    ]);

  // ==========================================================
  // CALCULATED AMOUNT
  // ==========================================================

  const calculatedAmount =
    useMemo(() => {
      if (
        customAmount !==
        ''
      ) {
        const parsed =
          Number(
            String(
              customAmount
            ).replace(
              ',',
              '.'
            )
          );

        return Number.isFinite(
          parsed
        )
          ? parsed
          : 0;
      }

      if (
        !selectedCourt
      ) {
        return 0;
      }

      const duration =
        calculatedDurationHours >
        0
          ? calculatedDurationHours
          : 1;

      return (
        Number(
          selectedCourt.price ||
            0
        ) *
        duration
      );
    }, [
      customAmount,
      selectedCourt,
      calculatedDurationHours,
    ]);

  // ==========================================================
  // TIMESTAMPS
  // ==========================================================

  const startAtISO =
    useMemo(() => {
      if (
        !date ||
        !startTime
      ) {
        return '';
      }

      return buildArenaDateTime(
        date,
        startTime
      );
    }, [
      date,
      startTime,
    ]);

  const endAtISO =
    useMemo(() => {
      if (
        !date ||
        !endTime
      ) {
        return '';
      }

      /*
       * Caso especial:
       *
       * 23:00 -> 00:00
       *
       * O término pertence ao
       * dia seguinte.
       */
      const startMinutes =
        timeToMinutes(
          startTime
        );

      const endMinutes =
        timeToMinutes(
          endTime
        );

      const endDate =
        endTime ===
          '00:00' &&
        endMinutes <=
          startMinutes
          ? addCalendarDays(
              date,
              1
            )
          : date;

      return buildArenaDateTime(
        endDate,
        endTime
      );
    }, [
      date,
      startTime,
      endTime,
    ]);

  // ==========================================================
  // CONFLICT VALIDATION
  // ==========================================================

  useEffect(() => {
    if (
      !isOpen ||
      !arenaId ||
      !courtId ||
      !startAtISO ||
      !endAtISO ||
      calculatedDurationMinutes <=
        0
    ) {
      setConflictWarning(
        null
      );

      return;
    }

    let isMounted =
      true;

    const checkConflict =
      async () => {
        try {
          const [
            reservations,
            blocks,
          ] =
            await Promise.all([
              arenaService.getReservations(
                arenaId
              ),

              arenaService.getCourtBlocks(
                arenaId
              ),
            ]);

          const conflict =
            arenaService.checkReservationOverlap(
              reservations,
              courtId,
              startAtISO,
              endAtISO,
              initialData?.id,
              blocks
            );

          if (
            !isMounted
          ) {
            return;
          }

          if (conflict) {
            setConflictWarning(
              'Atenção: A quadra selecionada já possui uma reserva ou bloqueio neste intervalo de horário.'
            );
          } else {
            setConflictWarning(
              null
            );
          }
        } catch (
          error
        ) {
          console.error(
            'Erro ao verificar conflito:',
            error
          );
        }
      };

    checkConflict();

    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    arenaId,
    courtId,
    startAtISO,
    endAtISO,
    calculatedDurationMinutes,
    initialData?.id,
  ]);

  // ==========================================================
  // CUSTOMER FILTER
  // ==========================================================

  const filteredCustomers =
    useMemo(() => {
      const search =
        customerSearch
          .trim()
          .toLowerCase();

      if (!search) {
        return customersList.slice(
          0,
          6
        );
      }

      return customersList
        .filter(
          (customer) =>
            customer.full_name
              .toLowerCase()
              .includes(
                search
              ) ||
            String(
              customer.phone ||
                ''
            ).includes(
              customerSearch
            )
        )
        .slice(
          0,
          6
        );
    }, [
      customersList,
      customerSearch,
    ]);

  // ==========================================================
  // SELECT CUSTOMER
  // ==========================================================

  const handleSelectCustomer =
    (
      customer: Customer
    ) => {
      setCustomerId(
        customer.id
      );

      setCustomerSearch(
        customer.full_name
      );

      setShowCustomerDropdown(
        false
      );

      setIsCreatingNewCustomer(
        false
      );
    };

  // ==========================================================
  // QUICK CREATE CUSTOMER
  // ==========================================================

  const handleQuickCreateCustomer =
    async () => {
      if (
        !newCustomerName.trim() ||
        !newCustomerPhone.trim()
      ) {
        setErrorMessage(
          'Informe ao menos o Nome e Telefone do novo cliente.'
        );

        return;
      }

      setLoading(
        true
      );

      setErrorMessage(
        null
      );

      try {
        const created =
          await arenaService.createCustomer(
            {
              arena_id:
                arenaId,

              full_name:
                newCustomerName.trim(),

              phone:
                newCustomerPhone.trim(),

              email:
                newCustomerEmail.trim() ||
                null,

              status:
                'ACTIVE',
            }
          );

        setCustomersList(
          (
            current
          ) => [
            created,
            ...current.filter(
              (customer) =>
                customer.id !==
                created.id
            ),
          ]
        );

        setCustomerId(
          created.id
        );

        setCustomerSearch(
          created.full_name
        );

        setIsCreatingNewCustomer(
          false
        );

        setShowCustomerDropdown(
          false
        );

        setNewCustomerName(
          ''
        );

        setNewCustomerPhone(
          ''
        );

        setNewCustomerEmail(
          ''
        );

      } catch (
        error: any
      ) {
        console.error(
          'Erro ao cadastrar cliente:',
          error
        );

        setErrorMessage(
          error?.message ||
            'Erro ao cadastrar cliente.'
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  // ==========================================================
  // SUBMIT RESERVATION
  // ==========================================================

  const handleSubmit =
    async (
      event: React.FormEvent
    ) => {
      event.preventDefault();

      setErrorMessage(
        null
      );

      if (!courtId) {
        setErrorMessage(
          'Selecione uma quadra.'
        );

        return;
      }

      if (
        !date ||
        !startTime ||
        !endTime
      ) {
        setErrorMessage(
          'Preencha a data e os horários de início e término.'
        );

        return;
      }

      if (
        calculatedDurationMinutes <=
        0
      ) {
        setErrorMessage(
          'O horário de término deve ser posterior ao horário de início.'
        );

        return;
      }

      if (
        calculatedAmount <
        0
      ) {
        setErrorMessage(
          'O valor da reserva não pode ser negativo.'
        );

        return;
      }

      // ------------------------------------------------------
      // CUSTOMER
      // ------------------------------------------------------

      let targetCustomerId =
        customerId;

      if (
        isCreatingNewCustomer
      ) {
        if (
          !newCustomerName.trim() ||
          !newCustomerPhone.trim()
        ) {
          setErrorMessage(
            'Informe o Nome e Telefone do novo cliente.'
          );

          return;
        }

        setLoading(
          true
        );

        try {
          const created =
            await arenaService.createCustomer(
              {
                arena_id:
                  arenaId,

                full_name:
                  newCustomerName.trim(),

                phone:
                  newCustomerPhone.trim(),

                email:
                  newCustomerEmail.trim() ||
                  null,

                status:
                  'ACTIVE',
              }
            );

          setCustomersList(
            (
              current
            ) => [
              created,
              ...current,
            ]
          );

          targetCustomerId =
            created.id;

          setCustomerId(
            created.id
          );

          setCustomerSearch(
            created.full_name
          );

          setIsCreatingNewCustomer(
            false
          );

        } catch (
          error: any
        ) {
          console.error(
            'Erro ao criar cliente:',
            error
          );

          setErrorMessage(
            error?.message ||
              'Erro ao criar cliente.'
          );

          setLoading(
            false
          );

          return;
        } finally {
          setLoading(
            false
          );
        }
      }

      if (
        !targetCustomerId
      ) {
        setErrorMessage(
          'Selecione ou cadastre um cliente para esta reserva.'
        );

        return;
      }

      // ------------------------------------------------------
      // CONFLICT
      // ------------------------------------------------------

      if (
        conflictWarning
      ) {
        setErrorMessage(
          'Não é possível salvar: conflito de horário com outra reserva ou bloqueio na quadra.'
        );

        return;
      }

      // ------------------------------------------------------
      // TIMESTAMP VALIDATION
      // ------------------------------------------------------

      if (
        !startAtISO ||
        !endAtISO
      ) {
        setErrorMessage(
          'Não foi possível montar os horários da reserva.'
        );

        return;
      }

      setLoading(
        true
      );

      try {
        // ====================================================
        // EDIT
        // ====================================================

        if (
          mode ===
            'edit' &&
          initialData?.id
        ) {
          await arenaService.updateReservation(
            initialData.id,
            {
              court_id:
                courtId,

              customer_id:
                targetCustomerId,

              start_at:
                startAtISO,

              end_at:
                endAtISO,

              status,

              amount:
                calculatedAmount,

              payment_status:
                paymentStatus,

              payment_method:
                paymentMethod,

              notes:
                notes.trim() ||
                null,
            },
            arenaId
          );

        } else {
          // ==================================================
          // CREATE
          // ==================================================

          await arenaService.createReservation(
            {
              arena_id:
                arenaId,

              court_id:
                courtId,

              customer_id:
                targetCustomerId,

              start_at:
                startAtISO,

              end_at:
                endAtISO,

              status,

              amount:
                calculatedAmount,

              payment_status:
                paymentStatus,

              payment_method:
                paymentMethod,

              notes:
                notes.trim() ||
                null,
            }
          );
        }

        onSuccess();
        onClose();

      } catch (
        error: any
      ) {
        console.error(
          'Erro ao salvar reserva:',
          error
        );

        setErrorMessage(
          error?.message ||
            'Erro ao salvar reserva.'
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  // ==========================================================
  // CANCEL RESERVATION
  // ==========================================================

  const handleCancelReservation =
    async () => {
      if (
        !initialData?.id
      ) {
        setErrorMessage(
          'Reserva não identificada.'
        );

        return;
      }

      setLoading(
        true
      );

      setErrorMessage(
        null
      );

      try {
        await arenaService.cancelReservation(
          initialData.id,
          arenaId
        );

        onSuccess();
        onClose();

      } catch (
        error: any
      ) {
        console.error(
          'Erro ao cancelar reserva:',
          error
        );

        setErrorMessage(
          error?.message ||
            'Erro ao cancelar reserva.'
        );

        setConfirmCancel(
          false
        );

      } finally {
        setLoading(
          false
        );
      }
    };

  // ==========================================================
  // DELETE RESERVATION
  // ==========================================================

  const handleDeleteReservation =
    async () => {
      if (
        !initialData?.id
      ) {
        setErrorMessage(
          'Não foi possível identificar a reserva.'
        );

        return;
      }

      if (!arenaId) {
        setErrorMessage(
          'Não foi possível identificar a arena da reserva.'
        );

        return;
      }

      setLoading(
        true
      );

      setErrorMessage(
        null
      );

      try {
        /*
         * IMPORTANTE:
         *
         * O método deleteReservation
         * do arena.service.ts precisa
         * aceitar:
         *
         * deleteReservation(id, arenaId)
         */
        await arenaService.deleteReservation(
          initialData.id,
          arenaId
        );

        /*
         * Atualiza a agenda antes de fechar.
         */
        await onSuccess();

        onClose();

      } catch (
        error: any
      ) {
        console.error(
          'Erro ao excluir reserva:',
          error
        );

        setErrorMessage(
          error?.message ||
            'Erro ao excluir reserva.'
        );

        setConfirmDelete(
          false
        );

      } finally {
        setLoading(
          false
        );
      }
    };

  // ==========================================================
  // FORMAT MONEY
  // ==========================================================

  const formattedAmount =
    calculatedAmount.toLocaleString(
      'pt-BR',
      {
        minimumFractionDigits:
          2,
        maximumFractionDigits:
          2,
      }
    );

  // ==========================================================
  // CLOSED
  // ==========================================================

  if (!isOpen) {
    return null;
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">

      <div className="relative bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-scaleUp max-h-[90vh] flex flex-col">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">

          <div className="flex items-center gap-3">

            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                mode ===
                'view'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : mode ===
                    'edit'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              <Calendar className="w-5 h-5" />
            </div>

            <div>

              <h3 className="text-base font-bold text-white">

                {mode ===
                  'view' &&
                  'Detalhes da Reserva'}

                {mode ===
                  'edit' &&
                  'Editar Reserva'}

                {mode ===
                  'create' &&
                  'Nova Reserva na Grade'}

              </h3>

              <p className="text-xs text-slate-400">

                {mode ===
                  'view' &&
                  'Visualização completa dos dados da reserva'}

                {mode ===
                  'edit' &&
                  'Altere os dados, horários ou status'}

                {mode ===
                  'create' &&
                  'Agende um horário para um cliente com validação anti-conflito'}

              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              loading
            }
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>

        </div>

        {/* ====================================================
            ERRORS
        ==================================================== */}

        {errorMessage && (

          <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 shrink-0">

            <AlertCircle className="w-4 h-4 shrink-0" />

            <span>
              {errorMessage}
            </span>

          </div>

        )}

        {conflictWarning && (

          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 shrink-0">

            <AlertCircle className="w-4 h-4 shrink-0" />

            <span>
              {conflictWarning}
            </span>

          </div>

        )}

        {/* ====================================================
            FORM
        ==================================================== */}

        <form
          id="reservation-form"
          onSubmit={
            handleSubmit
          }
          className="flex-1 overflow-y-auto space-y-4 pr-1"
        >

          {/* ==================================================
              COURT
          ================================================== */}

          <div className="space-y-1.5">

            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">

              <span>
                Quadra / Campo *
              </span>

              {selectedCourt && (

                <span className="text-[11px] text-emerald-400 font-normal">

                  R${' '}
                  {Number(
                    selectedCourt.price ||
                      0
                  ).toFixed(
                    2
                  )}
                  /hora

                  {' • '}

                  {selectedCourt.modality
                    ?.name ||
                    'Modalidade'}

                </span>

              )}

            </label>

            <select
              id="res-court-select"
              disabled={
                mode ===
                'view'
              }
              value={
                courtId
              }
              onChange={(
                event
              ) =>
                setCourtId(
                  event.target
                    .value
                )
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
            >

              {courts.length ===
              0 ? (

                <option value="">
                  Nenhuma quadra disponível
                </option>

              ) : (

                courts.map(
                  (
                    court
                  ) => (

                    <option
                      key={
                        court.id
                      }
                      value={
                        court.id
                      }
                    >
                      {court.name}
                      {' ('}
                      {court.modality
                        ?.name ||
                        'Modalidade'}
                      {')'}
                      {' — R$ '}
                      {Number(
                        court.price ||
                          0
                      ).toFixed(
                        2
                      )}
                      /h
                    </option>

                  )
                )

              )}

            </select>

          </div>

          {/* ==================================================
              DATE / TIME
          ================================================== */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />

                Data *
              </label>

              <input
                id="res-date-input"
                type="date"
                disabled={
                  mode ===
                  'view'
                }
                value={
                  date
                }
                onChange={(
                  event
                ) =>
                  setDate(
                    event.target
                      .value
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              />

            </div>

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />

                Início *
              </label>

              <input
                id="res-start-time"
                type="time"
                step="1800"
                disabled={
                  mode ===
                  'view'
                }
                value={
                  startTime
                }
                onChange={(
                  event
                ) =>
                  setStartTime(
                    event.target
                      .value
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              />

            </div>

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />

                Término *
              </label>

              <input
                id="res-end-time"
                type="time"
                step="1800"
                disabled={
                  mode ===
                  'view'
                }
                value={
                  endTime
                }
                onChange={(
                  event
                ) =>
                  setEndTime(
                    event.target
                      .value
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              />

            </div>

          </div>

          {/* ==================================================
              DURATION
          ================================================== */}

          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">

            <div className="flex items-center gap-2 text-xs text-slate-400">

              <Clock className="w-4 h-4 text-teal-400" />

              <span>
                Duração
              </span>

            </div>

            <span
              className={`text-xs font-black ${
                calculatedDurationMinutes >
                0
                  ? 'text-white'
                  : 'text-rose-400'
              }`}
            >
              {calculatedDurationMinutes >
              0
                ? `${calculatedDurationHours}h`
                : 'Horário inválido'}
            </span>

          </div>

          {/* ==================================================
              CUSTOMER
          ================================================== */}

          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">

            <div className="flex items-center justify-between">

              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">

                <User className="w-3.5 h-3.5 text-emerald-400" />

                <span>
                  Cliente *
                </span>

              </label>

              {mode !==
                'view' && (

                <button
                  type="button"
                  onClick={() => {

                    setIsCreatingNewCustomer(
                      (
                        current
                      ) =>
                        !current
                    );

                    setShowCustomerDropdown(
                      false
                    );

                    setErrorMessage(
                      null
                    );

                  }}
                  className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >

                  <Plus className="w-3 h-3" />

                  {isCreatingNewCustomer
                    ? 'Selecionar cliente'
                    : 'Novo cliente'}

                </button>

              )}

            </div>

            {!isCreatingNewCustomer ? (

              <div className="relative">

                <div className="relative">

                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />

                  <input
                    type="text"
                    disabled={
                      mode ===
                      'view'
                    }
                    placeholder="Buscar cliente por nome ou telefone..."
                    value={
                      customerSearch
                    }
                    onFocus={() =>
                      setShowCustomerDropdown(
                        true
                      )
                    }
                    onChange={(
                      event
                    ) => {

                      setCustomerSearch(
                        event.target
                          .value
                      );

                      setCustomerId(
                        ''
                      );

                      setShowCustomerDropdown(
                        true
                      );

                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                  />

                </div>

                {showCustomerDropdown &&
                  mode !==
                    'view' && (

                  <div className="absolute z-40 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">

                    {filteredCustomers.length >
                    0 ? (

                      filteredCustomers.map(
                        (
                          customer
                        ) => (

                          <button
                            key={
                              customer.id
                            }
                            type="button"
                            onClick={() =>
                              handleSelectCustomer(
                                customer
                              )
                            }
                            className="w-full text-left px-3 py-2.5 hover:bg-slate-800 transition cursor-pointer border-b border-slate-800/60 last:border-0"
                          >

                            <div className="flex items-center gap-2">

                              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5" />
                              </div>

                              <div className="min-w-0">

                                <div className="text-xs font-bold text-slate-200 truncate">
                                  {
                                    customer.full_name
                                  }
                                </div>

                                <div className="text-[10px] text-slate-500">
                                  {
                                    customer.phone
                                  }
                                </div>

                              </div>

                            </div>

                          </button>

                        )
                      )

                    ) : (

                      <div className="p-4 text-center">

                        <p className="text-xs text-slate-400">
                          Nenhum cliente encontrado.
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            setIsCreatingNewCustomer(
                              true
                            )
                          }
                          className="mt-2 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          Cadastrar novo cliente
                        </button>

                      </div>

                    )}

                  </div>

                )}

              </div>

            ) : (

              <div className="space-y-3">

                <div>

                  <label className="text-[10px] font-semibold text-slate-400 mb-1 block">
                    Nome completo *
                  </label>

                  <div className="relative">

                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />

                    <input
                      type="text"
                      value={
                        newCustomerName
                      }
                      onChange={(
                        event
                      ) =>
                        setNewCustomerName(
                          event.target
                            .value
                        )
                      }
                      placeholder="Nome do cliente"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />

                  </div>

                </div>

                <div>

                  <label className="text-[10px] font-semibold text-slate-400 mb-1 block">
                    Telefone / WhatsApp *
                  </label>

                  <div className="relative">

                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />

                    <input
                      type="text"
                      value={
                        newCustomerPhone
                      }
                      onChange={(
                        event
                      ) =>
                        setNewCustomerPhone(
                          event.target
                            .value
                        )
                      }
                      placeholder="(34) 99999-9999"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />

                  </div>

                </div>

                <div>

                  <label className="text-[10px] font-semibold text-slate-400 mb-1 block">
                    E-mail
                  </label>

                  <div className="relative">

                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />

                    <input
                      type="email"
                      value={
                        newCustomerEmail
                      }
                      onChange={(
                        event
                      ) =>
                        setNewCustomerEmail(
                          event.target
                            .value
                        )
                      }
                      placeholder="cliente@email.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />

                  </div>

                </div>

                <button
                  type="button"
                  onClick={
                    handleQuickCreateCustomer
                  }
                  disabled={
                    loading
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {loading
                    ? 'Cadastrando...'
                    : 'Cadastrar e Selecionar Cliente'}
                </button>

              </div>

            )}

          </div>

          {/* ==================================================
              PAYMENT
          ================================================== */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* AMOUNT */}

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">

                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />

                Valor da reserva

              </label>

              <input
                id="res-amount"
                type="number"
                min="0"
                step="0.01"
                disabled={
                  mode ===
                  'view'
                }
                value={
                  customAmount !==
                  ''
                    ? customAmount
                    : calculatedAmount
                }
                onChange={(
                  event
                ) =>
                  setCustomAmount(
                    event.target
                      .value
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              />

              {customAmount ===
                '' &&
                selectedCourt && (

                <p className="text-[9px] text-slate-500">
                  Calculado automaticamente:
                  {' '}
                  {selectedCourt.price.toFixed(
                    2
                  )}
                  /h ×{' '}
                  {calculatedDurationHours}
                  h
                </p>

              )}

            </div>

            {/* PAYMENT STATUS */}

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">

                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />

                Status Pagamento

              </label>

              <select
                id="res-payment-status"
                disabled={
                  mode ===
                  'view'
                }
                value={
                  paymentStatus
                }
                onChange={(
                  event
                ) =>
                  setPaymentStatus(
                    event.target
                      .value as PaymentStatus
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              >

                <option value="PENDING">
                  Pendente (A Pagar)
                </option>

                <option value="PAID">
                  Pago Integralmente
                </option>

                <option value="PARTIAL">
                  Parcial / Sinal
                </option>

                <option value="REFUNDED">
                  Estornado
                </option>

              </select>

            </div>

            {/* PAYMENT METHOD */}

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">

                <CreditCard className="w-3.5 h-3.5 text-blue-400" />

                Forma Pagamento

              </label>

              <select
                id="res-payment-method"
                disabled={
                  mode ===
                  'view'
                }
                value={
                  paymentMethod
                }
                onChange={(
                  event
                ) =>
                  setPaymentMethod(
                    event.target
                      .value as PaymentMethod
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              >

                <option value="PIX">
                  PIX
                </option>

                <option value="CREDIT_CARD">
                  Cartão de Crédito
                </option>

                <option value="DEBIT_CARD">
                  Cartão de Débito
                </option>

                <option value="CASH">
                  Dinheiro / Espécie
                </option>

                <option value="OTHER">
                  Outro
                </option>

              </select>

            </div>

          </div>

          {/* ==================================================
              RESERVATION STATUS + NOTES
          ================================================== */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* STATUS */}

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300">
                Status da Reserva
              </label>

              <select
                id="res-status-select"
                disabled={
                  mode ===
                  'view'
                }
                value={
                  status
                }
                onChange={(
                  event
                ) =>
                  setStatus(
                    event.target
                      .value as ReservationStatus
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              >

                <option value="CONFIRMED">
                  Confirmada
                </option>

                <option value="PENDING">
                  Pendente
                </option>

                <option value="COMPLETED">
                  Concluída (Jogo Realizado)
                </option>

                <option value="CANCELLED">
                  Cancelada
                </option>

                <option value="NO_SHOW">
                  Não Compareceu (No-Show)
                </option>

              </select>

            </div>

            {/* NOTES */}

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">

                <FileText className="w-3.5 h-3.5 text-slate-500" />

                Observações

              </label>

              <textarea
                id="res-notes"
                rows={3}
                disabled={
                  mode ===
                  'view'
                }
                value={
                  notes
                }
                onChange={(
                  event
                ) =>
                  setNotes(
                    event.target
                      .value
                  )
                }
                placeholder="Observações da reserva..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              />

            </div>

          </div>

          {/* ==================================================
              RESERVATION SUMMARY
          ================================================== */}

          <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">

            <div className="flex flex-wrap items-center justify-between gap-2">

              <div className="flex items-center gap-2">

                <Clock className="w-4 h-4 text-emerald-400" />

                <span className="text-xs text-slate-400">
                  Período
                </span>

                <span className="text-xs font-bold text-white">
                  {date
                    ? new Date(
                        `${date}T12:00:00`
                      ).toLocaleDateString(
                        'pt-BR'
                      )
                    : '--/--/----'}
                </span>

                <span className="text-xs font-mono font-bold text-teal-400">
                  {startTime}
                  {' - '}
                  {endTime}
                </span>

              </div>

              <div className="flex items-center gap-1.5">

                <DollarSign className="w-4 h-4 text-emerald-400" />

                <span className="text-xs font-black text-emerald-400">
                  R${' '}
                  {formattedAmount}
                </span>

              </div>

            </div>

          </div>

        </form>

        {/* ====================================================
            FOOTER
        ==================================================== */}

        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">

          {mode ===
          'view' ? (

            <div className="flex items-center gap-2 w-full justify-between">

              <div className="flex items-center gap-2">

                {initialData?.status !==
                  'CANCELLED' && (

                  <button
                    type="button"
                    onClick={() =>
                      setConfirmCancel(
                        true
                      )
                    }
                    disabled={
                      loading
                    }
                    className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" />

                    <span>
                      Cancelar Reserva
                    </span>

                  </button>

                )}

                <button
                  type="button"
                  onClick={() =>
                    setConfirmDelete(
                      true
                    )
                  }
                  disabled={
                    loading
                  }
                  className="px-3 py-2 bg-rose-500/5 hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-500/20 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Excluir permanentemente"
                >
                  <Trash2 className="w-4 h-4" />

                  <span className="text-xs font-bold">
                    Excluir
                  </span>

                </button>

              </div>

              <div className="flex items-center gap-2">

                <button
                  type="button"
                  onClick={
                    onClose
                  }
                  disabled={
                    loading
                  }
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setMode(
                      'edit'
                    )
                  }
                  disabled={
                    loading
                  }
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  Editar Dados
                </button>

              </div>

            </div>

          ) : (

            <div className="flex items-center justify-between w-full">

              {mode ===
                'edit' &&
              initialData?.status !==
                'CANCELLED' ? (

                <button
                  type="button"
                  onClick={() =>
                    setConfirmCancel(
                      true
                    )
                  }
                  disabled={
                    loading
                  }
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" />

                  <span>
                    Cancelar Reserva
                  </span>

                </button>

              ) : (

                <div />

              )}

              <div className="flex items-center gap-2">

                <button
                  type="button"
                  onClick={
                    onClose
                  }
                  disabled={
                    loading
                  }
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Voltar
                </button>

                <button
                  type="submit"
                  form="reservation-form"
                  disabled={
                    loading ||
                    Boolean(
                      conflictWarning
                    )
                  }
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  {loading
                    ? 'Salvando...'
                    : mode ===
                      'edit'
                    ? 'Salvar Alterações'
                    : 'Confirmar Reserva'}
                </button>

              </div>

            </div>

          )}

        </div>

        {/* ====================================================
            CANCEL CONFIRMATION
        ==================================================== */}

        {confirmCancel && (

          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-4 z-40">

            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Ban className="w-6 h-6" />
            </div>

            <div>

              <h4 className="text-base font-bold text-white">
                Cancelar esta Reserva?
              </h4>

              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                O horário será liberado imediatamente na grade da arena para novas reservas.
              </p>

            </div>

            <div className="flex items-center gap-3 pt-2">

              <button
                type="button"
                onClick={() =>
                  setConfirmCancel(
                    false
                  )
                }
                disabled={
                  loading
                }
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={
                  handleCancelReservation
                }
                disabled={
                  loading
                }
                className="px-5 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-rose-500/20 disabled:opacity-50"
              >
                {loading
                  ? 'Cancelando...'
                  : 'Confirmar Cancelamento'}
              </button>

            </div>

          </div>

        )}

        {/* ====================================================
            DELETE CONFIRMATION
        ==================================================== */}

        {confirmDelete && (

          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-4 z-40">

            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>

              <h4 className="text-base font-bold text-white">
                Excluir esta Reserva?
              </h4>

              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                A reserva será removida permanentemente da agenda. Esta ação não poderá ser desfeita.
              </p>

              {initialData?.customer?.full_name && (

                <p className="text-xs font-bold text-slate-200 mt-3">
                  {initialData.customer.full_name}
                </p>

              )}

            </div>

            <div className="flex items-center gap-3 pt-2">

              <button
                type="button"
                onClick={() =>
                  setConfirmDelete(
                    false
                  )
                }
                disabled={
                  loading
                }
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={
                  handleDeleteReservation
                }
                disabled={
                  loading
                }
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />

                {loading
                  ? 'Excluindo...'
                  : 'Excluir Permanentemente'}

              </button>

            </div>

          </div>

        )}

      </div>

    </div>
  );
};