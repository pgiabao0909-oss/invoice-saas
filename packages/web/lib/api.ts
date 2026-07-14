import type {
  BrandingUpdate,
  Client,
  ClientCreate,
  DashboardStats,
  Invoice,
  InvoiceCreate,
  InvoiceStatus,
  InvoiceWithClient,
  IsolationStatus,
  OverdueCheckResult,
  Subscription,
  SubscriptionCreate,
  Tenant,
} from '@invoice-saas/contracts';

const TENANT_KEY = 'invoice-saas-tenant';

export function getTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TENANT_KEY);
}

export function setTenantSlug(slug: string | null): void {
  if (typeof window === 'undefined') return;
  if (slug) localStorage.setItem(TENANT_KEY, slug);
  else localStorage.removeItem(TENANT_KEY);
}

export class ApiError extends Error {
  status: number;
  error: string;
  constructor(status: number, error: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
  }
}

interface FetchOpts extends RequestInit {
  token?: string;
}

async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { token, headers, ...rest } = opts;
  const slug = getTenantSlug();
  const h = new Headers(headers);
  if (slug) h.set('x-tenant-slug', slug);
  if (token) h.set('Authorization', `Bearer ${token}`);
  h.set('Content-Type', 'application/json');

  const res = await fetch(`/api${path}`, { ...rest, headers: h });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = data ?? {};
    throw new ApiError(res.status, err.error ?? 'error', err.message ?? res.statusText);
  }
  return data as T;
}

export const api = {
  listInvoices: (status?: InvoiceStatus, clientId?: string) => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (clientId) q.set('clientId', clientId);
    const qs = q.toString();
    return apiFetch<Invoice[]>(`/invoices${qs ? `?${qs}` : ''}`);
  },
  getInvoice: (id: string) => apiFetch<InvoiceWithClient>(`/invoices/${id}`),
  createInvoice: (body: InvoiceCreate) =>
    apiFetch<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(body) }),
  sendInvoice: (id: string) =>
    apiFetch<Invoice>(`/invoices/${id}/send`, { method: 'POST' }),
  listClients: () => apiFetch<Client[]>('/clients'),
  createClient: (body: ClientCreate) =>
    apiFetch<Client>('/clients', { method: 'POST', body: JSON.stringify(body) }),
  listSubscriptions: () => apiFetch<Subscription[]>('/subscriptions'),
  createSubscription: (body: SubscriptionCreate) =>
    apiFetch<Subscription>('/subscriptions', { method: 'POST', body: JSON.stringify(body) }),
  listTenants: () => apiFetch<Tenant[]>('/tenants'),
  createTenant: (body: { name: string; slug: string }) =>
    apiFetch<Tenant>('/tenants', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => apiFetch<{ tenant: Tenant; stats: DashboardStats }>('/me'),
  updateBranding: (body: BrandingUpdate) =>
    apiFetch<Tenant>('/me/branding', { method: 'PATCH', body: JSON.stringify(body) }),
  runOverdue: (token: string) =>
    apiFetch<OverdueCheckResult>('/admin/run-overdue', { method: 'POST', token }),
  getIsolationStatus: (token: string) =>
    apiFetch<IsolationStatus>('/admin/isolation-status', { token }),
};
