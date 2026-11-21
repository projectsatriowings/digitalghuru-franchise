-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SettlementStatus') THEN
    CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED', 'ON_HOLD', 'REJECTED');
  END IF;
END $$;

-- AlterTable: Franchise
ALTER TABLE "Franchise" 
  ADD COLUMN IF NOT EXISTS "revenueSharePercentage" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS "digitalGuruRevenuePercentage" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS "razorpayAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "beneficiaryName" TEXT,
  ADD COLUMN IF NOT EXISTS "beneficiaryBankName" TEXT,
  ADD COLUMN IF NOT EXISTS "beneficiaryAccountNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "beneficiaryIfsc" TEXT,
  ADD COLUMN IF NOT EXISTS "beneficiaryStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable: Payment
ALTER TABLE "Payment" 
  ADD COLUMN IF NOT EXISTS "franchiseId" TEXT,
  ADD COLUMN IF NOT EXISTS "gatewayPaymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "gatewayOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "gatewaySignature" TEXT,
  ADD COLUMN IF NOT EXISTS "franchisePercentage" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "digitalGuruPercentage" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "franchiseShareAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "digitalGuruShareAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "feeDeduction" DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "netEligibleAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "settlementId" TEXT,
  ADD COLUMN IF NOT EXISTS "transferId" TEXT,
  ADD COLUMN IF NOT EXISTS "transferStatus" TEXT DEFAULT 'PENDING';

-- CreateTable: FranchiseSettlement
CREATE TABLE IF NOT EXISTS "FranchiseSettlement" (
    "id" TEXT NOT NULL,
    "statementNumber" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "settlementMonth" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCapturedPayments" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalEligibleCollections" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "refundDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "applicableFranchisePercentage" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "applicableDigitalGuruPercentage" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "franchisePayableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "digitalGuruShareAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "transferEligibility" BOOLEAN NOT NULL DEFAULT false,
    "beneficiarySnapshot" JSONB,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "transferInitiatedAt" TIMESTAMP(3),
    "transferCompletedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FranchiseSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SettlementAdjustment
CREATE TABLE IF NOT EXISTS "SettlementAdjustment" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "authorizedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SettlementTransfer
CREATE TABLE IF NOT EXISTS "SettlementTransfer" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "razorpayTransferId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "destinationAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "failureCode" TEXT,
    "failureDescription" TEXT,
    "reversalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FranchiseSettlement_statementNumber_key" ON "FranchiseSettlement"("statementNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "FranchiseSettlement_franchiseId_settlementMonth_key" ON "FranchiseSettlement"("franchiseId", "settlementMonth");
CREATE INDEX IF NOT EXISTS "FranchiseSettlement_franchiseId_idx" ON "FranchiseSettlement"("franchiseId");
CREATE INDEX IF NOT EXISTS "FranchiseSettlement_status_idx" ON "FranchiseSettlement"("status");
CREATE INDEX IF NOT EXISTS "FranchiseSettlement_settlementMonth_idx" ON "FranchiseSettlement"("settlementMonth");

CREATE INDEX IF NOT EXISTS "SettlementAdjustment_settlementId_idx" ON "SettlementAdjustment"("settlementId");
CREATE INDEX IF NOT EXISTS "SettlementAdjustment_authorizedById_idx" ON "SettlementAdjustment"("authorizedById");

CREATE UNIQUE INDEX IF NOT EXISTS "SettlementTransfer_razorpayTransferId_key" ON "SettlementTransfer"("razorpayTransferId");
CREATE INDEX IF NOT EXISTS "SettlementTransfer_settlementId_idx" ON "SettlementTransfer"("settlementId");
CREATE INDEX IF NOT EXISTS "SettlementTransfer_paymentId_idx" ON "SettlementTransfer"("paymentId");
CREATE INDEX IF NOT EXISTS "SettlementTransfer_status_idx" ON "SettlementTransfer"("status");

CREATE INDEX IF NOT EXISTS "Payment_franchiseId_paidAt_idx" ON "Payment"("franchiseId", "paidAt");
CREATE INDEX IF NOT EXISTS "Payment_settlementId_idx" ON "Payment"("settlementId");
CREATE INDEX IF NOT EXISTS "Payment_gatewayPaymentId_idx" ON "Payment"("gatewayPaymentId");

-- AddForeignKey constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_franchiseId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_settlementId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "FranchiseSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FranchiseSettlement_franchiseId_fkey') THEN
    ALTER TABLE "FranchiseSettlement" ADD CONSTRAINT "FranchiseSettlement_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FranchiseSettlement_approvedById_fkey') THEN
    ALTER TABLE "FranchiseSettlement" ADD CONSTRAINT "FranchiseSettlement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SettlementAdjustment_settlementId_fkey') THEN
    ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "FranchiseSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SettlementAdjustment_authorizedById_fkey') THEN
    ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SettlementTransfer_settlementId_fkey') THEN
    ALTER TABLE "SettlementTransfer" ADD CONSTRAINT "SettlementTransfer_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "FranchiseSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SettlementTransfer_paymentId_fkey') THEN
    ALTER TABLE "SettlementTransfer" ADD CONSTRAINT "SettlementTransfer_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
