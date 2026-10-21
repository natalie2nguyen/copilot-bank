import { describe, expect, it } from "vitest";
import {
  authorizedGet,
  authorizedPost,
  createCustomer,
  createCustomerWithCheckingBalance,
  drawLoan,
  entriesIn,
  expectAmountAndType,
  expectBalance,
  expectError,
  objectsIn,
  withdraw,
} from "./money-test-support.js";

const drawPath = "/api/loans/draws";
const loanBalancePath = "/api/loans/balance";
const checkingBalancePath = "/api/accounts/me/balance";
const transactionsPath = "/api/accounts/me/transactions";

describe("borrow funds", () => {
  it("adds a loan draw to checking and loan balances and records it (05-borrow-funds.feature: Borrow within the available credit)", async () => {
    const customer = await createCustomerWithCheckingBalance(10_000);
    const response = await authorizedPost(drawPath, customer, { amountCents: 25_000 });

    expect([200, 201]).toContain(response.status);
    const checking = await authorizedGet(checkingBalancePath, customer);
    expect(checking.status).toBe(200);
    expectBalance(checking.body, 35_000);
    const loanBalance = await authorizedGet(loanBalancePath, customer);
    expect(loanBalance.status).toBe(200);
    expect(entriesIn(loanBalance.body).some(
      ([key, value]) => /loanBalanceCents|loanBalance/i.test(key) && value === 25_000,
    )).toBe(true);
    const transactions = await authorizedGet(transactionsPath, customer);
    expect(transactions.status).toBe(200);
    expectAmountAndType(transactions.body, "LOAN_DRAW", 25_000);
  });

  it("allows borrowing the remaining available credit (05-borrow-funds.feature: Borrow the remaining available credit)", async () => {
    const customer = await createCustomer();
    await drawLoan(customer, 475_000);
    const response = await authorizedPost(drawPath, customer, { amountCents: 25_000 });

    expect([200, 201]).toContain(response.status);
    const loanBalance = await authorizedGet(loanBalancePath, customer);
    expect(entriesIn(loanBalance.body).some(
      ([key, value]) => /loanBalanceCents|loanBalance/i.test(key) && value === 500_000,
    )).toBe(true);
  });

  it("rejects a draw above the credit limit without changing balances (05-borrow-funds.feature: Reject a borrow that exceeds the credit limit)", async () => {
    const customer = await createCustomerWithCheckingBalance(10_000);
    await drawLoan(customer, 475_000);
    await withdraw(customer, 475_000);
    const rejected = await authorizedPost(drawPath, customer, { amountCents: 25_001 });

    expectError(rejected, 422, "CREDIT_LIMIT_EXCEEDED");
    expect(objectsIn(rejected.body).some((entry) => entry.type === "LOAN_DRAW")).toBe(false);

    const checking = await authorizedGet(checkingBalancePath, customer);
    expect(checking.status).toBe(200);
    expectBalance(checking.body, 10_000);
    const loanBalance = await authorizedGet(loanBalancePath, customer);
    expect(loanBalance.status).toBe(200);
    expect(entriesIn(loanBalance.body).some(
      ([key, value]) => /loanBalanceCents|loanBalance/i.test(key) && value === 475_000,
    )).toBe(true);
    const transactions = await authorizedGet(transactionsPath, customer);
    expect(transactions.status).toBe(200);
    const loanDraws = objectsIn(transactions.body).filter(
      (entry) => entry.type === "LOAN_DRAW",
    );
    expect(loanDraws).toHaveLength(1);
    expect(loanDraws[0].amountCents ?? loanDraws[0].amount).toBe(475_000);
  });
});
