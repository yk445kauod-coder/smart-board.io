import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: true } });
try {
  const sql = await readFile(new URL('./extra.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('extra SQL applied');
} finally {
  await pool.end();
}
