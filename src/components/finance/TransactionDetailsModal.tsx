import React, { useState } from 'react';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  CreditCard, 
  Tag, 
  User, 
  FileText, 
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { FinancialTransaction } from '../../types';
import { arenaService } from '../../services/arena.service';

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: FinancialTransaction | null;
  onTransactionUpdated: () => void;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onTransactionUpdated,
}) => {
  if (!isOpen || !transaction) return null;

  const [isVoiding, setIsVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isIncome = transaction.type === 'INCOME';
  const isVoid = transaction.status === 'VOID';

  const categoryLabels: Record<string, string> = {
    RESERVATION: 'Locação de Quadra',
    SERVICE: 'Aulas / Clínicas',
    BAR: 'Bar & Lanchonete',
    ENERGY: 'Energia Elétrica',
    WATER: 'Água & Gelo',
    MAINTENANCE: 'Manutenção / Areia',
    EQUIPMENT: 'Equipamentos',
    STAFF: 'Equipe / Folha',
    RENT: 'Aluguel do Espaço',
    MARKETING: 'Marketing & Divulgação',
    TAX: 'Impostos & Taxas',
    OTHER: 'Outros / Diversos',
  };

  const paymentLabels: Record<string, string> = {
    PIX: 'PIX (Imediato)',
    CREDIT_CARD: 'Cartão de Crédito',
    DEBIT_CARD: 'Cartão de Débito',
    CASH: 'Dinheiro',
    BANK_TRANSFER: 'Transferência Bancária',
    OTHER: 'Outro',
  };

  const handleConfirmVoid = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await arenaService.voidFinancialTransaction(transaction.id, voidReason);
      onTransactionUpdated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao estornar transação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold border ${
                isVoid
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : isIncome
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {isIncome ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Detalhes do Lançamento</h3>
                {isVoid && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    ANULADO
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">ID: {transaction.id}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Big Display */}
        <div className="text-center p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {isIncome ? 'Entrada / Receita' : 'Saída / Despesa'}
          </span>
          <div
            className={`text-2xl font-black ${
              isVoid
                ? 'line-through text-slate-500'
                : isIncome
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {isIncome ? '+' : '-'}{' '}
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              transaction.amount
            )}
          </div>
          <p className="text-xs text-slate-300 font-medium">{transaction.description}</p>
        </div>

        {/* Metadata Details List */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-teal-400" />
              Categoria
            </span>
            <span className="font-semibold text-white">
              {categoryLabels[transaction.category] || transaction.category}
            </span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              Data de Competência
            </span>
            <span className="font-semibold text-white">
              {new Date(transaction.transaction_date + 'T12:00:00.000Z').toLocaleDateString('pt-BR')}
            </span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-teal-400" />
              Forma de Pagamento
            </span>
            <span className="font-semibold text-white">
              {paymentLabels[transaction.payment_method] || transaction.payment_method}
            </span>
          </div>

          {transaction.customer && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-400" />
                Cliente Vinculado
              </span>
              <span className="font-semibold text-teal-300">
                {transaction.customer.full_name}
              </span>
            </div>
          )}

          {transaction.notes && (
            <div className="py-2 px-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Observações
              </span>
              <p className="text-slate-300">{transaction.notes}</p>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Void / Estorno confirmation section */}
        {!isVoid && !isVoiding && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsVoiding(true)}
              className="w-full py-2.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Ban className="w-4 h-4" />
              <span>Estornar / Anular Lançamento</span>
            </button>
          </div>
        )}

        {isVoiding && !isVoid && (
          <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 space-y-3">
            <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Confirmar Anulação do Lançamento</span>
            </div>
            <p className="text-[11px] text-slate-400">
              O lançamento não será excluído para manter a rastreabilidade contábil (audit trail), mas seu valor deixará de somar no saldo e faturamento.
            </p>
            <input
              type="text"
              placeholder="Motivo da anulação (Ex: Lançamento duplicado)"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-rose-500/30 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsVoiding(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmVoid}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Anulando...' : 'Confirmar Anulação'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
