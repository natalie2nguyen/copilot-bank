import { describe, expect, it } from "vitest";
import {
  parseDepositAmountToCents,
  parseLoanAmountToCents,
  parseLoanPaymentAmountToCents,
  parseWithdrawalAmountToCents,
} from "./money";

describe("parseDepositAmountToCents", () => {
  it.each([
    ["0.01", 1],
    ["$40.25", 4_025],
    ["10,000.00", 1_000_000],
    ["$10,000.00", 1_000_000],
  ] as const)("converts %s to %i cents", (input, expectedCents) => {
    expect(parseDepositAmountToCents(input)).toBe(expectedCents);
  });

  describe("parseWithdrawalAmountToCents", () => {
    it.each([
      ["0.01", 1],
      ["$40.25", 4_025],
      ["$10,000.00", 1_000_000],
    ] as const)("converts %s to %i cents", (input, expectedCents) => {
      expect(parseWithdrawalAmountToCents(input)).toBe(expectedCents);
    });

    it.each([
      "0.00",
      "-0.01",
      "$10,000.01",
      "1.234",
      "1,23.45",
      "",
    ])("rejects invalid withdrawal amount %s", (input) => {
      expect(() => parseWithdrawalAmountToCents(input)).toThrow();
    });
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

  describe("parseLoanAmountToCents", () => {
    it.each([
      ["0.01", 1],
      ["$250.00", 25_000],
      ["$5,000.00", 500_000],
      ["$10,000.01", 1_000_001],
    ] as const)("converts %s to %i cents without a transaction cap", (input, expectedCents) => {
      expect(parseLoanAmountToCents(input)).toBe(expectedCents);
    });

    it.each(["0", "-1.00", "1.234", "1,23.45", "", "999999999999999999"])(
      "rejects invalid borrow amount %s",
      (input) => {
        expect(() => parseLoanAmountToCents(input)).toThrow();
      },
    );
  });

  describe("parseLoanPaymentAmountToCents", () => {
    it.each([
      ["0.01", 1],
      ["$100.00", 10_000],
      ["$10,000.01", 1_000_001],
    ] as const)("converts %s to %i cents without a transaction cap", (input, expectedCents) => {
      expect(parseLoanPaymentAmountToCents(input)).toBe(expectedCents);
    });

    it.each(["0", "-1.00", "1.234", "1,23.45", "", "999999999999999999"])(
      "rejects invalid payment amount %s",
      (input) => {
        expect(() => parseLoanPaymentAmountToCents(input)).toThrow();
      },
    );
  });
});
