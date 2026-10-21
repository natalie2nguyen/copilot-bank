import { randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import express, { type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { db, withDatabaseTransaction } from "./database.js";

const app = express();
app.use(express.json());

const CREDIT_LIMIT_CENTS = 500_000;
const MAX_TRANSACTION_CENTS = 1_000_000;
const MAX_TRANSACTION_PAGE_SIZE = 100;

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
  id: string;
  name: string;
  email: string;
  passwordSalt: string;
  passwordHash: Buffer;
  accountNumber: string;
  balanceCents: number;
  loanBalanceCents: number;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  hasAvatar: boolean;
  avatar?: {
    mimeType: "image/png" | "image/jpeg";
    buffer: Buffer;
  };
};

type DatabaseRow = Record<
  string,
  string | number | bigint | Uint8Array | null
>;

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
const transactionQuerySchema = z.object({
  page: z.string().regex(/^[1-9]\d*$/).transform(Number)
    .pipe(z.number().int().positive()).default("1"),
  pageSize: z.string().regex(/^[1-9]\d*$/).transform(Number)
    .pipe(z.number().int().positive().max(MAX_TRANSACTION_PAGE_SIZE))
    .default("20"),
  type: z.enum([
    "DEPOSIT",
    "WITHDRAWAL",
    "LOAN_DRAW",
    "LOAN_PAYMENT",
    "WIRE_IN",
    "WIRE_OUT",
  ]).optional(),
}).superRefine(({ page, pageSize }, context) => {
  if (!Number.isSafeInteger((page - 1) * pageSize)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "The requested transaction page is too large.",
    });
  }
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

function requiredString(row: DatabaseRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`Expected ${column} to contain a string.`);
  }
  return value;
}

function nullableString(row: DatabaseRow, column: string): string | undefined {
  const value = row[column];
  if (value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error(`Expected ${column} to contain a string or null.`);
  }
  return value;
}

function requiredNumber(row: DatabaseRow, column: string): number {
  const value = row[column];
  if (typeof value !== "number") {
    throw new Error(`Expected ${column} to contain a number.`);
  }
  return value;
}

function requiredBuffer(row: DatabaseRow, column: string): Buffer {
  const value = row[column];
  if (!(value instanceof Uint8Array)) {
    throw new Error(`Expected ${column} to contain binary data.`);
  }
  return Buffer.from(value);
}

function isTransactionType(value: string): value is TransactionType {
  return [
    "DEPOSIT",
    "WITHDRAWAL",
    "LOAN_DRAW",
    "LOAN_PAYMENT",
    "WIRE_IN",
    "WIRE_OUT",
  ].includes(value);
}

function transactionFromRow(row: DatabaseRow): Transaction {
  const type = requiredString(row, "type");
  if (!isTransactionType(type)) {
    throw new Error("Database contains an unsupported transaction type.");
  }

  const transaction: Transaction = {
    type,
    amountCents: requiredNumber(row, "amount_cents"),
    direction: requiredString(row, "direction"),
    timestamp: requiredString(row, "timestamp"),
    resultingBalanceCents: requiredNumber(row, "resulting_balance_cents"),
  };
  const memo = nullableString(row, "memo");
  const wireId = nullableString(row, "wire_id");
  if (memo !== undefined) transaction.memo = memo;
  if (wireId !== undefined) transaction.wireId = wireId;
  return transaction;
}

function customerFromRow(row: DatabaseRow): Customer {
  const customer: Customer = {
    id: requiredString(row, "id"),
    name: requiredString(row, "name"),
    email: requiredString(row, "email"),
    passwordSalt: requiredString(row, "password_salt"),
    passwordHash: requiredBuffer(row, "password_hash"),
    accountNumber: requiredString(row, "account_number"),
    balanceCents: requiredNumber(row, "balance_cents"),
    loanBalanceCents: requiredNumber(row, "loan_balance_cents"),
    hasAvatar: requiredNumber(row, "has_avatar") === 1,
  };
  const address = {
    street: nullableString(row, "street"),
    city: nullableString(row, "city"),
    state: nullableString(row, "state"),
    postalCode: nullableString(row, "postal_code"),
    country: nullableString(row, "country"),
  };
  if (Object.values(address).some((value) => value !== undefined)) {
    customer.address = address;
  }
  return customer;
}

