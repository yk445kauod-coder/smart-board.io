import { createAuthClient } from '@neon/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

interface AuthClientLike {
  signUp: { email: (input: { email: string; password: string; name?: string }) => Promise<unknown> };
  signIn: { email: (input: { email: string; password: string }) => Promise<unknown> };
  signOut: () => Promise<unknown>;
  getSession: () => Promise<unknown>;
  token?: () => Promise<unknown>;
}

const baseUrl = (import.meta.env.VITE_NEON_AUTH_BASE_URL as string | undefined) ?? '';
const client = baseUrl ? (createAuthClient(baseUrl) as unknown as AuthClientLike) : null;

export const authConfigured = Boolean(client);

function extractUser(result: unknown): SessionUser | null {
  if (!result || typeof result !== 'object') return null;
  const data = 'data' in result ? (result as { data?: unknown }).data : result;
  if (!data || typeof data !== 'object') return null;
  const user = 'user' in data ? (data as { user?: unknown }).user : data;
  if (!user || typeof user !== 'object') return null;
  const u = user as Record<string, unknown>;
  if (typeof u.id !== 'string') return null;
  return {
    id: u.id,
    email: typeof u.email === 'string' ? u.email : '',
    name: typeof u.name === 'string' ? u.name : '',
  };
}

function extractError(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const error = (result as { error?: unknown }).error;
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'تعذّر إكمال العملية';
}

async function readToken(): Promise<string | null> {
  if (!client?.token) return null;
  try {
    const result = await client.token();
    if (!result || typeof result !== 'object') return null;
    const data = 'data' in result ? (result as { data?: unknown }).data : result;
    if (data && typeof data === 'object' && 'token' in data) {
      const token = (data as { token?: unknown }).token;
      if (typeof token === 'string') return token;
    }
    return null;
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: SessionUser | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!client) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }
    const session = await client.getSession().catch(() => null);
    const nextUser = extractUser(session);
    setUser(nextUser);
    setToken(nextUser ? await readToken() : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async fetch
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!client) throw new Error('إعداد المصادقة غير مكتمل (VITE_NEON_AUTH_BASE_URL)');
    const result = await client.signIn.email({ email, password });
    const error = extractError(result);
    if (error) throw new Error(error);
    await refresh();
  }, [refresh]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!client) throw new Error('إعداد المصادقة غير مكتمل (VITE_NEON_AUTH_BASE_URL)');
    const result = await client.signUp.email({ email, password, name });
    const error = extractError(result);
    if (error) throw new Error(error);
    await refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    if (client) await client.signOut().catch(() => undefined);
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, signIn, signUp, signOut, refresh }),
    [user, token, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
