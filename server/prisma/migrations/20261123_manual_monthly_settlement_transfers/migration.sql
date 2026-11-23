-- AlterEnum: Add new SettlementStatus values if they do not exist
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterTable: FranchiseSettlement
ALTER TABLE "FranchiseSettlement"
  ADD COLUMN IF NOT EXISTS "totalTransferredAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "remainingPayableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- CreateTable: ManualBankTransfer
CREATE TABLE IF NOT EXISTS "ManualBankTransfer" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transferMethod" TEXT NOT NULL,
    "utrNumber" TEXT NOT NULL,
    "recipientBankName" TEXT,
    "recipientAccountLast4" TEXT,
    "recipientIfsc" TEXT,
    "paymentProofUrl" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualBankTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "ManualBankTransfer_utrNumber_key" ON "ManualBankTransfer"("utrNumber");
CREATE INDEX IF NOT EXISTS "ManualBankTransfer_settlementId_idx" ON "ManualBankTransfer"("settlementId");
CREATE INDEX IF NOT EXISTS "ManualBankTransfer_franchiseId_idx" ON "ManualBankTransfer"("franchiseId");
CREATE INDEX IF NOT EXISTS "ManualBankTransfer_transferDate_idx" ON "ManualBankTransfer"("transferDate");
CREATE INDEX IF NOT EXISTS "ManualBankTransfer_status_idx" ON "ManualBankTransfer"("status");

-- AddForeignKey constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ManualBankTransfer_settlementId_fkey') THEN
    ALTER TABLE "ManualBankTransfer" ADD CONSTRAINT "ManualBankTransfer_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "FranchiseSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ManualBankTransfer_franchiseId_fkey') THEN
    ALTER TABLE "ManualBankTransfer" ADD CONSTRAINT "ManualBankTransfer_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ManualBankTransfer_recordedById_fkey') THEN
    ALTER TABLE "ManualBankTransfer" ADD CONSTRAINT "ManualBankTransfer_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ManualBankTransfer_verifiedById_fkey') THEN
    ALTER TABLE "ManualBankTransfer" ADD CONSTRAINT "ManualBankTransfer_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
