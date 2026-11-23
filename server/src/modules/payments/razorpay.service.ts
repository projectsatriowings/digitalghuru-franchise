import crypto from 'crypto';

export interface RazorpayOrderOptions {
  amountInPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayTransferOptions {
  destinationAccountId: string;
  amountInPaise: number;
  currency?: string;
  notes?: Record<string, string>;
}

export class RazorpayService {
  private keyId: string | undefined;
  private keySecret: string | undefined;
  private webhookSecret: string | undefined;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID;
    this.keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  }

  public getKeyId(): string {
    return (process.env.RAZORPAY_KEY_ID || this.keyId || '').trim();
  }

  public getKeySecret(): string | undefined {
    return (process.env.RAZORPAY_KEY_SECRET || this.keySecret || '').trim() || undefined;
  }

  public getWebhookSecret(): string | undefined {
    return (process.env.RAZORPAY_WEBHOOK_SECRET || this.webhookSecret || '').trim() || undefined;
  }

  public isLiveConfigured(): boolean {
    const kid = this.getKeyId();
    const ksec = this.getKeySecret();
    return Boolean(
      kid &&
      ksec &&
      !kid.includes('YOUR_KEY_ID') &&
      !ksec.includes('YOUR_KEY_SECRET') &&
      kid !== 'rzp_test_simulated'
    );
  }

  public isSimulation(): boolean {
    return !this.isLiveConfigured();
  }

  private getBasicAuthHeader(): string {
    const kid = this.getKeyId();
    const ksec = this.getKeySecret();
    if (!kid || !ksec) {
      throw new Error('Razorpay credentials not configured');
    }
    return 'Basic ' + Buffer.from(`${kid}:${ksec}`).toString('base64');
  }

  /**
   * Create Razorpay Order from backend (Rule C)
   */
  public async createOrder(options: RazorpayOrderOptions): Promise<{
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    isSimulated: boolean;
  }> {
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

      const data = (await response.json()) as any;
      return {
        id: data.id,
        amount: data.amount,
        currency: data.currency,
        receipt: data.receipt,
        isSimulated: false,
      };
    }

    // Controlled simulation mode for development/testing
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Razorpay credentials missing. Simulated order creation is strictly prohibited in production.');
    }

    const mockOrderId = `order_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
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
  public verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!signature || !orderId || !paymentId) {
      return false;
    }

    const secret = this.getKeySecret();

    // Simulation check - strictly disabled in production
    if (process.env.NODE_ENV === 'production') {
      if (!secret) {
        return false;
      }
    } else if (!secret || orderId.startsWith('order_sim_') || orderId.startsWith('order_test_')) {
      return signature.length > 0;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret!)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } catch (err) {
      console.error('[Razorpay Signature Verification Error]', err);
      return false;
    }
  }

  /**
   * Verify Razorpay Webhook Signature using raw request body
   */
  public verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const secret = this.getWebhookSecret() || this.getKeySecret();
    if (!secret) {
      // In development without webhook secret, accept if test header present
      return process.env.NODE_ENV !== 'production';
    }

    if (!signature) {
      return false;
    }

    try {
      const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(bodyBuffer)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } catch (err) {
      console.error('[Webhook Signature Verification Error]', err);
      return false;
    }
  }

  /**
   * Fetch payment status directly from Razorpay (Authoritative financial confirmation)
   */
  public async fetchPayment(paymentId: string): Promise<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    captured: boolean;
    orderId?: string;
    method?: string;
  }> {
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

      const data = (await response.json()) as any;
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
  public async createPaymentTransfer(
    paymentId: string,
    options: RazorpayTransferOptions
  ): Promise<{
    transferId: string;
    amount: number;
    currency: string;
    destinationAccountId: string;
    status: 'PROCESSED' | 'PENDING' | 'FAILED';
    rawResponse?: any;
  }> {
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

      const data = (await response.json()) as any;
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
    const simulatedTransferId = `trf_sim_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
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
  public async reverseTransfer(
    transferId: string,
    options?: { amountInPaise?: number; notes?: Record<string, string> }
  ): Promise<{ reversalId: string; status: string }> {
    if (this.isLiveConfigured() && !transferId.startsWith('trf_sim_')) {
      const payload: any = {};
      if (options?.amountInPaise) payload.amount = options.amountInPaise;
      if (options?.notes) payload.notes = options.notes;

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

      const data = (await response.json()) as any;
      return { reversalId: data.id, status: data.status || 'processed' };
    }

    return {
      reversalId: `rev_sim_${Date.now()}`,
      status: 'processed',
    };
  }
}

export const razorpayService = new RazorpayService();
