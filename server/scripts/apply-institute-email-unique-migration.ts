/**
 * apply-institute-email-unique-migration.ts
 *
 * Pre-migration safety audit and conditional migration runner for A08:
 * - Checks database for duplicate normalized institute emails.
 * - If duplicates exist, halts immediately without touching database records,
 *   printing a full diagnostic report for manual remediation.
 * - If no duplicates exist, applies the unique functional index safely.
 */

import { prisma } from '../src/prisma.js';

interface DuplicateRow {
  email: string;
  count: number;
}

export async function runSafetyAuditAndMigration(): Promise<{
  safeToMigrate: boolean;
  duplicateCount: number;
  conflictingRecords: Array<{
    id: string;
    code: string;
    name: string;
    rawEmail: string | null;
    city: string | null;
  }>;
}> {
  console.log('----------------------------------------------------------------');
  console.log('[MIGRATION PRE-CHECK] Auditing Institute email uniqueness in database...');
  console.log('----------------------------------------------------------------');

  // Query duplicates using functional normalization LOWER(TRIM(email))
  const duplicates: DuplicateRow[] = await prisma.$queryRawUnsafe(`
    SELECT LOWER(TRIM("email")) as email, COUNT(*)::int as count
    FROM "Institute"
    WHERE "email" IS NOT NULL AND TRIM("email") <> ''
    GROUP BY LOWER(TRIM("email"))
    HAVING COUNT(*) > 1
    ORDER BY count DESC;
  `);

  if (duplicates.length > 0) {
    console.error(`\n[SAFETY HALT] Detected ${duplicates.length} conflicting email group(s) across existing records:`);

    const allConflicting: any[] = [];
    for (const dup of duplicates) {
      console.error(`\n>> Group: "${dup.email}" (${dup.count} records)`);
      const records = await prisma.institute.findMany({
        where: {
          email: { equals: dup.email, mode: 'insensitive' },
        },
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          city: true,
          phone: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      for (const rec of records) {
        console.error(`   - ID: ${rec.id} | Code: ${rec.code} | Name: "${rec.name}" | Email: "${rec.email}" | City: ${rec.city || 'N/A'}`);
        allConflicting.push({
          id: rec.id,
          code: rec.code,
          name: rec.name,
          rawEmail: rec.email,
          city: rec.city,
        });
      }
    }

    console.error('\n----------------------------------------------------------------');
    console.error('[SAFETY POLICY ENFORCED]');
    console.error('1. Existing institutes must NOT be deleted, merged or altered automatically.');
    console.error('2. Migration execution HALTED to prevent database constraint failures.');
    console.error('3. Please resolve the conflicting records according to the Safe Manual Remediation Report.');
    console.error('----------------------------------------------------------------\n');

    return {
      safeToMigrate: false,
      duplicateCount: duplicates.length,
      conflictingRecords: allConflicting,
    };
  }

  console.log('\n[AUDIT PASSED] No duplicate normalized institute emails found.');
  console.log('Applying functional partial unique index "Institute_email_normalized_unique_idx"...');

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Institute_email_normalized_unique_idx"
      ON "Institute" (LOWER(TRIM("email")))
      WHERE "email" IS NOT NULL AND TRIM("email") <> '';
  `);

  console.log('[MIGRATION SUCCESS] "Institute_email_normalized_unique_idx" is active and enforced.');
  return {
    safeToMigrate: true,
    duplicateCount: 0,
    conflictingRecords: [],
  };
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('apply-institute-email-unique-migration.ts')) {
  runSafetyAuditAndMigration()
    .then((result) => {
      if (!result.safeToMigrate) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration Error]', err);
      process.exit(1);
    });
}

