import { Prisma, SettlementStatus } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { razorpayService } from '../payments/razorpay.service.js';

export interface RecordManualTransferInput {
  amount: number;
  transferDate?: Date | string;
  transferMethod: 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'OTHER';
  utrNumber: string;
  recipientBankName?: string;
  recipientAccountLast4?: string;
  recipientIfsc?: string;
  paymentProofUrl?: string;
  remarks?: string;
  status?: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
}

export class SettlementTransferService {
  /**
   * Initiate Razorpay Route Transfers for an Approved Settlement (Section G)
   * Isolated behind ENABLE_RAZORPAY_ROUTE feature flag.
   */
  public async initiateStatementTransfers(settlementId: string, superAdminId: string) {
    if (process.env.ENABLE_RAZORPAY_ROUTE !== 'true') {
      throw new Error(
        'Razorpay Route is disabled. Settlements are processed via manual monthly bank transfers (NEFT / RTGS / IMPS).'
      );
    }
    const settlement = await prisma.franchiseSettlement.findUnique({
      where: { id: settlementId },
      include: {
        franchise: true,
        payments: {
          where: { status: 'SUCCESS' },
          include: { transfers: true },
        },
      },
    });

    if (!settlement) {
      throw new Error(`Settlement not found with ID ${settlementId}`);
    }

    // Must be in APPROVED or PARTIALLY_FAILED state (allows safe retry)
    if (
      settlement.status !== SettlementStatus.APPROVED &&
      settlement.status !== SettlementStatus.PARTIALLY_FAILED &&
      settlement.status !== SettlementStatus.FAILED
    ) {
      throw new Error(
        `Cannot initiate transfers for settlement with status "${settlement.status}". Settlement must be APPROVED.`
      );
    }

    const franchise = settlement.franchise;
    const destinationAccountId = franchise.razorpayAccountId;

    if (!destinationAccountId || !destinationAccountId.trim()) {
      throw new Error(
        `Franchise "${franchise.name}" does not have a configured Razorpay Linked Account ID (acc_xxxx). Please configure and verify beneficiary details.`
      );
    }

    // Update status to PROCESSING
    await prisma.franchiseSettlement.update({
      where: { id: settlementId },
      data: {
        status: SettlementStatus.PROCESSING,
        transferInitiatedAt: new Date(),
      },
    });

    const eligiblePayments = settlement.payments;
    const transferResults: any[] = [];
    let processedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const payment of eligiblePayments) {
      // 1. Idempotency Check: Skip payments that already have a successful processed transfer
      const existingProcessedTransfer = payment.transfers.find(
        (t) => t.status === 'PROCESSED' && t.settlementId === settlementId
      );

      if (existingProcessedTransfer) {
        skippedCount++;
        transferResults.push({
          paymentId: payment.id,
          status: 'SKIPPED_ALREADY_PROCESSED',
          transferId: existingProcessedTransfer.razorpayTransferId,
        });
        continue;
      }

      // 2. Determine transfer amount in paise
      const franchiseShare = payment.franchiseShareAmount !== null
        ? Number(payment.franchiseShareAmount)
        : Number(payment.amountPaid) * (Number(settlement.applicableFranchisePercentage) / 100);

      const amountInPaise = Math.round(franchiseShare * 100);

      if (amountInPaise <= 0) {
        skippedCount++;
        continue;
      }

      const gatewayPaymentId = payment.gatewayPaymentId || payment.transactionReference;

      if (!gatewayPaymentId) {
        failedCount++;
        transferResults.push({
          paymentId: payment.id,
          status: 'FAILED',
          error: 'Payment lacks a valid gatewayPaymentId',
        });
        continue;
      }

      // 3. Execute Route transfer against the captured payment
      try {
        const transferRes = await razorpayService.createPaymentTransfer(gatewayPaymentId, {
          destinationAccountId,
          amountInPaise,
          currency: 'INR',
          notes: {
            settlementId: settlement.id,
            statementNumber: settlement.statementNumber,
            paymentId: payment.id,
            franchiseCode: franchise.code,
          },
        });

        // 4. Record SettlementTransfer idempotently
        const recordedTransfer = await prisma.settlementTransfer.upsert({
          where: { razorpayTransferId: transferRes.transferId },
          update: {
            status: transferRes.status,
            amount: new Prisma.Decimal(franchiseShare),
          },
          create: {
            settlementId: settlement.id,
            paymentId: payment.id,
            razorpayTransferId: transferRes.transferId,
            amount: new Prisma.Decimal(franchiseShare),
            currency: transferRes.currency,
            destinationAccountId: transferRes.destinationAccountId,
            status: transferRes.status,
            metadata: transferRes.rawResponse || {},
          },
        });

        // 5. Update payment transfer status
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            transferId: transferRes.transferId,
            transferStatus: transferRes.status,
          },
        });

        if (transferRes.status === 'PROCESSED') {
          processedCount++;
        } else {
          failedCount++;
        }

        transferResults.push({
          paymentId: payment.id,
          transferId: transferRes.transferId,
          status: transferRes.status,
          amount: franchiseShare,
        });
      } catch (transferErr: any) {
        failedCount++;
        console.error(`[Transfer Error for Payment ${payment.id}]`, transferErr);

        await prisma.settlementTransfer.create({
          data: {
            settlementId: settlement.id,
            paymentId: payment.id,
            amount: new Prisma.Decimal(franchiseShare),
            currency: 'INR',
            destinationAccountId,
            status: 'FAILED',
            failureDescription: transferErr.message || 'Transfer failed',
          },
        });

        transferResults.push({
          paymentId: payment.id,
          status: 'FAILED',
          error: transferErr.message,
        });
      }
    }

    // 6. Reconciliation of settlement state
    const allTransfers = await prisma.settlementTransfer.findMany({
      where: { settlementId },
    });

    const isAllProcessed = allTransfers.length > 0 && allTransfers.every((t) => t.status === 'PROCESSED');
    const hasAnyFailed = allTransfers.some((t) => t.status === 'FAILED');

    let finalSettlementStatus: SettlementStatus;
    if (isAllProcessed) {
      finalSettlementStatus = SettlementStatus.COMPLETED;
    } else if (hasAnyFailed && processedCount > 0) {
      finalSettlementStatus = SettlementStatus.PARTIALLY_FAILED;
    } else if (hasAnyFailed && processedCount === 0) {
      finalSettlementStatus = SettlementStatus.FAILED;
    } else {
      finalSettlementStatus = SettlementStatus.PROCESSING;
    }

    const updatedSettlement = await prisma.franchiseSettlement.update({
      where: { id: settlementId },
      data: {
        status: finalSettlementStatus,
        transferCompletedAt: finalSettlementStatus === SettlementStatus.COMPLETED ? new Date() : undefined,
        failureReason: hasAnyFailed ? `${failedCount} transfers failed during route payout.` : null,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: superAdminId,
        action: 'SETTLEMENT_TRANSFERS_INITIATED',
        entityType: 'FranchiseSettlement',
        entityId: settlementId,
        newValues: {
          status: finalSettlementStatus,
          processedCount,
          failedCount,
          skippedCount,
          totalEligible: eligiblePayments.length,
        },
      },
    });

    return {
      settlement: updatedSettlement,
      processedCount,
      failedCount,
      skippedCount,
      results: transferResults,
    };
  }

  /**
   * Record Manual Bank Transfer for an Approved or Partially Paid Settlement
   * Supports partial transfers (NEFT / RTGS / IMPS / UPI / OTHER)
   * Enforces global duplicate UTR prevention, concurrency row locking, and updates running balances.
   *
   * FINANCIAL INTEGRITY RULE:
   * Student fee payments (Payment records) and franchise payout transfers (ManualBankTransfer)
   * are completely independent financial processes. Recording a manual franchise bank transfer
   * must NEVER alter student Payment status, fee assignments, or captured payment records.
   */
  public async recordManualBankTransfer(
    settlementId: string,
    superAdminId: string,
    input: RecordManualTransferInput
  ) {
    if (input.amount <= 0) {
      throw new Error('Transfer amount must be greater than zero.');
    }

    const cleanUtr = input.utrNumber.trim();
    if (!cleanUtr) {
      throw new Error('A valid bank transaction reference / UTR is required.');
    }

    // Execute within an interactive transaction with exclusive row-level locking
    const result = await prisma.$transaction(async (tx) => {
      // 1. Concurrency Protection: Acquire exclusive row lock on the settlement
      await tx.$queryRaw`SELECT id FROM "FranchiseSettlement" WHERE id = ${settlementId} FOR UPDATE`;

      const settlement = await tx.franchiseSettlement.findUnique({
        where: { id: settlementId },
        include: {
          franchise: true,
          bankTransfers: true,
        },
      });

      if (!settlement) {
        throw new Error(`Settlement not found with ID ${settlementId}`);
      }

      // 2. Enforce global uniqueness on UTR numbers
      const existingUtr = await tx.manualBankTransfer.findUnique({
        where: { utrNumber: cleanUtr },
      });
      if (existingUtr) {
        throw new Error(
          `Duplicate UTR: Bank transfer with reference / UTR "${cleanUtr}" is already recorded in the system.`
        );
      }

      // 3. Only APPROVED or PARTIALLY_PAID settlements are eligible for recording bank transfers
      const eligibleStatuses: SettlementStatus[] = [
        SettlementStatus.APPROVED,
        SettlementStatus.PARTIALLY_PAID,
      ];

      if (!eligibleStatuses.includes(settlement.status)) {
        if (settlement.status === SettlementStatus.PAID || settlement.status === SettlementStatus.COMPLETED) {
          throw new Error('Settlement is already fully paid. No further transfers are required.');
        }
        throw new Error(
          `Cannot record bank transfer for settlement with status "${settlement.status}". Settlement must be APPROVED first.`
        );
      }

      // 3. Re-calculate and enforce remaining balance INSIDE the row lock
      const payableAmount = Number(settlement.franchisePayableAmount);
      const existingTransferred = Number(settlement.totalTransferredAmount || 0);
      const remainingBalance = Number(
        (settlement.remainingPayableAmount !== null && Number(settlement.remainingPayableAmount) > 0)
          ? settlement.remainingPayableAmount
          : Math.max(0, payableAmount - existingTransferred)
      );

      if (input.amount > remainingBalance + 0.01) {
        throw new Error(
          `Transfer amount (₹${input.amount}) exceeds the remaining payable balance of ₹${remainingBalance.toFixed(2)}.`
        );
      }

      const franchise = settlement.franchise;
      const recipientBank = input.recipientBankName || franchise.beneficiaryBankName || null;
      const recipientAccLast4 = input.recipientAccountLast4 || (franchise.beneficiaryAccountNumber ? franchise.beneficiaryAccountNumber.slice(-4) : null);
      const recipientIfsc = input.recipientIfsc || franchise.beneficiaryIfsc || null;

      // Initial status: PENDING_VERIFICATION (or explicit status if provided)
      const initialStatus = input.status || 'PENDING_VERIFICATION';

      // 4. Create the immutable ManualBankTransfer record
      const transfer = await tx.manualBankTransfer.create({
        data: {
          settlementId,
          franchiseId: settlement.franchiseId,
          amount: new Prisma.Decimal(input.amount),
          transferDate: input.transferDate ? new Date(input.transferDate) : new Date(),
          transferMethod: input.transferMethod,
          utrNumber: cleanUtr,
          recipientBankName: recipientBank,
          recipientAccountLast4: recipientAccLast4,
          recipientIfsc: recipientIfsc,
          paymentProofUrl: input.paymentProofUrl || null,
          remarks: input.remarks || null,
          status: initialStatus,
          recordedById: superAdminId,
          recordedAt: new Date(),
          verifiedById: initialStatus === 'VERIFIED' ? superAdminId : undefined,
          verifiedAt: initialStatus === 'VERIFIED' ? new Date() : undefined,
        },
        include: {
          recordedBy: { select: { id: true, fullName: true, email: true } },
          verifiedBy: { select: { id: true, fullName: true, email: true } },
        },
      });

      // 5. Compute updated balances
      const newTotalTransferred = Number((existingTransferred + input.amount).toFixed(2));
      const newRemainingPayable = Math.max(0, Number((payableAmount - newTotalTransferred).toFixed(2)));

      // 6. Determine new settlement status: PARTIALLY_PAID vs PAID
      let newStatus: SettlementStatus;
      if (newRemainingPayable <= 0) {
        newStatus = SettlementStatus.PAID;
      } else {
        newStatus = SettlementStatus.PARTIALLY_PAID;
      }

      // 7. Update FranchiseSettlement balances and status
      const updatedSettlement = await tx.franchiseSettlement.update({
        where: { id: settlementId },
        data: {
          status: newStatus,
          totalTransferredAmount: new Prisma.Decimal(newTotalTransferred),
          remainingPayableAmount: new Prisma.Decimal(newRemainingPayable),
          transferCompletedAt: newStatus === SettlementStatus.PAID ? new Date() : undefined,
          approvalNotes: input.remarks ? `${settlement.approvalNotes || ''}\nTransfer: ${input.remarks}`.trim() : undefined,
        },
      });

      // NOTE: We deliberately DO NOT mutate student payment records!
      // Student fee collections are immutable and independent from franchise bank payouts.

      // 8. Record Audit Log
      await tx.auditLog.create({
        data: {
          userId: superAdminId,
          action: 'MANUAL_BANK_TRANSFER_RECORDED',
          entityType: 'ManualBankTransfer',
          entityId: transfer.id,
          newValues: {
            statementNumber: settlement.statementNumber,
            franchiseId: settlement.franchiseId,
            transferAmount: input.amount,
            transferMethod: input.transferMethod,
            utrNumber: cleanUtr,
            transferStatus: initialStatus,
            newSettlementStatus: newStatus,
            totalTransferred: newTotalTransferred,
            remainingPayable: newRemainingPayable,
          },
        },
      });

      return {
        transfer,
        settlement: updatedSettlement,
        isFullyPaid: newStatus === SettlementStatus.PAID,
        remainingBalance: newRemainingPayable,
      };
    });

    return result;
  }

  /**
   * Get all manual bank transfer records for a settlement
   */
  public async getSettlementTransfers(settlementId: string) {
    const transfers = await prisma.manualBankTransfer.findMany({
      where: { settlementId },
      include: {
        recordedBy: { select: { id: true, fullName: true, email: true } },
        verifiedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { transferDate: 'desc' },
    });
    return transfers;
  }

  /**
   * Verify a recorded bank transfer (Independent secondary verification)
   * Enforces immutability once verified/rejected, and reverses balances if rejected.
   */
  public async verifyManualBankTransfer(
    transferId: string,
    superAdminId: string,
    verificationStatus: 'VERIFIED' | 'REJECTED',
    notes?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const transfer = await tx.manualBankTransfer.findUnique({
        where: { id: transferId },
        include: { settlement: true },
      });

      if (!transfer) {
        throw new Error(`Transfer not found with ID ${transferId}`);
      }

      // Disallow re-verification if already in a finalized state
      if (transfer.status === 'VERIFIED') {
        throw new Error('Transfer is already verified and cannot be modified.');
      }
      if (transfer.status === 'REJECTED') {
        throw new Error('Transfer is already rejected and cannot be modified.');
      }

      // Dual Control Policy (Maker-Checker): If enforced, verifier cannot be the recorder
      if (process.env.ENFORCE_TRANSFER_DUAL_CONTROL === 'true' && transfer.recordedById === superAdminId) {
        throw new Error(
          'Dual control policy violation: The administrator who recorded this bank transfer cannot verify it. Secondary approval by a different Super Admin is required.'
        );
      }

      // Update transfer status and verification metadata
      const updatedTransfer = await tx.manualBankTransfer.update({
        where: { id: transferId },
        data: {
          status: verificationStatus,
          verifiedById: superAdminId,
          verifiedAt: new Date(),
          remarks: notes ? `${transfer.remarks || ''}\nVerification note: ${notes}`.trim() : transfer.remarks,
        },
      });

      // If REJECTED, adjust settlement balances and status
      if (verificationStatus === 'REJECTED') {
        const settlement = transfer.settlement;
        const currentTransferred = Number(settlement.totalTransferredAmount || 0);
        const restoredTotalTransferred = Math.max(0, currentTransferred - Number(transfer.amount));
        const payableAmount = Number(settlement.franchisePayableAmount);
        const restoredRemaining = Math.max(0, payableAmount - restoredTotalTransferred);

        // Revert status: if no transfers remain, revert to APPROVED; otherwise PARTIALLY_PAID
        const revertedStatus = restoredTotalTransferred === 0
          ? SettlementStatus.APPROVED
          : SettlementStatus.PARTIALLY_PAID;

        await tx.franchiseSettlement.update({
          where: { id: settlement.id },
          data: {
            totalTransferredAmount: new Prisma.Decimal(restoredTotalTransferred),
            remainingPayableAmount: new Prisma.Decimal(restoredRemaining),
            status: revertedStatus,
            approvalNotes: `${settlement.approvalNotes || ''}\nTransfer ${transfer.utrNumber} rejected: ${notes || 'Rejected by finance verification'}`.trim(),
          },
        });
      }

      // Record verification audit log
      await tx.auditLog.create({
        data: {
          userId: superAdminId,
          action: `MANUAL_BANK_TRANSFER_${verificationStatus}`,
          entityType: 'ManualBankTransfer',
          entityId: transferId,
          newValues: {
            utrNumber: transfer.utrNumber,
            status: verificationStatus,
            notes,
          },
        },
      });

      return updatedTransfer;
    });
  }

  /**
   * Direct Bank Transfer / Pooled Payout Alternative (Backward compatible bridge)
   */
  public async executeDirectBankTransfer(
    settlementId: string,
    superAdminId: string,
    details: {
      transactionReference: string;
      bankReceiptUrl?: string;
      notes?: string;
      amount?: number;
    }
  ) {
    const settlement = await prisma.franchiseSettlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new Error(`Settlement not found with ID ${settlementId}`);
    }

    const transferAmount = details.amount || Number(settlement.remainingPayableAmount || settlement.franchisePayableAmount);

    const result = await this.recordManualBankTransfer(settlementId, superAdminId, {
      amount: transferAmount,
      transferMethod: 'NEFT',
      utrNumber: details.transactionReference,
      paymentProofUrl: details.bankReceiptUrl,
      remarks: details.notes || 'Recorded via direct payout interface',
    });

    return result.settlement;
  }

  /**
   * Reconcile transfer webhook event from Razorpay (Section G.7)
   */
  public async reconcileTransferWebhook(event: string, transferPayload: any) {
    const transferId = transferPayload?.id;
    if (!transferId) return;

    const existingTransfer = await prisma.settlementTransfer.findUnique({
      where: { razorpayTransferId: transferId },
      include: { settlement: true },
    });

    if (!existingTransfer) return;

    if (event === 'transfer.processed') {
      await prisma.settlementTransfer.update({
        where: { id: existingTransfer.id },
        data: { status: 'PROCESSED' },
      });

      await prisma.payment.update({
        where: { id: existingTransfer.paymentId },
        data: { transferStatus: 'PROCESSED' },
      });

      // Check if all transfers for this settlement are now PROCESSED
      const remainingPending = await prisma.settlementTransfer.count({
        where: {
          settlementId: existingTransfer.settlementId,
          status: { not: 'PROCESSED' },
        },
      });

      if (remainingPending === 0) {
        await prisma.franchiseSettlement.update({
          where: { id: existingTransfer.settlementId },
          data: {
            status: SettlementStatus.COMPLETED,
            transferCompletedAt: new Date(),
          },
        });
      }
    } else if (event === 'transfer.failed') {
      await prisma.settlementTransfer.update({
        where: { id: existingTransfer.id },
        data: {
          status: 'FAILED',
          failureCode: transferPayload.error_code,
          failureDescription: transferPayload.error_description,
        },
      });

      await prisma.payment.update({
        where: { id: existingTransfer.paymentId },
        data: { transferStatus: 'FAILED' },
      });

      await prisma.franchiseSettlement.update({
        where: { id: existingTransfer.settlementId },
        data: { status: SettlementStatus.PARTIALLY_FAILED },
      });
    } else if (event === 'transfer.reversed') {
      await prisma.settlementTransfer.update({
        where: { id: existingTransfer.id },
        data: {
          status: 'REVERSED',
          reversalId: transferPayload.reversal_id,
        },
      });
    }
  }
}

export const settlementTransferService = new SettlementTransferService();
