import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from './api';
import { useAuth } from './auth';
import type { OrgSummary } from './types';

interface WorkspaceValue {
  orgs: OrgSummary[];
  org: OrgSummary | null;
  orgId: string;
  setOrgId: (id: string) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);
const ORG_KEY = 'smartboard:org';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { token, signOut } = useAuth();
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [orgId, setOrgIdState] = useState<string>(() => localStorage.getItem(ORG_KEY) ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ orgs: OrgSummary[] }>('/api/me', { token });
      setOrgs(result.orgs);
      setOrgIdState((current) => {
        const valid = result.orgs.some((o) => o.id === current);
        const next = valid ? current : (result.orgs[0]?.id ?? '');
        if (next) localStorage.setItem(ORG_KEY, next);
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذّر تحميل مساحة العمل';
      setError(message);
      if (message.includes('401') || message.includes('session')) await signOut();
    } finally {
      setLoading(false);
    }
  }, [token, signOut]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async fetch
    void refresh();
  }, [refresh]);

  const setOrgId = useCallback((id: string) => {
    localStorage.setItem(ORG_KEY, id);
    setOrgIdState(id);
  }, []);

  const value = useMemo<WorkspaceValue>(() => ({
    orgs,
    org: orgs.find((o) => o.id === orgId) ?? orgs[0] ?? null,
    orgId: orgs.find((o) => o.id === orgId)?.id ?? orgs[0]?.id ?? '',
    setOrgId,
    loading,
    error,
    refresh,
  }), [orgs, orgId, setOrgId, loading, error, refresh]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
