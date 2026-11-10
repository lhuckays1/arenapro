# ArenaPro — integração legada do Pagar.me

> A integração atual em desenvolvimento migra novos checkouts para o Asaas Sandbox. Este documento descreve somente a configuração antiga do Pagar.me e não deve ser usado para iniciar novas cobranças. O código e o histórico antigos são mantidos até a validação e a transição segura das assinaturas existentes.

## Fluxo implementado

1. O Super Admin configura o preço de cada plano em **Gestão do SaaS → Preços mensais dos planos**. A alteração vale para novos contratos; o preço contratado por uma assinatura existente fica registrado separadamente.
2. O administrador da arena sem pagamento vigente recebe um link de checkout hospedado pelo Pagar.me.
3. O Pagar.me envia eventos para a Edge Function. Somente `invoice.paid` ativa ou renova a assinatura. A volta do navegador ao ArenaPro não confirma pagamento.
4. Eventos têm deduplicação por ID. O banco registra o histórico de pagamento sem guardar dados de cartão ou o payload completo do provedor.
5. `PAST_DUE` preserva o acesso por 5 dias após o vencimento. Depois disso, as regras de acesso ao banco e ao app bloqueiam a arena.
6. O SUPER_ADMIN também pode registrar uma renovação manual quando o pagamento for recebido fora do Pagar.me. A ação exige forma de pagamento, observação e confirmação do recebimento; cria um registro `MANUAL` com o ID do administrador e renova um mês sem disparar cobrança.
7. A renovação manual fica indisponível quando há um identificador de recorrência Pagar.me na assinatura, para evitar cobrança duplicada. Assinaturas suspensas/canceladas exigem revisão antes da renovação.

## Formas de pagamento

O checkout de assinatura recorrente foi configurado para cartão de crédito e boleto. O checkout recorrente documentado pelo Pagar.me não oferece Pix; Pix poderá ser estudado como cobrança avulsa, sem renovação automática. Consulte [Checkout recorrente](https://docs.pagar.me/reference/checkout-link) e [criação de planos](https://docs.pagar.me/reference/criar-plano-1).

## Segredos no Supabase

Configure em **Project Settings → Edge Functions → Secrets**. Nunca coloque esses valores no frontend, `.env` do Vite ou Git:

- `PAGARME_SECRET_KEY`: primeiro a chave de teste (`sk_test_...`).
- `PAGARME_API_URL`: `https://sdx-api.pagar.me/core/v5` para teste.
- `PAGARME_WEBHOOK_TOKEN`: valor aleatório com pelo menos 32 caracteres.
- Para cobrança real, mudar `PAGARME_API_URL` para `https://api.pagar.me/core/v5` e definir `PAGARME_LIVE_BILLING_ENABLED=true` somente após aprovar os preços comerciais e validar o sandbox.

O ambiente de produção é bloqueado no código enquanto `PAGARME_LIVE_BILLING_ENABLED` não estiver exatamente como `true`.

## Webhook Pagar.me

Depois de publicar a função, configure no painel Pagar.me um endpoint para:

`https://<PROJECT-REF>.supabase.co/functions/v1/pagarme-billing-webhook/<PAGARME_WEBHOOK_TOKEN>`

Eventos necessários: `subscription.created`, `subscription.canceled`, `invoice.paid`, `invoice.payment_failed` e `invoice.canceled`. A rota valida o token secreto e retorna erro temporário para eventos de pagamento ainda sem correspondência, para que o provedor tente novamente.

## Publicação

1. Revisar e aplicar `supabase/migrations/20261109090000_pagarme_subscription_billing.sql` no projeto ArenaPro.
2. Definir os segredos do ambiente de teste.
3. Publicar `create-pagarme-subscription-checkout` e `record-manual-subscription-renewal` com JWT obrigatório; publicar `pagarme-billing-webhook` sem JWT (a função valida o token secreto na rota).
4. Cadastrar os eventos do webhook no Pagar.me.
5. Validar com chave e cartão de teste do Pagar.me; confirmar `invoice.paid`, histórico, renovação, atraso e bloqueio após a tolerância.
6. Só depois de revisar preços, meios de pagamento, termos e chaves live, habilitar cobranças reais.

## Valores

Os valores existentes no banco são defaults de desenvolvimento. A tela do Super Admin permite ajustá-los, mas a cobrança live continua bloqueada até a configuração explícita do segredo de produção.
