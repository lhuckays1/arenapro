import { addCalendarDays } from './agendaDate';

export function enrollmentEndDate(startDate: string, duration: number, unit: 'MONTHS' | 'WEEKS'): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isInteger(duration) || duration < 1 || duration > 120) {
    throw new Error('Informe a data inicial e uma duração inteira entre 1 e 120.');
  }
  const start = new Date(`${startDate}T12:00:00Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== startDate) {
    throw new Error('Data inicial inválida.');
  }
  if (unit === 'WEEKS') return addCalendarDays(startDate, duration * 7 - 1);
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + duration, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return addCalendarDays(target.toISOString().slice(0, 10), -1);
}
