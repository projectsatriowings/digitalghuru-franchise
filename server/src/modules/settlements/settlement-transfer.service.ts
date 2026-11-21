import { Prisma, SettlementStatus } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { razorpayService } from '../payments/razorpay.service.js';

export class SettlementTransferService {
  /**
   * Initiate Razorpay Route Transfers for an Approved Settlement (Section G)
   */
  public async initiateStatementTransfers(settlementId: string, superAdminId: string) {
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
   * Direct Bank Transfer / Pooled Payout Alternative (Documented alternative per Section G)
   */
  public async executeDirectBankTransfer(
    settlementId: string,
    superAdminId: string,
    details: {
      transactionReference: string;
      bankReceiptUrl?: string;
      notes?: string;
    }
  ) {
    const settlement = await prisma.franchiseSettlement.findUnique({
      where: { id: settlementId },
      include: {
        payments: { where: { status: 'SUCCESS' } },
        franchise: true,
      },
    });

    if (!settlement) {
      throw new Error(`Settlement not found with ID ${settlementId}`);
    }

    if (
      settlement.status !== SettlementStatus.APPROVED &&
      settlement.status !== SettlementStatus.PARTIALLY_FAILED
    ) {
      throw new Error(`Cannot execute direct transfer for settlement with status "${settlement.status}"`);
    }

    const completed = await prisma.$transaction(async (tx) => {
      // 1. Mark all payments transferred
      const paymentIds = settlement.payments.map((p) => p.id);
      if (paymentIds.length > 0) {
        await tx.payment.updateMany({
          where: { id: { in: paymentIds } },
          data: {
            transferStatus: 'PROCESSED',
            transferId: details.transactionReference,
          },
        });
      }

      // 2. Mark settlement COMPLETED
      const updated = await tx.franchiseSettlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.COMPLETED,
          transferCompletedAt: new Date(),
          approvalNotes: details.notes || 'Settled via Direct Bank Payout',
          metadata: {
            payoutMethod: 'DIRECT_BANK_TRANSFER',
            transactionReference: details.transactionReference,
            bankReceiptUrl: details.bankReceiptUrl,
            settledByAdminId: superAdminId,
          },
        },
      });

      // 3. Audit Log
      await tx.auditLog.create({
        data: {
          userId: superAdminId,
          action: 'SETTLEMENT_DIRECT_BANK_PAYOUT_COMPLETED',
          entityType: 'FranchiseSettlement',
          entityId: settlementId,
          newValues: {
            statementNumber: updated.statementNumber,
            amount: Number(updated.franchisePayableAmount),
            transactionReference: details.transactionReference,
          },
        },
      });

      return updated;
    });

    return completed;
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
