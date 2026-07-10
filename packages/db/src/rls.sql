-- Row-Level Security backstop for POOLED tenants (ADR 0001).
--
-- The app-level guard (tenancy/scoped.ts) already threads `tenantId` into every
-- query. RLS is a defense-in-depth backstop: even if app code ever forgets the
-- filter, Postgres physically prevents cross-tenant reads/writes.
--
-- Apply in a migration on the POOLED database. The session variable
-- `app.tenant_id` must be set per request (see note below).

ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxRate" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_invoice ON "Invoice"
  USING ("tenantId" = current_setting('app.tenant_id')::text);

CREATE POLICY tenant_isolation_client ON "Client"
  USING ("tenantId" = current_setting('app.tenant_id')::text);

CREATE POLICY tenant_isolation_payment ON "Payment"
  USING ("tenantId" = current_setting('app.tenant_id')::text);

CREATE POLICY tenant_isolation_taxrate ON "TaxRate"
  USING ("tenantId" = current_setting('app.tenant_id')::text);

-- NOTE: A shared connection pool means the session var must be set on the SAME
-- connection that runs the query. Use a transaction-scoped setting per request,
-- e.g. `SET LOCAL app.tenant_id = $1` inside the request transaction, or a
-- dedicated connection per request for pooled tenants. SILOED tenants do not
-- need RLS because their data lives in a separate database.
