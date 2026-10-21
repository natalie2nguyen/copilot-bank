import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

const registerPath = "/api/auth/register";
const loginPath = "/api/auth/login";
const depositsPath = "/api/accounts/me/deposits";
const initialBalanceCents = 10_000;

type AuthenticatedCustomer = {
  token: string;
};

function entriesIn(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return value.flatMap(entriesIn);
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, nested]) => [
      [key, nested],
      ...entriesIn(nested),
    ]);
  }
  return [];
}

function objectsIn(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.flatMap(objectsIn);
  }
  if (typeof value === "object" && value !== null) {
    return [
      value as Record<string, unknown>,
      ...Object.values(value).flatMap(objectsIn),
    ];
  }
  return [];
}

function expectDepositInResponse(
  body: unknown,
  amountCents: number,
  resultingBalanceCents: number,
): void {
  const deposit = objectsIn(body).find((value) => value.type === "DEPOSIT");
  expect(deposit).toBeDefined();
  expect(deposit?.amountCents ?? deposit?.amount).toBe(amountCents);
  expect(typeof deposit?.timestamp).toBe("string");
  expect(Number.isNaN(Date.parse(deposit?.timestamp as string))).toBe(false);
  expect(deposit?.resultingBalanceCents ?? deposit?.resultingBalance).toBe(
    resultingBalanceCents,
  );
}

async function createFundedCustomer(): Promise<AuthenticatedCustomer> {
  const credentials = {
    name: "Deposit Test Customer",
    email: `deposit-${randomUUID()}@example.com`,
    password: "correct-horse-battery",
  };

  const registration = await request(app)
    .post(registerPath)
    .send(credentials);
  expect(registration.status).toBe(201);

  const login = await request(app)
    .post(loginPath)
    .send({ email: credentials.email, password: credentials.password });
  expect(login.status).toBe(200);

  const token = entriesIn(login.body).find(([key, value]) =>
    /token/i.test(key) && typeof value === "string" && value.length > 0,
  )?.[1];
  expect(typeof token).toBe("string");

  const customer = { token: token as string };
  const funding = await request(app)
    .post(depositsPath)
    .set("Authorization", `Bearer ${customer.token}`)
    .send({ amountCents: initialBalanceCents });
  expect([200, 201]).toContain(funding.status);

  return customer;
}

function authorizedDeposit(token: string, amountCents: number, memo?: string): request.Test {
  const body: { amountCents: number; memo?: string } = { amountCents };
  if (memo !== undefined) {
    body.memo = memo;
  }

  return request(app)
    .post(depositsPath)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

describe("deposit money", () => {
  it.each([
    ["$0.01", 1],
    ["$40.25", 4_025],
    ["$10,000.00", 1_000_000],
  ] as const)(
    "deposits %s and records the exact balance and transaction (03-deposit-money.feature: Deposit a valid amount)",
    async (_formattedAmount, amountCents) => {
      const customer = await createFundedCustomer();
      const expectedBalanceCents = initialBalanceCents + amountCents;
      const response = await authorizedDeposit(customer.token, amountCents);

      expect([200, 201]).toContain(response.status);
      const responseEntries = entriesIn(response.body);
      expect(responseEntries.some(
        ([key, value]) =>
          /newBalanceCents|balanceCents|newBalance|balance/i.test(key) &&
          value === expectedBalanceCents,
      )).toBe(true);
      expectDepositInResponse(response.body, amountCents, expectedBalanceCents);
    },
  );

  it("records an optional memo on the deposit transaction (03-deposit-money.feature: Record an optional memo with a deposit)", async () => {
    const customer = await createFundedCustomer();
    const response = await authorizedDeposit(customer.token, 2_500, "Paycheck");

    expect([200, 201]).toContain(response.status);
    const deposit = objectsIn(response.body).find((value) => value.type === "DEPOSIT");
    expect(deposit?.memo).toBe("Paycheck");
  });

  it.each([
    ["$0.00", 0],
    ["-$0.01", -1],
    ["$10,000.01", 1_000_001],
  ] as const)(
    "rejects %s without changing the balance or recording a transaction (03-deposit-money.feature: Reject an amount outside the allowed deposit range)",
    async (_formattedAmount, amountCents) => {
      const customer = await createFundedCustomer();
      const rejected = await authorizedDeposit(customer.token, amountCents);

      expect(rejected.status).toBe(400);
      expect(rejected.body).toMatchObject({
        error: {
          code: "INVALID_AMOUNT",
          message: expect.any(String),
        },
      });
      expect(objectsIn(rejected.body).some(
        (transaction) => transaction.type === "DEPOSIT",
      )).toBe(false);

      const followUp = await authorizedDeposit(customer.token, 1);
      expect([200, 201]).toContain(followUp.status);
      expect(entriesIn(followUp.body).some(
        ([key, value]) =>
          /newBalanceCents|balanceCents|newBalance|balance/i.test(key) &&
          value === initialBalanceCents + 1,
      )).toBe(true);
    },
  );
});
