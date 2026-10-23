# Correções operacionais — 23/10/2026

## Situação

Migrations aplicadas no Supabase de produção após autorização, inventário somente leitura e ensaio transacional com rollback. A verificação independente confirmou as funções novas, RLS ativo em todas as tabelas públicas e zero policies operacionais usando os helpers comerciais. Não foram excluídos dados nem persistidos cadastros ou recebimentos de teste.

O retorno da disponibilidade pública foi mantido como `status text`, compatível com a função existente em produção. Os testes locais cobrem instalação limpa e compatibilidade com o enum legado de mensalidades. Resultado: 16 testes automatizados e 15 regressões de serviço aprovados; build e TypeScript aprovados. A interface só deve ser publicada depois dessa confirmação do banco.

Pacote aplicado: SHA-256 `EA56861CED296E349CA735C465F9D02BA03F205390E34EA999B9CAD374CF837D`. Uma falha inicial de comunicação foi seguida por consulta independente que confirmou ausência das novas estruturas; a aplicação posterior e a persistência foram confirmadas. Evidências privadas ficam na pasta ignorada `audit/`, fora do Git.

## Cadastro de aluno e mensalidades

Em **Alunos → Novo aluno**, informe nome, professor, início, duração e valor mensal. A opção **Gerar mensalidades do período ao salvar** cria também as cobranças, com dia de vencimento entre 1 e 28. Aluno, vínculo e cobranças pertencem à mesma transação: se uma etapa falhar, nenhuma delas é confirmada.

Ao escolher um aluno em **Mensalidades → Nova mensalidade**, o professor do vínculo ativo e seu valor contratado são preenchidos; a seleção de professor fica limitada aos vínculos ativos do aluno. Uma mensalidade manual exige esse vínculo.

Regras:

- Um contrato de N meses gera no máximo N competências, a partir do mês do início. Exemplo: início em 15/10, 3 meses → outubro, novembro e dezembro; término das aulas em 14/01.
- O término das aulas é inclusivo. O aniversário é ajustado ao último dia do mês quando necessário, e o término fica no dia anterior a esse aniversário. Início 31/01/2026 + um mês termina em 27/02/2026.
- Contratos em semanas mantêm cobrança por competência mensal abrangida pelo período, sem cálculo proporcional automático. Rever essa regra com a arena se houver planos semanais com preço próprio.
- O primeiro vencimento não antecede o início das aulas.
- Gerar novamente preserva as cobranças existentes, incluindo canceladas ou pagas. Não recria uma competência já cadastrada para o mesmo aluno/professor.
- Editar cadastro/vínculo não altera valores já cobrados. A geração ao editar começa desmarcada.
- Mensalidades pagas são protegidas contra edição/exclusão. Recebimento repetido retorna o mesmo pagamento financeiro.
- Alunos e professores devem pertencer à mesma arena. É permitido somente um vínculo ativo por aluno em cada arena.

O fluxo **Professor → Adicionar aluno** continua sendo uma atribuição de professor. A duração/valor e a geração automática são configurados no cadastro do aluno. Para emitir uma cobrança avulsa nesse fluxo, use o botão de mensalidade.

## Demais correções

- O painel consulta `has_arena_operational_access` no servidor. ADMIN/STAFF precisam de vínculo ativo na arena; SUPER_ADMIN mantém acesso global. Assinaturas e privilégios comerciais continuam separados e não foram apagados ou ativados artificialmente.
- Policies operacionais passam a usar os helpers operacionais. Helpers comerciais legados continuam existindo para compatibilidade; funções/policies adicionais presentes somente em produção devem ser verificadas no inventário.
- Reservas usam recebimento transacional com trava de linha, limite de saldo e chave idempotente. Valor de pagamento inválido/excedente é rejeitado.
- O status de pagamento da reserva é somente leitura na agenda; o recebimento é feito em Reservas/Financeiro. Os saldos da listagem consideram pagamentos parciais reais.
- Comandas validam arena, produto e estado no banco. O preço do item é obtido do produto no servidor; itens encerrados e comandas com recebimentos são protegidos. Escritas diretas em pagamentos/totais não substituem a RPC.
- Receita de comanda nova utiliza categoria `BAR`; a interface reconhece também o valor legado `Bar / Comandas` sem alterar o histórico.
- Datas de agenda/dashboard/financeiro usam America/Sao_Paulo; o extrato e seu CSV acompanham o período selecionado. Corrigida também a semana que cruza meses.
- Portal público cria a ficha própria e a reserva numa transação, com preço da quadra e horário validados no servidor. Não vincula clientes por coincidência de telefone/e-mail. A API pública de disponibilidade retorna somente quadra/intervalo/status.
- CLIENT pode cancelar a própria reserva dentro do prazo, mas não alterar preço, quitação ou dados privilegiados pela API.
- Corrigidos o identificador ausente no upload de logo, as tipagens de sessão/joins e o ciclo de hooks do modal de pagamento.
- A réplica local preserva reservas das outras arenas e reverte escritas simuladas em falha. Resultados locais não equivalem à certificação do banco publicado.

