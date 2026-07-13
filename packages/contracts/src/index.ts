import { z } from 'zod';

/**
 * Shared domain contracts for the invoice SaaS.
 *
 * These Zod schemas are the single source of truth: the same definition drives
 * runtime validation at every system boundary AND compile-time types. Changing a
 * shape here breaks the build everywhere it is used — that is the primary
 * "no-mistakes" guard at scale (see ADR 0001).
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Money is always stored/transmitted as INTEGER MINOR UNITS (cents). Never float. */
export const MoneySchema = z
  .number()
  .int()
  .nonnegative()
  .describe('Integer minor units (e.g. cents). Never a float.');
export type Money = z.infer<typeof MoneySchema>;

/** ISO 4217, three uppercase letters. */
export const CurrencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Expected ISO 4217 currency code, e.g. USD, EUR, GBP');
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

/** Idempotency key guarding every payment-affecting operation (ADR 0001). */
export const IdempotencyKeySchema = z
  .string()
  .min(1)
  .max(255)
  .describe('Idempotency key — retries with the same key never double-apply.');
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

// ---------------------------------------------------------------------------
// Totals math (pure — no Prisma/zod at runtime, ADR 0001 single source of truth)
// ---------------------------------------------------------------------------

/**
 * Banker's rounding (round-half-to-even) to integer minor units. Required for tax
 * rounding parity with most jurisdictions and to avoid systematic penny drift across
 * millions of invoices (CONTEXT.md: Tax rounding).
 */
export function roundHalfEven(value: number): Money {
  const floor = Math.floor(value);
  const frac = value - floor;
  if (frac < 0.5) return floor;
  if (frac > 0.5) return floor + 1;
  // Exactly .5 → round to the nearest EVEN integer.
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Computes invoice totals. Tax is calculated PER LINE ITEM (never on the aggregated
 * subtotal) and rounded with roundHalfEven, per CONTEXT.md. Pure function — no DB —
 * so it is unit-testable without infrastructure and shared by web + db.
 */
export function computeTotals(
  lineItems: LineItem[],
  taxRates: TaxRate[],
  discount?: Discount,
): InvoiceTotals {
  let subtotal = 0;
  let tax = 0;

  for (const li of lineItems) {
    const lineGross = li.quantity * li.unitPriceMinor;
    subtotal += lineGross;

    const rate = li.taxRateId
      ? (taxRates.find((t) => t.id === li.taxRateId)?.rateBps ?? 0)
      : 0;
    // tax per line, in minor units, basis points → /10000
    tax += roundHalfEven((lineGross * rate) / 10000);
  }

  let discountMinor = 0;
  if (discount) {
    if (discount.amountMinor != null) {
      discountMinor = discount.amountMinor;
    } else if (discount.percentBps != null) {
      discountMinor = roundHalfEven((subtotal * discount.percentBps) / 10000);
    }
  }

  const totalMinor = Math.max(0, subtotal + tax - discountMinor);
  return { subtotalMinor: subtotal, taxMinor: tax, discountMinor, totalMinor };
}

export const TenantIdSchema = z.cuid();
export type TenantId = z.infer<typeof TenantIdSchema>;

export const ClientIdSchema = z.cuid();
export type ClientId = z.infer<typeof ClientIdSchema>;

export const InvoiceIdSchema = z.cuid();
export type InvoiceId = z.infer<typeof InvoiceIdSchema>;

// ---------------------------------------------------------------------------
// Tenant (hybrid tenancy registry — ADR 0001)
// ---------------------------------------------------------------------------

export const TenantDataModeSchema = z.enum(['POOLED', 'SILOED']);
export type TenantDataMode = z.infer<typeof TenantDataModeSchema>;

/** Tenant-configurable branding for invoices/emails (T2). */
export const BrandingSchema = z.object({
  displayName: z.string().max(200).optional(),
  logoUrl: z.url().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex color e.g. #1a1a1a').optional(),
});
export type Branding = z.infer<typeof BrandingSchema>;

export const TenantCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric/hyphen'),
  dataMode: TenantDataModeSchema.default('POOLED'),
  /** For SILOED tenants: the database/schema that holds their data. */
  dataLocation: z.string().max(256).optional(),
  baseCurrency: CurrencyCodeSchema.default('USD'),
  branding: BrandingSchema.optional(),
});
export type TenantCreate = z.infer<typeof TenantCreateSchema>;

