import '../src/dns-preload.cjs';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[Migration Error] DATABASE_URL not found in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function runAdditiveMigration() {
  const client = await pool.connect();
  console.log('[Additive Migration] Connected to Neon PostgreSQL.');

  try {
    await client.query('BEGIN');

    // 1. Create Enums if not exist
    console.log('[Additive Migration] Creating new Enums...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "AgreementBusinessModel" AS ENUM (
          'NEW_CENTRE_JOINT_INVESTMENT',
          'EXISTING_CENTRE',
          'BRAND_AND_COURSE_SUPPORT',
          'CUSTOM_AGREEMENT'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "RevenueCalculationBasis" AS ENUM (
          'GROSS_COURSE_FEES',
          'NET_COURSE_REVENUE',
          'PROFIT_AFTER_EXPENSES'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "SettlementFrequency" AS ENUM (
          'MONTHLY',
          'YEARLY'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "ExpensePayerRole" AS ENUM (
          'DIGITAL_GURU',
          'PARTNER',
          'SHARED',
          'CUSTOM'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Add columns to FranchiseAgreement safely
    console.log('[Additive Migration] Adding new additive columns to FranchiseAgreement...');
    const columns = [
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "agreementType" "AgreementBusinessModel" DEFAULT 'CUSTOM_AGREEMENT';`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "totalInvestment" DECIMAL(12, 2);`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "digitalGuruInvestmentAmount" DECIMAL(12, 2);`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "partnerInvestmentAmount" DECIMAL(12, 2);`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "digitalGuruInvestmentPercentage" DECIMAL(5, 2);`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "partnerInvestmentPercentage" DECIMAL(5, 2);`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "operationalSetupContribution" DECIMAL(12, 2);`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "investmentNotes" TEXT;`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "digitalGuruRevenuePercentage" DECIMAL(5, 2) DEFAULT 50.00;`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "partnerRevenuePercentage" DECIMAL(5, 2) DEFAULT 50.00;`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "revenueCalculationBasis" "RevenueCalculationBasis" DEFAULT 'GROSS_COURSE_FEES';`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "settlementFrequency" "SettlementFrequency" DEFAULT 'YEARLY';`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "expenseResponsibilities" JSONB;`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "marketingResponsibleParty" "ExpensePayerRole" DEFAULT 'DIGITAL_GURU';`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "marketingSupportDurationMonths" INTEGER DEFAULT 3;`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "marketingPostSupportParty" "ExpensePayerRole" DEFAULT 'PARTNER';`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "marketingBudget" DECIMAL(12, 2);`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "marketingEffectiveStartDate" DATE;`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "marketingNotes" TEXT;`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "courseSoftwareAccessEnabled" BOOLEAN NOT NULL DEFAULT true;`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "courseSoftwarePricingNotes" TEXT;`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;`,
      `ALTER TABLE "FranchiseAgreement" ADD COLUMN IF NOT EXISTS "parentAgreementId" TEXT;`,
    ];

    for (const sql of columns) {
      await client.query(sql);
    }

    // 3. Add Foreign Key for parentAgreementId if not exists
    console.log('[Additive Migration] Ensuring parentAgreementId foreign key exists...');
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FranchiseAgreement_parentAgreementId_fkey'
        ) THEN
          ALTER TABLE "FranchiseAgreement"
          ADD CONSTRAINT "FranchiseAgreement_parentAgreementId_fkey"
          FOREIGN KEY ("parentAgreementId") REFERENCES "FranchiseAgreement"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 4. Create Indexes
    console.log('[Additive Migration] Creating indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS "FranchiseAgreement_agreementType_idx" ON "FranchiseAgreement"("agreementType");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "FranchiseAgreement_parentAgreementId_idx" ON "FranchiseAgreement"("parentAgreementId");`);

    await client.query('COMMIT');
    console.log('[Additive Migration] SUCCESS! All additive columns, types, constraints, and indexes applied safely.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Additive Migration] FAILED with error, rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runAdditiveMigration().catch((e) => {
  console.error(e);
  process.exit(1);
});

