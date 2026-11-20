"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const notification_service_js_1 = require("./notification.service.js");
const sms_provider_js_1 = require("./sms.provider.js");
console.log('[TuitionOS SMS Standalone Worker] Initializing...');
const status = (0, sms_provider_js_1.getSmsProviderStatus)();
console.log(`[TuitionOS SMS Standalone Worker] Active Provider: ${status.providerName} (${status.isMock ? 'MOCK' : 'REAL'})`);
if (!status.isConfigured && !status.isMock) {
    console.warn(`[TuitionOS SMS Standalone Worker] Warning: Real provider is missing configuration: ${status.missingConfig.join(', ')}`);
}
// Poll every 10 seconds in standalone worker mode
notification_service_js_1.NotificationService.startWorker(10000);
process.on('SIGINT', () => {
    console.log('[TuitionOS SMS Standalone Worker] Stopping on SIGINT...');
    notification_service_js_1.NotificationService.stopWorker();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('[TuitionOS SMS Standalone Worker] Stopping on SIGTERM...');
    notification_service_js_1.NotificationService.stopWorker();
    process.exit(0);
});
