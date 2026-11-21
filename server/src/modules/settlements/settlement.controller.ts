import { Response } from 'express';
import { prisma } from '../../prisma.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { settlementEngineService } from './settlement-engine.service.js';
import { settlementTransferService } from './settlement-transfer.service.js';
import { SettlementStatus } from '@prisma/client';
import { z } from 'zod';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const generateSettlementSchema = z.object({
  settlementMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM (e.g., 2026-11)'),
  franchiseId: z.string().uuid().optional(),
  autoSubmit: z.boolean().default(false),
});

export const approveSettlementSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['ON_HOLD', 'REJECTED', 'PENDING_APPROVAL']),
  reason: z.string().min(3, 'A clear reason is required'),
});

export const initiateTransfersSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Explicit confirmation (confirm: true) is required before initiating transfers' }),
  }),
});

export const directPayoutSchema = z.object({
  transactionReference: z.string().min(4, 'Bank transaction reference / UTR is required'),
  bankReceiptUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().max(500).optional(),
});

export const addAdjustmentSchema = z.object({
  adjustmentType: z.string().min(2),
  amount: z.number().positive('Adjustment amount must be positive'),
  reason: z.string().min(5, 'Detailed adjustment reason required'),
});

// ============================================================================
// CONTROLLER HANDLERS
// ============================================================================

/**
 * List settlements with filtering and security isolation (Section F)
 */
export async function listSettlements(req: AuthenticatedRequest, res: Response) {
  try {
    const userRole = req.user!.role;
    const userId = req.user!.userId;
    const { settlementMonth, franchiseId, status } = req.query;

    const where: any = {};

    if (settlementMonth) {
      where.settlementMonth = settlementMonth as string;
    }

    if (status && Object.values(SettlementStatus).includes(status as any)) {
      where.status = status as SettlementStatus;
    }

    // Role-based Tenant Isolation (Rule K)
    if (userRole === 'FRANCHISE_OWNER') {
      const ownedFranchises = await prisma.franchise.findMany({
        where: { ownerUserId: userId },
        select: { id: true },
      });
      const ownedIds = ownedFranchises.map((f) => f.id);
      if (ownedIds.length === 0) {
        return res.json({
          success: true,
          data: { settlements: [], summary: { total: 0, payable: 0, pending: 0, completed: 0 } },
        });
      }
      where.franchiseId = { in: ownedIds };
    } else if (userRole === 'SUPER_ADMIN') {
      if (franchiseId) {
        where.franchiseId = franchiseId as string;
      }
    } else {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions to view settlements' });
    }

    const settlements = await prisma.franchiseSettlement.findMany({
      where,
      include: {
        franchise: {
          select: {
            id: true,
            code: true,
            name: true,
            ownerName: true,
            email: true,
            revenueSharePercentage: true,
            razorpayAccountId: true,
            beneficiaryStatus: true,
          },
        },
        approvedBy: {
          select: { id: true, fullName: true, email: true },
        },
        _count: {
          select: { payments: true, transfers: true, adjustments: true },
        },
      },
      orderBy: [
        { settlementMonth: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Compute financial summary metrics
    let totalEligibleCollections = 0;
    let totalFranchisePayable = 0;
    let totalDgShare = 0;
    let pendingApprovalCount = 0;
    let approvedAmount = 0;
    let completedAmount = 0;

    for (const s of settlements) {
      const payable = Number(s.franchisePayableAmount);
      totalEligibleCollections += Number(s.totalEligibleCollections);
      totalFranchisePayable += payable;
      totalDgShare += Number(s.digitalGuruShareAmount);

      if (s.status === 'PENDING_APPROVAL') {
        pendingApprovalCount++;
      }
      if (s.status === 'APPROVED') {
        approvedAmount += payable;
      }
      if (s.status === 'COMPLETED') {
        completedAmount += payable;
      }
    }

    return res.json({
      success: true,
      data: {
        settlements,
        summary: {
          count: settlements.length,
          totalEligibleCollections: Number(totalEligibleCollections.toFixed(2)),
          totalFranchisePayable: Number(totalFranchisePayable.toFixed(2)),
          totalDgShare: Number(totalDgShare.toFixed(2)),
          pendingApprovalCount,
          approvedAmount: Number(approvedAmount.toFixed(2)),
          completedAmount: Number(completedAmount.toFixed(2)),
        },
      },
    });
  } catch (err: any) {
    console.error('[List Settlements Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve settlements' });
  }
}

/**
 * Get single settlement detail with full transaction breakdown (Section F)
 */
export async function getSettlementById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userRole = req.user!.role;
    const userId = req.user!.userId;

    const settlement = await prisma.franchiseSettlement.findUnique({
      where: { id },
      include: {
        franchise: {
          include: {
            branches: { select: { id: true, name: true, code: true, city: true } },
          },
        },
        approvedBy: {
          select: { id: true, fullName: true, email: true },
        },
        adjustments: {
          include: {
            authorizedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        transfers: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
            institute: { select: { id: true, name: true, code: true } },
            adjustments: { where: { adjustmentType: 'REFUND' } },
          },
          orderBy: { paidAt: 'desc' },
        },
      },
    });

    if (!settlement) {
      return res.status(404).json({ success: false, error: 'Settlement statement not found' });
    }

    // Role tenant check
    if (userRole === 'FRANCHISE_OWNER' && settlement.franchise.ownerUserId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access to other franchise records is denied' });
    }

    return res.json({
      success: true,
      data: settlement,
    });
  } catch (err: any) {
    console.error('[Get Settlement Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch settlement statement details' });
  }
}

