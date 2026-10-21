import { describe, expect, it } from "vitest";
import {
  authorizedGet,
  authorizedPost,
  createCustomer,
  createCustomerWithCheckingBalance,
  entriesIn,
  expectAmountAndType,
  expectBalance,
  expectError,
  objectsIn,
} from "./money-test-support.js";

const wiresPath = "/api/wires";
const balancePath = "/api/accounts/me/balance";
const transactionsPath = "/api/accounts/me/transactions";

function accountNumber(customer: Awaited<ReturnType<typeof createCustomer>>): string {
  expect(customer.accountNumber).toMatch(/^\d{10}$/);
  return customer.accountNumber as string;
}

describe("send a wire", () => {
  it("debits sender, credits recipient, and records linked wire transactions (07-send-wire.feature: Send a wire successfully)", async () => {
    const sender = await createCustomerWithCheckingBalance(50_000, "Wire Sender");
    const recipient = await createCustomerWithCheckingBalance(10_000, "Wire Recipient");
    const recipientAccount = accountNumber(recipient);
    const response = await authorizedPost(wiresPath, sender, {
      recipientAccountNumber: recipientAccount,
      amountCents: 7_525,
      memo: "Rent",
    });

    expect([200, 201]).toContain(response.status);
    const senderTransactions = await authorizedGet(transactionsPath, sender);
    const recipientTransactions = await authorizedGet(transactionsPath, recipient);
    expect(senderTransactions.status).toBe(200);
    expect(recipientTransactions.status).toBe(200);
    const outgoing = expectAmountAndType(senderTransactions.body, "WIRE_OUT", 7_525);
    const wireId = outgoing.wireId ?? outgoing.wire_id;
    expect(wireId).toBeTruthy();
    expect(outgoing.memo).toBe("Rent");
    const incoming = objectsIn(recipientTransactions.body).find(
      (transaction) => transaction.type === "WIRE_IN",
    );
    expect(incoming).toBeDefined();
    expect(incoming?.amountCents ?? incoming?.amount).toBe(7_525);
    expect(incoming?.wireId ?? incoming?.wire_id).toBe(wireId);
    expect(incoming?.memo).toBe("Rent");

    const recipientBalance = await authorizedGet(balancePath, recipient);
    expect(recipientBalance.status).toBe(200);
    expectBalance(recipientBalance.body, 17_525);
  });

  it("sends a wire without a memo (07-send-wire.feature: Send a wire without an optional memo)", async () => {
    const sender = await createCustomerWithCheckingBalance(50_000, "Wire Sender");
    const recipient = await createCustomer("Wire Recipient");
    const response = await authorizedPost(wiresPath, sender, {
      recipientAccountNumber: accountNumber(recipient),
      amountCents: 7_525,
    });

    expect([200, 201]).toContain(response.status);
    const senderTransactions = await authorizedGet(transactionsPath, sender);
    expect(senderTransactions.status).toBe(200);
    expectAmountAndType(senderTransactions.body, "WIRE_OUT", 7_525);
    const recipientTransactions = await authorizedGet(transactionsPath, recipient);
    expect(recipientTransactions.status).toBe(200);
    expect(objectsIn(recipientTransactions.body).some(
      (transaction) => transaction.type === "WIRE_IN",
    )).toBe(true);
  });

  it("rejects a wire to an unknown recipient (07-send-wire.feature: Reject a wire to a nonexistent account)", async () => {
    const sender = await createCustomerWithCheckingBalance(50_000);
    const response = await authorizedPost(wiresPath, sender, {
      recipientAccountNumber: "0000000000",
      amountCents: 7_525,
    });

    expectError(response, 404, "RECIPIENT_NOT_FOUND");
    expect(objectsIn(response.body).some(
      (transaction) => transaction.type === "WIRE_OUT",
    )).toBe(false);
    const balance = await authorizedGet(balancePath, sender);
    expect(balance.status).toBe(200);
    expectBalance(balance.body, 50_000);
  });

  it("rejects a wire to the sender's own account (07-send-wire.feature: Reject a wire to my own account)", async () => {
    const sender = await createCustomerWithCheckingBalance(50_000);
    const response = await authorizedPost(wiresPath, sender, {
      recipientAccountNumber: accountNumber(sender),
      amountCents: 7_525,
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: { code: expect.any(String), message: expect.any(String) },
    });
    const balance = await authorizedGet(balancePath, sender);
    expect(balance.status).toBe(200);
    expectBalance(balance.body, 50_000);
  });

  it("rejects a wire with insufficient funds without crediting the recipient (07-send-wire.feature: Reject a wire when I have insufficient funds)", async () => {
    const sender = await createCustomerWithCheckingBalance(5_000, "Wire Sender");
    const recipient = await createCustomerWithCheckingBalance(10_000, "Wire Recipient");
    const response = await authorizedPost(wiresPath, sender, {
      recipientAccountNumber: accountNumber(recipient),
      amountCents: 5_001,
    });

    expectError(response, 422, "INSUFFICIENT_FUNDS");
    const [senderBalance, recipientBalance] = await Promise.all([
      authorizedGet(balancePath, sender),
      authorizedGet(balancePath, recipient),
    ]);
    expect(senderBalance.status).toBe(200);
    expect(recipientBalance.status).toBe(200);
    expectBalance(senderBalance.body, 5_000);
    expectBalance(recipientBalance.body, 10_000);
  });

  it.each([
    ["$0.00", 0],
    ["-$0.01", -1],
    ["$10,000.01", 1_000_001],
  ] as const)(
    "rejects a wire of %s as INVALID_AMOUNT (07-send-wire.feature: Reject a wire amount outside the allowed range)",
    async (_formattedAmount, amountCents) => {
      const sender = await createCustomerWithCheckingBalance(50_000, "Wire Sender");
      const recipient = await createCustomer("Wire Recipient");
      const response = await authorizedPost(wiresPath, sender, {
        recipientAccountNumber: accountNumber(recipient),
        amountCents,
      });

      expectError(response, 400, "INVALID_AMOUNT");
      expect(objectsIn(response.body).some(
        (transaction) => transaction.type === "WIRE_OUT",
      )).toBe(false);
      const balance = await authorizedGet(balancePath, sender);
      expect(balance.status).toBe(200);
      expectBalance(balance.body, 50_000);
    },
  );

});
