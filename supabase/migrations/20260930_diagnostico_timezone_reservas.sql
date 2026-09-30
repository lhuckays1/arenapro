-- ArenaPro - diagnóstico e correção de reservas gravadas com 3h de diferença
-- IMPORTANTE: execute primeiro o SELECT. Ele mostra como o PostgreSQL interpreta cada reserva.

-- 1) DIAGNÓSTICO
SELECT
  id,
  arena_id,
  start_at AS start_at_utc,
  end_at AS end_at_utc,
  start_at AT TIME ZONE 'America/Sao_Paulo' AS start_at_arena,
  end_at AT TIME ZONE 'America/Sao_Paulo' AS end_at_arena,
  created_at
FROM public.reservations
ORDER BY created_at DESC;

-- 2) CORREÇÃO CONTROLADA
-- Não aplicar automaticamente em todas as reservas: reservas já corretas não podem
-- receber +3h novamente. Para corrigir uma reserva comprovadamente gravada 3h atrás,
-- use o ID da reserva abaixo.
--
-- UPDATE public.reservations
-- SET
--   start_at = start_at + INTERVAL '3 hours',
--   end_at = end_at + INTERVAL '3 hours',
--   updated_at = NOW()
-- WHERE id = 'COLE-O-ID-DA-RESERVA-AQUI';

-- 3) Se houver várias reservas do mesmo teste e você confirmar que TODAS elas
-- pertencem ao período legado, substitua os IDs explicitamente:
--
-- UPDATE public.reservations
-- SET
--   start_at = start_at + INTERVAL '3 hours',
--   end_at = end_at + INTERVAL '3 hours',
--   updated_at = NOW()
-- WHERE id IN (
--   'ID-RESERVA-1',
--   'ID-RESERVA-2'
-- );
