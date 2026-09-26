import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { supabase } from './supabase';
import type { Profile } from './types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Dev-only: set EXPO_PUBLIC_DEV_SKIP_AUTH=true in .env to bypass sign-in and land straight in
// the app with a fake completed profile, for UI preview before Supabase is fully wired up.
const DEV_SKIP_AUTH = process.env.EXPO_PUBLIC_DEV_SKIP_AUTH === 'true';
const DEV_PROFILE: Profile = {
  id: 'dev-user',
  display_name: 'Dev Preview',
  birth_year: 1995,
  skin_type: 'combination',
  sensitivities: [],
  pregnant_or_breastfeeding: false,
  budget: 'medium',
  timezone: null,
  terms_accepted_at: new Date().toISOString(),
  photo_consent_at: new Date().toISOString(),
  am_reminder: false,
  pm_reminder: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(
    DEV_SKIP_AUTH ? ({ user: { id: 'dev-user' } } as Session) : null,
  );
  const [profile, setProfile] = useState<Profile | null>(DEV_SKIP_AUTH ? DEV_PROFILE : null);
  const [loading, setLoading] = useState(!DEV_SKIP_AUTH);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    if (DEV_SKIP_AUTH) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Defer the query so it doesn't run inside the auth callback.
      setTimeout(() => loadProfile(next?.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(
    () => loadProfile(session?.user.id),
    [loadProfile, session?.user.id],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!session) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session.user.id)
        .select('*')
        .single();
      if (error) throw error;
      setProfile(data as Profile);
    },
    [session],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, updateProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Where a signed-in user should be sent next, based on what they've completed. */
export function nextOnboardingStep(profile: Profile | null): '/consent' | '/profile-setup' | null {
  if (!profile?.terms_accepted_at || !profile.photo_consent_at || !profile.birth_year) return '/consent';
  if (!profile.skin_type) return '/profile-setup';
  return null;
}