const customerSelect = `
  SELECT c.id, c.name, c.email, c.password_salt, c.password_hash,
         c.street, c.city, c.state, c.postal_code, c.country,
         a.account_number, a.balance_cents, a.loan_balance_cents,
         EXISTS (
           SELECT 1 FROM avatars WHERE customer_id = c.id
         ) AS has_avatar
  FROM customers AS c
  JOIN accounts AS a ON a.customer_id = c.id
`;

function findCustomerById(id: string): Customer | undefined {
  const row = db.prepare(`${customerSelect} WHERE c.id = ?`).get(id);
  return row ? customerFromRow(row as DatabaseRow) : undefined;
}

function findCustomerByEmail(email: string): Customer | undefined {
  const row = db.prepare(`${customerSelect} WHERE c.email = ?`).get(email);
  return row ? customerFromRow(row as DatabaseRow) : undefined;
}

function findCustomerByAccountNumber(accountNumber: string): Customer | undefined {
  const row = db.prepare(`${customerSelect} WHERE a.account_number = ?`)
    .get(accountNumber);
  return row ? customerFromRow(row as DatabaseRow) : undefined;
}

function findCustomerByToken(token: string): Customer | undefined {
  const session = db.prepare(
    "SELECT customer_id FROM sessions WHERE token = ?",
  ).get(token) as DatabaseRow | undefined;
  if (!session) return undefined;
  return findCustomerById(requiredString(session, "customer_id"));
}

function persistCustomer(customer: Customer): void {
  db.prepare(`
    UPDATE customers
    SET name = ?, email = ?, password_salt = ?, password_hash = ?,
        street = ?, city = ?, state = ?, postal_code = ?, country = ?
    WHERE id = ?
  `).run(
    customer.name,
    customer.email,
    customer.passwordSalt,
    customer.passwordHash,
    customer.address?.street ?? null,
    customer.address?.city ?? null,
    customer.address?.state ?? null,
    customer.address?.postalCode ?? null,
    customer.address?.country ?? null,
    customer.id,
  );
  db.prepare(`
    UPDATE accounts
    SET account_number = ?, balance_cents = ?, loan_balance_cents = ?
    WHERE customer_id = ?
  `).run(
    customer.accountNumber,
    customer.balanceCents,
    customer.loanBalanceCents,
    customer.id,
  );
}

