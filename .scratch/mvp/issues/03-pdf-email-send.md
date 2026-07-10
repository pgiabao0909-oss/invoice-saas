Status: resolved
Type: task
Category: enhancement
Blocked by: 02-create-draft-invoice
Source: tickets.md T2; PRD `.scratch/mvp/PRD.md`; glossary `CONTEXT.md`

# T2 — Generate branded PDF + email on send

**What to build:** A tenant user can generate a branded PDF of a draft invoice and email
it to the client. On send the invoice moves to `sent` and the client receives the PDF
with a payment pointer.

**Acceptance criteria**

- [ ] PDF renders all line items, tax, discount, total, and tenant branding/logo.
- [ ] Email delivers the PDF to the client's address.
- [ ] Sending transitions the invoice `draft → sent` and is rejected once already sent.
- [ ] Branding is tenant-configurable (logo/name at minimum).

## Comments
