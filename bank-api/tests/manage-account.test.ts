import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

const profilePath = "/api/me";
const avatarPath = "/api/me/avatar";
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpegSignature = Buffer.from([0xff, 0xd8, 0xff]);
let customerSequence = 0;

type Customer = {
  name: string;
  email: string;
  password: string;
  token: string;
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

function fieldValue(value: unknown, field: RegExp): unknown {
  return entriesIn(value).find(([key]) => field.test(key))?.[1];
}

function expectErrorResponse(response: request.Response): void {
  expect(response.body).toMatchObject({
    error: {
      code: expect.any(String),
      message: expect.any(String),
    },
  });
}

async function createCustomer(name = "Taylor Example"): Promise<Customer> {
  customerSequence += 1;
  const customer = {
    name,
    email: `profile-${customerSequence}@example.com`,
    password: "correct-horse-battery",
  };

  const registration = await request(app)
    .post("/api/auth/register")
    .send(customer);
  expect(registration.status).toBe(201);

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: customer.email, password: customer.password });
  expect(login.status).toBe(200);

  const token = fieldValue(login.body, /token/i);
  expect(typeof token).toBe("string");
  expect(token).not.toBe("");

  return { ...customer, token: token as string };
}

function authorized(
  method: "get" | "patch" | "put" | "delete",
  path: string,
  token: string,
): request.Test {
  return request(app)[method](path).set("Authorization", `Bearer ${token}`);
}

