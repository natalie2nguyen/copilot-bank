import { randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import express, { type Request, type Response } from "express";
import { z } from "zod";

const app = express();
app.use(express.json());

const CREDIT_LIMIT_CENTS = 500_000;
const MAX_TRANSACTION_CENTS = 1_000_000;

type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "LOAN_DRAW";

type Transaction = {
  type: TransactionType;
  amountCents: number;
  timestamp: string;
  resultingBalanceCents: number;
  memo?: string;
};

type Customer = {
  name: string;
  email: string;
  passwordSalt: string;
  passwordHash: Buffer;
  accountNumber: string;
  balanceCents: number;
  loanBalanceCents: number;
  transactions: Transaction[];
};

const customersByEmail = new Map<string, Customer>();
const customersByToken = new Map<string, Customer>();
const registrationSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
});
const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
const transactionSchema = z.object({
  amountCents: z.number().int().positive().max(MAX_TRANSACTION_CENTS),
  memo: z.string().optional(),
});
const loanDrawSchema = z.object({
  amountCents: z.number().int().positive(),
});

function sendError(
  response: Response,
  status: number,
  code: string,
  message: string,
): void {
  response.status(status).json({ error: { code, message } });
}

function getAuthenticatedCustomer(request: Request, response: Response): Customer | undefined {
  const token = request.header("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  const customer = token ? customersByToken.get(token) : undefined;
  if (!customer) {
    sendError(response, 401, "UNAUTHORIZED", "Authentication is required.");
    return undefined;
  }
  return customer;
}

function formatCurrency(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountCents / 100);
}

function makeTransaction(
  customer: Customer,
  type: TransactionType,
  amountCents: number,
  memo?: string,
): Transaction {
  const transaction: Transaction = {
    type,
    amountCents,
    timestamp: new Date().toISOString(),
    resultingBalanceCents: customer.balanceCents,
  };
  if (memo !== undefined) {
    transaction.memo = memo;
  }
  customer.transactions.unshift(transaction);
  return transaction;
}

app.post("/api/auth/register", (request, response) => {
  const parsed = registrationSchema.safeParse(request.body);
  if (!parsed.success) {
    sendError(response, 400, "VALIDATION_ERROR", "Name, valid email, and a password of at least 8 characters are required.");
    return;
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  if (customersByEmail.has(normalizedEmail)) {
    sendError(response, 409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
    return;
  }

  let accountNumber: string;
  do {
    accountNumber = String(randomInt(1_000_000_000, 10_000_000_000));
  } while ([...customersByEmail.values()].some(
    (customer) => customer.accountNumber === accountNumber,
  ));

  const passwordSalt = randomUUID();
  const customer: Customer = {
    name,
    email: normalizedEmail,
    passwordSalt,
    passwordHash: scryptSync(password, passwordSalt, 64),
    accountNumber,
    balanceCents: 0,
    loanBalanceCents: 0,
    transactions: [],
  };
  customersByEmail.set(normalizedEmail, customer);

  response.status(201).json({
    profile: { name, email: normalizedEmail },
    account: {
      accountNumber,
      balanceCents: customer.balanceCents,
      formattedBalance: formatCurrency(customer.balanceCents),
    },
  });
});

app.post("/api/auth/login", (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    sendError(response, 401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    return;
  }

  const customer = customersByEmail.get(parsed.data.email.toLowerCase());
  const candidateHash = scryptSync(
    parsed.data.password,
    customer?.passwordSalt ?? "invalid-login-salt",
    64,
  );
  if (
    !customer ||
    !timingSafeEqual(candidateHash, customer.passwordHash)
  ) {
    sendError(response, 401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    return;
  }

  const token = randomUUID();
  customersByToken.set(token, customer);
  response.json({ token });
});

app.post("/api/accounts/me/deposits", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;

  const parsed = transactionSchema.safeParse(request.body);
  if (!parsed.success) {
    sendError(response, 400, "INVALID_AMOUNT", "Deposit must be between 1 and 1,000,000 cents.");
    return;
  }

  customer.balanceCents += parsed.data.amountCents;
  const transaction = makeTransaction(
    customer,
    "DEPOSIT",
    parsed.data.amountCents,
    parsed.data.memo,
  );
  response.status(201).json({
    newBalanceCents: customer.balanceCents,
    balanceCents: customer.balanceCents,
    transaction,
  });
});

app.post("/api/accounts/me/withdrawals", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;

  const parsed = transactionSchema.safeParse(request.body);
  if (!parsed.success) {
    sendError(response, 400, "INVALID_AMOUNT", "Withdrawal must be between 1 and 1,000,000 cents.");
    return;
  }
  if (parsed.data.amountCents > customer.balanceCents) {
    sendError(response, 422, "INSUFFICIENT_FUNDS", "Balance is too low for this withdrawal.");
    return;
  }

  customer.balanceCents -= parsed.data.amountCents;
  const transaction = makeTransaction(
    customer,
    "WITHDRAWAL",
    parsed.data.amountCents,
    parsed.data.memo,
  );
  response.status(201).json({
    newBalanceCents: customer.balanceCents,
    balanceCents: customer.balanceCents,
    transaction,
  });
});

app.post("/api/loans/draws", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;

  const parsed = loanDrawSchema.safeParse(request.body);
  if (!parsed.success) {
    sendError(response, 400, "INVALID_AMOUNT", "Borrow amount must be a positive integer number of cents.");
    return;
  }
  if (customer.loanBalanceCents + parsed.data.amountCents > CREDIT_LIMIT_CENTS) {
    sendError(response, 422, "CREDIT_LIMIT_EXCEEDED", "Borrowing this amount would exceed the credit limit.");
    return;
  }

  customer.balanceCents += parsed.data.amountCents;
  customer.loanBalanceCents += parsed.data.amountCents;
  const transaction = makeTransaction(
    customer,
    "LOAN_DRAW",
    parsed.data.amountCents,
  );
  response.status(201).json({
    balanceCents: customer.balanceCents,
    loanBalanceCents: customer.loanBalanceCents,
    transaction,
  });
});

app.get("/api/accounts/me/balance", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;
  response.json({
    balanceCents: customer.balanceCents,
    formattedBalance: formatCurrency(customer.balanceCents),
  });
});

app.get("/api/loans/balance", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;
  const availableCreditCents = CREDIT_LIMIT_CENTS - customer.loanBalanceCents;
  response.json({
    loanBalanceCents: customer.loanBalanceCents,
    formattedLoanBalance: formatCurrency(customer.loanBalanceCents),
    creditLimitCents: CREDIT_LIMIT_CENTS,
    formattedCreditLimit: formatCurrency(CREDIT_LIMIT_CENTS),
    availableCreditCents,
    formattedAvailableCredit: formatCurrency(availableCreditCents),
  });
});

app.get("/api/accounts/me/transactions", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;
  response.json({ transactions: customer.transactions });
});

app.use((_request, response) => {
  sendError(response, 404, "NOT_FOUND", "The requested resource was not found.");
});

export default app;
