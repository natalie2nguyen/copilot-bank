import { describe, expect, it } from "vitest";
import {
  authorizedGet,
  createCustomer,
  drawLoan,
  entriesIn,
} from "./money-test-support.js";

const loanBalancePath = "/api/loans/balance";

describe("current borrowing balance", () => {
  it("returns loan balance, credit limit, and available credit in cents and formatted currency (10-current-borrowing-balance.feature: Return loan balance, credit limit, and available credit)", async () => {
    const customer = await createCustomer();
    await drawLoan(customer, 125_000);
    const response = await authorizedGet(loanBalancePath, customer);

    expect(response.status).toBe(200);
    for (const [key, value] of [
      ["loanBalanceCents", 125_000],
      ["formattedLoanBalance", "$1,250.00"],
      ["creditLimitCents", 500_000],
      ["formattedCreditLimit", "$5,000.00"],
      ["availableCreditCents", 375_000],
      ["formattedAvailableCredit", "$3,750.00"],
    ]) {
      expect(entriesIn(response.body)).toContainEqual([key, value]);
    }
  });
});
