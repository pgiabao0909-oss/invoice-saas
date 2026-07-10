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
  createdAt: z.iso.datetime(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

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

// Re-export zod for convenience in consumers.
export { z };
