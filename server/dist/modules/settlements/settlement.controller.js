"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAdjustmentSchema = exports.directPayoutSchema = exports.initiateTransfersSchema = exports.verifyTransferSchema = exports.recordManualTransferSchema = exports.updateStatusSchema = exports.approveSettlementSchema = exports.generateSettlementSchema = void 0;
exports.listSettlements = listSettlements;
exports.getSettlementById = getSettlementById;
exports.generateMonthlySettlements = generateMonthlySettlements;
exports.approveSettlement = approveSettlement;
exports.updateSettlementStatus = updateSettlementStatus;
exports.initiateTransfers = initiateTransfers;
exports.recordManualTransfer = recordManualTransfer;
exports.getSettlementTransfers = getSettlementTransfers;
exports.verifyManualTransfer = verifyManualTransfer;
exports.executeDirectPayout = executeDirectPayout;
exports.addAdjustment = addAdjustment;
const prisma_js_1 = require("../../prisma.js");
const settlement_engine_service_js_1 = require("./settlement-engine.service.js");
const settlement_transfer_service_js_1 = require("./settlement-transfer.service.js");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
exports.generateSettlementSchema = zod_1.z.object({
    settlementMonth: zod_1.z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM (e.g., 2026-11)'),
    franchiseId: zod_1.z.string().uuid().optional(),
    autoSubmit: zod_1.z.boolean().default(false),
});
exports.approveSettlementSchema = zod_1.z.object({
    notes: zod_1.z.string().max(500).optional(),
});
exports.updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['ON_HOLD', 'CANCELLED', 'REJECTED', 'PENDING_APPROVAL', 'PENDING_REVIEW']),
    reason: zod_1.z.string().min(3, 'A clear reason is required'),
});
exports.recordManualTransferSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Transfer amount must be positive'),
    transferDate: zod_1.z.string().or(zod_1.z.date()).optional(),
    transferMethod: zod_1.z.enum(['NEFT', 'RTGS', 'IMPS', 'UPI', 'OTHER']).default('NEFT'),
    utrNumber: zod_1.z.string().min(3, 'Bank transaction reference / UTR is required').max(100),
    recipientBankName: zod_1.z.string().optional(),
    recipientAccountLast4: zod_1.z.string().max(4).optional(),
    recipientIfsc: zod_1.z.string().max(11).optional(),
    paymentProofUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    remarks: zod_1.z.string().max(500).optional(),
    status: zod_1.z.enum(['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED']).default('VERIFIED'),
});
exports.verifyTransferSchema = zod_1.z.object({
    status: zod_1.z.enum(['VERIFIED', 'REJECTED']),
    notes: zod_1.z.string().max(500).optional(),
});
exports.initiateTransfersSchema = zod_1.z.object({
    confirm: zod_1.z.literal(true, {
        errorMap: () => ({ message: 'Explicit confirmation (confirm: true) is required before initiating transfers' }),
    }),
});
exports.directPayoutSchema = zod_1.z.object({
    transactionReference: zod_1.z.string().min(4, 'Bank transaction reference / UTR is required'),
    bankReceiptUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    notes: zod_1.z.string().max(500).optional(),
});
exports.addAdjustmentSchema = zod_1.z.object({
    adjustmentType: zod_1.z.string().min(2),
    amount: zod_1.z.number().positive('Adjustment amount must be positive'),
    reason: zod_1.z.string().min(5, 'Detailed adjustment reason required'),
});
// ============================================================================
// CONTROLLER HANDLERS
// ============================================================================
/**
 * List settlements with filtering and security isolation (Section F)
 */
