/**
 * Traduções centralizadas da interface do ArenaPro.
 * Os valores internos do banco continuam em inglês/ENUM;
 * somente a apresentação para o usuário é traduzida para pt-BR.
 */

export const reservationStatusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Não compareceu',
};

export const paymentStatusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  PARTIAL: 'Parcial',
  REFUNDED: 'Estornado',
};

export const paymentMethodLabels: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  CASH: 'Dinheiro',
  BANK_TRANSFER: 'Transferência bancária',
  OTHER: 'Outro',
};

export const financialTransactionStatusLabels: Record<string, string> = {
  COMPLETED: 'Concluída',
  PENDING: 'Pendente',
  CANCELLED: 'Cancelada',
  VOID: 'Anulada',
};

export const financialTransactionTypeLabels: Record<string, string> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
};

export const subscriptionStatusLabels: Record<string, string> = {
  ACTIVE: 'Ativa',
  PENDING: 'Pendente',
  PAST_DUE: 'Atrasada',
  SUSPENDED: 'Suspensa',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada',
};

export const entityStatusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  MAINTENANCE: 'Em manutenção',
};

export const userRoleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador',
  ARENA_ADMIN: 'Administrador da Arena',
  ARENA_STAFF: 'Funcionário',
  CLIENT: 'Cliente',
};

export const translateReservationStatus = (status?: string | null) =>
  status ? reservationStatusLabels[status] || status : '—';

export const translatePaymentStatus = (status?: string | null) =>
  status ? paymentStatusLabels[status] || status : '—';

export const translatePaymentMethod = (method?: string | null) =>
  method ? paymentMethodLabels[method] || method : '—';

export const translateFinancialStatus = (status?: string | null) =>
  status ? financialTransactionStatusLabels[status] || status : '—';

export const translateTransactionType = (type?: string | null) =>
  type ? financialTransactionTypeLabels[type] || type : '—';

export const translateSubscriptionStatus = (status?: string | null) =>
  status ? subscriptionStatusLabels[status] || status : 'Sem assinatura';

export const translateEntityStatus = (status?: string | null) =>
  status ? entityStatusLabels[status] || status : '—';
