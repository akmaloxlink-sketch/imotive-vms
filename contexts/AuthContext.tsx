import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { fleetApi } from '@/services/fleetApi';
import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  fleet_account: string;
  fleet_password: string;
  is_approved: boolean;
  role: string;
  contact_no?: string;
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  jsession: string | null;
  account: string | null;
  isLoading: boolean;
  fleetAuthError: boolean;
  signUp: (email: string, password: string, fleetAccount: string, fleetPassword: string, contactNo?: string) => Promise<{ error?: string; success?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateFleetCredentials: (fleetAccount: string, fleetPassword: string) => Promise<{ error?: string }>;
  retryFleetLogin: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [jsession, setJsession] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fleetAuthError, setFleetAuthError] = useState(false);

  const account = profile?.fleet_account ?? null;

  const loginToFleet = useCallback(async (fleetAccount: string, fleetPassword: string) => {
    try {
      setFleetAuthError(false);
      const response = await fleetApi.login(fleetAccount, fleetPassword);
      if (response.jsession) {
        setJsession(response.jsession);
      } else {
        setFleetAuthError(true);
      }
    } catch {
      setFleetAuthError(true);
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        setIsLoading(false);
        return;
      }

      setProfile(data);
      if (data?.is_approved) {
        await loginToFleet(data.fleet_account, data.fleet_password);
      }
    } catch {
      // profile fetch failed silently
    } finally {
      setIsLoading(false);
    }
  }, [loginToFleet]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setJsession(null);
        setFleetAuthError(false);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  useEffect(() => {
    if (!jsession || !profile) return;

    const validateFleetSession = async () => {
      if (!jsession || !profile) return;
      try {
        const response = await fleetApi.getDeviceOnlineStatus(jsession).catch(() => null);
        if (!response || response.result !== 0) {
          await loginToFleet(profile.fleet_account, profile.fleet_password);
        }
      } catch {
        // validation failed silently
      }
    };

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        validateFleetSession();
      }
    });

    const checkSessionListener = DeviceEventEmitter.addListener('auth:check_session', () => {
      validateFleetSession();
    });

    return () => {
      subscription.remove();
      checkSessionListener.remove();
    };
  }, [jsession, profile, loginToFleet]);

  const signUp = async (email: string, password: string, fleetAccount: string, fleetPassword: string, contactNo?: string) => {
    if (!supabase) return { error: 'System not configured' };

    try {
      const metadata: Record<string, string> = {
        fleet_account: fleetAccount,
        fleet_password: fleetPassword,
      };

      if (contactNo && contactNo.trim()) {
        metadata.contact_no = contactNo.trim();
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });
      if (error) return { error: error.message };
      if (!data.user) return { error: 'Registration failed' };

      if (data.user.identities && data.user.identities.length === 0) {
        return { error: 'An account with this email already exists' };
      }

      if (data.session) {
        setUser(data.user);
        await fetchProfile(data.user.id);
        return {};
      }

      return { success: true };
    } catch {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'System not configured' };

    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setIsLoading(false);
        return { error: error.message };
      }
      if (data.user) {
        setUser(data.user);
        await fetchProfile(data.user.id);
      }
      return {};
    } catch {
      setIsLoading(false);
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    try {
      if (jsession) {
        await fleetApi.logout(jsession).catch(() => {});
      }
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setJsession(null);
      setFleetAuthError(false);
    } catch {
      // sign out failed silently
    }
  };

  const updateFleetCredentials = async (fleetAccount: string, fleetPassword: string) => {
    if (!supabase || !user) return { error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          fleet_account: fleetAccount,
          fleet_password: fleetPassword,
        })
        .eq('id', user.id);

      if (error) return { error: error.message };

      setProfile(prev => prev ? { ...prev, fleet_account: fleetAccount, fleet_password: fleetPassword } : null);
      await loginToFleet(fleetAccount, fleetPassword);
      return {};
    } catch {
      return { error: 'Failed to update credentials' };
    }
  };

  const retryFleetLogin = async () => {
    if (!profile) return;
    await loginToFleet(profile.fleet_account, profile.fleet_password);
  };

  const refreshProfile = async () => {
    if (!user) return;
    await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      jsession,
      account,
      isLoading,
      fleetAuthError,
      signUp,
      signIn,
      signOut,
      updateFleetCredentials,
      retryFleetLogin,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
