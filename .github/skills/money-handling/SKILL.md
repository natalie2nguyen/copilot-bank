---
name: money-handling
description: "Handle banking amounts safely in TypeScript. Use when parsing user-entered currency, validating transaction amounts, converting dollars to cents, or writing money-related tests."
---

# Money Handling

Use these rules when implementing or testing money-related behavior in this
banking application.

## Core Rules

- Represent money in calculations, application state, and API data as integer
  cents. For example, `$10.50` is `1050`.
- Convert a decimal currency string to cents once, at the input boundary.
  Never use floating-point dollar values for calculations, and never convert
  values that are already cents a second time.
- Format cents as currency only for display.
- Accept no more than two decimal places on currency input. Do not silently
  round or truncate extra decimal places.
- Transaction amounts must be positive. Reject zero and negative amounts.
- The current maximum for a single deposit, withdrawal, or wire is `$10,000.00`
  (`1_000_000` cents). Apply that limit only to the transaction types covered
  by the project specification; do not assume it applies to unrelated money
  operations.
- Validate API input with the project's Zod schemas before database access.
  When an API receives an amount already expressed in cents, validate it as an
  integer in cents; do not parse it as dollars.
- Follow the project error response contract for invalid API input:
  `{ "error": { "code": "ERROR_CODE", "message": "Error message" } }`.

## Parsing Currency Input

Use a decimal string as input rather than a JavaScript `number`, so the
conversion does not depend on binary floating-point arithmetic. The following
example accepts an optional dollar sign and correctly grouped thousands
separators. Adapt naming or error handling to existing project conventions.

```ts
const MAX_TRANSACTION_CENTS = 1_000_000;

export function parseTransactionAmountToCents(input: string): number {
  const value = input.trim().replace(/^\$/, "");
  const validCurrency =
    /^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/;

  if (!validCurrency.test(value)) {
    throw new Error("Enter a valid amount with no more than two decimal places.");
  }

  const [dollars, fraction = ""] = value.replace(/,/g, "").split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  if (cents > MAX_TRANSACTION_CENTS) {
    throw new Error("Amount exceeds the maximum transaction size.");
  }

  return cents;
}
```

Do not swallow parsing or validation errors. At an API boundary, translate
them into the project's standard error response. Keep business behavior
scenario-driven: do not add a new limit or input rule unless the feature or
project specification requires it.

## Tests to Follow

Use Vitest and follow the existing test structure. Cover conversion,
boundaries, and invalid input. These are example expectations for the helper
above:

```ts
import { describe, expect, it } from "vitest";
import { parseTransactionAmountToCents } from "./money";

describe("parseTransactionAmountToCents", () => {
  it.each([
    ["0.01", 1],
    ["12", 1200],
    ["12.3", 1230],
    ["$12.34", 1234],
    ["$1,234.56", 123456],
    ["$10,000.00", 1_000_000],
  ] as const)("converts %s to %i cents", (input, expected) => {
    expect(parseTransactionAmountToCents(input)).toBe(expected);
  });

  it.each([
    "0",
    "0.00",
    "-1.00",
    "$10,000.01",
    "1.234",
    "1,23.45",
    "1e2",
    "",
  ])("rejects invalid amount %s", (input) => {
    expect(() => parseTransactionAmountToCents(input)).toThrow();
  });
});
```

For API schemas that receive integer cents, add separate tests for non-integer,
zero, negative, and over-limit values where those constraints apply. Keep
feature scenarios and existing tests unchanged to force a pass; if an
expectation conflicts with the feature, resolve the feature first.
