import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function inspectDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[Error] DATABASE_URL is not set.');
    process.exit(1);
  }

  // Sanitize display URL (hide password)
  const sanitizedUrl = connectionString.replace(/:\/\/[^:]+:([^@]+)@/, '://***:***@');
  console.log(`Connecting to database at ${sanitizedUrl}...`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('[Success] Connected to Neon PostgreSQL.');

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`Found ${res.rows.length} existing tables in 'public' schema:`);
    if (res.rows.length === 0) {
      console.log(' -> Database is currently clean with no public tables.');
    } else {
      for (const row of res.rows) {
        console.log(` -> Table: ${row.table_name}`);
      }
    }
  } catch (err: any) {
    console.error('[Error] Database connection failed:', err.message);
  } finally {
    await client.end();
  }
}

inspectDatabase();
