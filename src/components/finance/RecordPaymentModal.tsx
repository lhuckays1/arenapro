import React, { useState } from 'react';
import { 
  X, 
  DollarSign, 
  CreditCard, 
  CheckCircle2, 
  Calendar, 
  FileText, 
  User, 
  AlertCircle,
  Clock
} from 'lucide-react';
import { PaymentMethod, Reservation } from '../../types';
import { arenaService } from '../../services/arena.service';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  pendingAmount?: number;
  onPaymentSuccess: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  reservation,
  pendingAmount: defaultPending,
  onPaymentSuccess,
}) => {
  if (!isOpen || !reservation) return null;

  const totalAmount = reservation.amount || 0;
  const initialPending = defaultPending !== undefined ? defaultPending : totalAmount;

  const [amount, setAmount] = useState<number>(initialPending > 0 ? initialPending : totalAmount);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setErrorMsg('O valor a ser recebido deve ser superior a R$ 0,00.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await arenaService.registerReservationPayment({
        reservationId: reservation.id,
        amount: Number(amount),
        paymentMethod,
        transactionDate,
        notes: notes.trim() || undefined,
      });

      onPaymentSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const paymentMethodsList: { value: PaymentMethod; label: string; icon: string }[] = [
    { value: 'PIX', label: 'PIX (Imediato)', icon: '💠' },
    { value: 'CREDIT_CARD', label: 'Cartão de Crédito', icon: '💳' },
    { value: 'DEBIT_CARD', label: 'Cartão de Débito', icon: '💳' },
    { value: 'CASH', label: 'Dinheiro (Espécie)', icon: '💵' },
    { value: 'BANK_TRANSFER', label: 'Transferência / TED', icon: '🏦' },
    { value: 'OTHER', label: 'Outro Método', icon: '🏷️' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Registrar Pagamento</h3>
              <p className="text-xs text-slate-400">
                Liquidação e baixa de reserva na arena
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

        {/* Reservation summary badge */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-400" />
              {reservation.customer?.full_name || 'Cliente'}
            </span>
            <span className="text-xs font-medium text-slate-400">
              {reservation.court?.name || 'Quadra'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Valor Total</span>
              <p className="text-xs font-bold text-white">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Pendente</span>
              <p className="text-xs font-bold text-amber-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(initialPending)}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Status Atual</span>
              <p className="text-[10px] font-bold text-teal-400 mt-0.5">
                {reservation.payment_status}
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Valor a Receber (R$)
              </label>
              {initialPending > 0 && amount !== initialPending && (
                <button
                  type="button"
                  onClick={() => setAmount(initialPending)}
                  className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                >
                  Quitar Total Pendente ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(initialPending)})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-teal-400" />
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethodsList.map((m) => (
                <button
                  type="button"
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`p-2.5 rounded-xl border text-left text-xs font-medium transition flex items-center gap-2 cursor-pointer ${
                    paymentMethod === m.value
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              Data do Recebimento
            </label>
            <input
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Observações / Comprovante (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Recebido no balcão / Comprovante enviado no WhatsApp"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 text-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Registrando...' : 'Confirmar Recebimento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
