import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function catalogTestRecords() {
  console.log('================================================================');
  console.log(' CATALOGING AUDIT TEST RECORDS IN DATABASE');
  console.log('================================================================\n');

  // 1. Database Connection Info (Host & Database Name only, zero credentials)
  const dbUrl = process.env.DATABASE_URL || '';
  let dbHost = 'Unknown';
  let dbName = 'Unknown';
  try {
    const parsed = new URL(dbUrl);
    dbHost = parsed.hostname;
    dbName = parsed.pathname.replace(/^\//, '');
  } catch (e) {
    // ignore
  }

  console.log(`Database Host: ${dbHost}`);
  console.log(`Database Name: ${dbName}`);
  console.log(`Provider: Neon PostgreSQL (AWS ap-southeast-1)\n`);

  // 2. Identify Test Franchises
  const testFranchises = await prisma.franchise.findMany({
    where: {
      OR: [
        { code: { contains: 'AUDIT', mode: 'insensitive' } },
        { code: { contains: 'TEST', mode: 'insensitive' } },
        { name: { contains: 'Audit', mode: 'insensitive' } },
        { name: { contains: 'Gate', mode: 'insensitive' } },
      ],
    },
    select: { id: true, code: true, name: true, createdAt: true },
  });

  // 3. Identify Test Branches / Institutes
  const testInstitutes = await prisma.institute.findMany({
    where: {
      OR: [
        { code: { contains: 'AUDIT', mode: 'insensitive' } },
        { code: { contains: 'TEST', mode: 'insensitive' } },
        { name: { contains: 'Audit', mode: 'insensitive' } },
      ],
    },
    select: { id: true, code: true, name: true, createdAt: true },
  });

  // 4. Identify Test Users
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'audit', mode: 'insensitive' } },
        { email: { contains: 'gate', mode: 'insensitive' } },
        { email: { contains: 'test', mode: 'insensitive' } },
      ],
    },
    select: { id: true, email: true, fullName: true, role: true, createdAt: true },
  });

  // 5. Identify Test Payments
  const totalPayments = await prisma.payment.count();
  const testPayments = await prisma.payment.findMany({
    where: {
      OR: [
        { receiptNumber: { startsWith: 'REC-AUDIT' } },
        { receiptNumber: { startsWith: 'REC-GATE' } },
        { receiptNumber: { startsWith: 'REC-TEST' } },
        { gatewayPaymentId: { startsWith: 'pay_audit' } },
        { gatewayPaymentId: { startsWith: 'pay_wh' } },
        { remarks: { contains: 'audit', mode: 'insensitive' } },
        { remarks: { contains: 'gate', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      receiptNumber: true,
      amountPaid: true,
      status: true,
      gatewayPaymentId: true,
      paidAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // 6. Identify Test Settlements
  const totalSettlements = await prisma.franchiseSettlement.count();
  const testSettlements = await prisma.franchiseSettlement.findMany({
    where: {
      OR: [
        { statementNumber: { contains: 'AUDIT', mode: 'insensitive' } },
        { statementNumber: { contains: 'GATE', mode: 'insensitive' } },
        { statementNumber: { contains: 'TEST', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      statementNumber: true,
      settlementMonth: true,
      status: true,
      franchisePayableAmount: true,
      totalTransferredAmount: true,
      remainingPayableAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // 7. Identify Test Manual Bank Transfers
  const totalBankTransfers = await prisma.manualBankTransfer.count();
  const testBankTransfers = await prisma.manualBankTransfer.findMany({
    where: {
      OR: [
        { utrNumber: { startsWith: 'UTR-AUDIT' } },
        { utrNumber: { startsWith: 'UTR-GATE' } },
        { utrNumber: { startsWith: 'UTR-CONCUR' } },
        { remarks: { contains: 'audit', mode: 'insensitive' } },
        { remarks: { contains: 'gate', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      utrNumber: true,
      amount: true,
      status: true,
      transferMethod: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // 8. Identify Test Payment Adjustments (Refunds)
  const totalAdjustments = await prisma.paymentAdjustment.count();
  const testAdjustments = await prisma.paymentAdjustment.findMany({
    where: {
      OR: [
        { reason: { contains: 'gate', mode: 'insensitive' } },
        { reason: { contains: 'audit', mode: 'insensitive' } },
        { reason: { contains: 'test', mode: 'insensitive' } },
        { reason: { contains: 'rfnd_gate', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      adjustmentType: true,
      amount: true,
      reason: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Print Summary Table
  console.log('--- DATABASE RECORD SUMMARY ---');
  console.log(`Total Payments: ${totalPayments} (Test: ${testPayments.length}, Production/Pre-existing: ${totalPayments - testPayments.length})`);
  console.log(`Total Settlements: ${totalSettlements} (Test: ${testSettlements.length}, Production/Pre-existing: ${totalSettlements - testSettlements.length})`);
  console.log(`Total Manual Bank Transfers: ${totalBankTransfers} (Test: ${testBankTransfers.length}, Production/Pre-existing: ${totalBankTransfers - testBankTransfers.length})`);
  console.log(`Total Payment Adjustments: ${totalAdjustments} (Test: ${testAdjustments.length}, Production/Pre-existing: ${totalAdjustments - testAdjustments.length})`);
  console.log(`Test Franchises: ${testFranchises.length}`);
  console.log(`Test Institutes: ${testInstitutes.length}`);
  console.log(`Test Users: ${testUsers.length}\n`);

  console.log('--- DETAILED TEST RECORDS IN DATABASE ---');
  console.log('\n[Test Franchises]:', JSON.stringify(testFranchises, null, 2));
  console.log('\n[Test Institutes]:', JSON.stringify(testInstitutes, null, 2));
  console.log('\n[Test Users]:', JSON.stringify(testUsers, null, 2));
  console.log('\n[Test Payments (' + testPayments.length + ')]:');
  testPayments.forEach((p) => {
    console.log(`  - ID: ${p.id} | Receipt: ${p.receiptNumber} | Amount: ₹${p.amountPaid} | Status: ${p.status} | GatewayId: ${p.gatewayPaymentId}`);
  });
  console.log('\n[Test Settlements (' + testSettlements.length + ')]:');
  testSettlements.forEach((s) => {
    console.log(`  - ID: ${s.id} | Statement: ${s.statementNumber} | Month: ${s.settlementMonth} | Status: ${s.status} | Payable: ₹${s.franchisePayableAmount} | Transferred: ₹${s.totalTransferredAmount}`);
  });
  console.log('\n[Test Manual Bank Transfers (' + testBankTransfers.length + ')]:');
  testBankTransfers.forEach((t) => {
    console.log(`  - ID: ${t.id} | UTR: ${t.utrNumber} | Amount: ₹${t.amount} | Status: ${t.status} | Method: ${t.transferMethod}`);
  });
  console.log('\n[Test Adjustments (' + testAdjustments.length + ')]:');
  testAdjustments.forEach((a) => {
    console.log(`  - ID: ${a.id} | Type: ${a.adjustmentType} | Amount: ₹${a.amount} | Reason: ${a.reason}`);
  });

  console.log('\n================================================================');
  console.log(' CATALOG COMPLETE — ZERO RECORDS MODIFIED OR DELETED');
  console.log('================================================================');
}

catalogTestRecords()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
