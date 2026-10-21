import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

const registerPath = "/api/auth/register";
const loginPath = "/api/auth/login";
const depositsPath = "/api/accounts/me/deposits";
const withdrawalsPath = "/api/accounts/me/withdrawals";
const balancePath = "/api/accounts/me/balance";

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

function expectErrorResponse(response: request.Response, code: string): void {
  expect(response.body).toMatchObject({
    error: {
      code,
      message: expect.any(String),
    },
  });
}

function expectBalance(response: request.Response, expectedCents: number): void {
  expect(response.status).toBe(200);
  expect(entriesIn(response.body).some(
    ([key, value]) =>
      /balanceCents|balance/i.test(key) && value === expectedCents,
  )).toBe(true);
}

async function createCustomer(): Promise<AuthenticatedCustomer> {
  const credentials = {
    name: "Withdrawal Test Customer",
    email: `withdraw-${randomUUID()}@example.com`,
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
  return { token: token as string };
}

async function deposit(token: string, amountCents: number): Promise<void> {
  const response = await request(app)
    .post(depositsPath)
    .set("Authorization", `Bearer ${token}`)
    .send({ amountCents });
  expect([200, 201]).toContain(response.status);
}

async function createFundedCustomer(balanceCents: number): Promise<AuthenticatedCustomer> {
  const customer = await createCustomer();
  let remainingCents = balanceCents;

  while (remainingCents > 0) {
    const amountCents = Math.min(remainingCents, 1_000_000);
    await deposit(customer.token, amountCents);
    remainingCents -= amountCents;
  }

  return customer;
}

function authorizedGet(path: string, token: string): request.Test {
  return request(app)
    .get(path)
    .set("Authorization", `Bearer ${token}`);
}

function withdraw(token: string, amountCents: number): request.Test {
  return request(app)
    .post(withdrawalsPath)
    .set("Authorization", `Bearer ${token}`)
    .send({ amountCents });
}

describe("withdraw money", () => {
  it.each([
    ["$0.01", 1, 10_000],
    ["$40.25", 4_025, 10_000],
    ["$10,000.00", 1_000_000, 1_010_000],
  ] as const)(
    "withdraws %s and records the withdrawal (04-withdraw-money.feature: Withdraw a valid amount)",
    async (_formattedAmount, amountCents, initialBalanceCents) => {
      const customer = await createFundedCustomer(initialBalanceCents);
      const response = await withdraw(customer.token, amountCents);

      expect([200, 201]).toContain(response.status);
      const expectedBalanceCents = initialBalanceCents - amountCents;
      expect(entriesIn(response.body).some(
        ([key, value]) =>
          /newBalanceCents|balanceCents|newBalance|balance/i.test(key) &&
          value === expectedBalanceCents,
      )).toBe(true);

      const transaction = objectsIn(response.body).find(
        (value) => value.type === "WITHDRAWAL",
      );
      expect(transaction).toBeDefined();
      expect(transaction?.amountCents ?? transaction?.amount).toBe(amountCents);
    },
  );

  it.each([
    ["$0.00", 0],
    ["-$0.01", -1],
    ["$10,000.01", 1_000_001],
  ] as const)(
    "rejects %s as an invalid withdrawal amount (04-withdraw-money.feature: Reject an amount outside the allowed withdrawal range)",
    async (_formattedAmount, amountCents) => {
      const initialBalanceCents = 2_000_000;
      const customer = await createFundedCustomer(initialBalanceCents);
      const rejected = await withdraw(customer.token, amountCents);

      expect(rejected.status).toBe(400);
      expectErrorResponse(rejected, "INVALID_AMOUNT");

      const balance = await authorizedGet(balancePath, customer.token);
      expectBalance(balance, initialBalanceCents);
    },
  );

  it("rejects a withdrawal exceeding the balance without changing it (04-withdraw-money.feature: Reject a withdrawal that exceeds my checking balance)", async () => {
    const initialBalanceCents = 2_500;
    const customer = await createFundedCustomer(initialBalanceCents);
    const rejected = await withdraw(customer.token, 2_501);

    expect(rejected.status).toBe(422);
    expectErrorResponse(rejected, "INSUFFICIENT_FUNDS");

    const balance = await authorizedGet(balancePath, customer.token);
    expectBalance(balance, initialBalanceCents);
  });
});
