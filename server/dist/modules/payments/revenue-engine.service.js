"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revenueEngineService = exports.RevenueEngineService = void 0;
const prisma_js_1 = require("../../prisma.js");
class RevenueEngineService {
    defaultPolicy = {
        gatewayFeePercentage: 0,
        gatewayFeeGstPercentage: 0,
        tdsPercentage: 0,
        deductGatewayFeeFromCollections: false,
    };
    /**
     * Calculate revenue sharing with integer paise precision (Rules D, 4, 5, 6)
     */
    calculateShares(grossAmountRupees, franchisePercentage, customPolicy) {
        const policy = { ...this.defaultPolicy, ...customPolicy };
        // Validate & normalize percentage bounds (0% to 100%)
        const clampedFranchisePct = Math.min(100, Math.max(0, Number(franchisePercentage.toFixed(2))));
        const clampedDgPct = Number((100 - clampedFranchisePct).toFixed(2));
        // Convert gross amount to integer paise
        const grossPaise = Math.round(grossAmountRupees * 100);
        // Apply configurable financial policy deductions
        let feeDeductionPaise = 0;
        if (policy.deductGatewayFeeFromCollections && policy.gatewayFeePercentage && policy.gatewayFeePercentage > 0) {
            const gatewayFeePaise = Math.round((grossPaise * policy.gatewayFeePercentage) / 100);
            const gstPaise = policy.gatewayFeeGstPercentage
                ? Math.round((gatewayFeePaise * policy.gatewayFeeGstPercentage) / 100)
                : 0;
            feeDeductionPaise = gatewayFeePaise + gstPaise;
        }
        const netEligiblePaise = Math.max(0, grossPaise - feeDeductionPaise);
        // Calculate franchise share using integer paise arithmetic
        // Rule: franchiseShare = (netEligible * franchisePercentage) / 100
        const franchiseSharePaise = Math.round((netEligiblePaise * clampedFranchisePct) / 100);
        // DigitalGhuru share is automatically the remaining paise (guarantees 0 rounding leaks)
        const dgSharePaise = netEligiblePaise - franchiseSharePaise;
        return {
            grossAmount: Number((grossPaise / 100).toFixed(2)),
            grossAmountPaise: grossPaise,
            feeDeduction: Number((feeDeductionPaise / 100).toFixed(2)),
            feeDeductionPaise,
            netEligibleAmount: Number((netEligiblePaise / 100).toFixed(2)),
            netEligibleAmountPaise: netEligiblePaise,
            franchisePercentage: clampedFranchisePct,
            digitalGuruPercentage: clampedDgPct,
            franchiseShareAmount: Number((franchiseSharePaise / 100).toFixed(2)),
            franchiseSharePaise,
            digitalGuruShareAmount: Number((dgSharePaise / 100).toFixed(2)),
            digitalGuruSharePaise: dgSharePaise,
        };
    }
    /**
     * Resolve applicable franchise revenue percentage for a given franchise ID (Rule 7, 8)
     */
    async resolveFranchisePercentage(franchiseId) {
        const franchise = await prisma_js_1.prisma.franchise.findUnique({
            where: { id: franchiseId },
            select: {
                id: true,
                code: true,
                name: true,
                revenueSharePercentage: true,
                digitalGuruRevenuePercentage: true,
                razorpayAccountId: true,
                beneficiaryStatus: true,
            },
        });
        if (!franchise) {
            throw new Error(`Franchise not found with ID ${franchiseId}`);
        }
        const franchisePercentage = franchise.revenueSharePercentage !== null && franchise.revenueSharePercentage !== undefined
            ? Number(franchise.revenueSharePercentage)
            : 50.00;
        const digitalGuruPercentage = Number((100 - franchisePercentage).toFixed(2));
        return {
            franchisePercentage,
            digitalGuruPercentage,
            franchise,
        };
    }
    /**
     * Resolve franchise for a given branch / institute
     */
    async getFranchiseForBranch(instituteId) {
        const institute = await prisma_js_1.prisma.institute.findUnique({
            where: { id: instituteId },
            select: {
                id: true,
                name: true,
                franchiseId: true,
                franchise: true,
            },
        });
        return institute?.franchise || null;
    }
    /**
     * Aggregate branch collections for a franchise over a calendar date range
     */
    async aggregateFranchiseCollections(franchiseId, startDate, endDate, dbClient = prisma_js_1.prisma) {
        // 1. Get all branches belonging to this franchise
        const branches = await dbClient.institute.findMany({
            where: { franchiseId },
            select: { id: true, name: true, code: true },
        });
        const branchIds = branches.map((b) => b.id);
        // 2. Query all successful captured payments in the period
        // Matching either explicit franchiseId OR branch instituteId
        const payments = await dbClient.payment.findMany({
            where: {
                OR: [
                    { franchiseId },
                    { instituteId: { in: branchIds } },
                ],
                status: 'SUCCESS',
                paidAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
                institute: { select: { id: true, name: true, code: true } },
                adjustments: { where: { adjustmentType: 'REFUND' } },
            },
            orderBy: { paidAt: 'asc' },
        });
        let totalGrossPaise = 0;
        let totalRefundsPaise = 0;
        let totalFranchiseSharePaise = 0;
        let totalDgSharePaise = 0;
        let totalFeeDeductionPaise = 0;
        for (const payment of payments) {
            const amountPaidPaise = Math.round(Number(payment.amountPaid) * 100);
            totalGrossPaise += amountPaidPaise;
            // Calculate refunds against this payment
            let paymentRefundPaise = 0;
            if (payment.adjustments && payment.adjustments.length > 0) {
                for (const adj of payment.adjustments) {
                    paymentRefundPaise += Math.round(Number(adj.amount) * 100);
                }
            }
            totalRefundsPaise += paymentRefundPaise;
            // Use snapshotted shares if present, otherwise recalculate
            if (payment.franchiseShareAmount !== null && payment.franchiseShareAmount !== undefined) {
                totalFranchiseSharePaise += Math.round(Number(payment.franchiseShareAmount) * 100);
                totalDgSharePaise += Math.round(Number(payment.digitalGuruShareAmount) * 100);
                totalFeeDeductionPaise += Math.round(Number(payment.feeDeduction || 0) * 100);
            }
            else {
                // Fallback calculation
                const pct = payment.franchisePercentage !== null ? Number(payment.franchisePercentage) : 50;
                const shares = this.calculateShares(Number(payment.amountPaid), pct);
                totalFranchiseSharePaise += shares.franchiseSharePaise;
                totalDgSharePaise += shares.digitalGuruSharePaise;
            }
        }
        const netEligiblePaise = Math.max(0, totalGrossPaise - totalRefundsPaise - totalFeeDeductionPaise);
        return {
            franchiseId,
            branchCount: branches.length,
            branches,
            paymentCount: payments.length,
            totalCapturedAmount: Number((totalGrossPaise / 100).toFixed(2)),
            totalCapturedPaise: totalGrossPaise,
            totalRefundDeductions: Number((totalRefundsPaise / 100).toFixed(2)),
            totalRefundDeductionsPaise: totalRefundsPaise,
            totalFeeDeductions: Number((totalFeeDeductionPaise / 100).toFixed(2)),
            netEligibleCollections: Number((netEligiblePaise / 100).toFixed(2)),
            netEligiblePaise,
            totalFranchiseShareAmount: Number((totalFranchiseSharePaise / 100).toFixed(2)),
            totalFranchiseSharePaise,
            totalDigitalGuruShareAmount: Number((totalDgSharePaise / 100).toFixed(2)),
            totalDigitalGuruSharePaise: totalDgSharePaise,
            payments,
        };
    }
}
exports.RevenueEngineService = RevenueEngineService;
exports.revenueEngineService = new RevenueEngineService();
