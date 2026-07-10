import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { AuditEvent, AuditLogEntry, TenantId } from '@invoice-saas/contracts';

/**
 * Immutable audit trail (guide §2.5 — "the system's conscience").
 *
 * Every meaningful state change appends ONE record. There is deliberately no update
 * or delete helper: the trail is append-only so it can be trusted as evidence of what
 * the automation did, when, and why — without anyone lifting a finger.
 *
 * A transaction-aware client can be passed (the same `tx` as the domain write) so the
 * audit record and the change it describes commit atomically — the change is never
 * recorded as having happened unless it actually did.
 */
export interface AuditWriter {
  auditLog: {
    create(args: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<unknown>;
  };
}

export interface RecordAuditInput {
  tenantId: TenantId;
  invoiceId?: string;
  event: AuditEvent;
  detail?: Record<string, unknown>;
}

export async function recordAudit(db: AuditWriter, input: RecordAuditInput): Promise<void> {
  await db.auditLog.create({
    data: {
      tenantId: input.tenantId,
      invoiceId: input.invoiceId ?? null,
      event: input.event,
      detail: input.detail ? (input.detail as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}

function mapAudit(r: {
  id: string;
  tenantId: string;
  invoiceId: string | null;
  event: string;
  detail: unknown;
  createdAt: Date;
}): AuditLogEntry {
  return {
    id: r.id,
    tenantId: r.tenantId,
    invoiceId: r.invoiceId ?? undefined,
    event: r.event,
    detail: (r.detail as AuditLogEntry['detail']) ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listAudit(
  prisma: PrismaClient,
  tenantId: TenantId,
  query: { invoiceId?: string; limit?: number } = {},
): Promise<AuditLogEntry[]> {
  const where: Prisma.AuditLogWhereInput = { tenantId };
  if (query.invoiceId) where.invoiceId = query.invoiceId;
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: query.limit ?? 100,
  });
  return rows.map(mapAudit);
}
