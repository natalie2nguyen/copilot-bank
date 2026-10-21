import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

const registerPath = "/api/auth/register";
const loginPath = "/api/auth/login";

const validRegistration = {
  name: "Taylor Example",
  email: "taylor@example.com",
  password: "correct-horse-battery",
};

function valuesIn(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap(valuesIn);
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(valuesIn);
  }
  return [value];
}

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

describe("registration and account creation", () => {
  it("registers a profile without an address and creates a zero-balance account (01-register.feature: Register successfully without an address)", async () => {
    const response = await request(app)
      .post(registerPath)
      .send(validRegistration);

    expect(response.status).toBe(201);
    expect(valuesIn(response.body)).toContain(validRegistration.name);
    expect(valuesIn(response.body)).toContain(validRegistration.email);
    expect(valuesIn(response.body).some(
      (value) => typeof value === "string" && /^\d{10}$/.test(value),
    )).toBe(true);
    expect(entriesIn(response.body).some(
      ([key, value]) => /balance/i.test(key) && value === 0,
    )).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(validRegistration.password);
  });

  it.each(["name", "email", "password"] as const)(
    "rejects registration without %s (01-register.feature: Registration requires name, email, and password)",
    async (field) => {
      const payload: Record<string, string> = { ...validRegistration };
      delete payload[field];

      const response = await request(app).post(registerPath).send(payload);

      expect([400, 422]).toContain(response.status);
      expect(response.body).toMatchObject({
        error: {
          code: expect.any(String),
          message: expect.any(String),
        },
      });
    },
  );

  it("rejects an invalid email format (01-register.feature: Reject an invalid email during registration)", async () => {
    const response = await request(app)
      .post(registerPath)
      .send({ ...validRegistration, email: "not-an-email" });

    expect([400, 422]).toContain(response.status);
    expect(response.body).toMatchObject({
      error: {
        code: expect.any(String),
        message: expect.any(String),
      },
    });
  });

  it("rejects duplicate email addresses regardless of case (01-register.feature: Reject a duplicate email regardless of letter case)", async () => {
    const first = await request(app)
      .post(registerPath)
      .send({ ...validRegistration, email: "Taylor@example.com" });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post(registerPath)
      .send({ ...validRegistration, email: "taylor@EXAMPLE.com" });

    expect(duplicate.status).toBe(409);
  });

  it("rejects a password shorter than 8 characters (01-register.feature: Reject a password shorter than 8 characters)", async () => {
    const response = await request(app)
      .post(registerPath)
      .send({ ...validRegistration, password: "short7!" });

    expect([400, 422]).toContain(response.status);
    expect(response.body).toMatchObject({
      error: {
        code: expect.any(String),
        message: expect.any(String),
      },
    });
  });
});

describe("login", () => {
  it("returns an authentication token for valid credentials (01-register.feature: Log in successfully)", async () => {
    const registration = await request(app)
      .post(registerPath)
      .send(validRegistration);
    expect(registration.status).toBe(201);

    const response = await request(app)
      .post(loginPath)
      .send({
        email: validRegistration.email,
        password: validRegistration.password,
      });

    expect(response.status).toBe(200);
    expect(entriesIn(response.body).some(
      ([key, value]) => /token/i.test(key) && typeof value === "string" && value.length > 0,
    )).toBe(true);
  });

  it.each(["email", "password"] as const)(
    "rejects an incorrect %s with a generic 401 message (01-register.feature: Reject login with incorrect credentials generically)",
    async (credential) => {
      const registration = await request(app)
        .post(registerPath)
        .send(validRegistration);
      expect(registration.status).toBe(201);

      const incorrectCredentials = {
        email: validRegistration.email,
        password: validRegistration.password,
      };
      if (credential === "email") {
        incorrectCredentials.email = "wrong@example.com";
      } else {
        incorrectCredentials.password = "wrong-password";
      }

      const response = await request(app)
        .post(loginPath)
        .send(incorrectCredentials);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: {
          code: expect.any(String),
          message: expect.any(String),
        },
      });
      expect(response.body.error.message).not.toMatch(/email|password/i);
    },
  );
});
