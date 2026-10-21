import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";

export type TestCustomer = {
  email: string;
  token: string;
  accountNumber?: string;
};

export function entriesIn(value: unknown): Array<[string, unknown]> {
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

export function objectsIn(value: unknown): Array<Record<string, unknown>> {
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

export function expectError(
  response: request.Response,
  status: number,
  code: string,
): void {
  expect(response.status).toBe(status);
  expect(response.body).toMatchObject({
    error: {
      code,
      message: expect.any(String),
    },
  });
}

export function expectAmountAndType(
  body: unknown,
  type: string,
  amountCents: number,
): Record<string, unknown> {
  const transaction = objectsIn(body).find((entry) => entry.type === type);
  expect(transaction).toBeDefined();
  expect(transaction?.amountCents ?? transaction?.amount).toBe(amountCents);
  return transaction as Record<string, unknown>;
}

export function expectBalance(body: unknown, expectedCents: number): void {
  expect(entriesIn(body).some(
    ([key, value]) =>
      /balanceCents|checkingBalance|balance/i.test(key) &&
      value === expectedCents,
  )).toBe(true);
}

export async function createCustomer(name = "Money Test Customer"): Promise<TestCustomer> {
  const credentials = {
    name,
    email: `money-${randomUUID()}@example.com`,
    password: "correct-horse-battery",
  };
  const registration = await request(app)
    .post("/api/auth/register")
    .send(credentials);
  expect(registration.status).toBe(201);

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: credentials.email, password: credentials.password });
  expect(login.status).toBe(200);

  const token = entriesIn(login.body).find(([key, value]) =>
    /token/i.test(key) && typeof value === "string" && value.length > 0,
  )?.[1];
  expect(typeof token).toBe("string");

  const accountNumber = entriesIn(registration.body).find(([key, value]) =>
    /accountNumber/i.test(key) && typeof value === "string" && /^\d{10}$/.test(value),
  )?.[1];

  return {
    email: credentials.email,
    token: token as string,
    accountNumber: accountNumber as string | undefined,
  };
}

export function authorizedGet(path: string, customer: TestCustomer): request.Test {
  return request(app)
    .get(path)
    .set("Authorization", `Bearer ${customer.token}`);
}

export function authorizedPost(
  path: string,
  customer: TestCustomer,
  body: Record<string, unknown>,
): request.Test {
  return request(app)
    .post(path)
    .set("Authorization", `Bearer ${customer.token}`)
    .send(body);
}

export async function deposit(
  customer: TestCustomer,
  amountCents: number,
  memo?: string,
): Promise<request.Response> {
  const body: Record<string, unknown> = { amountCents };
  if (memo !== undefined) {
    body.memo = memo;
  }
  const response = await authorizedPost(
    "/api/accounts/me/deposits",
    customer,
    body,
  );
  expect([200, 201]).toContain(response.status);
  return response;
}

export async function drawLoan(
  customer: TestCustomer,
  amountCents: number,
): Promise<request.Response> {
  const response = await authorizedPost(
    "/api/loans/draws",
    customer,
    { amountCents },
  );
  expect([200, 201]).toContain(response.status);
  return response;
}

export async function payLoan(
  customer: TestCustomer,
  amountCents: number,
): Promise<request.Response> {
  const response = await authorizedPost(
    "/api/loans/payments",
    customer,
    { amountCents },
  );
  return response;
}

export async function withdraw(
  customer: TestCustomer,
  amountCents: number,
): Promise<request.Response> {
  const response = await authorizedPost(
    "/api/accounts/me/withdrawals",
    customer,
    { amountCents },
  );
  expect([200, 201]).toContain(response.status);
  return response;
}

export async function createCustomerWithCheckingBalance(
  balanceCents: number,
  name?: string,
): Promise<TestCustomer> {
  const customer = await createCustomer(name);
  let remainingCents = balanceCents;
  while (remainingCents > 0) {
    const amountCents = Math.min(remainingCents, 1_000_000);
    await deposit(customer, amountCents);
    remainingCents -= amountCents;
  }
  return customer;
}

export function centsFromCurrency(currency: string): number {
  const normalized = currency.trim().replace(/^\$/, "").replace(/,/g, "");
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) {
    throw new Error(`Invalid currency literal in test scenario: ${currency}`);
  }
  const [, sign, dollars, fraction = ""] = match;
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  return sign === "-" ? -cents : cents;
}
