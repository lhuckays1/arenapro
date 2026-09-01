import React, { useState, useEffect } from 'react';
import { 
  X, 
  TrendingUp, 
  CreditCard, 
  Calendar, 
  FileText, 
  Tag, 
  User, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { FinancialTransactionCategory, PaymentMethod, Customer, Service } from '../../types';
import { arenaService } from '../../services/arena.service';

interface NewIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  arenaId: string;
  onIncomeCreated: () => void;
}

export const NewIncomeModal: React.FC<NewIncomeModalProps> = ({
  isOpen,
  onClose,
  arenaId,
  onIncomeCreated,
}) => {
  if (!isOpen) return null;

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<FinancialTransactionCategory>('BAR');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [customerId, setCustomerId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        const [custList, svcList] = await Promise.all([
          arenaService.getCustomers(arenaId),
          arenaService.getServices(arenaId),
        ]);
        setCustomers(custList);
        setServices(svcList);
      } catch (e) {
        console.error(e);
      }
    };
    if (arenaId) {
      loadDependencies();
    }
  }, [arenaId]);

  const incomeCategories: { value: FinancialTransactionCategory; label: string; icon: string }[] = [
    { value: 'BAR', label: 'Bar & Lanchonete / Bebidas', icon: '🍹' },
    { value: 'SERVICE', label: 'Aulas / Clínicas / Serviços', icon: '🎓' },
    { value: 'EQUIPMENT', label: 'Locação de Raquetes / Acessórios', icon: '🎾' },
    { value: 'OTHER', label: 'Outras Receitas / Patrocínios', icon: '💰' },
  ];

  const paymentMethodsList: { value: PaymentMethod; label: string }[] = [
    { value: 'PIX', label: 'PIX' },
    { value: 'DEBIT_CARD', label: 'Débito' },
    { value: 'CREDIT_CARD', label: 'Crédito' },
    { value: 'CASH', label: 'Dinheiro' },
    { value: 'BANK_TRANSFER', label: 'TED / Transf.' },
    { value: 'OTHER', label: 'Outro' },
  ];

  const handleSelectService = (sId: string) => {
    setServiceId(sId);
    if (sId) {
      const selected = services.find(s => s.id === sId);
      if (selected) {
        setDescription(`Serviço: ${selected.name}`);
        setAmount(selected.price);
        setCategory('SERVICE');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Informe a descrição da receita.');
      return;
    }
    if (amount <= 0) {
      setErrorMsg('O valor da receita deve ser maior que zero.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await arenaService.createFinancialTransaction({
        arena_id: arenaId,
        type: 'INCOME',
        category,
        description: description.trim(),
        amount: Number(amount),
        payment_method: paymentMethod,
        transaction_date: transactionDate,
        customer_id: customerId || undefined,
        service_id: serviceId || undefined,
        status: 'COMPLETED',
        notes: notes.trim() || undefined,
        created_by: 'u-admin-xp',
      });

      onIncomeCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar receita.');
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
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Nova Receita Avulsa / Bar</h3>
              <p className="text-xs text-slate-400">
                Registro de entrada de caixa e venda de serviços
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
          {/* Quick preset from Services if available */}
          {services.length > 0 && (
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-semibold text-teal-400 flex items-center gap-1.5">
                <Tag className="w-3 h-3" />
                Vender do Catálogo de Serviços
              </label>
              <select
                value={serviceId}
                onChange={(e) => handleSelectService(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
              >
                <option value="">-- Selecione ou digite manualmente abaixo --</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.price)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Descrição da Receita
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Água de coco + Gatorade / Aula avulsa Beach Tennis"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Valor Recebido (R$)
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
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Data
              </label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Category & Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" />
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FinancialTransactionCategory)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                {incomeCategories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                Cliente (Opcional)
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
              >
                <option value="">Cliente Balcão / Não Identificado</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
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
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold'
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
              Observações (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Mesa 4 / Comanda 12"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
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
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Receita'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
