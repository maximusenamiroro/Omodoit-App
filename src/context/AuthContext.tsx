import React, {
  createContext, useCallback, useContext, useState,
} from 'react';

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
  user: any;
  profile: Profile | null;
  role: 'client' | 'worker' | null;
  loading: boolean;
  profileLoading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setDirectAuth: (user: any, profile: Profile) => void;
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
});

// ── Provider ─────────────────────────────────────────────────────────
// ⚠️ TEMPORARY MOCK AUTH — Supabase is down (bandwidth exceeded)
// When Supabase is back, restore the real AuthProvider from git history:
//   git show HEAD~5:src/context/AuthContext.tsx
// Or ask Claude to restore it.

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mockRole, setMockRole] = useState<'client' | 'worker'>('client');

  const mockUser = { id: 'mock-user-id', email: 'test@omodoit.com' };

  const mockProfile: Profile = {
    id: 'mock-user-id',
    full_name: 'Max Test',
    avatar_url: null,
    role: mockRole,
    phone: '+2348050963733',
    location: 'Lagos, Nigeria',
    verification_level: 1,
    verification_status: 'basic',
    last_seen: new Date().toISOString(),
    created_at: '2026-07-26T00:00:00Z',
  };

  // Logout toggles between client and worker for testing both views
  const logout = useCallback(async () => {
    setMockRole(prev => prev === 'client' ? 'worker' : 'client');
  }, []);

  const refreshProfile = useCallback(async () => {}, []);
  const setDirectAuth = useCallback(() => {}, []);

  return (
    <AuthContext.Provider
      value={{
        user: mockUser,
        profile: mockProfile,
        role: mockRole,
        loading: false,
        profileLoading: false,
        logout,
        refreshProfile,
        setDirectAuth,
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