function insertTransaction(customer: Customer, transaction: Transaction): void {
  db.prepare(`
    INSERT INTO transactions (
      customer_id, type, amount_cents, direction, timestamp,
      resulting_balance_cents, memo, wire_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer.id,
    transaction.type,
    transaction.amountCents,
    transaction.direction,
    transaction.timestamp,
    transaction.resultingBalanceCents,
    transaction.memo ?? null,
    transaction.wireId ?? null,
  );
}

function saveAvatar(
  customerId: string,
  mimeType: "image/png" | "image/jpeg",
  data: Buffer,
): void {
  db.prepare(`
    INSERT INTO avatars (customer_id, mime_type, data)
    VALUES (?, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET
      mime_type = excluded.mime_type,
      data = excluded.data
  `).run(customerId, mimeType, data);
}

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
  const customer = token ? findCustomerByToken(token) : undefined;
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
    ...(customer.hasAvatar ? { avatarUrl: "/api/me/avatar" } : {}),
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
  insertTransaction(customer, transaction);
  return transaction;
}

function hasImageSignature(
  data: Buffer,
  mimeType: "image/png" | "image/jpeg",
): boolean {
  if (mimeType === "image/png") {
    return data.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff;
}

app.post("/api/auth/register", (request, response) => {
  const parsed = registrationSchema.safeParse(request.body);
  if (!parsed.success) {
    sendError(response, 400, "VALIDATION_ERROR", "Name, valid email, and a password of at least 8 characters are required.");
    return;
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  if (findCustomerByEmail(normalizedEmail)) {
    sendError(response, 409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
    return;
  }

  let accountNumber: string;
  do {
    accountNumber = String(randomInt(1_000_000_000, 10_000_000_000));
  } while (findCustomerByAccountNumber(accountNumber));

  const passwordSalt = randomUUID();
  const customer: Customer = {
    id: randomUUID(),
    name,
    email: normalizedEmail,
    passwordSalt,
    passwordHash: scryptSync(password, passwordSalt, 64),
    accountNumber,
    balanceCents: 0,
    loanBalanceCents: 0,
    hasAvatar: false,
  };
  withDatabaseTransaction(() => {
    db.prepare(`
      INSERT INTO customers (
        id, name, email, password_salt, password_hash
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      customer.id,
      customer.name,
      customer.email,
      customer.passwordSalt,
      customer.passwordHash,
    );
    db.prepare(`
      INSERT INTO accounts (customer_id, account_number, balance_cents)
      VALUES (?, ?, ?)
    `).run(customer.id, customer.accountNumber, customer.balanceCents);
  });

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

  const customer = findCustomerByEmail(parsed.data.email.toLowerCase());
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
  db.prepare("INSERT INTO sessions (token, customer_id) VALUES (?, ?)")
    .run(token, customer.id);
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
    findCustomerByEmail(updatedEmail)
  ) {
    sendError(response, 409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
    return;
  }

  if (updatedEmail && updatedEmail !== customer.email) {
    customer.email = updatedEmail;
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

  persistCustomer(customer);
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
  if (!hasImageSignature(request.file.buffer, request.file.mimetype)) {
    sendError(response, 415, "UNSUPPORTED_MEDIA_TYPE", "The uploaded file does not match its image type.");
    return;
  }

  customer.avatar = {
    mimeType: request.file.mimetype,
    buffer: request.file.buffer,
  };
  saveAvatar(customer.id, customer.avatar.mimeType, customer.avatar.buffer);
  customer.hasAvatar = true;
  response.status(201).json(profileResponse(customer));
});

app.get("/api/me/avatar", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;
  const avatar = db.prepare(
    "SELECT mime_type, data FROM avatars WHERE customer_id = ?",
  ).get(customer.id) as DatabaseRow | undefined;
  if (!avatar) {
    sendError(response, 404, "AVATAR_NOT_FOUND", "No profile picture is available.");
    return;
  }
  const mimeType = requiredString(avatar, "mime_type");
  if (mimeType !== "image/png" && mimeType !== "image/jpeg") {
    throw new Error("Database contains an unsupported avatar type.");
  }
  response.type(mimeType).send(requiredBuffer(avatar, "data"));
});

