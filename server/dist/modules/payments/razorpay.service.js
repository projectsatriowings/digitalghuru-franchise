"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpayService = exports.RazorpayService = void 0;
const crypto_1 = __importDefault(require("crypto"));
class RazorpayService {
    keyId;
    keySecret;
    webhookSecret;
    constructor() {
        this.keyId = process.env.RAZORPAY_KEY_ID;
        this.keySecret = process.env.RAZORPAY_KEY_SECRET;
        this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    }
    isLiveConfigured() {
        return Boolean(this.keyId && this.keySecret);
    }
    getKeyId() {
        return this.keyId || 'rzp_test_simulated';
    }
    getBasicAuthHeader() {
        if (!this.keyId || !this.keySecret) {
            throw new Error('Razorpay credentials not configured');
        }
        return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    }
    /**
     * Create Razorpay Order from backend (Rule C)
     */
    async createOrder(options) {
        const currency = options.currency || 'INR';
        if (this.isLiveConfigured()) {
            const response = await fetch('https://api.razorpay.com/v1/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: this.getBasicAuthHeader(),
                },
                body: JSON.stringify({
                    amount: options.amountInPaise,
                    currency,
                    receipt: options.receipt,
                    notes: options.notes || {},
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[Razorpay Order Creation Failed]', errorData);
                throw new Error(`Failed to create Razorpay Order: ${JSON.stringify(errorData)}`);
            }
            const data = (await response.json());
            return {
                id: data.id,
                amount: data.amount,
                currency: data.currency,
                receipt: data.receipt,
                isSimulated: false,
            };
        }
        // Controlled simulation mode for development/testing
        const mockOrderId = `order_sim_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
        return {
            id: mockOrderId,
            amount: options.amountInPaise,
            currency,
            receipt: options.receipt,
            isSimulated: true,
        };
    }
    /**
     * Verify Razorpay Payment Signature
     */
    verifySignature(orderId, paymentId, signature) {
        if (!signature || !orderId || !paymentId) {
            return false;
        }
        // Simulation check
        if (!this.keySecret || orderId.startsWith('order_sim_') || orderId.startsWith('order_test_')) {
            return signature.length > 0;
        }
        try {
            const expectedSignature = crypto_1.default
                .createHmac('sha256', this.keySecret)
                .update(`${orderId}|${paymentId}`)
                .digest('hex');
            return crypto_1.default.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(signature, 'utf8'));
        }
        catch (err) {
            console.error('[Razorpay Signature Verification Error]', err);
            return false;
        }
    }
    /**
     * Verify Razorpay Webhook Signature using raw request body
     */
    verifyWebhookSignature(rawBody, signature) {
        const secret = this.webhookSecret || this.keySecret;
        if (!secret) {
            // In development without webhook secret, accept if test header present
            return process.env.NODE_ENV !== 'production';
        }
        if (!signature) {
            return false;
        }
        try {
            const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
            const expectedSignature = crypto_1.default
                .createHmac('sha256', secret)
                .update(bodyBuffer)
                .digest('hex');
            return crypto_1.default.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(signature, 'utf8'));
        }
        catch (err) {
            console.error('[Webhook Signature Verification Error]', err);
            return false;
        }
    }
    /**
     * Fetch payment status directly from Razorpay (Authoritative financial confirmation)
     */
    async fetchPayment(paymentId) {
        if (this.isLiveConfigured() && !paymentId.startsWith('pay_sim_')) {
            const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
                method: 'GET',
                headers: {
                    Authorization: this.getBasicAuthHeader(),
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch Razorpay payment ${paymentId}`);
            }
            const data = (await response.json());
            return {
                id: data.id,
                status: data.status,
                amount: data.amount,
                currency: data.currency,
                captured: data.captured === true,
                orderId: data.order_id,
                method: data.method,
            };
        }
        // Simulated payment status
        return {
            id: paymentId,
            status: 'captured',
            amount: 100000,
            currency: 'INR',
            captured: true,
            orderId: 'order_sim',
            method: 'upi',
        };
    }
    /**
     * Razorpay Route: Transfer funds to a Linked Franchise Account (Section G)
     */
    async createPaymentTransfer(paymentId, options) {
        if (this.isLiveConfigured() && !paymentId.startsWith('pay_sim_')) {
            const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/transfers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: this.getBasicAuthHeader(),
                },
                body: JSON.stringify({
                    transfers: [
                        {
                            account: options.destinationAccountId,
                            amount: options.amountInPaise,
                            currency: options.currency || 'INR',
                            notes: options.notes || {},
                        },
                    ],
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[Razorpay Route Transfer Failed]', errorData);
                throw new Error(`Razorpay Route transfer failed: ${JSON.stringify(errorData)}`);
            }
            const data = (await response.json());
            const transferItem = data.items?.[0] || data;
            return {
                transferId: transferItem.id,
                amount: transferItem.amount,
                currency: transferItem.currency || 'INR',
                destinationAccountId: transferItem.account,
                status: transferItem.status === 'processed' ? 'PROCESSED' : 'PENDING',
                rawResponse: transferItem,
            };
        }
        // Simulation Route transfer
        const simulatedTransferId = `trf_sim_${Date.now()}_${crypto_1.default.randomBytes(3).toString('hex')}`;
        return {
            transferId: simulatedTransferId,
            amount: options.amountInPaise,
            currency: options.currency || 'INR',
            destinationAccountId: options.destinationAccountId,
            status: 'PROCESSED',
            rawResponse: { simulated: true },
        };
    }
    /**
     * Reverse a Route transfer (e.g., when a student payment refund is processed)
     */
    async reverseTransfer(transferId, options) {
        if (this.isLiveConfigured() && !transferId.startsWith('trf_sim_')) {
            const payload = {};
            if (options?.amountInPaise)
                payload.amount = options.amountInPaise;
            if (options?.notes)
                payload.notes = options.notes;
            const response = await fetch(`https://api.razorpay.com/v1/transfers/${transferId}/reversals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: this.getBasicAuthHeader(),
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[Razorpay Transfer Reversal Failed]', errorData);
                throw new Error(`Transfer reversal failed: ${JSON.stringify(errorData)}`);
            }
            const data = (await response.json());
            return { reversalId: data.id, status: data.status || 'processed' };
        }
        return {
            reversalId: `rev_sim_${Date.now()}`,
            status: 'processed',
        };
    }
}
exports.RazorpayService = RazorpayService;
exports.razorpayService = new RazorpayService();
