import React, { useState } from 'react';
import { 
  X, 
  TrendingDown, 
  CreditCard, 
  Calendar, 
  FileText, 
  Tag, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { FinancialTransactionCategory, PaymentMethod } from '../../types';
import { arenaService } from '../../services/arena.service';

interface NewExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  arenaId: string;
  onExpenseCreated: () => void;
}

export const NewExpenseModal: React.FC<NewExpenseModalProps> = ({
  isOpen,
  onClose,
  arenaId,
  onExpenseCreated,
}) => {
  if (!isOpen) return null;

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<FinancialTransactionCategory>('MAINTENANCE');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const expenseCategories: { value: FinancialTransactionCategory; label: string; icon: string }[] = [
    { value: 'MAINTENANCE', label: 'Manutenção / Areia / Reparos', icon: '🛠️' },
    { value: 'ENERGY', label: 'Energia Elétrica / Iluminação', icon: '⚡' },
    { value: 'WATER', label: 'Água & Gelo', icon: '💧' },
    { value: 'EQUIPMENT', label: 'Bolas / Redes / Materiais', icon: '🎾' },
    { value: 'STAFF', label: 'Equipe / Folha / Diárias', icon: '👥' },
    { value: 'RENT', label: 'Aluguel do Espaço / Terreno', icon: '🏢' },
    { value: 'MARKETING', label: 'Marketing & Divulgação', icon: '📢' },
    { value: 'TAX', label: 'Impostos & Taxas', icon: '🏛️' },
    { value: 'OTHER', label: 'Outras Despesas Operacionais', icon: '📋' },
  ];

  const paymentMethodsList: { value: PaymentMethod; label: string }[] = [
    { value: 'PIX', label: 'PIX' },
    { value: 'BANK_TRANSFER', label: 'Transferência / TED' },
    { value: 'DEBIT_CARD', label: 'Débito' },
    { value: 'CREDIT_CARD', label: 'Crédito' },
    { value: 'CASH', label: 'Dinheiro' },
    { value: 'OTHER', label: 'Outro' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Informe a descrição da despesa.');
      return;
    }
    if (amount <= 0) {
      setErrorMsg('O valor da despesa deve ser maior que zero.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await arenaService.createFinancialTransaction({
        arena_id: arenaId,
        type: 'EXPENSE',
        category,
        description: description.trim(),
        amount: Number(amount),
        payment_method: paymentMethod,
        transaction_date: transactionDate,
        status: 'COMPLETED',
        notes: notes.trim() || undefined,
        created_by: 'u-admin-xp',
      });

      onExpenseCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar despesa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center font-bold">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Nova Despesa Operacional</h3>
              <p className="text-xs text-slate-400">
                Registro de saída de caixa / contas pagas
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

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Descrição da Despesa
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Troca de refletores de LED Quadra 1, Conta de Luz..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Valor (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0,00"
                  value={amount || ''}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Data do Pagamento
              </label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <Tag className="w-3 h-3 text-slate-400" />
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FinancialTransactionCategory)}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
            >
              {expenseCategories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-slate-400" />
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethodsList.map((m) => (
                <button
                  type="button"
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`p-2 rounded-xl border text-center text-xs font-medium transition cursor-pointer ${
                    paymentMethod === m.value
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-400" />
              Observações / Fornecedor / NF (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Fornecedor Areia Brasil, NF-e 4482"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
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
              className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white font-bold rounded-xl shadow-lg shadow-rose-500/20 text-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Despesa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
