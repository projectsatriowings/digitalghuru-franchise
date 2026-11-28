"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementEngineService = exports.SettlementEngineService = void 0;
exports.getKolkataMonthRange = getKolkataMonthRange;
const client_1 = require("@prisma/client");
const prisma_js_1 = require("../../prisma.js");
const revenue_engine_service_js_1 = require("../payments/revenue-engine.service.js");
/**
 * Computes exact start and end dates for a calendar month in Asia/Kolkata (IST: UTC+5:30)
 * 1st day 00:00:00.000 IST to last day 23:59:59.999 IST
 */
function getKolkataMonthRange(settlementMonth) {
    const parts = settlementMonth.split('-');
    if (parts.length !== 2) {
        throw new Error(`Invalid settlement month format "${settlementMonth}". Expected "YYYY-MM"`);
    }
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10); // 1-12
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        throw new Error(`Invalid year or month in "${settlementMonth}"`);
    }
    // ISO string with explicit +05:30 timezone offset
    const monthStr = String(month).padStart(2, '0');
    const startIso = `${year}-${monthStr}-01T00:00:00.000+05:30`;
    const startDate = new Date(startIso);
    // Determine last day of month
    const lastDay = new Date(year, month, 0).getDate(); // e.g. 28, 29, 30, 31
    const endIso = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}T23:59:59.999+05:30`;
    const endDate = new Date(endIso);
    return { startDate, endDate, settlementMonth };
}
class SettlementEngineService {
    /**
     * Format unique statement number: STMT-YYYY-MM-FRANCHISECODE
     */
    generateStatementNumber(franchiseCode, settlementMonth) {
        const cleanCode = franchiseCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return `STMT-${settlementMonth}-${cleanCode}`;
    }
    /**
     * Generate or preview a monthly statement for a single franchise
     */
    async generateMonthlyStatement(franchiseId, settlementMonth, options = { persist: true }) {
        const { startDate, endDate } = getKolkataMonthRange(settlementMonth);
        // 1. Verify franchise existence and config
        const franchise = await prisma_js_1.prisma.franchise.findUnique({
            where: { id: franchiseId },
            include: {
                branches: { select: { id: true, code: true, name: true } },
            },
        });
        if (!franchise) {
            throw new Error(`Franchise not found with ID ${franchiseId}`);
        }
        // 2. Prevent duplicate statements (Rule E)
        const existing = await prisma_js_1.prisma.franchiseSettlement.findUnique({
            where: {
                franchiseId_settlementMonth: {
                    franchiseId,
                    settlementMonth,
                },
            },
            include: {
                adjustments: true,
                transfers: true,
            },
        });
        if (existing && options.persist) {
            // If already exists and finalized/approved, do not overwrite original statement
            if (['APPROVED', 'PROCESSING', 'COMPLETED'].includes(existing.status)) {
                return {
                    settlement: existing,
                    alreadyFinalized: true,
                    message: `Settlement for ${settlementMonth} is already ${existing.status} and locked from regeneration.`,
                };
            }
        }
        // 3. Aggregate collections across all branches belonging to this franchise
        const agg = await revenue_engine_service_js_1.revenueEngineService.aggregateFranchiseCollections(franchiseId, startDate, endDate, prisma_js_1.prisma);
        // 4. Resolve applicable franchise percentage
        let applicableFranchisePercentage = franchise.revenueSharePercentage !== null
            ? Number(franchise.revenueSharePercentage)
            : 50.00;
        // Fallback: If still at default 50%, check if active agreement specified a contracted share
        const activeAgreement = await prisma_js_1.prisma.franchiseAgreement.findFirst({
            where: { franchiseId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
        });
        if (activeAgreement && activeAgreement.partnerRevenuePercentage !== null && activeAgreement.partnerRevenuePercentage !== undefined) {
            const agrPartnerPct = Number(activeAgreement.partnerRevenuePercentage);
            if (agrPartnerPct !== 50 && applicableFranchisePercentage === 50) {
                applicableFranchisePercentage = agrPartnerPct;
            }
        }
        const applicableDigitalGuruPercentage = Number((100 - applicableFranchisePercentage).toFixed(2));
        // 5. Calculate payable amounts (in integer paise)
        const netEligibleRupees = agg.netEligibleCollections;
        const shares = revenue_engine_service_js_1.revenueEngineService.calculateShares(netEligibleRupees, applicableFranchisePercentage);
        // 6. Beneficiary eligibility check (Manual bank transfers require configured bank account details)
        const hasBankDetails = Boolean(franchise.beneficiaryAccountNumber &&
            franchise.beneficiaryIfsc &&
            franchise.beneficiaryName);
        const transferEligibility = hasBankDetails && shares.franchiseShareAmount > 0;
        const statementNumber = this.generateStatementNumber(franchise.code, settlementMonth);
        const initialStatus = options.autoSubmit ? client_1.SettlementStatus.PENDING_APPROVAL : client_1.SettlementStatus.DRAFT;
        const beneficiarySnapshot = {
            razorpayAccountId: franchise.razorpayAccountId,
            beneficiaryName: franchise.beneficiaryName,
            beneficiaryBankName: franchise.beneficiaryBankName,
            beneficiaryAccountNumber: franchise.beneficiaryAccountNumber ? `****${franchise.beneficiaryAccountNumber.slice(-4)}` : null,
            beneficiaryIfsc: franchise.beneficiaryIfsc,
            beneficiaryStatus: franchise.beneficiaryStatus,
        };
        if (!options.persist) {
            return {
                statementNumber,
                franchiseId,
                settlementMonth,
                startDate,
                endDate,
                status: initialStatus,
                totalCapturedPayments: agg.totalCapturedAmount,
                totalEligibleCollections: agg.netEligibleCollections,
                refundDeductions: agg.totalRefundDeductions,
                applicableFranchisePercentage,
                applicableDigitalGuruPercentage,
                franchisePayableAmount: shares.franchiseShareAmount,
                digitalGuruShareAmount: shares.digitalGuruShareAmount,
                totalTransferredAmount: existing ? Number(existing.totalTransferredAmount || 0) : 0,
                remainingPayableAmount: existing ? Math.max(0, shares.franchiseShareAmount - Number(existing.totalTransferredAmount || 0)) : shares.franchiseShareAmount,
                transactionCount: agg.paymentCount,
                transferEligibility,
                beneficiarySnapshot,
                payments: agg.payments,
            };
        }
        // Atomic persistence with payment linking
        const settlement = await prisma_js_1.prisma.$transaction(async (tx) => {
            let record = existing || (await tx.franchiseSettlement.findFirst({
                where: {
                    OR: [
                        { franchiseId, settlementMonth },
                        { statementNumber },
                    ],
                },
            }));
            if (record) {
                const totalTransferred = Number(record.totalTransferredAmount || 0);
                const remainingPayable = Math.max(0, shares.franchiseShareAmount - totalTransferred);
                record = await tx.franchiseSettlement.update({
                    where: { id: record.id },
                    data: {
                        statementNumber,
                        totalCapturedPayments: new client_1.Prisma.Decimal(agg.totalCapturedAmount),
                        totalEligibleCollections: new client_1.Prisma.Decimal(agg.netEligibleCollections),
                        refundDeductions: new client_1.Prisma.Decimal(agg.totalRefundDeductions),
                        applicableFranchisePercentage: new client_1.Prisma.Decimal(applicableFranchisePercentage),
                        applicableDigitalGuruPercentage: new client_1.Prisma.Decimal(applicableDigitalGuruPercentage),
                        franchisePayableAmount: new client_1.Prisma.Decimal(shares.franchiseShareAmount),
                        digitalGuruShareAmount: new client_1.Prisma.Decimal(shares.digitalGuruShareAmount),
                        remainingPayableAmount: new client_1.Prisma.Decimal(remainingPayable),
                        transactionCount: agg.paymentCount,
                        transferEligibility,
                        beneficiarySnapshot,
                        status: (record.status === client_1.SettlementStatus.DRAFT || record.status === client_1.SettlementStatus.PENDING_APPROVAL || record.status === client_1.SettlementStatus.PENDING_REVIEW)
                            ? initialStatus
                            : record.status,
                    },
                });
            }
            else {
                record = await tx.franchiseSettlement.create({
                    data: {
                        statementNumber,
                        franchiseId,
                        settlementMonth,
                        startDate,
                        endDate,
                        status: initialStatus,
                        totalCapturedPayments: new client_1.Prisma.Decimal(agg.totalCapturedAmount),
                        totalEligibleCollections: new client_1.Prisma.Decimal(agg.netEligibleCollections),
                        refundDeductions: new client_1.Prisma.Decimal(agg.totalRefundDeductions),
                        applicableFranchisePercentage: new client_1.Prisma.Decimal(applicableFranchisePercentage),
                        applicableDigitalGuruPercentage: new client_1.Prisma.Decimal(applicableDigitalGuruPercentage),
                        franchisePayableAmount: new client_1.Prisma.Decimal(shares.franchiseShareAmount),
                        digitalGuruShareAmount: new client_1.Prisma.Decimal(shares.digitalGuruShareAmount),
                        totalTransferredAmount: new client_1.Prisma.Decimal(0.00),
                        remainingPayableAmount: new client_1.Prisma.Decimal(shares.franchiseShareAmount),
                        transactionCount: agg.paymentCount,
                        transferEligibility,
                        beneficiarySnapshot,
                    },
                });
            }
            // Link included payments to this settlement record
            const paymentIds = agg.payments.map((p) => p.id);
            if (paymentIds.length > 0) {
                await tx.payment.updateMany({
                    where: { id: { in: paymentIds } },
                    data: {
                        settlementId: record.id,
                        franchiseId, // Guarantee franchise linkage
                    },
                });
            }
            return record;
        });
        return {
            settlement,
            alreadyFinalized: false,
            message: 'Settlement generated successfully',
        };
    }
    /**
     * Batch generate monthly settlements for ALL active franchises for a calendar month
     */
    async generateAllMonthlySettlements(settlementMonth, options = {}) {
        const franchises = await prisma_js_1.prisma.franchise.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, code: true },
        });
        const results = await Promise.all(franchises.map(async (franchise) => {
            try {
                const res = await this.generateMonthlyStatement(franchise.id, settlementMonth, {
                    persist: true,
                    autoSubmit: Boolean(options.autoSubmit),
                });
                return {
                    franchiseId: franchise.id,
                    code: franchise.code,
                    name: franchise.name,
                    success: true,
                    settlement: res.settlement,
                };
            }
            catch (err) {
                return {
                    franchiseId: franchise.id,
                    code: franchise.code,
                    name: franchise.name,
                    success: false,
                    error: err.message,
                };
            }
        }));
        return results;
    }
    /**
     * Super Admin approves settlement (Section F)
     */
    async approveSettlement(settlementId, superAdminId, notes) {
        const settlement = await prisma_js_1.prisma.franchiseSettlement.findUnique({
            where: { id: settlementId },
            include: { franchise: true },
        });
        if (!settlement) {
            throw new Error(`Settlement not found with ID ${settlementId}`);
        }
        if (settlement.status !== client_1.SettlementStatus.PENDING_APPROVAL &&
            settlement.status !== client_1.SettlementStatus.PENDING_REVIEW &&
            settlement.status !== client_1.SettlementStatus.DRAFT) {
            throw new Error(`Cannot approve settlement with current status "${settlement.status}"`);
        }
        const currentTransferred = Number(settlement.totalTransferredAmount || 0);
        const calculatedRemaining = Math.max(0, Number(settlement.franchisePayableAmount) - currentTransferred);
        const updated = await prisma_js_1.prisma.$transaction(async (tx) => {
            const approved = await tx.franchiseSettlement.update({
                where: { id: settlementId },
                data: {
                    status: client_1.SettlementStatus.APPROVED,
                    approvedById: superAdminId,
                    approvedAt: new Date(),
                    approvalNotes: notes || 'Approved by Super Admin',
                    remainingPayableAmount: new client_1.Prisma.Decimal(calculatedRemaining),
                },
            });
            // Audit Log
            await tx.auditLog.create({
                data: {
                    userId: superAdminId,
                    action: 'SETTLEMENT_APPROVED',
                    entityType: 'FranchiseSettlement',
                    entityId: settlementId,
                    newValues: {
                        statementNumber: approved.statementNumber,
                        franchiseId: approved.franchiseId,
                        settlementMonth: approved.settlementMonth,
                        franchisePayableAmount: Number(approved.franchisePayableAmount),
                        approvedAt: approved.approvedAt,
                    },
                },
            });
            return approved;
        });
        return updated;
    }
    /**
     * Super Admin puts settlement on hold or rejects it
     */
    async updateSettlementStatus(settlementId, newStatus, superAdminId, reason) {
        const settlement = await prisma_js_1.prisma.franchiseSettlement.findUnique({
            where: { id: settlementId },
        });
        if (!settlement) {
            throw new Error(`Settlement not found with ID ${settlementId}`);
        }
        if (settlement.status === client_1.SettlementStatus.COMPLETED || settlement.status === client_1.SettlementStatus.PAID) {
            throw new Error('Cannot change status of a completed or fully paid settlement.');
        }
        const updated = await prisma_js_1.prisma.$transaction(async (tx) => {
            const isRejectionOrCancellation = newStatus === 'REJECTED' || newStatus === 'CANCELLED';
            const record = await tx.franchiseSettlement.update({
                where: { id: settlementId },
                data: {
                    status: newStatus,
                    failureReason: isRejectionOrCancellation ? (reason || `Marked as ${newStatus} by Super Admin`) : undefined,
                    approvalNotes: reason,
                },
            });
            await tx.auditLog.create({
                data: {
                    userId: superAdminId,
                    action: `SETTLEMENT_STATUS_${newStatus}`,
                    entityType: 'FranchiseSettlement',
                    entityId: settlementId,
                    newValues: { status: newStatus, reason },
                },
            });
            return record;
        });
        return updated;
    }
    /**
     * Record post-approval auditable adjustment (Rule E)
     */
    async addSettlementAdjustment(settlementId, data) {
        const settlement = await prisma_js_1.prisma.franchiseSettlement.findUnique({
            where: { id: settlementId },
        });
        if (!settlement) {
            throw new Error(`Settlement not found with ID ${settlementId}`);
        }
        const adjustment = await prisma_js_1.prisma.settlementAdjustment.create({
            data: {
                settlementId,
                adjustmentType: data.adjustmentType,
                amount: new client_1.Prisma.Decimal(data.amount),
                reason: data.reason,
                authorizedById: data.authorizedById,
            },
        });
        return adjustment;
    }
}
exports.SettlementEngineService = SettlementEngineService;
exports.settlementEngineService = new SettlementEngineService();