app.delete("/api/me/avatar", (request, response) => {
  const customer = getAuthenticatedCustomer(request, response);
  if (!customer) return;
  db.prepare("DELETE FROM avatars WHERE customer_id = ?").run(customer.id);
  customer.hasAvatar = false;
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

  const transaction = withDatabaseTransaction(() => {
    customer.balanceCents += parsed.data.amountCents;
    const createdTransaction = makeTransaction(
      customer,
      "DEPOSIT",
      parsed.data.amountCents,
      parsed.data.memo,
    );
    persistCustomer(customer);
    return createdTransaction;
  });
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

  const transaction = withDatabaseTransaction(() => {
    customer.balanceCents -= parsed.data.amountCents;
    const createdTransaction = makeTransaction(
      customer,
      "WITHDRAWAL",
      parsed.data.amountCents,
      parsed.data.memo,
    );
    persistCustomer(customer);
    return createdTransaction;
  });
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

  const transaction = withDatabaseTransaction(() => {
    customer.balanceCents += parsed.data.amountCents;
    customer.loanBalanceCents += parsed.data.amountCents;
    const createdTransaction = makeTransaction(
      customer,
      "LOAN_DRAW",
      parsed.data.amountCents,
    );
    persistCustomer(customer);
    return createdTransaction;
  });
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

  const transaction = withDatabaseTransaction(() => {
    customer.balanceCents -= parsed.data.amountCents;
    customer.loanBalanceCents -= parsed.data.amountCents;
    const createdTransaction = makeTransaction(
      customer,
      "LOAN_PAYMENT",
      parsed.data.amountCents,
    );
    persistCustomer(customer);
    return createdTransaction;
  });
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
  const recipient = findCustomerByAccountNumber(parsed.data.recipientAccountNumber);
  if (!recipient) {
    sendError(response, 404, "RECIPIENT_NOT_FOUND", "The recipient account was not found.");
    return;
  }
  if (recipient.id === sender.id) {
    sendError(response, 400, "INVALID_RECIPIENT", "You cannot send a wire to your own account.");
    return;
  }

  const wireId = randomUUID();
  const { outgoingTransaction, incomingTransaction } = withDatabaseTransaction(() => {
    sender.balanceCents -= parsed.data.amountCents;
    recipient.balanceCents += parsed.data.amountCents;
    const outgoing = makeTransaction(
      sender,
      "WIRE_OUT",
      parsed.data.amountCents,
      parsed.data.memo,
      wireId,
    );
    const incoming = makeTransaction(
      recipient,
      "WIRE_IN",
      parsed.data.amountCents,
      parsed.data.memo,
      wireId,
    );
    persistCustomer(sender);
    persistCustomer(recipient);
    return {
      outgoingTransaction: outgoing,
      incomingTransaction: incoming,
    };
  });
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

  const parsed = transactionQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    sendError(response, 400, "VALIDATION_ERROR", "Page, page size, or transaction type is invalid.");
    return;
  }

  const { page, pageSize, type } = parsed.data;
  const start = (page - 1) * pageSize;
  const filterClause = type === undefined ? "" : " AND type = ?";
  const parameters = type === undefined
    ? [customer.id]
    : [customer.id, type];
  const totalRow = db.prepare(`
    SELECT COUNT(*) AS total
    FROM transactions
    WHERE customer_id = ?${filterClause}
  `).get(...parameters) as DatabaseRow;
  const transactionRows = db.prepare(`
    SELECT type, amount_cents, direction, timestamp,
           resulting_balance_cents, memo, wire_id
    FROM transactions
    WHERE customer_id = ?${filterClause}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...parameters, pageSize, start);
  response.json({
    transactions: transactionRows.map((row) =>
      transactionFromRow(row as DatabaseRow),
    ),
    page,
    pageSize,
    total: requiredNumber(totalRow, "total"),
  });
});

app.use((_request, response) => {
  sendError(response, 404, "NOT_FOUND", "The requested resource was not found.");
});

app.use((error: unknown, _request: Request, response: Response, _next: (error?: unknown) => void) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      sendError(response, 413, "FILE_TOO_LARGE", "Profile pictures must not exceed 2 MB.");
      return;
    }
    sendError(response, 400, "INVALID_UPLOAD", "The uploaded file could not be processed.");
    return;
  }
  if (
    error instanceof SyntaxError &&
    "type" in error &&
    error.type === "entity.parse.failed"
  ) {
    sendError(response, 400, "INVALID_JSON", "The request body must contain valid JSON.");
    return;
  }
  console.error("Unhandled API error:", error);
  sendError(response, 500, "INTERNAL_SERVER_ERROR", "An unexpected server error occurred.");
});

export default app;
