const MAX_DEPOSIT_CENTS = 1_000_000;

export function parseDepositAmountToCents(input: string): number {
  const value = input.trim().replace(/^\$/, "");
  const validCurrency =
    /^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/;

  if (!validCurrency.test(value)) {
    throw new Error("Enter a valid amount with no more than two decimal places.");
  }

  const [dollars, fraction = ""] = value.replace(/,/g, "").split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("Deposit amount must be greater than $0.00.");
  }
  if (cents > MAX_DEPOSIT_CENTS) {
    throw new Error("Deposit amount cannot exceed $10,000.00.");
  }

  return cents;
}

export function formatCentsAsCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
