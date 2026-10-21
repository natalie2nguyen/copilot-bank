---
description: "Guidelines for bank-api routes, validation, database transactions, and API responses."
applyTo: "bank-api/**"
---

- Every route validates input with zod (or Pydantic) before touching the database.
- Balance-changing operations run inside a single database transaction.
- Never return password hashes in any response.