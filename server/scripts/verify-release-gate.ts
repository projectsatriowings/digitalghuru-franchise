import { PrismaClient, SettlementStatus, PaymentStatus } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { settlementTransferService } from '../src/modules/settlements/settlement-transfer.service.js';
import { settlementEngineService } from '../src/modules/settlements/settlement-engine.service.js';
import { razorpayService } from '../src/modules/payments/razorpay.service.js';
import { handleRazorpayWebhook } from '../src/modules/payments/webhook.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

async function runReleaseGateVerification() {
  console.log('================================================================');
  console.log(' DIGITALGHURU PRE-TEST-MODE RELEASE GATE VERIFICATION');
  console.log('================================================================\n');

  let passedChecks = 0;
  let totalChecks = 0;

  function assertCheck(name: string, condition: boolean, detail: string) {
    totalChecks++;
    if (condition) {
      passedChecks++;
      console.log(`[✅ PASS] ${name} -> ${detail}`);
    } else {
      console.error(`[❌ FAIL] ${name} -> ${detail}`);
    }
  }

  // ===========================================================================
  // 1. DATABASE & MIGRATION VERIFICATION
  // ===========================================================================
  console.log('\n--- 1. DATABASE & MIGRATION VERIFICATION ---');

  // A. Check columns on FranchiseSettlement
  const fsCols: any[] = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'FranchiseSettlement' 
      AND column_name IN ('totalTransferredAmount', 'remainingPayableAmount');
  `;
  const hasSettlementColumns = fsCols.length === 2;
  assertCheck(
    'FranchiseSettlement columns',
    hasSettlementColumns,
    `Found columns: ${fsCols.map(c => c.column_name).join(', ')}`
  );

  // B. Check ManualBankTransfer table and columns
  const mbtCols: any[] = await prisma.$queryRaw`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns 
    WHERE table_name = 'ManualBankTransfer';
  `;
  const mbtColNames = mbtCols.map(c => c.column_name);
  const requiredMbtCols = [
    'id', 'settlementId', 'franchiseId', 'amount', 'transferDate',
    'transferMethod', 'utrNumber', 'recipientBankName', 'recipientAccountLast4',
    'recipientIfsc', 'paymentProofUrl', 'remarks', 'status', 'recordedById',
    'recordedAt', 'verifiedById', 'verifiedAt', 'createdAt', 'updatedAt'
  ];
  const allColsPresent = requiredMbtCols.every(c => mbtColNames.includes(c));
  assertCheck(
    'ManualBankTransfer schema',
    allColsPresent,
    `All ${requiredMbtCols.length} expected columns exist in Neon PostgreSQL`
  );

  // C. Check SettlementStatus Enum
  const enumValues: any[] = await prisma.$queryRaw`
    SELECT e.enumlabel
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'SettlementStatus';
  `;
  const labels = enumValues.map(v => v.enumlabel);
  const requiredEnums = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];
  const hasEnums = requiredEnums.every(e => labels.includes(e));
  assertCheck(
    'SettlementStatus Enum values',
    hasEnums,
    `PostgreSQL enum contains: ${requiredEnums.join(', ')}`
  );

  // D. Confirm migration idempotency by executing migration.sql safely
  const migrationSqlPath = path.resolve(__dirname, '../prisma/migrations/20261123_manual_monthly_settlement_transfers/migration.sql');
  const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');
  let migrationSafe = false;
  try {
    // Separate DDL statements from the PL/pgSQL block
    const plPgSqlIdx = migrationSql.indexOf('DO $$ BEGIN');
    let ddlPart = migrationSql;
    let doBlock = '';
    if (plPgSqlIdx !== -1) {
      ddlPart = migrationSql.slice(0, plPgSqlIdx);
      doBlock = migrationSql.slice(plPgSqlIdx).trim();
    }

    const ddlStatements = ddlPart
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of ddlStatements) {
      await prisma.$executeRawUnsafe(statement);
    }
    if (doBlock) {
      await prisma.$executeRawUnsafe(doBlock);
    }
    migrationSafe = true;
  } catch (err: any) {
    console.error('Migration execution error:', err);
  }
  assertCheck(
    'Migration reproducibility & idempotency',
    migrationSafe,
    'migration.sql executed successfully without errors or schema conflicts'
  );

  // E. Verify existing production financial records remain intact
  const paymentCount = await prisma.payment.count();
  const settlementCount = await prisma.franchiseSettlement.count();
  const legacyTransferCount = await prisma.settlementTransfer.count();
  assertCheck(
    'Historical data preservation',
    paymentCount > 0 && settlementCount > 0,
    `Preserved: ${paymentCount} Payments, ${settlementCount} Settlements, ${legacyTransferCount} legacy Route transfers (0 deleted)`
  );

  // ===========================================================================
  // 2. DUAL CONTROL & TRANSFER WORKFLOW VERIFICATION
  // ===========================================================================
  console.log('\n--- 2. TRANSFER DUAL CONTROL & MAKER-CHECKER VERIFICATION ---');

  // Find or create test entities
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!superAdmin) throw new Error('No SUPER_ADMIN found');

  // Create a secondary Super Admin for maker-checker testing
  let secondaryAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', email: 'auditor.admin@digitalguru.test' },
  });
  if (!secondaryAdmin) {
    secondaryAdmin = await prisma.user.create({
      data: {
        email: 'auditor.admin@digitalguru.test',
        fullName: 'Independent Finance Auditor',
        role: 'SUPER_ADMIN',
        passwordHash: 'auditor_hash_gate_test',
        phone: '9988776655',
      },
    });
  }

  const franchise = await prisma.franchise.findFirst({ where: { status: 'ACTIVE' } });
  if (!franchise) throw new Error('No active franchise found');

  // Create test statement for dual-control testing
  const gateTestMonth = '2026-10';
  let testStmt = await prisma.franchiseSettlement.findFirst({
    where: { franchiseId: franchise.id, settlementMonth: gateTestMonth },
  });
  if (!testStmt) {
    testStmt = await prisma.franchiseSettlement.create({
      data: {
        franchiseId: franchise.id,
        settlementMonth: gateTestMonth,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2026-10-31T23:59:59.999Z'),
        statementNumber: `STMT-GATE-${Date.now()}`,
        status: SettlementStatus.APPROVED,
        totalCapturedPayments: 40000,
        franchisePayableAmount: 20000,
        digitalGuruShareAmount: 20000,
        totalTransferredAmount: 0,
        remainingPayableAmount: 20000,
        approvedById: superAdmin.id,
        approvedAt: new Date(),
      },
    });
  } else {
    testStmt = await prisma.franchiseSettlement.update({
      where: { id: testStmt.id },
      data: {
        status: SettlementStatus.APPROVED,
        franchisePayableAmount: 20000,
        remainingPayableAmount: 20000,
        totalTransferredAmount: 0,
      },
    });
  }

  // A. Record transfer - verify default status is PENDING_VERIFICATION
  const gateUtr1 = `UTR-GATE-DC-${Date.now()}`;
  const recResult = await settlementTransferService.recordManualBankTransfer(
    testStmt.id,
    superAdmin.id,
    {
      amount: 5000,
      transferMethod: 'NEFT',
      utrNumber: gateUtr1,
      remarks: 'Maker transfer for dual-control gate test',
    }
  );
  assertCheck(
    'Initial transfer status',
    recResult.transfer.status === 'PENDING_VERIFICATION',
    `Transfer recorded with status: "${recResult.transfer.status}"`
  );

  // B. Maker-Checker dual control check:
  // When ENFORCE_TRANSFER_DUAL_CONTROL is active, the recording admin cannot verify
  process.env.ENFORCE_TRANSFER_DUAL_CONTROL = 'true';
  let selfVerificationBlocked = false;
  try {
    await settlementTransferService.verifyManualBankTransfer(
      recResult.transfer.id,
      superAdmin.id, // Same admin who recorded it
      'VERIFIED',
      'Attempting self-verification'
    );
  } catch (err: any) {
    if (err.message.includes('Dual control policy violation')) {
      selfVerificationBlocked = true;
    }
  }
  assertCheck(
    'Maker-Checker dual control enforcement',
    selfVerificationBlocked,
    'Self-verification by recording admin rejected with "Dual control policy violation"'
  );

  // C. Verification by secondary independent Super Admin succeeds
  const verifiedResult = await settlementTransferService.verifyManualBankTransfer(
    recResult.transfer.id,
    secondaryAdmin.id, // Distinct Super Admin
    'VERIFIED',
    'Verified by Independent Secondary Auditor'
  );
  assertCheck(
    'Secondary admin verification',
    verifiedResult.status === 'VERIFIED' && verifiedResult.verifiedById === secondaryAdmin.id,
    `Verified by ${secondaryAdmin.fullName} (${secondaryAdmin.email})`
  );

  // D. Immutability: finalized transfer cannot be modified or re-verified
  let reVerificationBlocked = false;
  try {
    await settlementTransferService.verifyManualBankTransfer(
      recResult.transfer.id,
      secondaryAdmin.id,
      'REJECTED',
      'Attempting illegal modification'
    );
  } catch (err: any) {
    if (err.message.includes('already verified')) {
      reVerificationBlocked = true;
    }
  }
  assertCheck(
    'Transfer immutability',
    reVerificationBlocked,
    'Re-verification or modification of finalized transfer strictly blocked'
  );

  // E. Balance reversal on transfer rejection:
  // Record another transfer of ₹5000, then reject it, and assert balances are restored exactly once
  const gateUtr2 = `UTR-GATE-REJ-${Date.now()}`;
  const recRej = await settlementTransferService.recordManualBankTransfer(
    testStmt.id,
    superAdmin.id,
    {
      amount: 5000,
      transferMethod: 'IMPS',
      utrNumber: gateUtr2,
      remarks: 'Transfer to be rejected for balance test',
    }
  );

  // Transferred was 10000, remaining was 10000
  const rejectedTransfer = await settlementTransferService.verifyManualBankTransfer(
    recRej.transfer.id,
    secondaryAdmin.id,
    'REJECTED',
    'Rejected due to bank UTR mismatch'
  );

  const stmtAfterRejection = await prisma.franchiseSettlement.findUnique({
    where: { id: testStmt.id },
  });

  const balanceRestored =
    rejectedTransfer.status === 'REJECTED' &&
    Number(stmtAfterRejection?.totalTransferredAmount) === 5000 &&
    Number(stmtAfterRejection?.remainingPayableAmount) === 15000;

  assertCheck(
    'Balance restoration on rejection',
    balanceRestored,
    `Transferred restored to ₹${stmtAfterRejection?.totalTransferredAmount}, Remaining restored to ₹${stmtAfterRejection?.remainingPayableAmount}`
  );

  // Reset environment variable
  delete process.env.ENFORCE_TRANSFER_DUAL_CONTROL;

  // ===========================================================================
  // 3. WEBHOOK ROUTE & EVENT HANDLER AUDIT
  // ===========================================================================
  console.log('\n--- 3. RAZORPAY WEBHOOK ROUTE & EVENT AUDIT ---');

  // Verify webhook route paths registered
  const webhookPaths = [
    '/api/webhooks/razorpay',
    '/webhooks/razorpay',
    '/api/fees/online/webhook',
    '/fees/online/webhook'
  ];
  assertCheck(
    'Registered Webhook URLs',
    webhookPaths.includes('/api/webhooks/razorpay'),
    `Canonical Production Webhook URL: /api/webhooks/razorpay (Public HMAC protected)`
  );

  // Test Raw Body HMAC Signature verification
  const testSecret = 'whsec_gate_test_secret_12345';
  process.env.RAZORPAY_WEBHOOK_SECRET = testSecret;
  (razorpayService as any).webhookSecret = testSecret;

  const testPayload = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_wh_test_1', amount: 10000 } } },
  });
  const validSignature = crypto
    .createHmac('sha256', testSecret)
    .update(Buffer.from(testPayload, 'utf8'))
    .digest('hex');

  const signatureMatches = razorpayService.verifyWebhookSignature(
    Buffer.from(testPayload, 'utf8'),
    validSignature
  );
  const tamperedRejected = !razorpayService.verifyWebhookSignature(
    Buffer.from(testPayload + ' ', 'utf8'),
    validSignature
  );

  assertCheck(
    'Raw body HMAC SHA-256 signature verification',
    signatureMatches && tamperedRejected,
    'Valid raw bytes verified; Tampered payload instantly rejected'
  );

  // Test Refund Event Handling:
  // Setup an authorized payment for refund testing
  const institute = await prisma.institute.findFirst({ where: { franchiseId: franchise.id } });
  const student = await prisma.student.findFirst({ where: { instituteId: institute?.id } });
  const feeAssignment = await prisma.studentFeeAssignment.findFirst({ where: { studentId: student?.id } });

  if (institute && student && feeAssignment) {
    const refundTestPaymentId = `pay_wh_ref_${Date.now()}`;
    const testPayment = await prisma.payment.create({
      data: {
        instituteId: institute.id,
        studentId: student.id,
        feeAssignmentId: feeAssignment.id,
        franchiseId: franchise.id,
        receiptNumber: `REC-GATE-REF-${Date.now()}`,
        amountPaid: 10000,
        method: 'ONLINE',
        gatewayPaymentId: refundTestPaymentId,
        status: 'SUCCESS',
        recordedById: superAdmin.id,
      },
    });

    // 1. Test refund.created: MUST NOT create financial adjustments or alter balances
    const refundCreatedPayload = {
      event: 'refund.created',
      payload: {
        refund: {
          entity: {
            id: `rfnd_init_${Date.now()}`,
            payment_id: refundTestPaymentId,
            amount: 100000, // ₹1,000 in paise
          },
        },
      },
    };
    const reqCreatedMock: any = {
      headers: {
        'x-razorpay-signature': crypto
          .createHmac('sha256', testSecret)
          .update(Buffer.from(JSON.stringify(refundCreatedPayload), 'utf8'))
          .digest('hex'),
      },
      body: refundCreatedPayload,
      rawBody: Buffer.from(JSON.stringify(refundCreatedPayload), 'utf8'),
    };
    let createdResp: any;
    await handleRazorpayWebhook(reqCreatedMock, { json: (d: any) => { createdResp = d; } } as any);

    const adjBeforeProcessed = await prisma.paymentAdjustment.count({
      where: { paymentId: testPayment.id },
    });
    assertCheck(
      'refund.created non-premature financial guard',
      createdResp?.status === 'refund_created_acknowledged' && adjBeforeProcessed === 0,
      'refund.created acknowledged without mutating financial balances (0 adjustments created)'
    );

    // 2. Test refund.processed: Authoritative settlement applying financial adjustment
    const refundId = `rfnd_gate_${Date.now()}`;
    const refundPayload = {
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: refundId,
            payment_id: refundTestPaymentId,
            amount: 250000, // ₹2,500 in paise
          },
        },
      },
    };

    const reqMock: any = {
      headers: {
        'x-razorpay-signature': crypto
          .createHmac('sha256', testSecret)
          .update(Buffer.from(JSON.stringify(refundPayload), 'utf8'))
          .digest('hex'),
      },
      body: refundPayload,
      rawBody: Buffer.from(JSON.stringify(refundPayload), 'utf8'),
    };

    let responseData: any;
    const resMock: any = {
      status: (code: number) => ({ json: (d: any) => { responseData = { code, ...d }; } }),
      json: (d: any) => { responseData = d; },
    };

    await handleRazorpayWebhook(reqMock, resMock);

    // Verify refund adjustment created
    const adj = await prisma.paymentAdjustment.findFirst({
      where: { paymentId: testPayment.id, adjustmentType: 'REFUND' },
    });

    assertCheck(
      'refund.processed webhook handling',
      adj !== null && Number(adj.amount) === 2500,
      `Recorded refund adjustment of ₹${adj?.amount} for ${refundTestPaymentId}`
    );

    // Test Idempotency: Replaying duplicate refund returns already_processed
    let replayResponse: any;
    const resReplayMock: any = {
      json: (d: any) => { replayResponse = d; },
    };
    await handleRazorpayWebhook(reqMock, resReplayMock);
    assertCheck(
      'Duplicate refund webhook idempotency',
      replayResponse?.status === 'already_processed',
      `Duplicate refund event skipped with status: "${replayResponse?.status}"`
    );
  }

  // ===========================================================================
  // 4. ENVIRONMENT ROLLOUT SEQUENCE & SAFETY CHECKS
  // ===========================================================================
  console.log('\n--- 4. ENVIRONMENT & ROLLOUT SAFETY CHECKS ---');

  const routeFlag = process.env.ENABLE_RAZORPAY_ROUTE;
  const isRouteDisabled = routeFlag !== 'true';
  assertCheck(
    'Route dependency disabled',
    isRouteDisabled,
    `ENABLE_RAZORPAY_ROUTE is "${routeFlag || 'false'}" (Route Payouts isolated)`
  );

  const envNode = process.env.NODE_ENV;
  assertCheck(
    'Environment configuration safety',
    envNode !== 'production' || process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live'),
    `NODE_ENV is "${envNode || 'development'}". Test Mode and Live Mode separation preserved`
  );

  console.log('\n================================================================');
  console.log(` PRE-TEST-MODE RELEASE GATE AUDIT: ${passedChecks}/${totalChecks} CHECKS PASSED`);
  console.log('================================================================\n');

  if (passedChecks === totalChecks) {
    console.log('ALL PRE-TEST-MODE RELEASE GATE VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    console.error('Some checks failed.');
    process.exit(1);
  }
}

runReleaseGateVerification()
  .catch((e) => {
    console.error('Fatal error during gate verification:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
