# ArenaPro — assinaturas com Asaas (Sandbox)

## Como funciona

1. O Super Admin configura o preço mensal do plano.
2. O administrador da arena com pagamento pendente ou vencido escolhe **Regularizar assinatura**.
3. O ArenaPro cria um link hospedado de recorrência mensal no Asaas, com vencimento do boleto em 3 dias úteis. O pagador escolhe a forma de pagamento disponível na conta Asaas; os dados do cartão não passam pelo ArenaPro.
4. O webhook do Asaas informa o resultado. Apenas a confirmação do pagamento ativa ou renova a assinatura; retornar do checkout não libera o acesso.
5. Os eventos são idempotentes e o histórico registra apenas IDs, status, valores e datas necessários, sem guardar payload financeiro completo.
6. A tolerância atual continua sendo de 5 dias. Pagamentos manuais são feitos pelo Super Admin e ficam bloqueados enquanto houver um gateway vinculado, para evitar cobrança duplicada.

## Configuração de Sandbox no Supabase

Configure os segredos em **Project Settings → Edge Functions → Secrets**. Não os coloque no GitHub, no frontend ou em mensagens:

- `ASAAS_API_KEY`: chave da conta de Sandbox, normalmente com prefixo `$aact_hmlg_`.
- `ASAAS_API_URL`: `https://api-sandbox.asaas.com/v3`.
- `ASAAS_WEBHOOK_TOKEN`: segredo aleatório exclusivo para autenticar o webhook, com pelo menos 32 caracteres. Não reutilize a chave API.

Não defina `ASAAS_LIVE_BILLING_ENABLED` nesta etapa. O checkout usa Sandbox por padrão e a função recusa a URL de produção enquanto essa variável não for explicitamente `true`.

## Webhook

Depois de publicar a função, cadastre no Asaas Sandbox a URL:

`https://lohlrbencmhybfbzqnve.supabase.co/functions/v1/asaas-billing-webhook`

Configure o campo de autenticação do webhook com o mesmo valor de `ASAAS_WEBHOOK_TOKEN`. O Asaas deve enviar esse valor no cabeçalho `asaas-access-token`.

Eventos usados:

- `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_INACTIVATED`, `SUBSCRIPTION_DELETED`;
- `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`.

## Transição do Pagar.me

A migração identifica assinaturas com IDs ou links Pagar.me e mantém `billing_provider = PAGARME`. A nova função recusa criar outra cobrança para elas. Antes de migrar uma dessas arenas, confirme no Pagar.me que não existe recorrência ativa; depois, o suporte pode limpar os campos antigos de forma auditável. Isso evita que uma troca de gateway deixe duas cobranças recorrentes.

As funções e tabelas Pagar.me não são removidas nesta migração; isso preserva histórico e permite voltar atrás antes da validação final.

## Publicação e validação

1. Aplicar `supabase/migrations/20261110010000_asaas_billing.sql` no projeto Supabase.
2. Publicar `create-asaas-subscription-checkout` com JWT obrigatório e `asaas-billing-webhook` sem JWT (a própria função valida o token).
3. Configurar as credenciais de Sandbox e cadastrar o webhook acima.
4. Validar: criação do link, pagamento de teste, confirmação por webhook, histórico, renovação única, atraso e bloqueio após a tolerância.
5. Só após a validação e aprovação dos preços, credenciais e termos, planejar separadamente a ativação de cobrança real.

## Documentação oficial

- [Criar link de pagamento recorrente](https://docs.asaas.com/reference/create-a-payments-link)
- [Criar assinatura diretamente pela API](https://docs.asaas.com/reference/create-new-subscription)
- [Formato de chave e ambientes](https://docs.asaas.com/docs/api-key-pattern-with-dollar-sign-and-php-clients)
- [Autenticação e configuração de webhooks](https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint)
