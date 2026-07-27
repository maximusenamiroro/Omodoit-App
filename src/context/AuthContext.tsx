import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { supabase } from '../api/supabase';
import type { User } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────

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
  setDirectAuth: (user: User, profile: Profile) => void;
  beginRegistration: () => void;
  endRegistration: () => void;
}

// ── Context ──────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  profileLoading: false,
  logout: async () => {},
  refreshProfile: async () => {},
  setDirectAuth: () => {},
  beginRegistration: () => {},
  endRegistration: () => {},
});

// ── Provider ─────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // Tracks if the component is still mounted
  // Prevents state updates after unmount which causes memory leaks
  const mountedRef = useRef(true);

  // Tracks if registration is currently in progress
  // When true, onAuthStateChange ignores SIGNED_IN events
  // because setDirectAuth will handle setting the user and profile
  // This prevents the brief flash of auth screen during registration
  const isRegisteringRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Fetch profile from database ────────────────────────────────────
  // Retries up to 3 times with 1 second delay between each attempt
  // This handles the case where the profile is being created by
  // another process and is not immediately available

  const fetchProfile = useCallback(async (userId: string, retries = 3) => {
    if (!mountedRef.current) return;
    setProfileLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, full_name, avatar_url, role, phone, location, ' +
          'verification_level, verification_status, last_seen, created_at'
        )
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      // Profile not found — retry if we have attempts left
      if (!data && retries > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, 1000));
        if (mountedRef.current) {
          return fetchProfile(userId, retries - 1);
        }
        return;
      }

      if (mountedRef.current) {
        setProfile(data as Profile | null);
      }

      // Update last_seen in background — not critical
      Promise.resolve(
        supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', userId)
      ).catch(() => {});
    } catch (error) {
      console.error('fetchProfile error:', error);
      if (mountedRef.current) {
        setProfile(null);
      }
    } finally {
      if (mountedRef.current) {
        setProfileLoading(false);
      }
    }
  }, []);

  // ── Initialize and listen for auth changes ─────────────────────────

  useEffect(() => {
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initialize = async () => {
      try {
        // Check AsyncStorage for an existing session
        const { data: { session } } = await supabase.auth.getSession();

        if (mountedRef.current) {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          if (currentUser) {
            await fetchProfile(currentUser.id);
          }
        }
      } catch (error) {
        console.error('AuthContext initialize error:', error);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }

      // Listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mountedRef.current) return;

          // CRITICAL: During registration, ignore SIGNED_IN events.
          // The registration screen calls setDirectAuth which sets
          // the user and profile directly. If we let onAuthStateChange
          // handle it, fetchProfile runs before the profile exists
          // and the user sees a brief flash of the auth screen.
          if (isRegisteringRef.current && event === 'SIGNED_IN') {
            return;
          }

          const currentUser = session?.user ?? null;

          if (event === 'SIGNED_OUT') {
            // User logged out — clear everything
            setUser(null);
            setProfile(null);
          } else if (event === 'SIGNED_IN' && currentUser) {
            // User logged in (not during registration)
            setUser(currentUser);
            await fetchProfile(currentUser.id);
          } else if (event === 'USER_UPDATED' && currentUser) {
            // User updated their email or password
            setUser(currentUser);
            await fetchProfile(currentUser.id);
          } else if (event === 'TOKEN_REFRESHED' && currentUser) {
            // JWT token refreshed — user and profile still valid
            setUser(currentUser);
          }
        }
      );

      authSubscription = subscription;
    };

    initialize();

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [fetchProfile]);

  // ── Logout ─────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('AuthContext logout error:', error);
    }
    // Always clear local state even if signOut fails
    setUser(null);
    setProfile(null);
  }, []);

  // ── Refresh profile ────────────────────────────────────────────────
  // Call this after user edits their profile so context updates

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  // ── Direct auth ────────────────────────────────────────────────────
  // Used exclusively by registration screens to bypass the race
  // condition between signUp and profile creation.
  //
  // HOW IT WORKS:
  // 1. Registration screen calls signUp → triggers onAuthStateChange
  // 2. Registration screen creates profile in database
  // 3. Registration screen calls setDirectAuth with user + profile
  // 4. setDirectAuth sets state immediately → AppNavigator renders
  //    the correct home screen instantly
  // 5. onAuthStateChange SIGNED_IN event is ignored because
  //    isRegisteringRef is true
  // 6. After 5 seconds the flag resets so normal auth flow works again
  //
  // WHY 5 SECONDS:
  // Supabase may fire multiple auth events (SIGNED_IN, TOKEN_REFRESHED)
  // during registration. 5 seconds is enough for all events to settle.
  // After that, normal auth flow resumes for login, logout, etc.

  // Must be called BEFORE supabase.auth.signUp() so the SIGNED_IN
  // event that signUp fires is ignored. Setting the flag inside
  // setDirectAuth is too late — the event arrives before the profile
  // row exists, fetchProfile finds nothing, and AppNavigator briefly
  // falls back to the Auth stack (flash of the first signup screen).
  const beginRegistration = useCallback(() => {
    isRegisteringRef.current = true;
  }, []);

  // Call this if registration fails, so normal auth flow resumes
  // immediately (e.g. the user goes back and logs in instead).
  const endRegistration = useCallback(() => {
    isRegisteringRef.current = false;
  }, []);

  const setDirectAuth = useCallback((newUser: User, newProfile: Profile) => {
    // Block onAuthStateChange from interfering
    isRegisteringRef.current = true;

    // Set state directly — no database fetch needed
    setUser(newUser);
    setProfile(newProfile);
    setLoading(false);
    setProfileLoading(false);

    // Reset the registration flag after events settle
    setTimeout(() => {
      isRegisteringRef.current = false;
    }, 5000);
  }, []);

  // ── Derived values ─────────────────────────────────────────────────

  const role = profile?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        profileLoading,
        logout,
        refreshProfile,
        setDirectAuth,
        beginRegistration,
        endRegistration,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;