/**
 * Generate monthly settlement statements (Super Admin Only)
 */
export async function generateMonthlySettlements(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = generateSettlementSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const { settlementMonth, franchiseId, autoSubmit } = parse.data;

    if (franchiseId) {
      const result = await settlementEngineService.generateMonthlyStatement(franchiseId, settlementMonth, {
        persist: true,
        autoSubmit,
      });
      return res.json({
        success: true,
        message: result.message,
        data: result.settlement,
      });
    }

    // Batch generate for all active franchises
    const batchResults = await settlementEngineService.generateAllMonthlySettlements(settlementMonth);
    return res.json({
      success: true,
      message: `Generated monthly settlements for ${batchResults.length} franchises`,
      data: batchResults,
    });
  } catch (err: any) {
    console.error('[Generate Settlement Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Settlement generation failed' });
  }
}

/**
 * Approve settlement (Super Admin Only - Section F)
 */
export async function approveSettlement(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const parse = approveSettlementSchema.safeParse(req.body);
    const notes = parse.success ? parse.data.notes : undefined;

    const approved = await settlementEngineService.approveSettlement(id, req.user!.userId, notes);

    return res.json({
      success: true,
      message: `Settlement ${approved.statementNumber} approved successfully`,
      data: approved,
    });
  } catch (err: any) {
    console.error('[Approve Settlement Error]', err);
    return res.status(400).json({ success: false, error: err.message || 'Settlement approval failed' });
  }
}

/**
 * Update settlement status (Put On Hold / Reject / Pending Approval)
 */
export async function updateSettlementStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const parse = updateStatusSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const { status, reason } = parse.data;
    const updated = await settlementEngineService.updateSettlementStatus(id, status, req.user!.userId, reason);

    return res.json({
      success: true,
      message: `Settlement status updated to ${status}`,
      data: updated,
    });
  } catch (err: any) {
    console.error('[Update Settlement Status Error]', err);
    return res.status(400).json({ success: false, error: err.message || 'Status update failed' });
  }
}

/**
 * Approve & Initiate Razorpay Route Transfers (Super Admin Only - Section G)
 */
export async function initiateTransfers(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const parse = initiateTransfersSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Explicit confirmation (confirm: true) required' });
    }

    // Auto-approve if currently PENDING_APPROVAL or DRAFT
    const existing = await prisma.franchiseSettlement.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Settlement not found' });
    }

    if (existing.status === 'PENDING_APPROVAL' || existing.status === 'DRAFT') {
      await settlementEngineService.approveSettlement(id, req.user!.userId, 'Approved upon transfer initiation');
    }

    const transferResult = await settlementTransferService.initiateStatementTransfers(id, req.user!.userId);

    return res.json({
      success: true,
      message: `Transfer processing initiated: ${transferResult.processedCount} processed, ${transferResult.failedCount} failed, ${transferResult.skippedCount} skipped`,
      data: transferResult,
    });
  } catch (err: any) {
    console.error('[Initiate Transfers Error]', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to initiate transfers' });
  }
}

/**
 * Direct Bank Transfer Payout Fallback (Section G Documentation)
 */
export async function executeDirectPayout(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const parse = directPayoutSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const completed = await settlementTransferService.executeDirectBankTransfer(id, req.user!.userId, parse.data);

    return res.json({
      success: true,
      message: `Direct bank payout recorded successfully for ${completed.statementNumber}`,
      data: completed,
    });
  } catch (err: any) {
    console.error('[Direct Payout Error]', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to record direct payout' });
  }
}

/**
 * Add Auditable Adjustment to an Approved Settlement
 */
export async function addAdjustment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const parse = addAdjustmentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const adjustment = await settlementEngineService.addSettlementAdjustment(id, {
      ...parse.data,
      authorizedById: req.user!.userId,
    });

    return res.json({
      success: true,
      message: 'Adjustment recorded successfully',
      data: adjustment,
    });
  } catch (err: any) {
    console.error('[Add Adjustment Error]', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to record adjustment' });
  }
}
