import { prisma } from '../src/prisma';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('================================================================');
  console.log('DATABASE IDENTITY & PRE-REMEDIATION BACKUP AUDIT');
  console.log('================================================================');

  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set!');
  }

  // Parse connection URL safely without exposing credentials
  const urlObj = new URL(dbUrl);
  const dbName = urlObj.pathname.replace(/^\//, '');
  const host = urlObj.hostname;

  console.log(`[Database Identity Check] Host: ${host}`);
  console.log(`[Database Identity Check] Database Name: ${dbName}`);

  // Strict validation against Tuition Management db
  if (dbName !== 'neondb') {
    throw new Error(`CRITICAL ABORT: Connected database is "${dbName}", expected dedicated "neondb"!`);
  }
  if (!host.includes('neon.tech') && !host.includes('neon')) {
    throw new Error(`CRITICAL ABORT: Host "${host}" is not recognized as a Neon PostgreSQL instance!`);
  }

  // Verify dedicated franchise tables exist and contain franchise records
  const franchiseCount = await prisma.franchise.count();
  const instituteCount = await prisma.institute.count();
  console.log(`[Database Identity Check] Franchise count: ${franchiseCount}, Institute count: ${instituteCount}`);

  if (franchiseCount === 0) {
    throw new Error('CRITICAL ABORT: Zero franchises found. Not the dedicated franchise database!');
  }

  console.log('DATABASE IDENTITY CONFIRMED: Dedicated Digital Guru Franchise Neon PostgreSQL (neondb).\n');

  // Verify the 16 target IDs exist
  const group1TargetIds = [
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

  const allTargetIds = [
    ...group1TargetIds,
    group1CanonicalId,
    group2RetainId,
    group2UpdateId,
  ];

  console.log(`[Backup] Fetching complete snapshot for all ${allTargetIds.length} target institute records...`);

  const records = await prisma.institute.findMany({
    where: { id: { in: allTargetIds } },
    include: {
      franchise: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          ownerName: true,
        },
      },
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
              isActive: true,
            },
          },
        },
      },
      _count: {
        select: {
          memberships: true,
          staffProfiles: true,
          students: true,
          batches: true,
          courseEnrollments: true,
          payments: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (records.length !== 16) {
    throw new Error(`CRITICAL ABORT: Expected 16 target records, but retrieved ${records.length}!`);
  }

  const backupData = {
    backupTimestamp: new Date().toISOString(),
    databaseHost: host,
    databaseName: dbName,
    recordCount: records.length,
    records: records.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      legalName: r.legalName,
      email: r.email,
      phone: r.phone,
      status: r.status,
      city: r.city,
      state: r.state,
      address: r.address,
      postalCode: r.postalCode,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      franchise: r.franchise,
      counts: r._count,
      memberships: r.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        isDefault: m.isDefault,
        user: m.user,
      })),
    })),
  };

  const backupPath = path.resolve(__dirname, 'backup-16-institutes-pre-remediation.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');

  console.log(`[Backup] Successfully exported snapshot of all 16 records to:`);
  console.log(`         ${backupPath}\n`);

  console.log('SUMMARY OF 16 BACKED UP RECORDS:');
  for (const r of backupData.records) {
    const frInfo = r.franchise ? `${r.franchise.code} (${r.franchise.name})` : 'Standalone';
    console.log(`- [${r.code}] ${r.name} | Status: ${r.status} | Email: ${r.email} | Franchise: ${frInfo} | Students: ${r.counts.students} | Batches: ${r.counts.batches} | Memberships: ${r.counts.memberships}`);
  }

  console.log('\nPRE-REMEDIATION BACKUP COMPLETED CLEANLY.');
}

main()
  .catch((e) => {
    console.error('[Verification & Backup Failed]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

