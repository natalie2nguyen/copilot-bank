import { randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import express, { type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";

const app = express();
app.use(express.json());

const CREDIT_LIMIT_CENTS = 500_000;
const MAX_TRANSACTION_CENTS = 1_000_000;

type TransactionType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "LOAN_DRAW"
  | "LOAN_PAYMENT"
  | "WIRE_IN"
  | "WIRE_OUT";

type Transaction = {
  type: TransactionType;
  amountCents: number;
  direction: string;
  timestamp: string;
  resultingBalanceCents: number;
  memo?: string;
  wireId?: string;
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
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  avatar?: {
    mimeType: "image/png" | "image/jpeg";
    buffer: Buffer;
  };
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
const wireSchema = z.object({
  recipientAccountNumber: z.string().regex(/^\d{10}$/),
  amountCents: z.number().int().positive().max(MAX_TRANSACTION_CENTS),
  memo: z.string().optional(),
});
const addressSchema = z.object({
  street: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  postalCode: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
}).partial();
const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  address: addressSchema.optional(),
}).refine(
  (profile) =>
    profile.name !== undefined ||
    profile.email !== undefined ||
    profile.address !== undefined,
);
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
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

function profileResponse(customer: Customer): Record<string, unknown> {
  return {
    name: customer.name,
    email: customer.email,
    ...(customer.address ? { address: customer.address } : {}),
    ...(customer.avatar ? { avatarUrl: "/api/me/avatar" } : {}),
  };
}

function makeTransaction(
  customer: Customer,
  type: TransactionType,
  amountCents: number,
  memo?: string,
  wireId?: string,
): Transaction {
  const transaction: Transaction = {
    type,
    amountCents,
    direction: type === "WITHDRAWAL" ||
      type === "LOAN_PAYMENT" ||
      type === "WIRE_OUT"
      ? `-${amountCents}`
      : `+${amountCents}`,
    timestamp: new Date().toISOString(),
    resultingBalanceCents: customer.balanceCents,
  };
  if (memo !== undefined) {
    transaction.memo = memo;
  }
  if (wireId !== undefined) {
    transaction.wireId = wireId;
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
    sendError(response, 401, "INVALID_CREDENTIALS", "Unable to sign in with those credentials.");
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
    sendError(response, 401, "INVALID_CREDENTIALS", "Unable to sign in with those credentials.");
    return;
  }

  const token = randomUUID();
  customersByToken.set(token, customer);
  response.json({ token });
});

app.get("/api/me", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;
  response.json(profileResponse(customer));
});

app.patch("/api/me", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;

  const parsed = profileUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    sendError(response, 400, "VALIDATION_ERROR", "Provide a valid name, email, or address update.");
    return;
  }

  const updatedEmail = parsed.data.email?.toLowerCase();
  if (
    updatedEmail &&
    updatedEmail !== customer.email &&
    customersByEmail.has(updatedEmail)
  ) {
    sendError(response, 409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
    return;
  }

  if (updatedEmail && updatedEmail !== customer.email) {
    customersByEmail.delete(customer.email);
    customer.email = updatedEmail;
    customersByEmail.set(updatedEmail, customer);
  }
  if (parsed.data.name !== undefined) {
    customer.name = parsed.data.name;
  }
  if (parsed.data.address !== undefined) {
    customer.address = {
      ...customer.address,
      ...parsed.data.address,
    };
  }

  response.json(profileResponse(customer));
});

app.put("/api/me/avatar", (request, response, next) => {
  if (!getAuthenticatedCustomer(request, response)) return;
  avatarUpload.single("avatar")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      sendError(response, 413, "FILE_TOO_LARGE", "Profile pictures must not exceed 2 MB.");
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
}, (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;

  if (!request.file) {
    sendError(response, 400, "VALIDATION_ERROR", "A PNG or JPEG profile picture is required.");
    return;
  }
  if (request.file.mimetype !== "image/png" && request.file.mimetype !== "image/jpeg") {
    sendError(response, 415, "UNSUPPORTED_MEDIA_TYPE", "Profile pictures must be PNG or JPEG.");
    return;
  }

  customer.avatar = {
    mimeType: request.file.mimetype,
    buffer: request.file.buffer,
  };
  response.status(201).json(profileResponse(customer));
});

