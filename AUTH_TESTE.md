# ArenaPro — Autenticação e modelo comercial

## Regra definitiva
- Cadastro público cria somente `CLIENT`.
- Somente `SUPER_ADMIN` cria arenas e proprietários.
- Proprietários entram como `ARENA_ADMIN` por convite.
- Novas arenas começam com assinatura `PENDING`.
- `ARENA_ADMIN` e `ARENA_STAFF` só acessam a operação quando a assinatura está `ACTIVE` e o período está vigente.
- `SUPER_ADMIN` não depende de assinatura.
- `CLIENT` não depende de assinatura para utilizar o portal e fazer reservas.

## Teste
1. Crie um CLIENT pelo `/register`.
2. Faça login e confirme que entra em `/app`.
3. Tente acessar `/admin`: deve ser redirecionado para o portal.
4. Entre com um SUPER_ADMIN real.
5. Abra `/admin/saas`.
6. Crie uma arena + proprietário.
7. O proprietário deve ser `ARENA_ADMIN` e receber convite.
8. A assinatura deve nascer `PENDING`.
9. O proprietário não deve acessar a operação enquanto estiver `PENDING`.
10. SUPER_ADMIN pode ativar a assinatura manualmente.
11. Após `ACTIVE`, o proprietário pode entrar no `/admin`.
12. Ao suspender a assinatura, o acesso operacional deve ser bloqueado novamente.

A confirmação de e-mail do cadastro público pode ficar desligada no ambiente de desenvolvimento. O convite de proprietário é um fluxo separado e deve usar o provedor de e-mail/SMTP configurado no Supabase.
