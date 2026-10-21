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
same credentials to confirm the new record can be read back from the in-memory
database. The database is process-local and is cleared when the API restarts;
it cannot be opened from an external SQLite viewer while using `:memory:`.
