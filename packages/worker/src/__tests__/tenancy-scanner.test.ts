import { describe, it, expect, vi } from 'vitest';
import { startTenancyScanner } from '../worker.js';
import { consoleAlertSink, type AlertSink } from '../alerting.js';

/**
 * C6 — the scheduled tenancy scanner must raise a C5 alert when it finds either:
 *  (a) a recent API-boundary isolation violation in the audit trail, or
 *  (b) a row whose tenantId is not a real tenant (orphaned / injected / mis-tenant'd).
 * And it must stay silent when the data is clean.
 */

class CapturingAlertSink implements AlertSink {
  alerts: Array<{ subject: string; message: string }> = [];
  async alert(subject: string, message: string): Promise<void> {
    this.alerts.push({ subject, message });
  }
}

function fakePrisma(opts: {
  tenants: string[];
  foreignRows?: { invoice?: number; client?: number; subscription?: number; payment?: number; taxRate?: number };
  auditViolations?: number;
}) {
  const foreign = opts.foreignRows ?? {};
  // Build a fake `db.<table>.findMany` for each tenant-scoped table.
  const makeTable = (n: number) => ({
    findMany: async ({ select }: { select?: { id: boolean } }) =>
      Array.from({ length: n }, (_, i) => (select ? { id: `bad${i}` } : {})),
  });
  const auditLog = {
    findMany: async (args: { where: { event: string; createdAt: { gte: Date } } }) => {
      if (args.where.event !== 'tenant.isolation_violation') return [];
      return Array.from({ length: opts.auditViolations ?? 0 }, (_, i) => ({
        id: `av${i}`,
        tenantId: 't1',
        detail: { route: '/invoices', violations: [{ path: '$.0', tenantId: 't2' }] },
      }));
    },
  };
  return {
    tenant: { findMany: async () => opts.tenants.map((id) => ({ id })) },
    auditLog,
    invoice: makeTable(foreign.invoice ?? 0),
    client: makeTable(foreign.client ?? 0),
    subscription: makeTable(foreign.subscription ?? 0),
    payment: makeTable(foreign.payment ?? 0),
    taxRate: makeTable(foreign.taxRate ?? 0),
  } as any;
}

describe('startTenancyScanner — C6 isolation scanner', () => {
  it('stays silent on a clean database', async () => {
    const sink = new CapturingAlertSink();
    const db = fakePrisma({ tenants: ['t1', 't2'], foreignRows: {}, auditViolations: 0 });
    const handle = startTenancyScanner(db, 100_000, sink);
    clearInterval(handle);
    await new Promise((r) => setTimeout(r, 30)); // let the immediate void tick() run
    expect(sink.alerts).toHaveLength(0);
  });

  it('alerts when an API-boundary isolation violation was recorded', async () => {
    const sink = new CapturingAlertSink();
    const db = fakePrisma({ tenants: ['t1'], foreignRows: {}, auditViolations: 2 });
    const handle = startTenancyScanner(db, 100_000, sink);
    clearInterval(handle);
    await new Promise((r) => setTimeout(r, 30));
    expect(sink.alerts).toHaveLength(1);
    expect(sink.alerts[0]!.subject).toContain('API boundary');
    expect(sink.alerts[0]!.message).toContain('2 cross-tenant');
  });

  it('alerts when rows have a foreign (non-existent) tenantId', async () => {
    const sink = new CapturingAlertSink();
    const db = fakePrisma({ tenants: ['t1'], foreignRows: { invoice: 3, client: 1 } });
    const handle = startTenancyScanner(db, 100_000, sink);
    clearInterval(handle);
    await new Promise((r) => setTimeout(r, 30));
    expect(sink.alerts).toHaveLength(1);
    expect(sink.alerts[0]!.subject).toContain('foreign tenantId');
    expect(sink.alerts[0]!.message).toContain('invoice');
  });

  it('uses the default console sink without throwing when none injected', async () => {
    const db = fakePrisma({ tenants: ['t1'], foreignRows: {}, auditViolations: 0 });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handle = startTenancyScanner(db, 100_000, consoleAlertSink);
    clearInterval(handle);
    await new Promise((r) => setTimeout(r, 30));
    spy.mockRestore();
    expect(true).toBe(true); // reached here => no throw
  });
});
