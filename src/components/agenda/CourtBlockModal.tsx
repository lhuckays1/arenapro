import React, {
  useState,
  useEffect,
} from 'react';

import {
  X,
  Lock,
  AlertCircle,
  Trash2,
  Calendar,
  Clock,
  ShieldAlert,
} from 'lucide-react';

import {
  Court,
  CourtBlock,
} from '../../types';

import {
  arenaService,
} from '../../services/arena.service';

import {
  addCalendarDays,
  buildArenaDateTime,
  getArenaDate,
  getArenaTime,
  getTodayArenaDate,
} from '../../utils/agendaDate';

interface CourtBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  arenaId: string;
  courts: Court[];
  initialData?: Partial<CourtBlock> | null;
}

const COMMON_REASONS = [
  'Manutenção / Nivelamento de Areia',
  'Chuva / Condições Climáticas',
  'Evento Corporativo / Torneio',
  'Aula da Escolinha / Treino Fixo',
  'Reforma / Troca de Iluminação',
  'Outro Motivo Operacional',
];

export const CourtBlockModal: React.FC<
  CourtBlockModalProps
> = ({
  isOpen,
  onClose,
  onSuccess,
  arenaId,
  courts,
  initialData,
}) => {

  // ==========================================================
  // STATE
  // ==========================================================

  const [courtId, setCourtId] =
    useState<string>('');

  const [date, setDate] =
    useState<string>('');

  const [startTime, setStartTime] =
    useState<string>('14:00');

  const [endTime, setEndTime] =
    useState<string>('16:00');

  const [reason, setReason] =
    useState<string>(
      COMMON_REASONS[0]
    );

  const [customReason, setCustomReason] =
    useState<string>('');

  const [notes, setNotes] =
    useState<string>('');

  const [loading, setLoading] =
    useState<boolean>(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  // ==========================================================
  // INITIAL DATA
  // ==========================================================

  useEffect(() => {

    if (!isOpen) {
      return;
    }

    setErrorMessage(null);

    if (initialData) {

      // ------------------------------------------------------
      // QUADRA
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
      // INÍCIO
      // ------------------------------------------------------

      if (
        initialData.start_at
      ) {

        /*
         * O banco guarda UTC.
         *
         * Aqui convertemos para o
         * horário local da arena.
         */

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
          '14:00'
        );

      }

      // ------------------------------------------------------
      // FIM
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
          '16:00'
        );

      }

      // ------------------------------------------------------
      // MOTIVO
      // ------------------------------------------------------

      if (
        initialData.reason
      ) {

        if (
          COMMON_REASONS.includes(
            initialData.reason
          )
        ) {

          setReason(
            initialData.reason
          );

          setCustomReason('');

        } else {

          setReason(
            'Outro Motivo Operacional'
          );

          setCustomReason(
            initialData.reason
          );

        }

      } else {

        setReason(
          COMMON_REASONS[0]
        );

        setCustomReason('');

      }

      // ------------------------------------------------------
      // OBSERVAÇÕES
      // ------------------------------------------------------

      setNotes(
        initialData.notes ||
          ''
      );

    } else {

      // ------------------------------------------------------
      // NOVO BLOQUEIO
      // ------------------------------------------------------

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
        '14:00'
      );

      setEndTime(
        '16:00'
      );

      setReason(
        COMMON_REASONS[0]
      );

      setCustomReason('');

      setNotes('');

    }

  }, [
    isOpen,
    initialData,
    courts,
  ]);

  // ==========================================================
  // ISO DO BLOQUEIO
  // ==========================================================

  const buildBlockDateTimes =
    () => {

      if (
        !date ||
        !startTime ||
        !endTime
      ) {
        return null;
      }

      const [
        startHour,
        startMinute,
      ] =
        startTime
          .split(':')
          .map(Number);

      const [
        endHour,
        endMinute,
      ] =
        endTime
          .split(':')
          .map(Number);

      const startMinutes =
        startHour * 60 +
        startMinute;

      const endMinutes =
        endHour * 60 +
        endMinute;

      /*
       * Se o término for 00:00 depois
       * de um início no dia anterior,
       * o término pertence ao dia seguinte.
       */

      const endDate =
        endMinutes <=
          startMinutes
          ? addCalendarDays(
              date,
              1
            )
          : date;

      const startAt =
        buildArenaDateTime(
          date,
          startTime
        );

      const endAt =
        buildArenaDateTime(
          endDate,
          endTime
        );

      return {
        startAt,
        endAt,
      };
    };

  // ==========================================================
  // SUBMIT
  // ==========================================================

  const handleSubmit = async (
    event: React.FormEvent
  ) => {

    event.preventDefault();

    setErrorMessage(null);

    if (
      !courtId
    ) {

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

    const finalReason =
      reason ===
        'Outro Motivo Operacional' &&
      customReason.trim()
        ? customReason.trim()
        : reason;

    if (
      !finalReason
    ) {

      setErrorMessage(
        'Informe o motivo do bloqueio.'
      );

      return;
    }

    const dateTimes =
      buildBlockDateTimes();

    if (!dateTimes) {

      setErrorMessage(
        'Não foi possível calcular o intervalo do bloqueio.'
      );

      return;
    }

    const {
      startAt,
      endAt,
    } = dateTimes;

    if (
      new Date(
        endAt
      ).getTime() <=
      new Date(
        startAt
      ).getTime()
    ) {

      setErrorMessage(
        'O horário de término deve ser posterior ao horário de início.'
      );

      return;
    }

    setLoading(true);

    try {

      /*
       * O serviço atual possui criação de bloqueio.
       *
       * A tela de gerenciamento continua usando
       * exclusão para remover o bloqueio existente.
       */

      await arenaService.createCourtBlock(
        {
          arena_id:
            arenaId,

          court_id:
            courtId,

          start_at:
            startAt,

          end_at:
            endAt,

          reason:
            finalReason,

          notes:
            notes.trim() ||
            null,
        }
      );

      onSuccess();
      onClose();

    } catch (
      error: any
    ) {

      setErrorMessage(
        error?.message ||
          'Erro ao criar bloqueio.'
      );

    } finally {

      setLoading(false);

    }
  };

  // ==========================================================
  // DELETE
  // ==========================================================

  const handleDelete =
    async () => {

      if (
        !initialData?.id
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          'Deseja realmente remover este bloqueio e liberar o horário na grade?'
        );

      if (!confirmed) {
        return;
      }

      setLoading(true);

      try {

        await arenaService.deleteCourtBlock(
          initialData.id
        );

        onSuccess();
        onClose();

      } catch (
        error: any
      ) {

        setErrorMessage(
          error?.message ||
            'Erro ao remover bloqueio.'
        );

      } finally {

        setLoading(false);

      }
    };

  // ==========================================================
  // VIEW
  // ==========================================================

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">

      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scaleUp max-h-[90vh] flex flex-col">

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>

            <div>

              <h3 className="text-base font-bold text-white">

                {initialData?.id
                  ? 'Gerenciar Bloqueio de Quadra'
                  : 'Bloquear Horário na Grade'}

              </h3>

              <p className="text-xs text-slate-400">
                Impedir agendamentos de clientes por manutenção, clima ou eventos
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

        </div>

        {/* ==================================================
            ERRO
        ================================================== */}

        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">

            <AlertCircle className="w-4 h-4 shrink-0" />

            <span>
              {errorMessage}
            </span>

          </div>
        )}

        {/* ==================================================
            FORM
        ================================================== */}

        <form
          id="court-block-form"
          onSubmit={
            handleSubmit
          }
          className="flex-1 overflow-y-auto space-y-4 pr-1"
        >

          {/* QUADRA */}

          <div className="space-y-1.5">

            <label className="text-xs font-semibold text-slate-300">
              Quadra / Campo *
            </label>

            <select
              id="block-court-select"
              disabled={
                Boolean(
                  initialData?.id
                )
              }
              value={
                courtId
              }
              onChange={(event) =>
                setCourtId(
                  event.target.value
                )
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
            >

              {courts.map(
                (court) => (
                  <option
                    key={
                      court.id
                    }
                    value={
                      court.id
                    }
                  >
                    {court.name}{' '}
                    (
                    {court.modality?.name ||
                      'Modalidade'}
                    )
                  </option>
                )
              )}

            </select>

          </div>

          {/* DATA/HORA */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">

                <Calendar className="w-3.5 h-3.5 text-slate-400" />

                Data *

              </label>

              <input
                id="block-date-input"
                type="date"
                disabled={
                  Boolean(
                    initialData?.id
                  )
                }
                value={
                  date
                }
                onChange={(event) =>
                  setDate(
                    event.target.value
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
              />

            </div>

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">

                <Clock className="w-3.5 h-3.5 text-slate-400" />

                Início *

              </label>

              <input
                id="block-start-time"
                type="time"
                step="1800"
                disabled={
                  Boolean(
                    initialData?.id
                  )
                }
                value={
                  startTime
                }
                onChange={(event) =>
                  setStartTime(
                    event.target.value
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
              />

            </div>

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">

                <Clock className="w-3.5 h-3.5 text-slate-400" />

                Término *

              </label>

              <input
                id="block-end-time"
                type="time"
                step="1800"
                disabled={
                  Boolean(
                    initialData?.id
                  )
                }
                value={
                  endTime
                }
                onChange={(event) =>
                  setEndTime(
                    event.target.value
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
              />

            </div>

          </div>

          {/* AVISO */}

          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">

            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />

            <p className="text-[10px] text-amber-300 leading-relaxed">
              O bloqueio impede novas reservas no intervalo selecionado. Reservas existentes no período podem impedir a criação do bloqueio.
            </p>

          </div>

          {/* MOTIVO */}

          <div className="space-y-1.5">

            <label className="text-xs font-semibold text-slate-300">
              Motivo do bloqueio *
            </label>

            <select
              id="block-reason-select"
              disabled={
                Boolean(
                  initialData?.id
                )
              }
              value={
                reason
              }
              onChange={(event) =>
                setReason(
                  event.target.value
                )
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
            >

              {COMMON_REASONS.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}

            </select>

          </div>

          {/* MOTIVO PERSONALIZADO */}

          {reason ===
            'Outro Motivo Operacional' && (

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300">
                Informe o motivo
              </label>

              <input
                id="block-custom-reason"
                type="text"
                disabled={
                  Boolean(
                    initialData?.id
                  )
                }
                value={
                  customReason
                }
                onChange={(event) =>
                  setCustomReason(
                    event.target.value
                  )
                }
                placeholder="Ex: Preparação para campeonato..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
              />

            </div>
          )}

          {/* OBSERVAÇÕES */}

          <div className="space-y-1.5">

            <label className="text-xs font-semibold text-slate-300">
              Observações
            </label>

            <textarea
              id="block-notes-input"
              disabled={
                Boolean(
                  initialData?.id
                )
              }
              value={
                notes
              }
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
              rows={3}
              placeholder="Informações adicionais sobre o bloqueio..."
              className="w-full resize-none bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
            />

          </div>

        </form>

        {/* ==================================================
            FOOTER
        ================================================== */}

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">

          {initialData?.id ? (

            <button
              type="button"
              onClick={
                handleDelete
              }
              disabled={
                loading
              }
              className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >

              <Trash2 className="w-3.5 h-3.5" />

              Liberar Horário

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
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Fechar
            </button>

            {!initialData?.id && (
              <button
                type="submit"
                form="court-block-form"
                disabled={
                  loading
                }
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >

                {loading
                  ? 'Bloqueando...'
                  : 'Bloquear Horário'}

              </button>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};