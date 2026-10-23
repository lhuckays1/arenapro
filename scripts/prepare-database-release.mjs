import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const migrations = [
  '20261023_operational_integrity.sql',
  '20261023_z_payments_integrity.sql',
  '20261023_zz_public_booking.sql',
  '20261023_zzz_financial_history.sql',
];

export async function databaseRelease() {
  const bodies = [];
  for (const migration of migrations) {
    const source = (await readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),'utf8')).trim();
    if (!source.startsWith('BEGIN;') || !source.endsWith('COMMIT;')) throw new Error(`Transação ausente em ${migration}`);
    bodies.push(source.slice(6,-7).trim());
  }
  return `BEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '120s';\n\n${bodies.join('\n\n')}\n\nCOMMIT;\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await mkdir('audit', { recursive:true });
  await writeFile('audit/APLICAR-CORRECOES-2026-10-23.sql',await databaseRelease());
  console.log('SQL preparado em audit/APLICAR-CORRECOES-2026-10-23.sql. Nenhuma conexão com banco foi realizada.');
}
