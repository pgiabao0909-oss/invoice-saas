'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { DashboardStats, Tenant } from '@invoice-saas/contracts';
import { api, getTenantSlug, setTenantSlug } from '@/lib/api';

interface TenantContextValue {
  slug: string | null;
  tenant: Tenant | null;
  stats: DashboardStats | null;
  tenants: Tenant[];
  loading: boolean;
  /** True once the initial load attempt has finished (used to decide onboarding vs shell). */
  ready: boolean;
  switchTenant: (slug: string) => void;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within <TenantProvider>');
  return ctx;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const current = getTenantSlug();
    setSlug(current);
    if (!current) {
      setTenant(null);
      setStats(null);
      setLoading(false);
      setReady(true);
      return;
    }
    setLoading(true);
    try {
      const me = await api.getMe();
      setTenant(me.tenant);
      setStats(me.stats);
      setTenants(await api.listTenants());
    } catch {
      // Stale/missing slug — drop back to onboarding.
      setTenantSlug(null);
      setSlug(null);
      setTenant(null);
      setStats(null);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchTenant = (next: string) => {
    setTenantSlug(next);
    void refresh();
  };

  return (
    <TenantContext.Provider
      value={{ slug, tenant, stats, tenants, loading, ready, switchTenant, refresh }}
    >
      {children}
    </TenantContext.Provider>
  );
}
