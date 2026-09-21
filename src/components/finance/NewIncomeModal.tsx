import React, {
  useEffect,
  useState,
} from 'react';

import {
  X,
  TrendingUp,
  CreditCard,
  Calendar,
  FileText,
  Tag,
  User,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

import {
  FinancialTransactionCategory,
  PaymentMethod,
  Customer,
  Service,
} from '../../types';

import {
  arenaService,
} from '../../services/arena.service';

import {
  useAuth,
} from '../../contexts/AuthContext';

interface NewIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  arenaId: string;
  onIncomeCreated: () => void;
}

/**
 * Valida UUID no frontend antes de enviar
 * qualquer identificador para uma coluna UUID
 * do PostgreSQL.
 */
const isValidUUID = (
  value: unknown
): value is string => {
  if (
    typeof value !== 'string'
  ) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
};

/**
 * Retorna a data local no formato YYYY-MM-DD.
 *
 * Evitamos:
 *
 * new Date().toISOString().split('T')[0]
 *
 * porque isso utiliza UTC e pode mudar o dia
 * dependendo do horário/local do usuário.
 */
const getTodayLocalDate = (): string => {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
};

export const NewIncomeModal: React.FC<
  NewIncomeModalProps
> = ({
  isOpen,
  onClose,
  arenaId,
  onIncomeCreated,
}) => {

  /*
   * Usuário atualmente autenticado.
   *
   * O ID real do usuário Supabase é utilizado
   * como created_by.
   */
  const {
    user,
  } = useAuth();

  // ==========================================================
  // FORM STATE
  // ==========================================================

  const [
    description,
    setDescription,
  ] = useState('');

  const [
    amount,
    setAmount,
  ] = useState<number>(0);

  const [
    category,
    setCategory,
  ] =
    useState<FinancialTransactionCategory>(
      'BAR'
    );

  const [
    paymentMethod,
    setPaymentMethod,
  ] =
    useState<PaymentMethod>(
      'PIX'
    );

  const [
    customerId,
    setCustomerId,
  ] = useState<string>('');

  const [
    serviceId,
    setServiceId,
  ] = useState<string>('');

  const [
    transactionDate,
    setTransactionDate,
  ] = useState<string>(
    getTodayLocalDate()
  );

  const [
    notes,
    setNotes,
  ] = useState('');

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMsg,
    setErrorMsg,
  ] = useState<string | null>(
    null
  );

  // ==========================================================
  // DEPENDENCIES
  // ==========================================================

  const [
    customers,
    setCustomers,
  ] = useState<Customer[]>(
    []
  );

  const [
    services,
    setServices,
  ] = useState<Service[]>(
    []
  );

  // ==========================================================
  // RESET FORM WHEN MODAL OPENS
  // ==========================================================

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDescription('');
    setAmount(0);

    setCategory(
      'BAR'
    );

    setPaymentMethod(
      'PIX'
    );

    setCustomerId('');
    setServiceId('');

    setTransactionDate(
      getTodayLocalDate()
    );

    setNotes('');

    setErrorMsg(null);

    setIsSubmitting(
      false
    );
  }, [
    isOpen,
  ]);

  // ==========================================================
  // LOAD CUSTOMERS / SERVICES
  // ==========================================================

  useEffect(() => {

    const loadDependencies =
      async () => {

        if (
          !isOpen ||
          !arenaId
        ) {
          return;
        }

        try {

          const [
            custList,
            svcList,
          ] =
            await Promise.all([
              arenaService.getCustomers(
                arenaId
              ),

              arenaService.getServices(
                arenaId
              ),
            ]);

          setCustomers(
            custList
          );

          setServices(
            svcList
          );

        } catch (
          error
        ) {

          console.error(
            'Erro ao carregar clientes e serviços:',
            error
          );

        }
      };

    void loadDependencies();

  }, [
    isOpen,
    arenaId,
  ]);

  // ==========================================================
  // CATEGORIES
  // ==========================================================

  const incomeCategories: {
    value: FinancialTransactionCategory;
    label: string;
    icon: string;
  }[] = [

    {
      value: 'BAR',
      label:
        'Bar & Lanchonete / Bebidas',
      icon: '🍹',
    },

    {
      value: 'SERVICE',
      label:
        'Aulas / Clínicas / Serviços',
      icon: '🎓',
    },

    {
      value: 'EQUIPMENT',
      label:
        'Locação de Raquetes / Acessórios',
      icon: '🎾',
    },

    {
      value: 'OTHER',
      label:
        'Outras Receitas / Patrocínios',
      icon: '💰',
    },

  ];

  // ==========================================================
  // PAYMENT METHODS
  // ==========================================================

  const paymentMethodsList: {
    value: PaymentMethod;
    label: string;
  }[] = [

    {
      value: 'PIX',
      label: 'PIX',
    },

    {
      value: 'DEBIT_CARD',
      label: 'Débito',
    },

    {
      value: 'CREDIT_CARD',
      label: 'Crédito',
    },

    {
      value: 'CASH',
      label: 'Dinheiro',
    },

    {
      value: 'BANK_TRANSFER',
      label: 'TED / Transf.',
    },

    {
      value: 'OTHER',
      label: 'Outro',
    },

  ];

  // ==========================================================
  // SERVICE SELECTION
  // ==========================================================

  const handleSelectService = (
    selectedServiceId: string
  ) => {

    setServiceId(
      selectedServiceId
    );

    if (
      !selectedServiceId
    ) {

      return;
    }

    const selected =
      services.find(
        (
          service
        ) =>
          service.id ===
          selectedServiceId
      );

    if (!selected) {
      return;
    }

    setDescription(
      `Serviço: ${selected.name}`
    );

    setAmount(
      Number(
        selected.price
      )
    );

    setCategory(
      'SERVICE'
    );
  };

  // ==========================================================
  // SUBMIT
  // ==========================================================

  const handleSubmit = async (
    event: React.FormEvent
  ) => {

    event.preventDefault();

    // --------------------------------------------------------
    // VALIDATIONS
    // --------------------------------------------------------

    if (
      !arenaId ||
      !isValidUUID(
        arenaId
      )
    ) {

      setErrorMsg(
        'A arena atual não possui um identificador válido.'
      );

      return;
    }

    if (
      !description.trim()
    ) {

      setErrorMsg(
        'Informe a descrição da receita.'
      );

      return;
    }

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {

      setErrorMsg(
        'O valor da receita deve ser maior que zero.'
      );

      return;
    }

    if (
      !transactionDate
    ) {

      setErrorMsg(
        'Informe a data da receita.'
      );

      return;
    }

    /*
     * Cliente é opcional.
     *
     * Se "Cliente Balcão" estiver selecionado,
     * enviamos undefined.
     *
     * Dessa forma o PostgreSQL recebe NULL.
     */
    const safeCustomerId =
      customerId &&
      isValidUUID(
        customerId
      )
        ? customerId
        : undefined;

    /*
     * Serviço também é opcional.
     *
     * Só enviamos se for UUID válido.
     */
    const safeServiceId =
      serviceId &&
      isValidUUID(
        serviceId
      )
        ? serviceId
        : undefined;

    /*
     * created_by precisa ser UUID.
     *
     * Antes estava:
     *
     * created_by: 'u-admin-xp'
     *
     * Isso causava:
     *
     * invalid input syntax for type uuid
     *
     * Agora usamos o ID REAL do usuário
     * autenticado.
     *
     * Se o usuário não tiver um UUID válido,
     * deixamos NULL/undefined.
     */
    const safeCreatedBy =
      user?.id &&
      isValidUUID(
        user.id
      )
        ? user.id
        : undefined;

    // --------------------------------------------------------
    // SUBMIT
    // --------------------------------------------------------

    setIsSubmitting(
      true
    );

    setErrorMsg(
      null
    );

    try {

      await arenaService.createFinancialTransaction(
        {
          arena_id:
            arenaId,

          type:
            'INCOME',

          category:
            category,

          description:
            description.trim(),

          amount:
            Math.round(
              Number(amount) *
                100
            ) / 100,

          payment_method:
            paymentMethod,

          transaction_date:
            transactionDate,

          /*
           * Cliente Balcão:
           * undefined -> coluna NULL
           */
          customer_id:
            safeCustomerId,

          /*
           * Serviço selecionado:
           * UUID válido ou undefined.
           */
          service_id:
            safeServiceId,

          status:
            'COMPLETED',

          notes:
            notes.trim() ||
            undefined,

          /*
           * CORREÇÃO PRINCIPAL:
           *
           * Não usamos mais:
           *
           * 'u-admin-xp'
           *
           * Usamos o UUID real do usuário.
           */
          created_by:
            safeCreatedBy,
        }
      );

      /*
       * Atualiza o FinancePage.
       *
       * Isso fará:
       *
       * - faturamento;
       * - recebido;
       * - saldo;
       * - gráficos;
       * - extrato;
       *
       * refletirem imediatamente
       * o novo lançamento.
       */
      await onIncomeCreated();

      /*
       * Fecha o modal somente depois
       * que a operação foi concluída.
       */
      onClose();

    } catch (
      error: any
    ) {

      console.error(
        'Erro ao registrar receita financeira:',
        error
      );

      /*
       * Mensagem amigável para o usuário.
       */
      setErrorMsg(
        error?.message ||
        'Erro ao registrar receita.'
      );

    } finally {

      setIsSubmitting(
        false
      );
    }
  };

  // ==========================================================
  // CLOSED MODAL
  // ==========================================================

  /*
   * IMPORTANTE:
   *
   * Este return acontece DEPOIS de todos os hooks.
   *
   * O componente anterior fazia:
   *
   * if (!isOpen) return null;
   *
   * antes dos useState/useEffect.
   *
   * Isso viola as Rules of Hooks.
   */
  if (
    !isOpen
  ) {
    return null;
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">

      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 animate-scaleUp">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="flex items-center justify-between pb-4 border-b border-slate-800">

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">

              <TrendingUp className="w-5 h-5" />

            </div>

            <div>

              <h3 className="text-base font-bold text-white">
                Nova Receita Avulsa / Bar
              </h3>

              <p className="text-xs text-slate-400">
                Registro de entrada de caixa e venda de serviços
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              isSubmitting
            }
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >

            <X className="w-5 h-5" />

          </button>

        </div>

        {/* ====================================================
            ERROR
        ==================================================== */}

        {errorMsg && (

          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">

            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />

            <span>
              {errorMsg}
            </span>

          </div>

        )}

        {/* ====================================================
            FORM
        ==================================================== */}

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-4"
        >

          {/* ==================================================
              SERVICE CATALOG
          ================================================== */}

          {services.length >
            0 && (

            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">

              <label className="text-[11px] font-semibold text-teal-400 flex items-center gap-1.5">

                <Tag className="w-3 h-3" />

                Vender do Catálogo de Serviços

              </label>

              <select
                value={
                  serviceId
                }
                onChange={(
                  event
                ) =>
                  handleSelectService(
                    event.target
                      .value
                  )
                }
                disabled={
                  isSubmitting
                }
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500 disabled:opacity-50"
              >

                <option value="">
                  -- Selecione ou digite manualmente abaixo --
                </option>

                {services.map(
                  (
                    service
                  ) => (

                    <option
                      key={
                        service.id
                      }
                      value={
                        service.id
                      }
                    >
                      {service.name} —{' '}
                      {new Intl.NumberFormat(
                        'pt-BR',
                        {
                          style:
                            'currency',
                          currency:
                            'BRL',
                        }
                      ).format(
                        Number(
                          service.price
                        )
                      )}
                    </option>

                  )
                )}

              </select>

            </div>

          )}

          {/* ==================================================
              DESCRIPTION
          ================================================== */}

          <div className="space-y-1.5">

            <label className="text-xs font-semibold text-slate-300">
              Descrição da Receita
            </label>

            <input
              type="text"
              required
              placeholder="Ex: Água de coco + Gatorade / Aula avulsa Beach Tennis"
              value={
                description
              }
              onChange={(
                event
              ) =>
                setDescription(
                  event.target
                    .value
                )
              }
              disabled={
                isSubmitting
              }
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />

          </div>

          {/* ==================================================
              AMOUNT / DATE
          ================================================== */}

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
                  value={
                    amount ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    setAmount(
                      parseFloat(
                        event.target
                          .value
                      ) ||
                      0
                    )
                  }
                  disabled={
                    isSubmitting
                  }
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-50"
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
                value={
                  transactionDate
                }
                onChange={(
                  event
                ) =>
                  setTransactionDate(
                    event.target
                      .value
                  )
                }
                disabled={
                  isSubmitting
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              />

            </div>

          </div>

          {/* ==================================================
              CATEGORY / CUSTOMER
          ================================================== */}

          <div className="grid grid-cols-2 gap-3">

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">

                <Tag className="w-3 h-3 text-slate-400" />

                Categoria

              </label>

              <select
                value={
                  category
                }
                onChange={(
                  event
                ) =>
                  setCategory(
                    event.target
                      .value as FinancialTransactionCategory
                  )
                }
                disabled={
                  isSubmitting
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              >

                {incomeCategories.map(
                  (
                    item
                  ) => (

                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {item.icon}{' '}
                      {item.label}
                    </option>

                  )
                )}

              </select>

            </div>

            <div className="space-y-1.5">

              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">

                <User className="w-3 h-3 text-slate-400" />

                Cliente (Opcional)

              </label>

              <select
                value={
                  customerId
                }
                onChange={(
                  event
                ) =>
                  setCustomerId(
                    event.target
                      .value
                  )
                }
                disabled={
                  isSubmitting
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500 disabled:opacity-50"
              >

                <option value="">
                  Cliente Balcão / Não Identificado
                </option>

                {customers.map(
                  (
                    customer
                  ) => (

                    <option
                      key={
                        customer.id
                      }
                      value={
                        customer.id
                      }
                    >
                      {customer.full_name}
                    </option>

                  )
                )}

              </select>

            </div>

          </div>

          {/* ==================================================
              PAYMENT METHOD
          ================================================== */}

          <div className="space-y-1.5">

            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">

              <CreditCard className="w-3 h-3 text-slate-400" />

              Forma de Pagamento

            </label>

            <div className="grid grid-cols-3 gap-2">

              {paymentMethodsList.map(
                (
                  method
                ) => (

                  <button
                    type="button"
                    key={
                      method.value
                    }
                    onClick={() =>
                      setPaymentMethod(
                        method.value
                      )
                    }
                    disabled={
                      isSubmitting
                    }
                    className={`p-2 rounded-xl border text-center text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                      paymentMethod ===
                      method.value
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {
                      method.label
                    }
                  </button>

                )
              )}

            </div>

          </div>

          {/* ==================================================
              NOTES
          ================================================== */}

          <div className="space-y-1.5">

            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">

              <FileText className="w-3 h-3 text-slate-400" />

              Observações (Opcional)

            </label>

            <input
              type="text"
              placeholder="Ex: Mesa 4 / Comanda 12"
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
              disabled={
                isSubmitting
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />

          </div>

          {/* ==================================================
              ACTIONS
          ================================================== */}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">

            <button
              type="button"
              onClick={
                onClose
              }
              disabled={
                isSubmitting
              }
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                isSubmitting
              }
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 text-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >

              <CheckCircle2 className="w-4 h-4" />

              <span>
                {isSubmitting
                  ? 'Salvando...'
                  : 'Salvar Receita'}
              </span>

            </button>

          </div>

        </form>

      </div>

    </div>
  );
};