## Testes

```powershell
npm run lint
npm test
npm run test:services
npm run build
npm run db:prepare
```

`npm test` cobre localização/geocodificação, datas de contrato, chave idempotente e uma integração PostgreSQL em memória (PGlite). Essa integração aplica migrations individuais repetidamente e o pacote atômico; exercita matrícula/cobranças, recebimentos, rollback de receita após falha, políticas por papel, negação entre arenas, portal e proteção de histórico. Não conecta a um banco externo.

`npm run test:services` executa 15 cenários de serviço em memória, incluindo cadastro com cobranças, reversão na falha de atribuição, pagamento parcial/total, concorrência simulada e regressões da auditoria. Os resultados são gravados em `audit/results-after.json`.

O teste SQL usa uma sessão PostgreSQL. Concorrência real com múltiplas conexões, armazenamento de imagens e E2E visual completo continuam exigindo homologação. O navegador disponível não alcançou localhost; a resposta HTTP local foi verificada separadamente. O build ainda apresenta aviso de tamanho do bundle, sem falha de compilação.

## Implantação preservando dados

1. Obter backup/restore point e executar **somente leitura** `supabase/preflight/20261023_readonly.sql` no banco alvo. Revisar tipos, assinaturas de funções, policies adicionais, triggers e regras do bucket `arena-logos`. Não basta a interface exibir o texto “RLS ativo”.
2. Comparar esse inventário com as migrations preparadas. A base usada nos testes é o schema versionado mais a migration SaaS e a migration original do bar; não é uma cópia do banco real. Uma função existente com retorno diferente, um tipo incompatível ou regra adicional requer ajuste antes da aplicação.
3. Gerar o pacote com `npm run db:prepare`: `audit/APLICAR-CORRECOES-2026-10-23.sql`. Ele combina as quatro migrations novas em uma única transação, com limites de espera. Preparar o arquivo não executa SQL nem acessa rede.
4. Validar o pacote em homologação com dados sintéticos. Duplicatas existentes em vínculos ativos ou competências interrompem a transação com erro descritivo; nenhum registro é apagado para contornar o problema.
5. Após revisão/aprovação, aplicar o pacote completo. Em erro, executar `ROLLBACK;` na sessão antes de continuar. Não publicar o frontend até confirmar o sucesso integral. Nunca reaplicar `src/db/schema.sql` ou a migration antiga do bar sobre o banco atual para fazer essa atualização.
6. Publicar o frontend com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` corretos, preservando as credenciais atuais. Build sem essas variáveis demonstra a réplica local, não uma conexão real de produção.
7. Fazer smoke test com contas restritas de ambas as arenas: aluno/vínculo/cobrança, parcial/total de reserva, comanda e financeiro, cancelamento de cliente, negação entre tenants e upload de logo. Confirmar exatamente uma receita por recebimento.

As migrations canônicas são:

1. `supabase/migrations/20261023_operational_integrity.sql`
2. `supabase/migrations/20261023_z_payments_integrity.sql`
3. `supabase/migrations/20261023_zz_public_booking.sql`
4. `supabase/migrations/20261023_zzz_financial_history.sql`

O estorno de receita de reserva recalcula o saldo/status. Estornos de comandas e mensalidades ficam bloqueados até existir um fluxo específico que preserve a conciliação; não se deve anular apenas a receita e deixar a cobrança quitada.

Os relatórios, screenshots e saídas de execução locais estão em `audit/`, ignorado pelo Git para não publicar acidentalmente dados do ambiente real. Os testes e migrations necessários para reproduzir as correções ficam fora dessa pasta.