async function listSettlements(req, res) {
    try {
        const userRole = req.user.role;
        const userId = req.user.userId;
        const { settlementMonth, franchiseId, status } = req.query;
        const where = {};
        if (settlementMonth) {
            where.settlementMonth = settlementMonth;
        }
        if (status && Object.values(client_1.SettlementStatus).includes(status)) {
            where.status = status;
        }
        // Role-based Tenant Isolation (Rule K)
        if (userRole === 'FRANCHISE_OWNER') {
            const ownedFranchises = await prisma_js_1.prisma.franchise.findMany({
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
        }
        else if (userRole === 'SUPER_ADMIN') {
            if (franchiseId) {
                where.franchiseId = franchiseId;
            }
        }
        else {
            return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions to view settlements' });
        }
        const settlements = await prisma_js_1.prisma.franchiseSettlement.findMany({
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
                        beneficiaryBankName: true,
                        beneficiaryAccountNumber: true,
                        beneficiaryIfsc: true,
                        beneficiaryName: true,
                    },
                },
                approvedBy: {
                    select: { id: true, fullName: true, email: true },
                },
                bankTransfers: {
                    include: {
                        recordedBy: { select: { id: true, fullName: true, email: true } },
                        verifiedBy: { select: { id: true, fullName: true, email: true } },
                    },
                    orderBy: { transferDate: 'desc' },
                },
                _count: {
                    select: { payments: true, transfers: true, adjustments: true, bankTransfers: true },
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
        let totalTransferredAmount = 0;
        let totalRemainingBalance = 0;
        let pendingApprovalCount = 0;
        let approvedAmount = 0;
        let partiallyPaidCount = 0;
        let completedAmount = 0;
        for (const s of settlements) {
            const payable = Number(s.franchisePayableAmount);
            const transferred = Number(s.totalTransferredAmount || 0);
            const remaining = Number(s.remainingPayableAmount !== null && Number(s.remainingPayableAmount) >= 0 ? s.remainingPayableAmount : Math.max(0, payable - transferred));
            totalEligibleCollections += Number(s.totalEligibleCollections);
            totalFranchisePayable += payable;
            totalDgShare += Number(s.digitalGuruShareAmount);
            totalTransferredAmount += transferred;
            totalRemainingBalance += remaining;
            if (s.status === 'PENDING_APPROVAL' || s.status === 'PENDING_REVIEW') {
                pendingApprovalCount++;
            }
            if (s.status === 'APPROVED') {
                approvedAmount += remaining;
            }
            if (s.status === 'PARTIALLY_PAID') {
                partiallyPaidCount++;
                approvedAmount += remaining;
            }
            if (s.status === 'COMPLETED' || s.status === 'PAID') {
                completedAmount += transferred > 0 ? transferred : payable;
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
                    totalTransferredAmount: Number(totalTransferredAmount.toFixed(2)),
                    totalRemainingBalance: Number(totalRemainingBalance.toFixed(2)),
                    pendingApprovalCount,
                    approvedAmount: Number(approvedAmount.toFixed(2)),
                    partiallyPaidCount,
                    completedAmount: Number(completedAmount.toFixed(2)),
                },
            },
        });
    }
    catch (err) {
        console.error('[List Settlements Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve settlements' });
    }
}
/**
 * Get single settlement detail with full transaction breakdown (Section F)
 */
async function getSettlementById(req, res) {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        const userId = req.user.userId;
        const settlement = await prisma_js_1.prisma.franchiseSettlement.findUnique({
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
                bankTransfers: {
                    include: {
                        recordedBy: { select: { id: true, fullName: true, email: true } },
                        verifiedBy: { select: { id: true, fullName: true, email: true } },
                    },
                    orderBy: { transferDate: 'desc' },
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
    }
    catch (err) {
        console.error('[Get Settlement Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch settlement statement details' });
    }
}
/**
 * Generate monthly settlement statements (Super Admin Only)
 */
async function generateMonthlySettlements(req, res) {
    try {
        const parse = exports.generateSettlementSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const { settlementMonth, franchiseId, autoSubmit } = parse.data;
        if (franchiseId) {
            const result = await settlement_engine_service_js_1.settlementEngineService.generateMonthlyStatement(franchiseId, settlementMonth, {
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
        const batchResults = await settlement_engine_service_js_1.settlementEngineService.generateAllMonthlySettlements(settlementMonth);
        return res.json({
            success: true,
            message: `Generated monthly settlements for ${batchResults.length} franchises`,
            data: batchResults,
        });
    }
    catch (err) {
        console.error('[Generate Settlement Error]', err);
        return res.status(500).json({ success: false, error: err.message || 'Settlement generation failed' });
    }
}
/**
 * Approve settlement (Super Admin Only - Section F)
 */
async function approveSettlement(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.approveSettlementSchema.safeParse(req.body);
        const notes = parse.success ? parse.data.notes : undefined;
        const approved = await settlement_engine_service_js_1.settlementEngineService.approveSettlement(id, req.user.userId, notes);
        return res.json({
            success: true,
            message: `Settlement ${approved.statementNumber} approved successfully`,
            data: approved,
        });
    }
    catch (err) {
        console.error('[Approve Settlement Error]', err);
        return res.status(400).json({ success: false, error: err.message || 'Settlement approval failed' });
    }
}
/**
 * Update settlement status (Put On Hold / Reject / Pending Approval)
 */
async function updateSettlementStatus(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.updateStatusSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const { status, reason } = parse.data;
        const updated = await settlement_engine_service_js_1.settlementEngineService.updateSettlementStatus(id, status, req.user.userId, reason);
        return res.json({
            success: true,
            message: `Settlement status updated to ${status}`,
            data: updated,
        });
    }
    catch (err) {
        console.error('[Update Settlement Status Error]', err);
        return res.status(400).json({ success: false, error: err.message || 'Status update failed' });
    }
}
/**
 * Approve & Initiate Razorpay Route Transfers (Super Admin Only - Section G)
 */
async function initiateTransfers(req, res) {
    try {
        if (process.env.ENABLE_RAZORPAY_ROUTE !== 'true') {
            return res.status(400).json({
                success: false,
                error: 'Razorpay Route is disabled. Settlements are processed via manual monthly bank transfers (NEFT / RTGS / IMPS).',
            });
        }
        const { id } = req.params;
        const parse = exports.initiateTransfersSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Explicit confirmation (confirm: true) required' });
        }
        // Auto-approve if currently PENDING_APPROVAL or DRAFT
        const existing = await prisma_js_1.prisma.franchiseSettlement.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Settlement not found' });
        }
        if (existing.status === 'PENDING_APPROVAL' || existing.status === 'DRAFT') {
            await settlement_engine_service_js_1.settlementEngineService.approveSettlement(id, req.user.userId, 'Approved upon transfer initiation');
        }
        const transferResult = await settlement_transfer_service_js_1.settlementTransferService.initiateStatementTransfers(id, req.user.userId);
        return res.json({
            success: true,
            message: `Transfer processing initiated: ${transferResult.processedCount} processed, ${transferResult.failedCount} failed, ${transferResult.skippedCount} skipped`,
            data: transferResult,
        });
    }
    catch (err) {
        console.error('[Initiate Transfers Error]', err);
        return res.status(400).json({ success: false, error: err.message || 'Failed to initiate transfers' });
    }
}
/**
 * Record Manual Bank Transfer (Super Admin Only)
 * Records NEFT / RTGS / IMPS / UPI transfer with UTR, supporting partial payments
 */