export const TenantSchema = TenantCreateSchema.extend({
  id: TenantIdSchema,
  createdAt: z.iso.datetime(),
});
export type Tenant = z.infer<typeof TenantSchema>;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export const ClientCreateSchema = z.object({
  legalName: z.string().min(1).max(200),
  email: z.email(),
  billingAddress: z.string().max(500).optional(),
  taxIdentifier: z.string().max(64).optional(),
});
export type ClientCreate = z.infer<typeof ClientCreateSchema>;

export const ClientSchema = ClientCreateSchema.extend({
  id: ClientIdSchema,
  tenantId: TenantIdSchema,
  createdAt: z.iso.datetime(),
});
export type Client = z.infer<typeof ClientSchema>;

// ---------------------------------------------------------------------------
// Tax & discount
// ---------------------------------------------------------------------------

export const TaxRateSchema = z.object({
  id: z.cuid(),
  code: z.string().min(1).max(32),
  jurisdiction: z.string().max(64),
  rateBps: z.number().int().nonnegative().describe('Tax rate in basis points (e.g. 2000 = 20%).'),
});
export type TaxRate = z.infer<typeof TaxRateSchema>;

export const DiscountSchema = z.object({
  /** Fixed amount in minor units, XOR percentage in basis points. */
  amountMinor: MoneySchema.optional(),
  percentBps: z.number().int().nonnegative().optional(),
  label: z.string().max(64).optional(),
});
export type Discount = z.infer<typeof DiscountSchema>;

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

