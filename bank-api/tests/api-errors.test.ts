import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("API error responses", () => {
  it("returns malformed JSON errors using the standard response shape", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "INVALID_JSON",
        message: expect.any(String),
      },
    });
  });
});
