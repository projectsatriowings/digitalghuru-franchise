import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { assertSafeTestDatabase } from '../src/utils/test-db-guard.js';

// Enforce Safety Guard before any database connection is initialized
const testDbIdentity = assertSafeTestDatabase();
const testDbUrl = process.env.TEST_DATABASE_URL!;

async function applyMigrationsToTestDb() {
  console.log(`Applying custom triggers and governance migrations to test DB: ${testDbIdentity.host}${testDbIdentity.database}`);

  const client = new Client({ connectionString: testDbUrl });
  await client.connect();

  const remediationSqlPath = path.resolve(__dirname, '../prisma/migrations/20261112_remediation/migration.sql');
  const governanceSqlPath = path.resolve(__dirname, '../prisma/migrations/20261113_course_governance/migration.sql');

  if (fs.existsSync(remediationSqlPath)) {
    console.log('Applying 20261112_remediation SQL (triggers and sequences)...');
    const sql = fs.readFileSync(remediationSqlPath, 'utf8');
    await client.query(sql);
    console.log('✓ 20261112_remediation applied successfully.');
  }

  if (fs.existsSync(governanceSqlPath)) {
    console.log('Applying 20261113_course_governance SQL...');
    const sql = fs.readFileSync(governanceSqlPath, 'utf8');
    await client.query(sql);
    console.log('✓ 20261113_course_governance applied successfully.');
  }

  await client.end();
  console.log('All custom database triggers and governance functions are active on test DB!');
}

applyMigrationsToTestDb().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

