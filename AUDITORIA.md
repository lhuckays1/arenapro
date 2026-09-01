# ArenaPro — Auditoria do projeto enviado

## Resultado

O ZIP foi analisado antes de continuar o desenvolvimento.

O projeto tem uma boa base, mas **não recomendo avançar para novos módulos ainda**. Existem correções importantes de segurança e consistência.

## Problemas encontrados

1. **UUID inválido nos seeds**
   - O schema usa `m1b2c3d4-...`.
   - A letra `m` não é hexadecimal.
   - Corrigido no schema revisado para `b1b2c3d4-...`.

2. **RLS permissivo em catálogo**
   - Modalidades, quadras, serviços e bloqueios tinham políticas públicas muito amplas.
   - O schema revisado restringe a exposição pública a registros ativos e mantém acesso completo para membros da arena.

3. **INSERT de reservas excessivamente permissivo**
   - A política original aceitava praticamente qualquer usuário autenticado através de `auth.uid() IS NOT NULL`.
   - Agora o cliente precisa estar vinculado ao `customer` correto, à mesma arena e usar seu próprio `auth.uid()` como `created_by`.

4. **Faltava proteção de banco para criação de bloqueios**
   - O frontend validava conflitos, mas o schema não tinha um trigger equivalente para bloquear sobreposição de `court_blocks`.
   - O schema revisado adiciona proteção no PostgreSQL.

5. **Risco de corrida em reservas simultâneas**
   - Apenas `SELECT EXISTS` no trigger não é suficiente para garantir concorrência.
   - Foi adicionado `pg_advisory_xact_lock` por quadra antes da validação.

6. **Integridade entre tenant e entidades relacionadas**
   - Foram adicionados triggers para impedir que reserva, bloqueio ou transação financeira misturem entidades de arenas diferentes.

7. **Schema pouco seguro para reexecução**
   - Policies agora são removidas antes de serem recriadas.

8. **Cadastro de ARENA_ADMIN precisa ser corrigido no frontend**
   - O formulário de cadastro permite escolher `ARENA_ADMIN` e o serviço grava esse role diretamente em `profiles`.
   - Isso não deve ser usado em produção.
   - O onboarding do proprietário da arena deverá ser implementado de forma segura, criando a arena e a associação `arena_users` através de fluxo controlado.

9. **Bug potencial no registro de pagamento**
   - `registerReservationPayment()` chama `getReservations('')`.
   - Com Supabase real, essa consulta pode retornar zero registros porque o serviço filtra por `arena_id`.
   - Isso precisa ser corrigido para consultar diretamente pelo ID da reserva ou pela arena correta.

## Próxima sequência recomendada

1. Aplicar o `schema.sql` revisado.
2. Corrigir autenticação/onboarding de proprietário.
3. Corrigir registro de pagamentos.
4. Executar testes de isolamento e concorrência.
5. Só depois continuar novos módulos.

## Arquivo entregue

O `schema.sql` desta pasta é a versão revisada para esta etapa.
