"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRazorpayWebhook = handleRazorpayWebhook;
const prisma_js_1 = require("../../prisma.js");
const razorpay_service_js_1 = require("./razorpay.service.js");
const revenue_engine_service_js_1 = require("./revenue-engine.service.js");
const settlement_transfer_service_js_1 = require("../settlements/settlement-transfer.service.js");
const client_1 = require("@prisma/client");
async function handleRazorpayWebhook(req, res) {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const rawBody = req.rawBody || JSON.stringify(req.body);
        // 1. Strict Webhook Signature Verification (Security Rule K)
        const isValid = razorpay_service_js_1.razorpayService.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
            console.error('[Razorpay Webhook Rejected] Invalid signature');
            return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
        }
        const event = req.body?.event;
        const payload = req.body?.payload;
        console.log(`[Razorpay Webhook Verified] Event: ${event}`);
        // =========================================================================
        // EVENT: payment.captured
        // =========================================================================
        if (event === 'payment.captured') {
            const paymentEntity = payload?.payment?.entity;
            if (!paymentEntity) {
                return res.json({ status: 'ignored_missing_entity' });
            }
            const gatewayPaymentId = paymentEntity.id;
            const gatewayOrderId = paymentEntity.order_id;
            const amountPaise = paymentEntity.amount;
            const amountRupees = amountPaise / 100;
            const notes = paymentEntity.notes || {};
            const { studentId, feeAssignmentId, instituteId } = notes;
            // Check anti-replay: has this payment already been recorded?
            const existingPayment = await prisma_js_1.prisma.payment.findFirst({
                where: {
                    OR: [
                        { gatewayPaymentId },
                        { transactionReference: gatewayPaymentId },
                        { idempotencyKey: `online_${gatewayOrderId}_${gatewayPaymentId}` },
                    ],
                },
            });
            if (existingPayment) {
                console.log(`[Webhook] Payment ${gatewayPaymentId} already recorded, skipping.`);
                return res.json({ status: 'already_processed' });
            }
            // Find pending order
            let onlineOrder = gatewayOrderId
                ? await prisma_js_1.prisma.onlinePaymentOrder.findUnique({
                    where: { orderId: gatewayOrderId },
                    include: { feeAssignment: true },
                })
                : null;
            const resolvedStudentId = studentId || onlineOrder?.studentId;
            const resolvedAssignmentId = feeAssignmentId || onlineOrder?.feeAssignmentId;
            const resolvedInstituteId = instituteId || onlineOrder?.instituteId;
            if (!resolvedStudentId || !resolvedAssignmentId || !resolvedInstituteId) {
                console.warn('[Webhook] Incomplete metadata in captured payment', paymentEntity.id);
                return res.json({ status: 'metadata_incomplete' });
            }
            // Resolve Franchise and Snapshot applicable revenue percentage (Rules 8 & 9)
            const institute = await prisma_js_1.prisma.institute.findUnique({
                where: { id: resolvedInstituteId },
                include: { franchise: true },
            });
            const franchiseId = institute?.franchiseId || null;
            let franchisePercentage = 50.00;
            if (institute?.franchise?.revenueSharePercentage !== null && institute?.franchise?.revenueSharePercentage !== undefined) {
                franchisePercentage = Number(institute.franchise.revenueSharePercentage);
            }
            // Calculate shares with integer paise arithmetic
            const shares = revenue_engine_service_js_1.revenueEngineService.calculateShares(amountRupees, franchisePercentage);
            const receiptNumber = `REC-ONL-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
            // Atomic payment credit and assignment update
            await prisma_js_1.prisma.$transaction(async (tx) => {
                // 1. Create authoritative Payment record
                const payment = await tx.payment.create({
                    data: {
                        instituteId: resolvedInstituteId,
                        studentId: resolvedStudentId,
                        feeAssignmentId: resolvedAssignmentId,
                        franchiseId,
                        receiptNumber,
                        amountPaid: new client_1.Prisma.Decimal(amountRupees),
                        method: client_1.PaymentMethod.ONLINE,
                        transactionReference: gatewayPaymentId,
                        gatewayPaymentId,
                        gatewayOrderId,
                        idempotencyKey: `online_${gatewayOrderId}_${gatewayPaymentId}`,
                        status: 'SUCCESS',
                        recordedById: (await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' } }))?.id || 'system-gateway',
                        remarks: `Captured via Razorpay Webhook (${event})`,
                        franchisePercentage: new client_1.Prisma.Decimal(shares.franchisePercentage),
                        digitalGuruPercentage: new client_1.Prisma.Decimal(shares.digitalGuruPercentage),
                        franchiseShareAmount: new client_1.Prisma.Decimal(shares.franchiseShareAmount),
                        digitalGuruShareAmount: new client_1.Prisma.Decimal(shares.digitalGuruShareAmount),
                        feeDeduction: new client_1.Prisma.Decimal(shares.feeDeduction),
                        netEligibleAmount: new client_1.Prisma.Decimal(shares.netEligibleAmount),
                    },
                });
                // 2. Update OnlinePaymentOrder if exists
                if (onlineOrder) {
                    await tx.onlinePaymentOrder.update({
                        where: { id: onlineOrder.id },
                        data: {
                            status: 'VERIFIED',
                            gatewayPaymentId,
                            receiptNumber,
                            paymentId: payment.id,
                        },
                    });
                }
                // 3. Recalculate StudentFeeAssignment status
                const allPayments = await tx.payment.findMany({
                    where: { feeAssignmentId: resolvedAssignmentId, status: 'SUCCESS' },
                });
                const totalPaid = allPayments.reduce((acc, p) => acc.plus(p.amountPaid), new client_1.Prisma.Decimal(0));
                const assignment = await tx.studentFeeAssignment.findUnique({ where: { id: resolvedAssignmentId } });
                const finalAmount = assignment ? assignment.finalAmount : new client_1.Prisma.Decimal(0);
                const newStatus = totalPaid.greaterThanOrEqualTo(finalAmount)
                    ? client_1.PaymentStatus.PAID
                    : totalPaid.greaterThan(0)
                        ? client_1.PaymentStatus.PARTIALLY_PAID
                        : client_1.PaymentStatus.PENDING;
                await tx.studentFeeAssignment.update({
                    where: { id: resolvedAssignmentId },
                    data: { status: newStatus },
                });
                // 4. InApp Notification
                const student = await tx.student.findUnique({
                    where: { id: resolvedStudentId },
                    select: { userId: true },
                });
                if (student?.userId) {
                    await tx.inAppNotification.create({
                        data: {
                            instituteId: resolvedInstituteId,
                            userId: student.userId,
                            studentId: resolvedStudentId,
                            type: 'FEE_PAID',
                            title: 'Fee Payment Successful',
                            message: `Your payment of ₹${amountRupees} has been captured (Receipt: ${receiptNumber}).`,
                        },
                    });
                }
            });
            console.log(`[Webhook] Payment ${gatewayPaymentId} credited successfully (Receipt: ${receiptNumber})`);
            return res.json({ status: 'captured_processed' });
        }
        // =========================================================================
        // EVENT: payment.failed
        // =========================================================================
        if (event === 'payment.failed') {
            const paymentEntity = payload?.payment?.entity;
            const gatewayOrderId = paymentEntity?.order_id;
            if (gatewayOrderId) {
                await prisma_js_1.prisma.onlinePaymentOrder.updateMany({
                    where: { orderId: gatewayOrderId, status: 'PENDING' },
                    data: {
                        status: 'FAILED',
                        gatewayPaymentId: paymentEntity.id,
                        metadata: {
                            error_code: paymentEntity.error_code,
                            error_description: paymentEntity.error_description,
                        },
                    },
                });
            }
            return res.json({ status: 'failed_recorded' });
        }
        // =========================================================================
        // EVENT: refund.created (Informational acknowledgment only — no balance change)
        // FINANCIAL INTEGRITY RULE: refund.created indicates refund initiation only.
        // Financial adjustments MUST only be applied upon receiving refund.processed.
        // =========================================================================
        if (event === 'refund.created') {
            const refundEntity = payload?.refund?.entity;
            console.log(`[Webhook] Refund ${refundEntity?.id} created for payment ${refundEntity?.payment_id} (pending bank settlement). Financial balance untouched.`);
            return res.json({
                status: 'refund_created_acknowledged',
                message: 'Refund initiated; financial balance will adjust when refund.processed is received.',
            });
        }
        // =========================================================================
        // EVENT: refund.processed (Authoritative financial settlement of refund)
        // =========================================================================
        if (event === 'refund.processed') {
            const refundEntity = payload?.refund?.entity;
            if (!refundEntity) {
                return res.json({ status: 'ignored_missing_entity' });
            }
            const gatewayPaymentId = refundEntity.payment_id;
            const refundId = refundEntity.id;
            const refundAmountPaise = refundEntity.amount;
            const refundAmountRupees = refundAmountPaise / 100;
            const payment = await prisma_js_1.prisma.payment.findFirst({
                where: {
                    OR: [
                        { gatewayPaymentId },
                        { transactionReference: gatewayPaymentId },
                    ],
                },
                include: {
                    feeAssignment: true,
                    adjustments: true,
                },
            });
            if (!payment) {
                console.warn(`[Webhook] Refund received for unknown payment ${gatewayPaymentId}`);
                return res.json({ status: 'payment_not_found' });
            }
            // Check anti-replay / idempotency: has this refund already been recorded?
            const existingRefund = payment.adjustments.find((adj) => adj.adjustmentType === 'REFUND' && adj.reason?.includes(refundId));
            if (existingRefund) {
                console.log(`[Webhook] Refund ${refundId} already recorded, skipping.`);
                return res.json({ status: 'already_processed' });
            }
            await prisma_js_1.prisma.$transaction(async (tx) => {
                // 1. Create PaymentAdjustment record
                await tx.paymentAdjustment.create({
                    data: {
                        instituteId: payment.instituteId,
                        paymentId: payment.id,
                        feeAssignmentId: payment.feeAssignmentId,
                        adjustmentType: 'REFUND',
                        amount: new client_1.Prisma.Decimal(refundAmountRupees),
                        reason: `Razorpay Refund ${refundId}`,
                        authorizedById: (await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' } }))?.id || payment.recordedById,
                    },
                });
                // 2. Recalculate StudentFeeAssignment status
                if (payment.feeAssignmentId) {
                    const allPayments = await tx.payment.findMany({
                        where: { feeAssignmentId: payment.feeAssignmentId, status: 'SUCCESS' },
                        include: { adjustments: { where: { adjustmentType: 'REFUND' } } },
                    });
                    let netPaid = new client_1.Prisma.Decimal(0);
                    for (const p of allPayments) {
                        netPaid = netPaid.plus(p.amountPaid);
                        for (const adj of p.adjustments) {
                            netPaid = netPaid.minus(adj.amount);
                        }
                    }
                    const assignment = await tx.studentFeeAssignment.findUnique({
                        where: { id: payment.feeAssignmentId },
                    });
                    if (assignment) {
                        const finalAmount = assignment.finalAmount;
                        const newStatus = netPaid.greaterThanOrEqualTo(finalAmount)
                            ? client_1.PaymentStatus.PAID
                            : netPaid.greaterThan(0)
                                ? client_1.PaymentStatus.PARTIALLY_PAID
                                : client_1.PaymentStatus.PENDING;
                        await tx.studentFeeAssignment.update({
                            where: { id: payment.feeAssignmentId },
                            data: { status: newStatus },
                        });
                    }
                }
            });
            console.log(`[Webhook] Refund ${refundId} settled and recorded successfully for payment ${gatewayPaymentId}`);
            return res.json({ status: 'refund_processed' });
        }
        // =========================================================================
        // EVENT: refund.failed
        // =========================================================================
        if (event === 'refund.failed') {
            const refundEntity = payload?.refund?.entity;
            console.warn(`[Webhook] Refund ${refundEntity?.id} failed at bank gateway.`);
            return res.json({ status: 'refund_failed_acknowledged' });
        }
        // =========================================================================
        // EVENTS: transfer.processed, transfer.failed, transfer.reversed (Route Payouts - Isolated)
        // =========================================================================
        if (['transfer.processed', 'transfer.failed', 'transfer.reversed'].includes(event)) {
            if (process.env.ENABLE_RAZORPAY_ROUTE === 'true') {
                const transferEntity = payload?.transfer?.entity;
                if (transferEntity) {
                    await settlement_transfer_service_js_1.settlementTransferService.reconcileTransferWebhook(event, transferEntity);
                }
            }
            return res.json({ status: 'transfer_webhook_acknowledged' });
        }
        return res.json({ status: 'event_acknowledged' });
    }
    catch (err) {
        console.error('[Razorpay Webhook Error]', err);
        return res.status(500).json({ success: false, error: 'Internal webhook error' });
    }
}
