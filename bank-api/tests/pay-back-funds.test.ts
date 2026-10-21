import { describe, expect, it } from "vitest";
import {
  authorizedGet,
  createCustomer,
  createCustomerWithCheckingBalance,
  drawLoan,
  entriesIn,
  expectAmountAndType,
  expectBalance,
  expectError,
  objectsIn,
  payLoan,
  withdraw,
} from "./money-test-support.js";

const loanBalancePath = "/api/loans/balance";
const checkingBalancePath = "/api/accounts/me/balance";
const transactionsPath = "/api/accounts/me/transactions";

async function expectBalances(
  customer: Awaited<ReturnType<typeof createCustomer>>,
  checkingCents: number,
  loanCents: number,
): Promise<void> {
  const [checking, loan] = await Promise.all([
    authorizedGet(checkingBalancePath, customer),
    authorizedGet(loanBalancePath, customer),
  ]);
  expect(checking.status).toBe(200);
  expectBalance(checking.body, checkingCents);
  expect(loan.status).toBe(200);
  expect(entriesIn(loan.body).some(
    ([key, value]) => /loanBalanceCents|loanBalance/i.test(key) && value === loanCents,
  )).toBe(true);
}

describe("pay back borrowed funds", () => {
  it("deducts a payment from checking and loan balances (06-pay-back-funds.feature: Make a loan payment)", async () => {
    const customer = await createCustomerWithCheckingBalance(20_000);
    await drawLoan(customer, 30_000);
    const response = await payLoan(customer, 10_000);

    expect([200, 201]).toContain(response.status);
    await expectBalances(customer, 40_000, 20_000);
    const transactions = await authorizedGet(transactionsPath, customer);
    expect(transactions.status).toBe(200);
    expectAmountAndType(transactions.body, "LOAN_PAYMENT", 10_000);
  });

  it("rejects a payment above the loan balance (06-pay-back-funds.feature: Reject a payment greater than the outstanding loan balance)", async () => {
    const customer = await createCustomerWithCheckingBalance(40_000);
    await drawLoan(customer, 10_000);
    const rejected = await payLoan(customer, 10_001);

    expectError(rejected, 422, "OVERPAYMENT");
    await expectBalances(customer, 50_000, 10_000);
    const transactions = await authorizedGet(transactionsPath, customer);
    expect(objectsIn(transactions.body).some(
      (transaction) => transaction.type === "LOAN_PAYMENT",
    )).toBe(false);
  });

  it("rejects a payment above the checking balance (06-pay-back-funds.feature: Reject a payment greater than the checking balance)", async () => {
    const customer = await createCustomerWithCheckingBalance(10_000);
    await drawLoan(customer, 30_000);
    await withdraw(customer, 30_000);
    const rejected = await payLoan(customer, 10_001);

    expectError(rejected, 422, "INSUFFICIENT_FUNDS");
    await expectBalances(customer, 10_000, 30_000);
    const transactions = await authorizedGet(transactionsPath, customer);
    expect(objectsIn(transactions.body).some(
      (transaction) => transaction.type === "LOAN_PAYMENT",
    )).toBe(false);
  });

  it("rejects a payment when there is no outstanding loan (06-pay-back-funds.feature: Reject a payment when there is no outstanding loan)", async () => {
    const customer = await createCustomer();
    const rejected = await payLoan(customer, 1);

    expectError(rejected, 422, "NO_OUTSTANDING_LOAN");
    await expectBalances(customer, 0, 0);
    const transactions = await authorizedGet(transactionsPath, customer);
    expect(objectsIn(transactions.body).some(
      (transaction) => transaction.type === "LOAN_PAYMENT",
    )).toBe(false);
  });

  it("allows the full loan balance to be repaid (06-pay-back-funds.feature: Pay the full outstanding loan balance using the shortcut)", async () => {
    const customer = await createCustomerWithCheckingBalance(20_000);
    await drawLoan(customer, 30_000);
    const response = await payLoan(customer, 30_000);

    expect([200, 201]).toContain(response.status);
    await expectBalances(customer, 20_000, 0);
    const transactions = await authorizedGet(transactionsPath, customer);
    expect(transactions.status).toBe(200);
    expectAmountAndType(transactions.body, "LOAN_PAYMENT", 30_000);
  });
});
