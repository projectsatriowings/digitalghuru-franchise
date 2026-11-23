import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'dg_access_token',
  REFRESH_TOKEN: 'dg_refresh_token',
  USER_DATA: 'dg_user_data',
  ACTIVE_INSTITUTE: 'dg_active_institute',
};

// In-memory fallback for environments where SecureStore native module is not mounted (e.g. unit tests / web)
const memoryStore = new Map<string, string>();

async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    const available = await isSecureStoreAvailable();
    if (available) {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } else {
      memoryStore.set(key, value);
    }
  },

  async getItem(key: string): Promise<string | null> {
    const available = await isSecureStoreAvailable();
    if (available) {
      return await SecureStore.getItemAsync(key);
    }
    return memoryStore.get(key) || null;
  },

  async removeItem(key: string): Promise<void> {
    const available = await isSecureStoreAvailable();
    if (available) {
      await SecureStore.deleteItemAsync(key);
    } else {
      memoryStore.delete(key);
    }
  },

  // High-level session methods
  async saveSession(tokens: { accessToken: string; refreshToken: string; user: any; institute?: any }): Promise<void> {
    await this.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
    await this.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
    await this.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(tokens.user));
    if (tokens.institute) {
      await this.setItem(STORAGE_KEYS.ACTIVE_INSTITUTE, JSON.stringify(tokens.institute));
    }
  },

  async getSession(): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
    user: any | null;
    institute: any | null;
  }> {
    const [accessToken, refreshToken, userRaw, instRaw] = await Promise.all([
      this.getItem(STORAGE_KEYS.ACCESS_TOKEN),
      this.getItem(STORAGE_KEYS.REFRESH_TOKEN),
      this.getItem(STORAGE_KEYS.USER_DATA),
      this.getItem(STORAGE_KEYS.ACTIVE_INSTITUTE),
    ]);

    let user = null;
    let institute = null;
    try {
      if (userRaw) user = JSON.parse(userRaw);
      if (instRaw) institute = JSON.parse(instRaw);
    } catch {
      // Ignore parse errors on corrupt session
    }

    return { accessToken, refreshToken, user, institute };
  },

  async clearSession(): Promise<void> {
    await Promise.all([
      this.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      this.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
      this.removeItem(STORAGE_KEYS.USER_DATA),
      this.removeItem(STORAGE_KEYS.ACTIVE_INSTITUTE),
    ]);
  },
};
