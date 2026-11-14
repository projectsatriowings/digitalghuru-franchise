import { prisma } from '../src/prisma';

async function main() {
  console.log('================================================================');
  console.log('READ-ONLY DATABASE REMEDIATION VERIFICATION AUDIT');
  console.log('================================================================');

  const group1NullIds = [
    'cef4b0cd-0f3e-4052-985a-ccf62684ef0e',
    '0e511d89-16dc-4783-815d-1af6a3d81d79',
    'c41b6373-6c75-4b6b-a8ea-dbac2e9d26b4',
    '58637f75-9106-4c88-b967-fd3e0b335b79',
    '6fea8b1a-df99-473a-8df4-478933e531ef',
    '75a62ef8-7cd1-46bf-9f5a-70cdfc097cbb',
    '0d1a0b46-35e4-45d3-9969-4b70a388ef32',
    '103396f7-3f76-490a-bb84-36bdf7104300',
    '4847be17-054b-4f06-8e65-a87a21909ef5',
    'd9f063b5-0bd8-4ac7-8054-34d5d89fe72d',
    '375697d4-d37d-416a-8c63-d10895dbb11c',
    '63009e98-bef8-41bd-baf7-7b34188d4cb9',
    'fa5dcf1b-dbbf-4b2d-a252-f23291cdb763',
  ];
  const group1CanonicalId = '94aaa68f-1318-4b67-9617-634b2773d92e';
  const group2RetainId = 'b90880ac-6d9c-41b8-9281-3dee76c3d3a3';
  const group2UpdateId = 'd40ca5a7-b9e3-41f9-aef9-e39a98be4dba';

  // 1. Verify 13 Group 1 records have email = NULL
  const g1NullRecords = await prisma.institute.findMany({
    where: { id: { in: group1NullIds } },
    select: {
      id: true,
      code: true,
      name: true,
      email: true,
      status: true,
      _count: {
        select: {
          students: true,
          batches: true,
          payments: true,
        },
      },
    },
  });

  if (g1NullRecords.length !== 13) {
    throw new Error(`[FAIL] Expected 13 Group 1 records, found ${g1NullRecords.length}`);
  }

  for (const rec of g1NullRecords) {
    if (rec.email !== null) {
      throw new Error(`[FAIL] Record ${rec.code} (${rec.id}) has email "${rec.email}", expected NULL!`);
    }
  }
  console.log(`[PASS] Group 1 (13 records): All 13 have email === NULL.`);

  // 2. Verify Group 1 Canonical
  const g1Canonical = await prisma.institute.findUnique({
    where: { id: group1CanonicalId },
    select: {
      id: true,
      code: true,
      name: true,
      email: true,
      status: true,
      franchiseId: true,
      franchise: { select: { code: true, name: true } },
      _count: { select: { staffProfiles: true, batches: true, courseEnrollments: true } },
    },
  });
  if (!g1Canonical || g1Canonical.email !== 'annanagar@digitalghuru.example.com') {
    throw new Error(`[FAIL] Canonical Group 1 record email mismatch: ${g1Canonical?.email}`);
  }
  console.log(`[PASS] Group 1 Canonical (${g1Canonical.code}): Retained ${g1Canonical.email} (Franchise: ${g1Canonical.franchise?.code}, ${g1Canonical._count.batches} batches, ${g1Canonical._count.courseEnrollments} course enrollments).`);

  // 3. Verify Group 2 Retained
  const g2Retain = await prisma.institute.findUnique({
    where: { id: group2RetainId },
    select: {
      id: true,
      code: true,
      name: true,
      email: true,
      status: true,
      memberships: {
        include: {
          user: { select: { email: true, role: true } },
        },
      },
    },
  });
  if (!g2Retain || g2Retain.email !== 'nowtest2@gmail.com') {
    throw new Error(`[FAIL] Group 2 Retain record email mismatch: ${g2Retain?.email}`);
  }
  console.log(`[PASS] Group 2 Retained (${g2Retain.code}): Retained ${g2Retain.email} (Admin User: ${g2Retain.memberships[0]?.user?.email}).`);

  // 4. Verify Group 2 Updated
  const g2Update = await prisma.institute.findUnique({
    where: { id: group2UpdateId },
    select: {
      id: true,
      code: true,
      name: true,
      email: true,
      status: true,
      memberships: {
        include: {
          user: { select: { email: true, role: true } },
        },
      },
    },
  });
  if (!g2Update || g2Update.email !== 'asssssssdf@gmail.com') {
    throw new Error(`[FAIL] Group 2 Update record email mismatch: ${g2Update?.email}`);
  }
  console.log(`[PASS] Group 2 Updated (${g2Update.code}): Updated to ${g2Update.email} (Admin User: ${g2Update.memberships[0]?.user?.email}).`);

  // 5. Verify Zero Normalized Duplicate Email Groups
  const duplicateGroups: any[] = await prisma.$queryRawUnsafe(`
    SELECT LOWER(TRIM("email")) as email, COUNT(*)::int as count
    FROM "Institute"
    WHERE "email" IS NOT NULL AND TRIM("email") <> ''
    GROUP BY LOWER(TRIM("email"))
    HAVING COUNT(*) > 1;
  `);
  if (duplicateGroups.length > 0) {
    throw new Error(`[FAIL] Found ${duplicateGroups.length} duplicate email groups in database!`);
  }
  console.log(`[PASS] Zero duplicate normalized email groups across all institutes in database.`);

  // 6. Verify Actual PostgreSQL Index Definition
  const indexRows: any[] = await prisma.$queryRawUnsafe(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'Institute'
      AND indexname = 'Institute_email_normalized_unique_idx';
  `);
  if (indexRows.length === 0) {
    throw new Error(`[FAIL] Index "Institute_email_normalized_unique_idx" not found in pg_indexes!`);
  }
  console.log(`[PASS] PostgreSQL Functional Unique Index verified in pg_indexes:`);
  console.log(`       ${indexRows[0].indexdef}`);

  console.log('\n[SUCCESS] READ-ONLY VERIFICATION CONFIRMED: Database operations are 100% complete and active.');
}

main()
  .catch((e) => {
    console.error('Read-only verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