async function recordManualTransfer(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.recordManualTransferSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: parse.error.errors,
            });
        }
        const result = await settlement_transfer_service_js_1.settlementTransferService.recordManualBankTransfer(id, req.user.userId, parse.data);
        return res.json({
            success: true,
            message: result.isFullyPaid
                ? 'Manual bank transfer recorded successfully. Settlement is now fully PAID.'
                : `Manual bank transfer of ₹${parse.data.amount} recorded. Remaining balance: ₹${result.remainingBalance.toFixed(2)}.`,
            data: result,
        });
    }
    catch (err) {
        console.error('[Record Manual Transfer Error]', err);
        return res.status(400).json({ success: false, error: err.message || 'Failed to record manual bank transfer' });
    }
}
/**
 * Get Manual Bank Transfer History for a Settlement
 */
async function getSettlementTransfers(req, res) {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        const userId = req.user.userId;
        const settlement = await prisma_js_1.prisma.franchiseSettlement.findUnique({
            where: { id },
            include: { franchise: true },
        });
        if (!settlement) {
            return res.status(404).json({ success: false, error: 'Settlement not found' });
        }
        if (userRole === 'FRANCHISE_OWNER' && settlement.franchise.ownerUserId !== userId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Access to other franchise transfers is denied' });
        }
        const transfers = await settlement_transfer_service_js_1.settlementTransferService.getSettlementTransfers(id);
        return res.json({
            success: true,
            data: transfers,
        });
    }
    catch (err) {
        console.error('[Get Settlement Transfers Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve transfer history' });
    }
}
/**
 * Verify a Manual Bank Transfer (Super Admin Only)
 */
async function verifyManualTransfer(req, res) {
    try {
        const { transferId } = req.params;
        const parse = exports.verifyTransferSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const updated = await settlement_transfer_service_js_1.settlementTransferService.verifyManualBankTransfer(transferId, req.user.userId, parse.data.status, parse.data.notes);
        return res.json({
            success: true,
            message: `Bank transfer marked as ${parse.data.status}`,
            data: updated,
        });
    }
    catch (err) {
        console.error('[Verify Manual Transfer Error]', err);
        return res.status(400).json({ success: false, error: err.message || 'Failed to verify bank transfer' });
    }
}
/**
 * Direct Bank Transfer Payout Fallback (Section G Documentation)
 */
async function executeDirectPayout(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.directPayoutSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const completed = await settlement_transfer_service_js_1.settlementTransferService.executeDirectBankTransfer(id, req.user.userId, parse.data);
        return res.json({
            success: true,
            message: `Direct bank payout recorded successfully for ${completed.statementNumber}`,
            data: completed,
        });
    }
    catch (err) {
        console.error('[Direct Payout Error]', err);
        return res.status(400).json({ success: false, error: err.message || 'Failed to record direct payout' });
    }
}
/**
 * Add Auditable Adjustment to an Approved Settlement
 */
async function addAdjustment(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.addAdjustmentSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const adjustment = await settlement_engine_service_js_1.settlementEngineService.addSettlementAdjustment(id, {
            ...parse.data,
            authorizedById: req.user.userId,
        });
        return res.json({
            success: true,
            message: 'Adjustment recorded successfully',
            data: adjustment,
        });
    }
    catch (err) {
        console.error('[Add Adjustment Error]', err);
        return res.status(400).json({ success: false, error: err.message || 'Failed to record adjustment' });
    }
}
