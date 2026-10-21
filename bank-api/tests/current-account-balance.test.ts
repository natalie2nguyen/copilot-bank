import { describe, expect, it } from "vitest";
import {
  authorizedGet,
  authorizedPost,
  createCustomer,
  createCustomerWithCheckingBalance,
  deposit,
  drawLoan,
  entriesIn,
  withdraw,
} from "./money-test-support.js";

const balancePath = "/api/accounts/me/balance";

describe("current account balance", () => {
  it("returns checking balance in cents and formatted currency (09-current-account-balance.feature: Return the checking balance in cents and formatted currency)", async () => {
    const customer = await createCustomerWithCheckingBalance(123_456);
    const response = await authorizedGet(balancePath, customer);

    expect(response.status).toBe(200);
    expect(entriesIn(response.body)).toContainEqual(["balanceCents", 123_456]);
    expect(entriesIn(response.body)).toContainEqual(["formattedBalance", "$1,234.56"]);
  });

  it("matches checking balance to the effects of mixed transactions (09-current-account-balance.feature: Balance equals the sum of transaction effects)", async () => {
    const customer = await createCustomerWithCheckingBalance(20_000);
    await deposit(customer, 5_000);
    await withdraw(customer, 2_500);
    await drawLoan(customer, 3_000);
    await authorizedPost(
      "/api/loans/payments",
      customer,
      { amountCents: 1_000 },
    );
    const otherCustomer = await createCustomerWithCheckingBalance(1_000);
    const wireOut = await authorizedPost("/api/wires", customer, {
      recipientAccountNumber: otherCustomer.accountNumber,
      amountCents: 500,
    });
    expect([200, 201]).toContain(wireOut.status);
    const wireIn = await authorizedPost("/api/wires", otherCustomer, {
      recipientAccountNumber: customer.accountNumber,
      amountCents: 300,
    });
    expect([200, 201]).toContain(wireIn.status);

    const response = await authorizedGet(balancePath, customer);
    expect(response.status).toBe(200);
    expect(entriesIn(response.body)).toContainEqual(["balanceCents", 24_300]);
  });
});
