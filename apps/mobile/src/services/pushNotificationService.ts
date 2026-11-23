import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient } from '../api/client';
import { handleNotificationDeepLink } from './deepLinkService';

// Configure how foreground notifications are presented
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let cachedPushToken: string | null = null;
let notificationReceivedSubscription: Notifications.Subscription | null = null;
let notificationResponseSubscription: Notifications.Subscription | null = null;

/**
 * Configure high-priority Android notification channel
 */
async function setupAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default Center Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FE4D01',
      sound: 'default',
    });
  }
}

/**
 * Request notification permissions, obtain Expo push token, and register with backend
 */
export async function registerDevicePushToken(): Promise<string | null> {
  try {
    await setupAndroidChannel();

    // Check device support
    if (!Device.isDevice) {
      console.log('[Push] Running on simulator/emulator; push notifications are simulated');
      // For local development on emulator, we still register a mock simulator token for testing
      const simToken = `ExponentPushToken[SIMULATOR_${Platform.OS}_${Date.now()}]`;
      cachedPushToken = simToken;
      await apiClient
        .post('/notifications/push-token', {
          token: simToken,
          platform: Platform.OS,
          deviceInfo: `${Device.modelName || 'Simulator'} (${Platform.OS})`,
        })
        .catch(() => {});
      return simToken;
    }

    // Permission checking
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Notification permissions not granted');
      return null;
    }

    // Obtain Expo Push Token
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData.data;
    cachedPushToken = token;

    // Register token on the backend
    await apiClient.post('/notifications/push-token', {
      token,
      platform: Platform.OS,
      deviceInfo: `${Device.manufacturer || ''} ${Device.modelName || Platform.OS}`.trim(),
    });

    console.log('[Push] Device token registered successfully:', token);
    return token;
  } catch (err: any) {
    console.warn('[Push] Failed to register device push token:', err.message);
    return null;
  }
}

/**
 * Unregister device push token on logout
 */
export async function unregisterDevicePushToken(): Promise<void> {
  try {
    if (cachedPushToken) {
      await apiClient.delete('/notifications/push-token', {
        data: { token: cachedPushToken },
      });
      cachedPushToken = null;
      console.log('[Push] Device token unregistered');
    } else {
      // Clear all tokens for the authenticated user session
      await apiClient.delete('/notifications/push-token').catch(() => {});
    }
  } catch (err: any) {
    console.warn('[Push] Failed to unregister push token:', err.message);
  }
}

/**
 * Initialize notification listeners for foreground reception, banner interaction, and cold-start taps
 */
export function initNotificationListeners() {
  // Clear any existing subscriptions
  if (notificationReceivedSubscription) {
    notificationReceivedSubscription.remove();
  }
  if (notificationResponseSubscription) {
    notificationResponseSubscription.remove();
  }

  // Listener for foreground notifications
  notificationReceivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('[Push] Notification received in foreground:', notification.request.content.title);
    }
  );

  // Listener for user tapping on a notification banner
  notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('[Push] Notification tapped by user');
      const data = response.notification.request.content.data;
      if (data) {
        handleNotificationDeepLink(data);
      }
    }
  );

  // Check if app was opened from a cold-start notification tap
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      console.log('[Push] Cold-start notification response detected');
      const data = response.notification.request.content.data;
      if (data) {
        setTimeout(() => {
          handleNotificationDeepLink(data);
        }, 1000); // Allow navigation container to finish mounting
      }
    }
  });

  return () => {
    if (notificationReceivedSubscription) {
      notificationReceivedSubscription.remove();
      notificationReceivedSubscription = null;
    }
    if (notificationResponseSubscription) {
      notificationResponseSubscription.remove();
      notificationResponseSubscription = null;
    }
  };
}
