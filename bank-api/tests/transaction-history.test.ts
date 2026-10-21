import { describe, expect, it } from "vitest";
import {
  authorizedGet,
  createCustomer,
  createCustomerWithCheckingBalance,
  deposit,
  objectsIn,
} from "./money-test-support.js";
import request from "supertest";
import app from "../src/app.js";

const transactionsPath = "/api/accounts/me/transactions";

function transactionList(body: unknown): Array<Record<string, unknown>> {
  return objectsIn(body).filter((entry) =>
    typeof entry.type === "string" &&
    ["DEPOSIT", "WITHDRAWAL", "LOAN_DRAW", "LOAN_PAYMENT", "WIRE_IN", "WIRE_OUT"]
      .includes(entry.type),
  );
}

describe("transaction history", () => {
  it("returns only the authenticated customer's transactions newest first (08-transaction-history.feature: View my transactions newest first)", async () => {
    const customer = await createCustomer();
    const otherCustomer = await createCustomer();
    await deposit(customer, 100);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await deposit(customer, 200);
    await deposit(otherCustomer, 300);

    const response = await authorizedGet(transactionsPath, customer);
    expect(response.status).toBe(200);
    const transactions = transactionList(response.body);
    expect(transactions).toHaveLength(2);
    expect(transactions.map((transaction) => transaction.amountCents ?? transaction.amount))
      .toEqual([200, 100]);
    const timestamps = transactions.map((transaction) =>
      Date.parse(transaction.timestamp as string),
    );
    expect(timestamps.every(Number.isFinite)).toBe(true);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("returns transaction type, amount, direction, timestamp, memo, and resulting balance (08-transaction-history.feature: Show the required details for each transaction)", async () => {
    const customer = await createCustomer();
    await deposit(customer, 1_234, "history-test");
    const response = await authorizedGet(transactionsPath, customer);

    expect(response.status).toBe(200);
    const transaction = transactionList(response.body).find(
      (entry) => entry.type === "DEPOSIT",
    );
    expect(transaction).toBeDefined();
    expect(transaction?.amountCents ?? transaction?.amount).toBe(1_234);
    expect(typeof transaction?.timestamp).toBe("string");
    expect(transaction?.memo).toBe("history-test");
    expect(transaction?.resultingBalanceCents ?? transaction?.resultingBalance).toBe(1_234);
    expect(typeof (transaction?.direction ?? transaction?.signedAmount)).toBe("string");
  });

  it("defaults to 20 newest transactions (08-transaction-history.feature: Use the default page size)", async () => {
    const customer = await createCustomer();
    for (let index = 0; index < 21; index += 1) {
      await deposit(customer, index + 1);
    }

    const response = await authorizedGet(transactionsPath, customer);
    expect(response.status).toBe(200);
    expect(transactionList(response.body)).toHaveLength(20);
  });

  it("supports pagination using page and pageSize query parameters (08-transaction-history.feature: View a specified page of transactions)", async () => {
    const customer = await createCustomer();
    for (let index = 0; index < 12; index += 1) {
      await deposit(customer, index + 1);
    }

    const response = await request(app)
      .get(`${transactionsPath}?page=2&pageSize=5`)
      .set("Authorization", `Bearer ${customer.token}`);
    expect(response.status).toBe(200);
    expect(transactionList(response.body)).toHaveLength(5);
  });

  it("rejects a page size larger than the supported maximum", async () => {
    const customer = await createCustomer();
    const response = await authorizedGet(
      `${transactionsPath}?pageSize=101`,
      customer,
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: expect.any(String),
      },
    });
  });

  it("filters transaction history by transaction type (08-transaction-history.feature: Filter transaction history by type)", async () => {
    const customer = await createCustomerWithCheckingBalance(1_000);
    const withdrawal = await request(app)
      .post("/api/accounts/me/withdrawals")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ amountCents: 100 });
    expect([200, 201]).toContain(withdrawal.status);
    const response = await request(app)
      .get(`${transactionsPath}?type=DEPOSIT`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(response.status).toBe(200);
    const transactions = transactionList(response.body);
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions.every((transaction) => transaction.type === "DEPOSIT")).toBe(true);
  });
});
