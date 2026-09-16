import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../api/supabase';
import type { User } from '@supabase/supabase-js';

// Auto-logout after 30 minutes of inactivity (Security requirement)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Cache key is scoped per user ID, so there's no risk of showing one
// account's cached profile to a different account that logs in on the
// same device (e.g. testing a client and worker account back to back).
const cacheKey = (userId: string) => `omodoit_cached_profile_${userId}`;

async function getCachedProfile(userId: string): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setCachedProfile(userId: string, profile: Profile) {
  try {
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(profile));
  } catch {
    // Non-fatal — worst case, next launch just falls back to the
    // normal blocking fetch instead of the instant cached path.
  }
}

async function clearCachedProfile(userId: string) {
  try {
    await AsyncStorage.removeItem(cacheKey(userId));
  } catch {
    // Non-fatal
  }
}

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
  // Worker-only fields — null/undefined for client accounts
  business_name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  experience?: string | null;
  service_area?: string | null;
  // Bank/payout details — used for withdrawals (worker) or refunds (client)
  bank_name?: string | null;
  account_number?: string | null;
  account_name?: string | null;
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
  const userRef = useRef<User | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Auto-logout timer for session security
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset inactivity timer on user interaction
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('Auto-logout: Session expired due to 30min inactivity');
        logout();
      }, SESSION_TIMEOUT_MS);
    }
  }, [user, logout]);

  // Track app state changes to reset timer when app comes to foreground
  useEffect(() => {
    if (!user) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      return;
    }

    resetInactivityTimer();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        resetInactivityTimer();
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      appStateSub.remove();
    };
  }, [user, resetInactivityTimer]);

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
          'verification_level, verification_status, last_seen, created_at, ' +
          'business_name, category, subcategory, experience, service_area, ' +
          'bank_name, account_number, account_name'
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

      // Still nothing after all retries — this is an authenticated user
      // with no profile row at all, most likely a signup that was
      // interrupted between creating the auth account and creating the
      // profile (dropped connection, brief Supabase hiccup). Rather than
      // leave them permanently stuck with a working login and nowhere
      // to go, create a minimal profile so the app is usable; they can
      // fill in the rest from Settings.
      if (!data) {
        console.warn('Authenticated user has no profile row — creating a fallback profile.');
        const { data: authUser } = await supabase.auth.getUser();
        const fallbackName = authUser?.user?.email?.split('@')[0] || 'New User';

        const { error: healError } = await supabase.from('profiles').insert({
          id: userId,
          full_name: fallbackName,
          role: 'client',
          verification_level: 0,
          verification_status: 'basic',
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

        if (!healError && mountedRef.current) {
          await fetchProfile(userId, 0);
        } else if (healError) {
          console.error('Failed to auto-heal missing profile:', healError.message);
          if (mountedRef.current) setProfile(null);
        }
        return;
      }

      if (mountedRef.current) {
        setProfile(data as unknown as Profile | null);
      }
      if (data) {
        setCachedProfile(userId, data as unknown as Profile);
      }

      // Update last_seen in background — not critical
      supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', userId)
        .catch((err) => {
          console.warn('Non-critical: Failed to update last_seen:', err.message);
        });
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
            // TikTok-style instant launch: if we have a cached profile
            // from a previous session, show it immediately and unblock
            // the UI right away, then refresh with real data in the
            // background. Without this, every cold launch waited on a
            // full network round-trip before showing anything past the
            // loading spinner, even for a user who was already logged
            // in — no different from a first-time login.
            const cached = await getCachedProfile(currentUser.id);
            if (cached && mountedRef.current) {
              setProfile(cached);
              setLoading(false);
              // Fetch profile in background without blocking
              fetchProfile(currentUser.id).catch(err => {
                console.warn('Background profile refresh failed:', err);
              });
            } else {
              await fetchProfile(currentUser.id);
            }
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
            // Don't await to prevent blocking
            fetchProfile(currentUser.id).catch(err => {
              console.error('Auth state change profile fetch failed:', err);
            });
          } else if (event === 'USER_UPDATED' && currentUser) {
            // User updated their email or password
            setUser(currentUser);
            fetchProfile(currentUser.id).catch(err => {
              console.error('User updated profile fetch failed:', err);
            });
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
  }, []); // FIXED: Empty dependency array prevents infinite loops

  // ── Logout ─────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    const loggedOutUserId = userRef.current?.id;
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('AuthContext logout error:', error);
    }
    // Always clear local state even if signOut fails
    setUser(null);
    setProfile(null);
    if (loggedOutUserId) {
      clearCachedProfile(loggedOutUserId);
    }
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