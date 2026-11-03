import { NotificationService } from './notification.service.js';
import { getSmsProviderStatus } from './sms.provider.js';

console.log('[TuitionOS SMS Standalone Worker] Initializing...');
const status = getSmsProviderStatus();
console.log(
  `[TuitionOS SMS Standalone Worker] Active Provider: ${status.providerName} (${status.isMock ? 'MOCK' : 'REAL'})`
);
if (!status.isConfigured && !status.isMock) {
  console.warn(
    `[TuitionOS SMS Standalone Worker] Warning: Real provider is missing configuration: ${status.missingConfig.join(', ')}`
  );
}

// Poll every 10 seconds in standalone worker mode
NotificationService.startWorker(10000);

process.on('SIGINT', () => {
  console.log('[TuitionOS SMS Standalone Worker] Stopping on SIGINT...');
  NotificationService.stopWorker();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[TuitionOS SMS Standalone Worker] Stopping on SIGTERM...');
  NotificationService.stopWorker();
  process.exit(0);
});
