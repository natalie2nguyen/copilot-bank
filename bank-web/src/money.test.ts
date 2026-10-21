import { describe, expect, it } from "vitest";
import { parseDepositAmountToCents } from "./money";

describe("parseDepositAmountToCents", () => {
  it.each([
    ["0.01", 1],
    ["$40.25", 4_025],
    ["10,000.00", 1_000_000],
    ["$10,000.00", 1_000_000],
  ] as const)("converts %s to %i cents", (input, expectedCents) => {
    expect(parseDepositAmountToCents(input)).toBe(expectedCents);
  });

  it.each([
    "0",
    "0.00",
    "-0.01",
    "$10,000.01",
    "1.234",
    "1,23.45",
    "1e2",
    "",
  ])("rejects invalid deposit amount %s", (input) => {
    expect(() => parseDepositAmountToCents(input)).toThrow();
  });
});
