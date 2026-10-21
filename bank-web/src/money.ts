const MAX_TRANSACTION_CENTS = 1_000_000;

function parsePositiveAmountToCents(input: string, transaction: string): number {
  const value = input.trim().replace(/^\$/, "");
  const validCurrency =
    /^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/;

  if (!validCurrency.test(value)) {
    throw new Error("Enter a valid amount with no more than two decimal places.");
  }

  const [dollars, fraction = ""] = value.replace(/,/g, "").split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error(`${transaction} amount must be greater than $0.00.`);
  }
  return cents;
}

function parseTransactionAmountToCents(input: string, transaction: string): number {
  const cents = parsePositiveAmountToCents(input, transaction);
  if (cents > MAX_TRANSACTION_CENTS) {
    throw new Error(`${transaction} amount cannot exceed $10,000.00.`);
  }
  return cents;
}

export function parseDepositAmountToCents(input: string): number {
  return parseTransactionAmountToCents(input, "Deposit");
}

export function parseWithdrawalAmountToCents(input: string): number {
  return parseTransactionAmountToCents(input, "Withdrawal");
}

export function parseLoanAmountToCents(input: string): number {
  return parsePositiveAmountToCents(input, "Borrow");
}

export function parseLoanPaymentAmountToCents(input: string): number {
  return parsePositiveAmountToCents(input, "Payment");
}

export function formatCentsAsCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