describe("manage account profile", () => {
  it("shows the logged-in customer's profile (02-manage-account.feature: View my profile)", async () => {
    const customer = await createCustomer();
    const response = await authorized("get", profilePath, customer.token);

    expect(response.status).toBe(200);
    expect(valuesIn(response.body)).toContain(customer.name);
    expect(valuesIn(response.body)).toContain(customer.email);
    expect(response.body.accountNumber).toMatch(/^\d{10}$/);
  });

  it("updates the customer's name (02-manage-account.feature: Update my name)", async () => {
    const customer = await createCustomer();
    const response = await authorized("patch", profilePath, customer.token)
      .send({ name: "Taylor Example Updated" });

    expect(response.status).toBe(200);
    expect(valuesIn(response.body)).toContain("Taylor Example Updated");
  });

  it("rejects a blank name and preserves the old value (02-manage-account.feature: Reject a blank name)", async () => {
    const customer = await createCustomer();
    const response = await authorized("patch", profilePath, customer.token)
      .send({ name: " " });

    expect([400, 422]).toContain(response.status);
    expectErrorResponse(response);

    const profile = await authorized("get", profilePath, customer.token);
    expect(valuesIn(profile.body)).toContain(customer.name);
  });

  it("updates the address fields (02-manage-account.feature: Update my address)", async () => {
    const customer = await createCustomer();
    const address = {
      street: "10 Main Street",
      city: "Seattle",
      state: "WA",
      postalCode: "98101",
      country: "US",
    };
    const response = await authorized("patch", profilePath, customer.token)
      .send({ address });

    expect(response.status).toBe(200);
    for (const value of Object.values(address)) {
      expect(valuesIn(response.body)).toContain(value);
    }
  });

  it("allows updating an address without a postal code (02-manage-account.feature: Save an address without a postal code)", async () => {
    const customer = await createCustomer();
    const address = {
      street: "10 Main Street",
      city: "Seattle",
      state: "WA",
      country: "US",
    };
    const response = await authorized("patch", profilePath, customer.token)
      .send({ address });

    expect(response.status).toBe(200);
    for (const value of Object.values(address)) {
      expect(valuesIn(response.body)).toContain(value);
    }
    expect(fieldValue(response.body, /postalCode/i)).toBeUndefined();
  });

  it("updates only provided address fields and preserves the rest (02-manage-account.feature: Update only some address fields)", async () => {
    const customer = await createCustomer();
    const originalAddress = {
      street: "10 Main Street",
      city: "Seattle",
      state: "WA",
      postalCode: "98101",
      country: "US",
    };
    const setup = await authorized("patch", profilePath, customer.token)
      .send({ address: originalAddress });
    expect(setup.status).toBe(200);

    const response = await authorized("patch", profilePath, customer.token)
      .send({ address: { city: "Portland", country: "US" } });
    expect(response.status).toBe(200);
    expect(valuesIn(response.body)).toContain("Portland");
    expect(valuesIn(response.body)).toContain(originalAddress.street);
    expect(valuesIn(response.body)).toContain(originalAddress.state);
    expect(valuesIn(response.body)).toContain(originalAddress.postalCode);
  });

  it("rejects a blank postal code when it is provided (02-manage-account.feature: Reject a blank postal code when one is provided)", async () => {
    const customer = await createCustomer();
    const initialAddress = { city: "Seattle", postalCode: "98101" };
    const setup = await authorized("patch", profilePath, customer.token)
      .send({ address: initialAddress });
    expect(setup.status).toBe(200);

    const response = await authorized("patch", profilePath, customer.token)
      .send({ address: { postalCode: " " } });

    expect([400, 422]).toContain(response.status);
    expectErrorResponse(response);
    const profile = await authorized("get", profilePath, customer.token);
    expect(valuesIn(profile.body)).toContain(initialAddress.postalCode);
  });

  it("updates the email address (02-manage-account.feature: Update my email)", async () => {
    const customer = await createCustomer();
    const response = await authorized("patch", profilePath, customer.token)
      .send({ email: "new-address@example.com" });

    expect(response.status).toBe(200);
    expect(valuesIn(response.body)).toContain("new-address@example.com");
  });

  it("rejects an invalid email and preserves the old value (02-manage-account.feature: Reject an invalid email update)", async () => {
    const customer = await createCustomer();
    const response = await authorized("patch", profilePath, customer.token)
      .send({ email: "not-an-email" });

    expect([400, 422]).toContain(response.status);
    expectErrorResponse(response);
    const profile = await authorized("get", profilePath, customer.token);
    expect(valuesIn(profile.body)).toContain(customer.email);
  });

  it("rejects an email used by another customer with 409 (02-manage-account.feature: Reject an email already used by another customer)", async () => {
    const customer = await createCustomer();
    const otherCustomer = await createCustomer("Other Customer");
    const response = await authorized("patch", profilePath, customer.token)
      .send({ email: otherCustomer.email });

    expect(response.status).toBe(409);
    expectErrorResponse(response);
    const profile = await authorized("get", profilePath, customer.token);
    expect(valuesIn(profile.body)).toContain(customer.email);
  });

  it("updates only provided profile fields (02-manage-account.feature: Update only the fields provided)", async () => {
    const customer = await createCustomer();
    const address = { street: "10 Main Street", city: "Seattle" };
    const setup = await authorized("patch", profilePath, customer.token)
      .send({ address });
    expect(setup.status).toBe(200);

    const response = await authorized("patch", profilePath, customer.token)
      .send({ name: "Taylor Updated" });
    expect(response.status).toBe(200);
    expect(valuesIn(response.body)).toContain("Taylor Updated");
    expect(valuesIn(response.body)).toContain(customer.email);
    expect(valuesIn(response.body)).toContain(address.street);
    expect(valuesIn(response.body)).toContain(address.city);
  });

  it.each([
    ["PNG", "image/png", 1024 * 1024],
    ["PNG", "image/png", 2 * 1024 * 1024],
    ["JPEG", "image/jpeg", 1024 * 1024],
    ["JPEG", "image/jpeg", 2 * 1024 * 1024],
  ] as const)(
    "accepts a %s profile picture (%s) of %i bytes and serves it from the profile (02-manage-account.feature: Upload a supported profile picture within the size limit)",
    async (_format, mimeType, size) => {
      const customer = await createCustomer();
      const image = Buffer.alloc(size);
      (mimeType === "image/png" ? pngSignature : jpegSignature).copy(image);
      const upload = await authorized("put", avatarPath, customer.token)
        .attach("avatar", image, { filename: "profile-image", contentType: mimeType });

      expect([200, 201]).toContain(upload.status);

      const profile = await authorized("get", profilePath, customer.token);
      expect(profile.status).toBe(200);
      expect(fieldValue(profile.body, /avatar|profilePicture/i)).toBeTruthy();
    },
  );

  it("rejects an unsupported profile picture type with 415 (02-manage-account.feature: Reject an unsupported profile picture format)", async () => {
    const customer = await createCustomer();
    const response = await authorized("put", avatarPath, customer.token)
      .attach("avatar", Buffer.from("not an image"), {
        filename: "profile.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(415);
    expectErrorResponse(response);
  });

  it("rejects image content that does not match its declared MIME type", async () => {
    const customer = await createCustomer();
    const response = await authorized("put", avatarPath, customer.token)
      .attach("avatar", Buffer.from("not a PNG"), {
        filename: "profile.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(415);
    expectErrorResponse(response);
  });

  it("rejects a profile picture larger than 2 MB with 413 (02-manage-account.feature: Reject a profile picture larger than 2 MB)", async () => {
    const customer = await createCustomer();
    const response = await authorized("put", avatarPath, customer.token)
      .attach("avatar", Buffer.alloc(2 * 1024 * 1024 + 1), {
        filename: "profile.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(413);
    expectErrorResponse(response);
  });

  it("removes the profile picture (02-manage-account.feature: Remove my profile picture)", async () => {
    const customer = await createCustomer();
    const image = Buffer.from([...pngSignature, 0x00]);
    const upload = await authorized("put", avatarPath, customer.token)
      .attach("avatar", image, {
        filename: "profile.png",
        contentType: "image/png",
      });
    expect([200, 201]).toContain(upload.status);

    const removal = await authorized("delete", avatarPath, customer.token);
    expect([200, 204]).toContain(removal.status);

    const profile = await authorized("get", profilePath, customer.token);
    expect(profile.status).toBe(200);
    expect(fieldValue(profile.body, /avatar|profilePicture/i)).toBeFalsy();
  });

  it("keeps each customer's profile scoped to their own authenticated identity (02-manage-account.feature: Prevent viewing another customer's profile)", async () => {
    const customer = await createCustomer();
    const otherCustomer = await createCustomer("Other Customer");

    const ownProfile = await authorized("get", profilePath, customer.token);
    const otherProfile = await authorized("get", profilePath, otherCustomer.token);

    expect(ownProfile.status).toBe(200);
    expect(valuesIn(ownProfile.body)).toContain(customer.name);
    expect(valuesIn(ownProfile.body)).not.toContain(otherCustomer.name);
    expect(otherProfile.status).toBe(200);
    expect(valuesIn(otherProfile.body)).toContain(otherCustomer.name);
  });

  it("keeps profile updates scoped to the authenticated customer (02-manage-account.feature: Prevent updating another customer's profile)", async () => {
    const customer = await createCustomer();
    const otherCustomer = await createCustomer("Other Customer");

    const update = await authorized("patch", profilePath, customer.token)
      .send({ name: "Changed by first customer" });
    expect(update.status).toBe(200);

    const otherProfile = await authorized("get", profilePath, otherCustomer.token);
    expect(otherProfile.status).toBe(200);
    expect(valuesIn(otherProfile.body)).toContain(otherCustomer.name);
    expect(valuesIn(otherProfile.body)).not.toContain("Changed by first customer");
  });
});
