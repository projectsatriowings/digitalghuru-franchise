import pg from 'pg';
import { config } from './index.js';

const { Pool } = pg;

export const dbPool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function checkDatabaseHealth(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await dbPool.query('SELECT NOW() as current_time');
    const latencyMs = Date.now() - start;
    return { connected: !!res.rows[0], latencyMs };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}
