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

The API authenticates profile requests using the signed-in session. Its
in-memory database is process-local and is cleared when the API restarts; it
cannot be opened from an external SQLite viewer while using `:memory:`.
