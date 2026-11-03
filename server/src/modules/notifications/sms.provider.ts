import { config } from '../../config/index.js';

export interface SmsSendResult {
  success: boolean;
  provider: string;
  providerRef?: string;
  isMock?: boolean;
  delivered?: boolean;
  error?: string;
}

export interface ISmsProvider {
  name: string;
  isMock: boolean;
  send(phoneNumber: string, messageBody: string, templateName?: string): Promise<SmsSendResult>;
}

/**
 * Development & Test Mock SMS Provider
 * Safely simulates SMS delivery without calling real external telephony gateways.
 * Explicitly identifies itself as mock and NEVER claims real carrier delivery.
 */
export class MockSmsProvider implements ISmsProvider {
  name = 'mock';
  isMock = true;

  async send(phoneNumber: string, messageBody: string, templateName?: string): Promise<SmsSendResult> {
    const maskedPhone = phoneNumber.replace(/(\d{2})\d+(\d{2})/, '$1******$2');
    console.log(`[SIMULATED SMS - DEV MODE] Destination: ${maskedPhone} | Template: ${templateName || 'DEFAULT'}`);
    console.log(`[SIMULATED SMS - DEV MODE] Content: "${messageBody}"`);

    // Simulate transient failure if phone ends in 0000 for testing retry handling
    if (phoneNumber.endsWith('0000')) {
      return {
        success: false,
        provider: 'mock',
        isMock: true,
        delivered: false,
        error: 'Simulated network timeout/gateway unreachable',
      };
    }

    return {
      success: true,
      provider: 'mock',
      isMock: true,
      delivered: false, // Provider accepted in mock mode, NOT real carrier delivery
      providerRef: `MOCK-SMS-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
    };
  }
}

/**
 * Fast2SMS Indian DLT Gateway Provider
 */
export class Fast2SmsProvider implements ISmsProvider {
  name = 'fast2sms';
  isMock = false;

  async send(phoneNumber: string, messageBody: string, templateName?: string): Promise<SmsSendResult> {
    const apiKey = process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        provider: this.name,
        isMock: false,
        delivered: false,
        error: 'Fast2SMS API Key is not configured (missing FAST2SMS_API_KEY or SMS_API_KEY)',
      };
    }

    // Clean Indian 10-digit phone
    const cleanNumbers = phoneNumber.replace(/\D/g, '').slice(-10);
    if (cleanNumbers.length !== 10) {
      return {
        success: false,
        provider: this.name,
        isMock: false,
        delivered: false,
        error: `Invalid destination phone number '${phoneNumber}'. Fast2SMS requires 10-digit Indian mobile number.`,
      };
    }

    const dltTeId =
      templateName === 'CHECK_OUT_NOTIFICATION'
        ? process.env.FAST2SMS_DLT_TE_ID_CHECKOUT || process.env.SMS_DLT_TE_ID_CHECKOUT
        : process.env.FAST2SMS_DLT_TE_ID_CHECKIN || process.env.SMS_DLT_TE_ID_CHECKIN;

    const senderId = process.env.FAST2SMS_SENDER_ID || process.env.SMS_SENDER_ID || 'TXTIND';

    try {
      // Fast2SMS DLT or Quick Transactional Endpoint
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          dltTeId
            ? {
                route: 'dlt',
                sender_id: senderId,
                message: dltTeId,
                variables_values: messageBody,
                numbers: cleanNumbers,
              }
            : {
                route: 'q',
                message: messageBody,
                language: 'english',
                numbers: cleanNumbers,
              }
        ),
      });

      const data: any = await response.json();
      if (!response.ok || !data.return) {
        return {
          success: false,
          provider: this.name,
          isMock: false,
          delivered: false,
          error: data.message ? (Array.isArray(data.message) ? data.message.join(', ') : data.message) : 'Fast2SMS rejected request',
        };
      }

      return {
        success: true,
        provider: this.name,
        isMock: false,
        delivered: false, // Fast2SMS accepts request; delivery receipts come via webhook
        providerRef: data.request_id || `FAST2SMS-${Date.now()}`,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        isMock: false,
        delivered: false,
        error: `Fast2SMS network error: ${err.message}`,
      };
    }
  }
}

/**
 * MSG91 Indian DLT Flow Gateway Provider
 */
export class Msg91Provider implements ISmsProvider {
  name = 'msg91';
  isMock = false;

  async send(phoneNumber: string, messageBody: string, templateName?: string): Promise<SmsSendResult> {
    const authKey = process.env.MSG91_AUTH_KEY || process.env.SMS_API_KEY;
    if (!authKey) {
      return {
        success: false,
        provider: this.name,
        isMock: false,
        delivered: false,
        error: 'MSG91 Auth Key is not configured (missing MSG91_AUTH_KEY or SMS_API_KEY)',
      };
    }

    const flowId =
      templateName === 'CHECK_OUT_NOTIFICATION'
        ? process.env.MSG91_FLOW_ID_CHECKOUT || process.env.SMS_FLOW_ID_CHECKOUT
        : process.env.MSG91_FLOW_ID_CHECKIN || process.env.SMS_FLOW_ID_CHECKIN;

    if (!flowId) {
      return {
        success: false,
        provider: this.name,
        isMock: false,
        delivered: false,
        error: `MSG91 Flow ID for ${templateName || 'attendance'} is not configured (missing MSG91_FLOW_ID_CHECKIN / MSG91_FLOW_ID_CHECKOUT)`,
      };
    }

    const cleanNumbers = phoneNumber.replace(/\D/g, '').slice(-10);

    try {
      const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          authkey: authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flow_id: flowId,
          sender: process.env.MSG91_SENDER_ID || process.env.SMS_SENDER_ID,
          recipients: [{ mobiles: `91${cleanNumbers}`, message: messageBody }],
        }),
      });

      const data: any = await response.json();
      if (!response.ok || data.type === 'error') {
        return {
          success: false,
          provider: this.name,
          isMock: false,
          delivered: false,
          error: data.message || 'MSG91 rejected request',
        };
      }

      return {
        success: true,
        provider: this.name,
        isMock: false,
        delivered: false,
        providerRef: data.message || `MSG91-${Date.now()}`,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        isMock: false,
        delivered: false,
        error: `MSG91 network error: ${err.message}`,
      };
    }
  }
}

/**
 * Returns active SMS provider based on configuration
 */
export function getSmsProvider(): ISmsProvider {
  const providerType = (process.env.SMS_PROVIDER || config.sms.provider || 'mock').toLowerCase();
  if (providerType === 'fast2sms') {
    return new Fast2SmsProvider();
  }
  if (providerType === 'msg91') {
    return new Msg91Provider();
  }
  return new MockSmsProvider();
}

/**
 * Diagnostics helper returning active provider configuration status
 */
export function getSmsProviderStatus() {
  const providerType = (process.env.SMS_PROVIDER || config.sms.provider || 'mock').toLowerCase();
  const isMock = providerType === 'mock' || !['fast2sms', 'msg91'].includes(providerType);

  const missingConfig: string[] = [];
  if (providerType === 'fast2sms') {
    if (!process.env.FAST2SMS_API_KEY && !process.env.SMS_API_KEY) {
      missingConfig.push('FAST2SMS_API_KEY (or SMS_API_KEY)');
    }
    if (!process.env.FAST2SMS_DLT_TE_ID_CHECKIN && !process.env.SMS_DLT_TE_ID_CHECKIN) {
      missingConfig.push('FAST2SMS_DLT_TE_ID_CHECKIN');
    }
    if (!process.env.FAST2SMS_DLT_TE_ID_CHECKOUT && !process.env.SMS_DLT_TE_ID_CHECKOUT) {
      missingConfig.push('FAST2SMS_DLT_TE_ID_CHECKOUT');
    }
  } else if (providerType === 'msg91') {
    if (!process.env.MSG91_AUTH_KEY && !process.env.SMS_API_KEY) {
      missingConfig.push('MSG91_AUTH_KEY (or SMS_API_KEY)');
    }
    if (!process.env.MSG91_FLOW_ID_CHECKIN && !process.env.SMS_FLOW_ID_CHECKIN) {
      missingConfig.push('MSG91_FLOW_ID_CHECKIN');
    }
    if (!process.env.MSG91_FLOW_ID_CHECKOUT && !process.env.SMS_FLOW_ID_CHECKOUT) {
      missingConfig.push('MSG91_FLOW_ID_CHECKOUT');
    }
  }

  return {
    provider: providerType,
    isMock,
    isConfigured: !isMock && missingConfig.length === 0,
    missingConfig,
    providerName: isMock
      ? 'Development Simulated Mock Provider'
      : providerType === 'fast2sms'
      ? 'Fast2SMS Indian DLT Gateway'
      : 'MSG91 Flow DLT Gateway',
  };
}
