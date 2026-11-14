import { prisma } from '../src/prisma';

interface RemediationResult {
  group1UpdatedCount: number;
  group2UpdatedCount: number;
  totalUpdatedCount: number;
  timestamp: string;
}

async function main() {
  console.log('================================================================');
  console.log('DIGITAL GURU FRANCHISE — EXECUTE APPROVED DATABASE REMEDIATION');
  console.log('================================================================');

  // Step 1: Pre-execution assertions
  console.log('\n[Phase 1] Pre-execution Assertions & Safeguard Checks...');

  // Group 1 Target IDs (13 historical standalone test records to set email = NULL)
  const group1Targets = [
    { id: 'cef4b0cd-0f3e-4052-985a-ccf62684ef0e', code: 'DG-ANN-8108' },
    { id: '0e511d89-16dc-4783-815d-1af6a3d81d79', code: 'DG-ANN-2173' },
    { id: 'c41b6373-6c75-4b6b-a8ea-dbac2e9d26b4', code: 'DG-ANN-3395' },
    { id: '58637f75-9106-4c88-b967-fd3e0b335b79', code: 'DG-ANN-0104' },
    { id: '6fea8b1a-df99-473a-8df4-478933e531ef', code: 'DG-ANN-6197' },
    { id: '75a62ef8-7cd1-46bf-9f5a-70cdfc097cbb', code: 'DG-ANN-8844' },
    { id: '0d1a0b46-35e4-45d3-9969-4b70a388ef32', code: 'DG-ANN-9934' },
    { id: '103396f7-3f76-490a-bb84-36bdf7104300', code: 'DG-ANN-2473' },
    { id: '4847be17-054b-4f06-8e65-a87a21909ef5', code: 'DG-ANN-8660' },
    { id: 'd9f063b5-0bd8-4ac7-8054-34d5d89fe72d', code: 'DG-ANN-3621' },
    { id: '375697d4-d37d-416a-8c63-d10895dbb11c', code: 'DG-ANN-9447' },
    { id: '63009e98-bef8-41bd-baf7-7b34188d4cb9', code: 'DG-ANN-6344' },
    { id: 'fa5dcf1b-dbbf-4b2d-a252-f23291cdb763', code: 'DG-ANN-2175' },
  ];
  const group1Canonical = {
    id: '94aaa68f-1318-4b67-9617-634b2773d92e',
    code: 'DG-ANN-5438',
    expectedEmail: 'annanagar@digitalghuru.example.com',
  };

  // Group 2 Targets
  const group2Retain = {
    id: 'b90880ac-6d9c-41b8-9281-3dee76c3d3a3',
    code: 'INS-A3DFD6',
    expectedEmail: 'nowtest2@gmail.com',
  };
  const group2Update = {
    id: 'd40ca5a7-b9e3-41f9-aef9-e39a98be4dba',
    code: 'INS-88C176',
    expectedOldEmail: 'nowtest2@gmail.com',
    replacementEmail: 'asssssssdf@gmail.com',
  };

  // 1.1 Verify all 13 Group 1 IDs exist and have expected email
  const group1Records = await prisma.institute.findMany({
    where: { id: { in: group1Targets.map((t) => t.id) } },
    select: { id: true, code: true, email: true, name: true, status: true },
  });

  if (group1Records.length !== 13) {
    throw new Error(`Assertion failed: Expected 13 Group 1 records, found ${group1Records.length}`);
  }

  for (const target of group1Targets) {
    const found = group1Records.find((r) => r.id === target.id);
    if (!found) {
      throw new Error(`Assertion failed: Record ID ${target.id} (${target.code}) not found in database!`);
    }
    if (found.code !== target.code) {
      throw new Error(`Assertion failed: Record ID ${target.id} code mismatch: expected ${target.code}, got ${found.code}`);
    }
    if ((found.email || '').trim().toLowerCase() !== 'annanagar@digitalghuru.example.com') {
      throw new Error(`Assertion failed: Record ID ${target.id} email mismatch: expected annanagar@digitalghuru.example.com, got ${found.email}`);
    }
  }
  console.log('  [PASS] All 13 Group 1 historical test records verified.');

  // 1.2 Verify canonical Group 1 record
  const canonicalRecord = await prisma.institute.findUnique({
    where: { id: group1Canonical.id },
    select: { id: true, code: true, email: true, franchiseId: true },
  });
  if (!canonicalRecord) {
    throw new Error(`Assertion failed: Canonical Group 1 record ${group1Canonical.id} not found!`);
  }
  if (canonicalRecord.code !== group1Canonical.code) {
    throw new Error(`Assertion failed: Canonical code mismatch: expected ${group1Canonical.code}, got ${canonicalRecord.code}`);
  }
  if ((canonicalRecord.email || '').trim().toLowerCase() !== group1Canonical.expectedEmail) {
    throw new Error(`Assertion failed: Canonical email mismatch: expected ${group1Canonical.expectedEmail}, got ${canonicalRecord.email}`);
  }
  console.log(`  [PASS] Group 1 canonical record verified: ${canonicalRecord.code} (${canonicalRecord.email}).`);

  // 1.3 Verify no unexpected records in Group 1
  const allAnnaNagarRecords = await prisma.institute.findMany({
    where: {
      email: {
        equals: 'annanagar@digitalghuru.example.com',
        mode: 'insensitive',
      },
    },
    select: { id: true },
  });
  if (allAnnaNagarRecords.length !== 14) {
    throw new Error(`Assertion failed: Expected exactly 14 records with email annanagar@digitalghuru.example.com, found ${allAnnaNagarRecords.length}`);
  }
  console.log('  [PASS] Group 1 isolation verified: Exactly 14 records in conflicting group.');

  // 1.4 Verify Group 2 records
  const group2RetainRecord = await prisma.institute.findUnique({
    where: { id: group2Retain.id },
    select: { id: true, code: true, email: true },
  });
  if (!group2RetainRecord || (group2RetainRecord.email || '').trim().toLowerCase() !== group2Retain.expectedEmail) {
    throw new Error(`Assertion failed: Group 2 Retain record ${group2Retain.id} mismatch!`);
  }

  const group2UpdateRecord = await prisma.institute.findUnique({
    where: { id: group2Update.id },
    select: { id: true, code: true, email: true },
  });
  if (!group2UpdateRecord || (group2UpdateRecord.email || '').trim().toLowerCase() !== group2Update.expectedOldEmail) {
    throw new Error(`Assertion failed: Group 2 Update record ${group2Update.id} mismatch!`);
  }
  console.log('  [PASS] Group 2 current records verified.');

  // 1.5 Verify replacement email availability
  const replacementNormalized = group2Update.replacementEmail.trim().toLowerCase();
  const existingWithReplacement = await prisma.institute.findFirst({
    where: {
      email: {
        equals: replacementNormalized,
        mode: 'insensitive',
      },
    },
    select: { id: true, code: true, name: true },
  });
  if (existingWithReplacement) {
    throw new Error(`Assertion failed: Replacement email "${replacementNormalized}" is already used by Institute ${existingWithReplacement.code} (${existingWithReplacement.name})!`);
  }
  console.log(`  [PASS] Replacement email "${replacementNormalized}" is fully available.`);

  // Step 2: Atomic Transactional Execution
  console.log('\n[Phase 2] Executing Approved Email Remediation in Atomic Transaction...');

  const result: RemediationResult = await prisma.$transaction(async (tx) => {
    // 2.1 Update Group 1 (13 records set email = NULL)
    let group1Count = 0;
    for (const target of group1Targets) {
      const updated = await tx.institute.update({
        where: { id: target.id },
        data: { email: null },
        select: { id: true, code: true, email: true },
      });
      if (updated.email !== null) {
        throw new Error(`Transaction abort: Failed to set email = NULL on ${target.id}`);
      }
      group1Count++;
    }

    if (group1Count !== 13) {
      throw new Error(`Transaction abort: Expected 13 Group 1 updates, completed ${group1Count}`);
    }

    // 2.2 Update Group 2 (1 record set email = asssssssdf@gmail.com)
    const updatedGroup2 = await tx.institute.update({
      where: { id: group2Update.id },
      data: { email: replacementNormalized },
      select: { id: true, code: true, email: true },
    });

    if (updatedGroup2.email !== replacementNormalized) {
      throw new Error(`Transaction abort: Failed to set replacement email on ${group2Update.id}`);
    }
    const group2Count = 1;

    return {
      group1UpdatedCount: group1Count,
      group2UpdatedCount: group2Count,
      totalUpdatedCount: group1Count + group2Count,
      timestamp: new Date().toISOString(),
    };
  });

  console.log(`\n[Phase 3] Remediation Transaction Committed Successfully!`);
  console.log(`  - Group 1 updates (email -> NULL): ${result.group1UpdatedCount}`);
  console.log(`  - Group 2 updates (email -> ${replacementNormalized}): ${result.group2UpdatedCount}`);
  console.log(`  - Total records remediated: ${result.totalUpdatedCount}`);

  // Step 4: Post-remediation verification
  console.log('\n[Phase 4] Post-Remediation Verification...');

  // Verify Anna Nagar group now has exactly 1 record
  const remainingAnnaNagar = await prisma.institute.findMany({
    where: {
      email: {
        equals: 'annanagar@digitalghuru.example.com',
        mode: 'insensitive',
      },
    },
    select: { id: true, code: true, email: true },
  });
  console.log(`  - Records with email "annanagar@digitalghuru.example.com": ${remainingAnnaNagar.length}`);
  if (remainingAnnaNagar.length !== 1 || remainingAnnaNagar[0].id !== group1Canonical.id) {
    throw new Error('Post-remediation verification failed: Group 1 still has non-unique email!');
  }

  // Verify nowtest2 group now has exactly 1 record
  const remainingNowtest2 = await prisma.institute.findMany({
    where: {
      email: {
        equals: 'nowtest2@gmail.com',
        mode: 'insensitive',
      },
    },
    select: { id: true, code: true, email: true },
  });
  console.log(`  - Records with email "nowtest2@gmail.com": ${remainingNowtest2.length}`);
  if (remainingNowtest2.length !== 1 || remainingNowtest2[0].id !== group2Retain.id) {
    throw new Error('Post-remediation verification failed: Group 2 still has non-unique email!');
  }

  // Verify updated record INS-88C176 has asssssssdf@gmail.com
  const updatedIns88 = await prisma.institute.findUnique({
    where: { id: group2Update.id },
    select: { id: true, code: true, email: true },
  });
  console.log(`  - INS-88C176 new email: ${updatedIns88?.email}`);
  if (updatedIns88?.email !== replacementNormalized) {
    throw new Error('Post-remediation verification failed: INS-88C176 does not have replacement email!');
  }

  console.log('\nALL REMEDIATION ASSERTIONS AND POST-VERIFICATIONS PASSED (100%).');
}

main()
  .catch((e) => {
    console.error('REMEDIATION ABORTED WITH ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

