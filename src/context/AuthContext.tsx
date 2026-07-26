import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { supabase } from '../api/supabase';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'client' | 'worker' | null;
  phone: string | null;
  location: string | null;
  verification_level: number;
  verification_status: string | null;
  last_seen: string | null;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  role: 'client' | 'worker' | null;
  loading: boolean;
  profileLoading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, profile: null, role: null,
  loading: true, profileLoading: false,
  logout: async () => {}, refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!mountedRef.current) return;
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, phone, location, verification_level, verification_status, last_seen, created_at')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      if (mountedRef.current) setProfile(data as Profile | null);
      Promise.resolve(
        supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId)
      ).catch(() => {});
    } catch (error) {
      console.error('fetchProfile error:', error);
      if (mountedRef.current) setProfile(null);
    } finally {
      if (mountedRef.current) setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let authSubscription: { unsubscribe: () => void } | null = null;
    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mountedRef.current) {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          if (currentUser) await fetchProfile(currentUser.id);
        }
      } catch (error) {
        console.error('initialize error:', error);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mountedRef.current) return;
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          if (event === 'SIGNED_IN' && currentUser) await fetchProfile(currentUser.id);
          else if (event === 'SIGNED_OUT') setProfile(null);
          else if (event === 'USER_UPDATED' && currentUser) await fetchProfile(currentUser.id);
        }
      );
      authSubscription = subscription;
    };
    initialize();
    return () => { if (authSubscription) authSubscription.unsubscribe(); };
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('logout error:', error);
      setUser(null);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const role = profile?.role ?? null;

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, profileLoading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
