import '../src/db-bridge.js';
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
    ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined },
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

    console.log('\n--- Record Counts Baseline ---');
    const fCount = await client.query('SELECT COUNT(*) FROM "Franchise"');
    const aCount = await client.query('SELECT COUNT(*) FROM "FranchiseAgreement"');
    const iCount = await client.query('SELECT COUNT(*) FROM "FranchiseRoyaltyInstallment"');
    const pCount = await client.query('SELECT COUNT(*) FROM "FranchiseRoyaltyPayment"');
    const rCount = await client.query('SELECT COUNT(*) FROM "FranchiseRoyaltyRecord"');
    console.log(`Franchises: ${fCount.rows[0].count}`);
    console.log(`Agreements: ${aCount.rows[0].count}`);
    console.log(`Installments: ${iCount.rows[0].count}`);
    console.log(`Payments: ${pCount.rows[0].count}`);
    console.log(`Royalty Records: ${rCount.rows[0].count}`);
  } catch (err: any) {
    console.error('[Error] Database connection failed:', err.message);
  } finally {
    await client.end();
  }
}

inspectDatabase();