export const InvoiceStatusSchema = z.enum(['draft', 'sent', 'paid', 'overdue', 'void']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const LineItemSchema = z.object({
  description: z.string().min(1).max(300),
  quantity: z.number().int().positive(),
  unitPriceMinor: MoneySchema.describe('Unit price in minor units.'),
  taxRateId: z.cuid().optional(),
});
export type LineItem = z.infer<typeof LineItemSchema>;

/** Input to create an invoice (T1). */
export const InvoiceCreateSchema = z.object({
  clientId: ClientIdSchema,
  currency: CurrencyCodeSchema,
  dueDate: z.iso.datetime({ offset: true }),
  lineItems: z.array(LineItemSchema).min(1),
  discount: DiscountSchema.optional(),
  /** Optional idempotency key; when set, a retry with the same key is a no-op (guide §C3). */
  idempotencyKey: z.string().min(1).max(200).optional(),
});
export type InvoiceCreate = z.infer<typeof InvoiceCreateSchema>;

/** Computed invoice totals (integer minor units throughout). */
export const InvoiceTotalsSchema = z.object({
  subtotalMinor: MoneySchema,
  taxMinor: MoneySchema,
  discountMinor: MoneySchema,
  totalMinor: MoneySchema,
});
export type InvoiceTotals = z.infer<typeof InvoiceTotalsSchema>;

/** Full invoice record returned by the API. */
export const InvoiceSchema = z.object({
  id: InvoiceIdSchema,
  tenantId: TenantIdSchema,
  clientId: ClientIdSchema,
  invoiceNumber: z.string().min(1),
  status: InvoiceStatusSchema,
  currency: CurrencyCodeSchema,
  issueDate: z.iso.datetime(),
  dueDate: z.iso.datetime(),
  lineItems: z.array(LineItemSchema),
  discount: DiscountSchema.optional(),
  totals: InvoiceTotalsSchema,
  amountPaidMinor: MoneySchema,
  /** Stripe-hosted payment link (T3). Absent until the invoice is sent. */
  paymentLink: z.string().url().optional(),
  createdAt: z.iso.datetime(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

// ---------------------------------------------------------------------------
// Recurring billing (guide §C2) — drives hands-off, scheduled invoice generation.
// ---------------------------------------------------------------------------

export const SubscriptionIntervalSchema = z.enum(['day', 'week', 'month', 'year']);
export type SubscriptionInterval = z.infer<typeof SubscriptionIntervalSchema>;

export const SubscriptionCreateSchema = z.object({
  clientId: ClientIdSchema,
  /** Defaults to the tenant's base currency when omitted. */
  currency: CurrencyCodeSchema.optional(),
  lineItems: z.array(LineItemSchema).min(1),
  discount: DiscountSchema.optional(),
  intervalUnit: SubscriptionIntervalSchema,
  intervalCount: z.number().int().positive().max(120),
  /** ISO date of the first (or next) charge. Defaults to 30 days out. */
  anchorDate: z.iso.datetime({ offset: true }).optional(),
  /** Net terms applied to each generated invoice (days from generation to due). */
  netDays: z.number().int().positive().max(3650).optional(),
  /** Whether the schedule is active (defaults to true). */
  active: z.boolean().optional(),
});
export type SubscriptionCreate = z.infer<typeof SubscriptionCreateSchema>;

export const SubscriptionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  clientId: z.string(),
  currency: CurrencyCodeSchema,
  lineItems: z.array(LineItemSchema),
  discount: DiscountSchema.optional(),
  intervalUnit: SubscriptionIntervalSchema,
  intervalCount: z.number().int(),
  /** Next charge date; the scheduler generates when anchorDate <= now. */
  anchorDate: z.string(),
  lastRunAt: z.string().nullable(),
  active: z.boolean(),
  netDays: z.number().int(),
  createdAt: z.string(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

export const PaymentSchema = z.object({
  id: z.cuid(),
  invoiceId: InvoiceIdSchema,
  tenantId: TenantIdSchema,
  amountMinor: MoneySchema,
  currency: CurrencyCodeSchema,
  idempotencyKey: IdempotencyKeySchema,
  stripeChargeId: z.string().max(256).optional(),
  createdAt: z.iso.datetime(),
});
export type Payment = z.infer<typeof PaymentSchema>;

// ---------------------------------------------------------------------------
// HTTP envelope
// ---------------------------------------------------------------------------

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  idempotencyKey: IdempotencyKeySchema.optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ---------------------------------------------------------------------------
// T4 — overdue sweep result (admin trigger / scheduler)
// ---------------------------------------------------------------------------

export const OverdueCheckResultSchema = z.object({
  flipped: z.number().int().nonnegative(),
  remindersEnqueued: z.number().int().nonnegative(),
});
export type OverdueCheckResult = z.infer<typeof OverdueCheckResultSchema>;

// ---------------------------------------------------------------------------
// Read models — richer shapes returned by the list/get/me endpoints (UI build)
// ---------------------------------------------------------------------------

/** An invoice with its client embedded (detail view). */
export const InvoiceWithClientSchema = InvoiceSchema.extend({ client: ClientSchema });
export type InvoiceWithClient = z.infer<typeof InvoiceWithClientSchema>;

/** Dashboard KPIs for a tenant (GET /me). */
export const DashboardStatsSchema = z.object({
  draft: z.number().int().nonnegative(),
  sent: z.number().int().nonnegative(),
  paid: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
  void: z.number().int().nonnegative(),
  /** Sum of (total − paid) across non-settled invoices. */
  outstandingMinor: MoneySchema,
  /** Sum of total across all invoices (gross billed). */
  totalBilledMinor: MoneySchema,
});
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

/** Partial branding update (PATCH /me/branding). */
export const BrandingUpdateSchema = BrandingSchema.partial();
export type BrandingUpdate = z.infer<typeof BrandingUpdateSchema>;

/** Query params for GET /invoices. */
export const InvoiceListQuerySchema = z.object({
  status: InvoiceStatusSchema.optional(),
  clientId: ClientIdSchema.optional(),
});
export type InvoiceListQuery = z.infer<typeof InvoiceListQuerySchema>;

// ---------------------------------------------------------------------------
// Automation — self-verification gate (guide §2.4)
// ---------------------------------------------------------------------------

/**
 * A single reason an invoice failed verification. `code` is a stable machine token
 * (safe to branch on); `message` is human-readable for the audit log / API response.
 */
export const VerificationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type VerificationIssue = z.infer<typeof VerificationIssueSchema>;

/** Result of running the pre-send verification gate over an invoice. */
export const VerificationResultSchema = z.object({
  ok: z.boolean(),
  issues: z.array(VerificationIssueSchema),
});
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

// ---------------------------------------------------------------------------
// Automation — ingestion trigger (guide §2.1 "a very basic API endpoint")
// ---------------------------------------------------------------------------

/**
 * The client on an ingested unit of work. Resolved by email within the tenant:
 * an existing client with this email is reused, otherwise one is created. This is
 * what lets an upstream system (CRM, store, webhook) push work with no prior setup.
 */
export const IngestClientSchema = z.object({
  email: z.email(),
  legalName: z.string().min(1).max(200).optional(),
  billingAddress: z.string().max(500).optional(),
  taxIdentifier: z.string().max(64).optional(),
});
export type IngestClient = z.infer<typeof IngestClientSchema>;

/**
 * One unit of billable work pushed to `POST /ingest`. The system turns this into a
 * draft invoice, verifies it, and (unless `autoSend` is false) sends it — no clicks.
 */
export const IngestSchema = z.object({
  client: IngestClientSchema,
  /** Defaults to the tenant's base currency when omitted. */
  currency: CurrencyCodeSchema.optional(),
  /** Explicit due date (ISO). Takes precedence over `dueInDays`. */
  dueDate: z.iso.datetime({ offset: true }).optional(),
  /** Net terms: days from now until due. Defaults to 14. Ignored if `dueDate` set. */
  dueInDays: z.number().int().positive().max(3650).optional(),
  lineItems: z.array(LineItemSchema).min(1),
  discount: DiscountSchema.optional(),
  /** When true (default) a verified invoice is sent immediately. */
  autoSend: z.boolean().optional(),
  /**
   * Idempotency key for the upstream event (e.g. a Stripe/CRM event id). Retrying the
   * same key returns the original invoice instead of creating a duplicate (guide §C3).
   */
  idempotencyKey: z.string().min(1).max(200).optional(),
});
export type Ingest = z.infer<typeof IngestSchema>;

/** Outcome of an ingestion: the invoice, its verification result, and whether it went out. */
export const IngestResultSchema = z.object({
  invoice: InvoiceSchema,
  clientId: ClientIdSchema,
  verification: VerificationResultSchema,
  /** True when the invoice was auto-sent; false when held (verification failed or autoSend=false). */
  autoSent: z.boolean(),
});
export type IngestResult = z.infer<typeof IngestResultSchema>;

// ---------------------------------------------------------------------------
// Automation — immutable audit trail (guide §2.5)
// ---------------------------------------------------------------------------

/** Canonical audit events. Append-only; the trail is never mutated or deleted. */
export const AUDIT_EVENTS = {
  INVOICE_CREATED: 'invoice.created',
  INVOICE_VERIFIED: 'invoice.verified',
  INVOICE_VERIFICATION_FAILED: 'invoice.verification_failed',
  INVOICE_SENT: 'invoice.sent',
  INVOICE_HELD: 'invoice.held',
  REMINDER_SENT: 'invoice.reminder_sent',
  INVOICE_OVERDUE: 'invoice.overdue',
  PAYMENT_RECORDED: 'invoice.paid',
} as const;
export type AuditEvent = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS];

export const AuditLogEntrySchema = z.object({
  id: z.cuid(),
  tenantId: TenantIdSchema,
  invoiceId: InvoiceIdSchema.optional(),
  event: z.string(),
  detail: z.record(z.string(), z.any()).optional(),
  createdAt: z.iso.datetime(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

/** Query params for GET /audit. */
export const AuditListQuerySchema = z.object({
  invoiceId: InvoiceIdSchema.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
export type AuditListQuery = z.infer<typeof AuditListQuerySchema>;

// Re-export zod for convenience in consumers.
export { z };
