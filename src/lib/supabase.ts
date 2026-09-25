import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

// Some embedded/preview contexts (e.g. a sandboxed iframe) block localStorage entirely —
// accessing it can throw synchronously and crash the whole app before it renders. Detect
// that up front and fall back to an in-memory store rather than let it take the app down.
function createAuthStorage() {
  if (Platform.OS !== 'web') return AsyncStorage;
  try {
    const testKey = '__sm_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return AsyncStorage;
  } catch {
    console.warn('Skin Mirror: localStorage is unavailable here, using in-memory session storage.');
    const memory = new Map<string, string>();
    return {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => void memory.set(key, value),
      removeItem: async (key: string) => void memory.delete(key),
    };
  }
}

// Only the public anon key lives in the app. The Claude API key stays on the server.
export const supabase = createClient(url ?? 'https://example.supabase.co', anonKey ?? 'missing-key', {
  auth: {
    storage: createAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Keep the session fresh only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
