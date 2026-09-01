import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { 
  FinancialSummary, 
  FinancialTransaction, 
  PeriodFilter, 
  PendingReservationItem, 
  Reservation,
  FinancialTransactionType,
  FinancialTransactionCategory,
  PaymentMethod
} from '../../types';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Wallet, 
  CreditCard, 
  Calendar, 
  Plus, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Tag, 
  ChevronRight,
  Eye,
  RefreshCw,
  Sparkles,
  FileSpreadsheet,
  AlertTriangle,
  Receipt
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend, 
  AreaChart, 
  Area 
} from 'recharts';

import { RecordPaymentModal } from '../../components/finance/RecordPaymentModal';
import { NewExpenseModal } from '../../components/finance/NewExpenseModal';
import { NewIncomeModal } from '../../components/finance/NewIncomeModal';
import { TransactionDetailsModal } from '../../components/finance/TransactionDetailsModal';
import { FinancialDiagnosticModal } from '../../components/finance/FinancialDiagnosticModal';

export const FinancePage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { activeArena } = useAuth();

  // State
  const [period, setPeriod] = useState<PeriodFilter>('MONTH');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'EXPENSES' | 'STATEMENT' | 'PENDING'>('OVERVIEW');

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [allTransactions, setAllTransactions] = useState<FinancialTransaction[]>([]);
  const [pendingReservations, setPendingReservations] = useState<PendingReservationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for statement / table
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Modals state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedPendingAmount, setSelectedPendingAmount] = useState<number | undefined>(undefined);

  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [isNewIncomeOpen, setIsNewIncomeOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);

  const loadData = async () => {
    if (!activeArena) return;
    setLoading(true);
    try {
      const [sum, txs, pending] = await Promise.all([
        arenaService.getFinancialSummary(activeArena.id, period, customStart || undefined, customEnd || undefined),
        arenaService.getFinancialTransactions(activeArena.id),
        arenaService.getPendingReservations(activeArena.id),
      ]);
      setSummary(sum);
      setAllTransactions(txs);
      setPendingReservations(pending);
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeArena, period, customStart, customEnd]);

  const handleOpenPayment = (res: Reservation, pending?: number) => {
    setSelectedReservation(res);
    setSelectedPendingAmount(pending);
    setIsRecordPaymentOpen(true);
  };

  const handleViewTransaction = (tx: FinancialTransaction) => {
    setSelectedTransaction(tx);
    setIsDetailsOpen(true);
  };

  // Filtered transactions for statement view
  const filteredTransactions = allTransactions.filter(t => {
    if (filterType !== 'ALL' && t.type !== filterType) return false;
    if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchDesc = t.description.toLowerCase().includes(q);
      const matchNotes = t.notes ? t.notes.toLowerCase().includes(q) : false;
      const matchCustomer = t.customer?.full_name ? t.customer.full_name.toLowerCase().includes(q) : false;
      return matchDesc || matchNotes || matchCustomer;
    }
    return true;
  });

  const exportStatementCSV = () => {
    if (!filteredTransactions.length) return;
    const headers = ['ID', 'Data', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)', 'Forma Pagamento', 'Status', 'Cliente', 'Observações'];
    const rows = filteredTransactions.map(t => [
      t.id,
      t.transaction_date,
      t.type === 'INCOME' ? 'Receita' : 'Despesa',
      t.category,
      `"${t.description.replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      t.payment_method,
      t.status,
      t.customer ? `"${t.customer.full_name}"` : '',
      t.notes ? `"${t.notes.replace(/"/g, '""')}"` : '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `extrato_arenapro_${activeArena?.slug || 'arena'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const categoryLabels: Record<string, string> = {
    RESERVATION: 'Locação Quadra',
    SERVICE: 'Aulas / Clínicas',
    BAR: 'Bar & Lanchonete',
    ENERGY: 'Energia Elétrica',
    WATER: 'Água & Gelo',
    MAINTENANCE: 'Manutenção / Areia',
    EQUIPMENT: 'Equipamentos',
    STAFF: 'Equipe / Folha',
    RENT: 'Aluguel do Espaço',
    MARKETING: 'Marketing',
    TAX: 'Impostos',
    OTHER: 'Outros',
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">
              Módulo Financeiro & Caixa
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Etapa 6
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Faturamento, liquidações em dinheiro/PIX/cartão, despesas e saldo real da arena
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsDiagnosticOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-teal-500/30 text-teal-300 hover:bg-teal-500/10 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span className="hidden sm:inline">Diagnóstico (14 Testes)</span>
          </button>

          <button
            onClick={() => setIsNewIncomeOpen(true)}
            className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Nova Receita / Bar</span>
          </button>

          <button
            onClick={() => setIsNewExpenseOpen(true)}
            className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <span>Nova Despesa</span>
          </button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['TODAY', 'WEEK', 'MONTH', 'YEAR', 'ALL', 'CUSTOM'] as PeriodFilter[]).map((p) => {
            const labels: Record<string, string> = {
              TODAY: 'Hoje',
              DAY: 'Hoje',
              WEEK: 'Esta Semana',
              MONTH: 'Este Mês',
              YEAR: 'Este Ano',
              ALL: 'Todo Período',
              '7_DAYS': '7 Dias',
              '30_DAYS': '30 Dias',
              CUSTOM: 'Personalizado',
            };
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  period === p
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>

        {period === 'CUSTOM' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-teal-500"
            />
            <span className="text-slate-500 font-bold">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-teal-500"
            />
          </div>
        )}

        <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-teal-400" />
          <span>
            {summary?.startDate && summary?.endDate
              ? `${new Date(summary.startDate + 'T12:00:00.000Z').toLocaleDateString('pt-BR')} até ${new Date(summary.endDate + 'T12:00:00.000Z').toLocaleDateString('pt-BR')}`
              : 'Carregando período...'}
          </span>
        </div>
      </div>

      {/* 5 MAIN FINANCIAL CARDS (Solicitados na especificação exata) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. FATURAMENTO */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
            <span>Faturamento</span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">
            {formatCurrency(summary?.faturamento)}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Receitas válidas</span>
            <span className="font-semibold text-blue-400">Total gerado</span>
          </div>
        </div>

        {/* 2. RECEBIDO */}
        <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-4 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition bg-gradient-to-br from-slate-900 to-emerald-950/20">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
            <span className="text-emerald-400">Recebido</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400">
            {formatCurrency(summary?.recebido)}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Pagamentos em caixa</span>
            <span className="font-semibold text-emerald-400">Efetivado</span>
          </div>
        </div>

        {/* 3. PENDENTE */}
        <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-4 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition bg-gradient-to-br from-slate-900 to-amber-950/20">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
            <span className="text-amber-400">Pendente</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400">
            {formatCurrency(summary?.pendente)}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
            <span>{summary?.pendingReservationsCount || 0} reservas abertas</span>
            <span className="font-semibold text-amber-400">A liquidar</span>
          </div>
        </div>

        {/* 4. DESPESAS */}
        <div className="bg-slate-900 border border-rose-500/20 rounded-2xl p-4 shadow-lg relative overflow-hidden group hover:border-rose-500/40 transition bg-gradient-to-br from-slate-900 to-rose-950/20">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
            <span className="text-rose-400">Despesas</span>
            <div className="w-7 h-7 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-400">
            {formatCurrency(summary?.despesas)}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
            <span>{summary?.expenseTransactionsCount || 0} lançamentos</span>
            <span className="font-semibold text-rose-400">Saídas pagas</span>
          </div>
        </div>

        {/* 5. SALDO */}
        <div className="bg-slate-900 border border-teal-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden group hover:border-teal-500/50 transition bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/30">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
            <span className="text-teal-300 font-bold">Saldo de Caixa</span>
            <div className="w-7 h-7 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-black ${(summary?.saldo || 0) >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
            {formatCurrency(summary?.saldo)}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Recebido - Despesas</span>
            <span className="font-bold text-teal-400">Líquido Real</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation for Sub-views */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'OVERVIEW'
              ? 'bg-slate-800 text-teal-400 border border-teal-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Visão Geral & Gráficos</span>
        </button>

        <button
          onClick={() => setActiveTab('PENDING')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'PENDING'
              ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Recebimentos Pendentes</span>
          {pendingReservations.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">
              {pendingReservations.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('EXPENSES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'EXPENSES'
              ? 'bg-slate-800 text-rose-400 border border-rose-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Despesas & Contas</span>
        </button>

        <button
          onClick={() => setActiveTab('STATEMENT')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'STATEMENT'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Extrato Geral & Lançamentos</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & CHARTS */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Cashflow Timeline Chart (Recharts) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-teal-400" />
                  Evolução do Fluxo Financeiro no Período (Entradas vs Saídas)
                </h3>
                <p className="text-xs text-slate-400">
                  Comparativo dia a dia de receitas recebidas versus despesas operacionais
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Recebido
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Despesas
                </span>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              {summary?.dailyFinancial && summary.dailyFinancial.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.dailyFinancial} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                    <XAxis dataKey="dayOfWeek" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#f8fafc',
                      }}
                      formatter={(val: any) => formatCurrency(Number(val))}
                    />
                    <Bar dataKey="income" name="Recebido (R$)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="expense" name="Despesa (R$)" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Nenhum dado financeiro registrado no período selecionado.
                </div>
              )}
            </div>
          </div>

          {/* Categories Grid (Receitas vs Despesas) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Receitas por Categoria */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Composição de Receitas</h3>
                    <p className="text-xs text-slate-400">Origem do dinheiro recebido</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400">
                  {formatCurrency(summary?.recebido)}
                </span>
              </div>

              {summary?.incomeCategories && summary.incomeCategories.length > 0 ? (
                <div className="space-y-3">
                  {summary.incomeCategories.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300">{cat.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{cat.count}x</span>
                          <span className="font-bold text-emerald-400">{formatCurrency(cat.amount)}</span>
                          <span className="text-[11px] text-slate-500 font-mono w-10 text-right">
                            {cat.percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, cat.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  Nenhuma receita recebida neste período.
                </div>
              )}
            </div>

            {/* Despesas por Categoria */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Composição de Despesas</h3>
                    <p className="text-xs text-slate-400">Distribuição dos custos da arena</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-400">
                  {formatCurrency(summary?.despesas)}
                </span>
              </div>

              {summary?.expenseCategories && summary.expenseCategories.length > 0 ? (
                <div className="space-y-3">
                  {summary.expenseCategories.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300">{cat.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{cat.count}x</span>
                          <span className="font-bold text-rose-400">{formatCurrency(cat.amount)}</span>
                          <span className="text-[11px] text-slate-500 font-mono w-10 text-right">
                            {cat.percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${Math.min(100, cat.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  Nenhuma despesa registrada neste período.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING RECEIVABLES */}
      {activeTab === 'PENDING' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Reservas com Pagamento Pendente / Parcial
              </h3>
              <p className="text-xs text-slate-400">
                Clientes que ainda não efetuaram a quitação total da locação
              </p>
            </div>
            <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Total Pendente: <strong>{formatCurrency(summary?.pendente)}</strong>
            </div>
          </div>

          {pendingReservations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">Data / Hora</th>
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3">Quadra</th>
                    <th className="py-3 px-3">Valor Total</th>
                    <th className="py-3 px-3">Já Pago</th>
                    <th className="py-3 px-3 text-amber-400 font-bold">A Receber</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pendingReservations.map((item) => {
                    const r = item.reservation;
                    const startDate = new Date(r.start_at);
                    return (
                      <tr key={r.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-white">
                            {startDate.toLocaleDateString('pt-BR')}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-medium text-slate-200">
                          {r.customer?.full_name || 'Cliente'}
                          <div className="text-[10px] text-slate-500">{r.customer?.phone}</div>
                        </td>
                        <td className="py-3.5 px-3 text-slate-300">
                          {r.court?.name || 'Quadra'}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-white">
                          {formatCurrency(item.totalAmount)}
                        </td>
                        <td className="py-3.5 px-3 text-emerald-400 font-medium">
                          {formatCurrency(item.paidAmount)}
                        </td>
                        <td className="py-3.5 px-3 text-amber-400 font-bold">
                          {formatCurrency(item.pendingAmount)}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.paymentStatus === 'PARTIAL'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {item.paymentStatus === 'PARTIAL' ? 'PARCIAL' : 'PENDENTE'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => handleOpenPayment(r, item.pendingAmount)}
                            className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-1.5 ml-auto cursor-pointer shadow-md shadow-emerald-500/10"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Receber</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-300">
                Nenhum pagamento pendente no momento!
              </p>
              <p className="text-[11px] text-slate-500">
                Todas as reservas ativas da arena foram quitadas.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EXPENSES FOCUSED VIEW */}
      {activeTab === 'EXPENSES' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                Controle e Histórico de Despesas Operacionais
              </h3>
              <p className="text-xs text-slate-400">
                Contas pagas, manutenção de quadras, iluminação, staff e materiais
              </p>
            </div>
            <button
              onClick={() => setIsNewExpenseOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-rose-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Lançar Nova Despesa</span>
            </button>
          </div>

          {/* Expense table */}
          {allTransactions.filter(t => t.type === 'EXPENSE').length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">Data</th>
                    <th className="py-3 px-3">Categoria</th>
                    <th className="py-3 px-3">Descrição / Fornecedor</th>
                    <th className="py-3 px-3">Forma Pagto</th>
                    <th className="py-3 px-3 text-rose-400 font-bold">Valor (R$)</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allTransactions
                    .filter(t => t.type === 'EXPENSE')
                    .map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3.5 px-3 font-semibold text-slate-300">
                          {new Date(tx.transaction_date + 'T12:00:00.000Z').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {categoryLabels[tx.category] || tx.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-white">{tx.description}</div>
                          {tx.notes && <div className="text-[10px] text-slate-500">{tx.notes}</div>}
                        </td>
                        <td className="py-3.5 px-3 text-slate-300 font-medium">
                          {tx.payment_method}
                        </td>
                        <td className="py-3.5 px-3 font-bold text-rose-400">
                          - {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => handleViewTransaction(tx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              Nenhuma despesa cadastrada ainda.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMPLETE STATEMENT & FILTERABLE LEDGER */}
      {activeTab === 'STATEMENT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-400" />
                Livro Caixa / Extrato Completo
              </h3>
              <p className="text-xs text-slate-400">
                Histórico auditável e imutável de todas as movimentações financeiras
              </p>
            </div>

            <button
              onClick={exportStatementCSV}
              className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Exportar CSV</span>
            </button>
          </div>

          {/* Search & Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por descrição, cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-teal-500"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">Todos os Tipos (Receitas & Despesas)</option>
              <option value="INCOME">Apenas Receitas (+)</option>
              <option value="EXPENSE">Apenas Despesas (-)</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">Todas as Categorias</option>
              <option value="RESERVATION">Locação de Quadra</option>
              <option value="SERVICE">Aulas / Serviços</option>
              <option value="BAR">Bar & Lanchonete</option>
              <option value="MAINTENANCE">Manutenção</option>
              <option value="ENERGY">Energia</option>
              <option value="WATER">Água</option>
              <option value="STAFF">Equipe</option>
              <option value="RENT">Aluguel</option>
              <option value="OTHER">Outros</option>
            </select>
          </div>

          {/* Transactions Ledger Table */}
          {filteredTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">Data</th>
                    <th className="py-3 px-3">Tipo</th>
                    <th className="py-3 px-3">Categoria</th>
                    <th className="py-3 px-3">Descrição</th>
                    <th className="py-3 px-3">Cliente / Vinculado</th>
                    <th className="py-3 px-3">Método</th>
                    <th className="py-3 px-3 text-right">Valor</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTransactions.map((tx) => {
                    const isIncome = tx.type === 'INCOME';
                    const isVoid = tx.status === 'VOID';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-semibold text-slate-300">
                          {new Date(tx.transaction_date + 'T12:00:00.000Z').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isIncome
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {isIncome ? 'RECEITA' : 'DESPESA'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          {categoryLabels[tx.category] || tx.category}
                        </td>
                        <td className="py-3 px-3 font-semibold text-white">
                          {tx.description}
                        </td>
                        <td className="py-3 px-3 text-teal-300 font-medium">
                          {tx.customer?.full_name || '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {tx.payment_method}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-bold ${
                            isVoid
                              ? 'line-through text-slate-500'
                              : isIncome
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isVoid
                                ? 'bg-rose-500/20 text-rose-300'
                                : tx.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleViewTransaction(tx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              Nenhuma transação encontrada com os filtros selecionados.
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        reservation={selectedReservation}
        pendingAmount={selectedPendingAmount}
        onPaymentSuccess={loadData}
      />

      <NewExpenseModal
        isOpen={isNewExpenseOpen}
        onClose={() => setIsNewExpenseOpen(false)}
        arenaId={activeArena?.id || ''}
        onExpenseCreated={loadData}
      />

      <NewIncomeModal
        isOpen={isNewIncomeOpen}
        onClose={() => setIsNewIncomeOpen(false)}
        arenaId={activeArena?.id || ''}
        onIncomeCreated={loadData}
      />

      <TransactionDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        transaction={selectedTransaction}
        onTransactionUpdated={loadData}
      />

      <FinancialDiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
        arenaId={activeArena?.id || ''}
      />
    </div>
  );
};
