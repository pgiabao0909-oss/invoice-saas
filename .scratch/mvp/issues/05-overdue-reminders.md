Status: ready-for-agent
Type: task
Category: enhancement
Blocked by: 03-pdf-email-send
Source: tickets.md T4; PRD `.scratch/mvp/PRD.md`; glossary `CONTEXT.md`

# T4 — Overdue detection + reminder schedule

**What to build:** The system detects `sent` invoices that passed their due date with an
outstanding balance, flips them to `overdue`, and emails reminders to the client on a
simple schedule.

**Acceptance criteria**

- [ ] A scheduled check flips `sent → overdue` when due date passes and balance remains.
- [ ] Reminder emails go out on a day-1 / day-7 / day-14-after-due schedule.
- [ ] No reminders sent for `paid` or `void` invoices.
- [ ] Overdue transition and reminders are tenant-scoped.

## Comments
