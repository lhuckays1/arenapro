# ArenaPro — Etapa 6A: SaaS comercial

## Regra de negócio implementada

1. Cadastro público = `CLIENT`.
2. Somente `SUPER_ADMIN` pode criar uma arena.
3. Somente `SUPER_ADMIN` pode criar/vincular `ARENA_ADMIN`.
4. O proprietário é criado por convite através da Edge Function `create-arena-owner`.
5. Nova assinatura nasce `PENDING`.
6. `ARENA_ADMIN`/`ARENA_STAFF` só acessam o painel operacional quando a assinatura está `ACTIVE` e o período está vigente.
7. `SUPER_ADMIN` não depende de assinatura.
8. `CLIENT` continua podendo utilizar o portal e reservar arenas públicas.
9. Arena e memberships não podem ser criadas pelo frontend usando a chave anon.
10. O antigo fluxo de "usuário cria a própria arena" foi removido.

## Aplicação da migration

Execute no Supabase SQL Editor:

`supabase/migrations/20260826_saas_commercial_access.sql`

Não execute novamente o schema inteiro se ele já estiver aplicado.

## Edge Function

Arquivo:

`supabase/functions/create-arena-owner/index.ts`

A função deve ser publicada como:

`create-arena-owner`

Ela usa a sessão do usuário para confirmar que o chamador é `SUPER_ADMIN` e usa a Service Role somente no servidor para:
- convidar o proprietário;
- transformar o profile em `ARENA_ADMIN`;
- criar `arena_users`;
- criar a assinatura `PENDING`.

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no `.env` do Vite ou no frontend.

## Teste comercial

1. Faça login com um `SUPER_ADMIN` real.
2. Acesse `/admin/saas`.
3. Crie uma arena e informe o proprietário.
4. Confira:
   - `arenas`: 1 registro;
   - `auth.users`: proprietário criado;
   - `profiles.role`: `ARENA_ADMIN`;
   - `arena_users.role`: `ARENA_ADMIN`;
   - `arena_subscriptions.status`: `PENDING`.
5. O proprietário não deve conseguir acessar `/admin`.
6. No painel SaaS, clique em `Ativar`.
7. O proprietário deve conseguir acessar o painel da arena.
8. Clique em `Suspender`.
9. O acesso operacional deve voltar a ser bloqueado.

## Observação sobre preços

Os três planos criados pela migration (`Starter`, `Pro`, `Premium`) possuem valores iniciais de referência para desenvolvimento. Eles devem ser definidos comercialmente antes da cobrança real.

## Próxima etapa

Depois de validar o núcleo SaaS, integrar:
- Asaas ou outro gateway;
- cobrança recorrente;
- webhook de pagamento;
- ativação automática;
- atraso/suspensão automática;
- histórico de pagamentos da assinatura;
- limites de recursos por plano.