app.get("/api/me/avatar", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;
  if (!customer.avatar) {
    sendError(response, 404, "AVATAR_NOT_FOUND", "No profile picture is available.");
    return;
  }
  response.type(customer.avatar.mimeType).send(customer.avatar.buffer);
});

app.delete("/api/me/avatar", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;
  delete customer.avatar;
  response.status(204).end();
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

app.post("/api/loans/payments", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;

  const parsed = loanDrawSchema.safeParse(request.body);
  if (!parsed.success) {
    sendError(response, 400, "INVALID_AMOUNT", "Payment must be a positive integer number of cents.");
    return;
  }
  if (customer.loanBalanceCents === 0) {
    sendError(response, 422, "NO_OUTSTANDING_LOAN", "There is no outstanding loan to pay.");
    return;
  }
  if (parsed.data.amountCents > customer.loanBalanceCents) {
    sendError(response, 422, "OVERPAYMENT", "Payment cannot exceed the outstanding loan balance.");
    return;
  }
  if (parsed.data.amountCents > customer.balanceCents) {
    sendError(response, 422, "INSUFFICIENT_FUNDS", "Balance is too low for this payment.");
    return;
  }

  customer.balanceCents -= parsed.data.amountCents;
  customer.loanBalanceCents -= parsed.data.amountCents;
  const transaction = makeTransaction(
    customer,
    "LOAN_PAYMENT",
    parsed.data.amountCents,
  );
  response.status(201).json({
    balanceCents: customer.balanceCents,
    loanBalanceCents: customer.loanBalanceCents,
    transaction,
  });
});

app.post("/api/wires", (request, response) => {
  const sender = getAuthenticatedCustomer(request, response);
  if (!sender) return;

  const parsed = wireSchema.safeParse(request.body);
  if (!parsed.success) {
    sendError(response, 400, "INVALID_AMOUNT", "Wire requires a valid recipient account and an amount between 1 and 1,000,000 cents.");
    return;
  }
  if (parsed.data.amountCents > sender.balanceCents) {
    sendError(response, 422, "INSUFFICIENT_FUNDS", "Balance is too low for this wire.");
    return;
  }
  const recipient = [...customersByEmail.values()].find(
    (customer) => customer.accountNumber === parsed.data.recipientAccountNumber,
  );
  if (!recipient) {
    sendError(response, 404, "RECIPIENT_NOT_FOUND", "The recipient account was not found.");
    return;
  }
  if (recipient === sender) {
    sendError(response, 400, "INVALID_RECIPIENT", "You cannot send a wire to your own account.");
    return;
  }

  const wireId = randomUUID();
  sender.balanceCents -= parsed.data.amountCents;
  recipient.balanceCents += parsed.data.amountCents;
  const outgoingTransaction = makeTransaction(
    sender,
    "WIRE_OUT",
    parsed.data.amountCents,
    parsed.data.memo,
    wireId,
  );
  const incomingTransaction = makeTransaction(
    recipient,
    "WIRE_IN",
    parsed.data.amountCents,
    parsed.data.memo,
    wireId,
  );
  response.status(201).json({
    wireId,
    balanceCents: sender.balanceCents,
    transaction: outgoingTransaction,
    recipientTransaction: incomingTransaction,
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

  const page = Number(request.query.page ?? 1);
  const pageSize = Number(request.query.pageSize ?? 20);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1
  ) {
    sendError(response, 400, "VALIDATION_ERROR", "Page and page size must be positive integers.");
    return;
  }

  let transactions = customer.transactions;
  if (request.query.type !== undefined) {
    const type = request.query.type;
    if (typeof type !== "string" || ![
      "DEPOSIT",
      "WITHDRAWAL",
      "LOAN_DRAW",
      "LOAN_PAYMENT",
      "WIRE_IN",
      "WIRE_OUT",
    ].includes(type)) {
      sendError(response, 400, "VALIDATION_ERROR", "Transaction type is invalid.");
      return;
    }
    transactions = transactions.filter((transaction) => transaction.type === type);
  }

  const start = (page - 1) * pageSize;
  response.json({
    transactions: transactions.slice(start, start + pageSize),
    page,
    pageSize,
    total: transactions.length,
  });
});

app.use((_request, response) => {
  sendError(response, 404, "NOT_FOUND", "The requested resource was not found.");
});

export default app;
