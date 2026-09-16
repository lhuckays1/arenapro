/**
 * ============================================================
 * ArenaPro - Utilitários de Data e Hora da Agenda
 * ============================================================
 *
 * A agenda trabalha com o horário local da arena.
 *
 * A arena utiliza:
 * America/Sao_Paulo
 *
 * O banco continua armazenando timestamps ISO/UTC.
 *
 * Exemplo:
 *
 * Horário escolhido na agenda:
 * 15/09/2026 18:00
 *
 * Banco:
 * 2026-09-15T21:00:00.000Z
 *
 * Exibição:
 * 18:00
 */

export const ARENA_TIMEZONE = 'America/Sao_Paulo';

/**
 * ============================================================
 * HOJE
 * ============================================================
 */

export function getTodayArenaDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARENA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find(
    part => part.type === 'year'
  )?.value;

  const month = parts.find(
    part => part.type === 'month'
  )?.value;

  const day = parts.find(
    part => part.type === 'day'
  )?.value;

  if (!year || !month || !day) {
    return '';
  }

  return `${year}-${month}-${day}`;
}

/**
 * ============================================================
 * DATA YYYY-MM-DD
 * ============================================================
 */

export function parseCalendarDate(
  dateString: string
): Date {
  return new Date(
    `${dateString}T12:00:00`
  );
}

/**
 * ============================================================
 * ADICIONAR DIAS
 * ============================================================
 */

export function addCalendarDays(
  dateString: string,
  amount: number
): string {
  const date =
    parseCalendarDate(dateString);

  date.setDate(
    date.getDate() + amount
  );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * ============================================================
 * CONVERTER DATA + HORA LOCAL DA ARENA PARA UTC
 * ============================================================
 *
 * IMPORTANTE:
 *
 * Não usamos:
 *
 * new Date(`${date}T${time}:00Z`)
 *
 * porque isso interpreta o horário como UTC.
 *
 * Para São Paulo:
 *
 * 18:00 local
 * =
 * 21:00 UTC
 *
 * ============================================================
 */

export function buildArenaDateTime(
  date: string,
  time: string
): string {
  if (!date || !time) {
    return '';
  }

  const normalizedTime =
    time.length === 5
      ? `${time}:00`
      : time;

  /**
   * America/Sao_Paulo atualmente utiliza
   * UTC-03:00.
   *
   * Mantemos o offset explícito para garantir
   * que 18:00 continue sendo 18:00 na agenda.
   */
  const dateTime =
    new Date(
      `${date}T${normalizedTime}-03:00`
    );

  if (
    Number.isNaN(
      dateTime.getTime()
    )
  ) {
    return '';
  }

  return dateTime.toISOString();
}

/**
 * ============================================================
 * DATA LOCAL DA ARENA
 * ============================================================
 */

export function getArenaDate(
  value:
    | string
    | Date
    | null
    | undefined
): string {
  if (!value) {
    return '';
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  const parts =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          ARENA_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }
    ).formatToParts(date);

  const year =
    parts.find(
      part =>
        part.type === 'year'
    )?.value;

  const month =
    parts.find(
      part =>
        part.type === 'month'
    )?.value;

  const day =
    parts.find(
      part =>
        part.type === 'day'
    )?.value;

  if (!year || !month || !day) {
    return '';
  }

  return `${year}-${month}-${day}`;
}

/**
 * ============================================================
 * HORÁRIO LOCAL DA ARENA
 * ============================================================
 */

export function getArenaTime(
  value:
    | string
    | Date
    | null
    | undefined
): string {
  if (!value) {
    return '';
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      timeZone:
        ARENA_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }
  ).format(date);
}

/**
 * ============================================================
 * HORA LOCAL
 * ============================================================
 */

export function getArenaHour(
  value:
    | string
    | Date
    | null
    | undefined
): number {
  const time =
    getArenaTime(value);

  if (!time) {
    return -1;
  }

  return parseInt(
    time.split(':')[0],
    10
  );
}

/**
 * ============================================================
 * MINUTO LOCAL
 * ============================================================
 */

export function getArenaMinutes(
  value:
    | string
    | Date
    | null
    | undefined
): number {
  const time =
    getArenaTime(value);

  if (!time) {
    return -1;
  }

  return parseInt(
    time.split(':')[1],
    10
  );
}

/**
 * ============================================================
 * DATA + HORA PARA EXIBIÇÃO
 * ============================================================
 */

export function formatArenaDateTime(
  value:
    | string
    | Date
    | null
    | undefined
): string {
  if (!value) {
    return '';
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      timeZone:
        ARENA_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }
  ).format(date);
}

/**
 * ============================================================
 * SOMENTE DATA
 * ============================================================
 */

export function formatArenaDate(
  value:
    | string
    | Date
    | null
    | undefined
): string {
  if (!value) {
    return '';
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      timeZone:
        ARENA_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  ).format(date);
}

/**
 * ============================================================
 * SOMENTE HORA
 * ============================================================
 */

export function formatArenaTime(
  value:
    | string
    | Date
    | null
    | undefined
): string {
  return getArenaTime(value);
}

/**
 * ============================================================
 * PRÓXIMA HORA
 * ============================================================
 */

export function nextHour(
  hour: string
): string {
  const [hourPart, minutePart = '00'] =
    hour.split(':');

  const currentHour =
    parseInt(hourPart, 10);

  if (
    Number.isNaN(
      currentHour
    )
  ) {
    return '19:00';
  }

  const next =
    (currentHour + 1) % 24;

  return `${String(next).padStart(
    2,
    '0'
  )}:${minutePart}`;
}

/**
 * ============================================================
 * SOBREPOSIÇÃO DE HORÁRIOS
 * ============================================================
 */

export function hasTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const aStart =
    new Date(startA).getTime();

  const aEnd =
    new Date(endA).getTime();

  const bStart =
    new Date(startB).getTime();

  const bEnd =
    new Date(endB).getTime();

  return (
    aStart < bEnd &&
    aEnd > bStart
  );
}