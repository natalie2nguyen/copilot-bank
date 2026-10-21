# Bank web

## Run locally

Use Node.js 22.13 or later. Open two terminals from the repository root:

```powershell
cd bank-api
npm run dev
```

```powershell
cd bank-web
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Vite
forwards `/api` requests to the API on `http://127.0.0.1:3000`.

Create an account in the browser. A success message and the generated account
number confirm the registration response. Switch to **Sign in** and use the
same credentials to open the profile page.

On the profile page, manually check Story 2:

- Change the name and email, then save. Try an invalid email and an email
  already used by another account to see the validation and duplicate errors.
- Update one or more address fields at a time. Leave postal code empty to omit
  it, or clear an existing postal code and save to confirm the API rejects it.
- Upload PNG/JPEG files up to 2 MB, a file over 2 MB, and an unsupported type.
  The API response is shown in the page. Remove a picture and confirm initials
  appear in its place.
- Sign out and sign in again to confirm the saved values are read back.

The profile page also includes the Story 3 deposit form:

- Submit `$0.01`, `$40.25`, and `$10,000.00` and check that the balance and
  confirmation show the exact new amount.
- Add an optional memo such as `Paycheck`; it should appear in the confirmation.
- Try `$0.00`, a negative amount, `$10,000.01`, and an amount with more than
  two decimal places. Each should show a validation error without changing the
  balance.

The same page includes the Story 4 withdrawal form:

- Deposit enough money to fund a withdrawal, then withdraw `$0.01`, `$40.25`,
  or `$10,000.00` within your available balance. Confirm the balance decreases
  and the withdrawal details appear.
- Try `$0.00`, a negative amount, `$10,000.01`, and more than two decimal
  places to verify input validation.
- Try withdrawing more than the checking balance. The API's insufficient-funds
  error should appear, and the displayed balance should remain unchanged.

The profile page also supports Story 5 borrowing:

- Check that the loan balance starts at `$0.00`, the credit limit is `$5,000.00`,
  and available credit is `$5,000.00`.
- Borrow `$250.00`. Confirm checking increases by `$250.00`, loan balance
  increases by `$250.00`, available credit decreases by `$250.00`, and a
  `LOAN_DRAW` confirmation appears.
- On a fresh account, borrow `$4,750.00`, then `$250.00` to use the remaining
  credit. The second borrow should succeed and available credit should be
  `$0.00`.
- On a fresh account, borrow `$4,750.00`, then try `$250.01`. The form should
  show `CREDIT_LIMIT_EXCEEDED`; checking balance, loan balance, and available
  credit should remain unchanged.

The profile page also supports Story 6 loan payments:

- Ensure the account has at least `$500.00` in checking and `$300.00` in loan
  balance (for example, deposit `$200.00`, then borrow `$300.00`). Pay `$100.00`.
  Confirm checking and loan balance each decrease by `$100.00`, available credit
  increases by `$100.00`, and a `LOAN_PAYMENT` confirmation appears.
- Select **Pay full balance** and verify the amount field is set to the current
  loan balance. Submit and confirm the loan reaches `$0.00`.
- To test `OVERPAYMENT`, ensure checking is greater than the loan balance, then
  enter an amount one cent above the loan balance. The error should appear below
  the amount field and neither balance should change.
- To test `INSUFFICIENT_FUNDS`, ensure checking is lower than the loan balance,
  then enter an amount one cent above checking but no greater than the loan.
  The error should appear and neither balance should change.
- With no outstanding loan, enter `$0.01` and submit to verify
  `NO_OUTSTANDING_LOAN` appears without a balance change. The full-balance
  shortcut is disabled when there is no loan to repay.

The dashboard also supports Stories 7–10:

- Use the account number shown under the checking balance to identify the
  recipient account when testing wires with a second customer. Enter the
  recipient's 10-digit account number, amount, and optional memo. Select
  **Review wire** and verify the masked confirmation before selecting
  **Confirm wire**. Try your own account, a nonexistent account, insufficient
  funds, and invalid amounts to check that errors are shown and balances do not
  change. Sign in as the recipient and use **Refresh balances and history** to
  confirm the incoming wire is reflected in their balance and transaction
  history.
- Review the transaction history table for signed amounts, resulting balances,
  timestamps, and memos. Use the type filter and page-size / previous / next
  controls to check filtering and pagination.
- Confirm the checking balance, loan balance, credit limit, and available
  credit are shown on the dashboard. After each successful operation, balances
  and the newest transaction history refresh automatically; use the refresh
  button after activity performed from another account.

The API authenticates profile requests using the signed-in session. Its
in-memory database is process-local and is cleared when the API restarts; it
cannot be opened from an external SQLite viewer while using `:memory:`.
