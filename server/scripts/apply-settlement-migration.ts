import '../src/db-bridge.js';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined },
  });

  try {
    await client.connect();
    console.log('[Migration] Connected to Neon PostgreSQL.');

    const sqlPath = path.resolve(__dirname, '../prisma/migrations/20261121_centralized_payments_and_revenue_sharing/migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('[Migration] Executing migration SQL...');
    await client.query(sql);
    console.log('[Migration] Migration executed successfully!');

    // Verification check
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('FranchiseSettlement', 'SettlementAdjustment', 'SettlementTransfer')
      ORDER BY table_name;
    `);

    console.log('[Migration] Verified new tables in database:');
    for (const row of tablesRes.rows) {
      console.log(` -> Table: ${row.table_name}`);
    }

    const colRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Franchise' 
      AND column_name IN ('revenueSharePercentage', 'razorpayAccountId', 'beneficiaryName');
    `);
    console.log('[Migration] Verified Franchise new columns:');
    for (const row of colRes.rows) {
      console.log(` -> Column: ${row.column_name}`);
    }

    await client.end();
    console.log('[Migration] Done.');
  } catch (err) {
    console.error('[Migration Error]', err);
    process.exit(1);
  }
}

runMigration();
