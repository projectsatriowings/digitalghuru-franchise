import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

async function applyMigrationsToTestDb() {
  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/dg_test_isolated';
  console.log(`Applying custom triggers and governance migrations to test DB: ${testDbUrl}`);

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

