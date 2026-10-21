# Capstone Project: "Copilot Bank"

**Course:** VS Code with GitHub Copilot
**Estimated effort:** 4–5 hours with Copilot
**Languages:** Python *or* TypeScript/JavaScript (students pick one track)

---

## 1. Project Overview

Students build a small online banking system made of **two separate projects**:

| Project | Purpose |
|---|---|
| `bank-api` | REST API backend: accounts, profiles, transactions, loans, wires |
| `bank-web` | Front end that calls the API |

The goal is not just to ship working code. It's to show that students can **drive Copilot deliberately** using everything covered in class:

- **Commands / prompt files**: reusable slash commands for repeated tasks
- **Selectors / context**: `#file`, `#selection`, `#codebase`, `#problems`, etc., to give Copilot the right context
- **Custom agents**: including a required critical code-review agent
- **Instruction files**: project-wide and file-type-specific conventions
- **Skills**: at least one reusable skill folder

Development is **spec-first**: students use Copilot to turn each user story into a Gherkin `.feature` file, generate failing tests from it, and then work with Copilot to make each test pass, one at a time (§6).

Persistence is **not** required. All data lives in memory and resets when the API restarts. No Docker.

---

## 2. Environment Setup

### 2.1 Install Node.js with Chocolatey + nvm (Windows)

> Python is already installed. Students on the Python track still need Node only if they choose a JavaScript front end.

Chocolatey is already installed on the lab machines. Open **PowerShell as Administrator**.

**Step 1: Install nvm for Windows:**

```powershell
choco install nvm -y
```

Close and reopen PowerShell again so `nvm` is on the PATH.

**Step 2: Install and use the current LTS version of Node:**

```powershell
nvm install lts
nvm use lts
```

> If your nvm version doesn't accept `lts`, run `nvm list available` and install a specific LTS version number, e.g. `nvm install 24` then `nvm use 24`.

**Step 3: Verify:**

```powershell
nvm list
node -v
npm -v
```

> **Troubleshooting**
> - `nvm use` must run in an **Administrator** shell (it creates a symlink).
> - If an existing Node install conflicts, uninstall it from *Apps & Features* first, then repeat Step 2.
> - Restart VS Code after installing so its integrated terminal picks up the new PATH.

### 2.2 Python track setup

```powershell
python --version
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2.3 VS Code

- Install / update **VS Code** and sign in to **GitHub Copilot** (Copilot and Copilot Chat).
- Confirm **Agent mode** is available in the Chat view.

---

## 3. Recommended Tech Stack

### Track A: TypeScript / JavaScript

| Layer | Recommendation |
|---|---|
| API | **Express** or **Fastify** with TypeScript |
| Validation | **zod** |
| Password hashing | **bcryptjs** (pure JS, no native build tools needed on Windows) |
| File upload (profile picture) | **multer** with in-memory storage |
| Front end | **React + Vite** (TypeScript template) |
| Tests | **Vitest** (+ **supertest** for API routes) |
| Gherkin runner | **@amiceli/vitest-cucumber** (runs `.feature` scenarios as Vitest tests) |

### Track B: Python

| Layer | Recommendation |
|---|---|
| API | **FastAPI** + **uvicorn** |
| Validation | **Pydantic** (built into FastAPI) |
| Password hashing | **passlib[bcrypt]** or **argon2-cffi** |
| File upload | FastAPI `UploadFile` (needs `python-multipart`) |
| Front end | **React + Vite** (needs Node) **or** **Flask + Jinja templates** (pure Python) |
| Tests | **pytest** + FastAPI `TestClient` |
| Gherkin runner | **pytest-bdd** (binds `.feature` scenarios to pytest tests) |

> Either track may skip the Gherkin runner and have Copilot translate each scenario into a plain unit test instead (see §6.4). The feature files are still required.

### 3.1 In-Memory Database Recommendation

**Node: use the built-in `node:sqlite` module with an in-memory database.**

```ts
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    balance_cents INTEGER NOT NULL DEFAULT 0
  );
`);
```

Why:
- **Nothing to install.** It ships with current Node LTS releases, so no native compilation and no Visual Studio Build Tools.
- Real SQL with **transactions**, which matters for banking (e.g. a wire must debit one account and credit another atomically).
- `:memory:` means data vanishes on restart, which is exactly what this project wants.

Notes:
- Node may print an `ExperimentalWarning` for `node:sqlite`. That's expected and safe to ignore for this project.
- Requires Node 22.13+ (any current LTS is fine).

**Alternatives** if a student prefers them:
- **sql.js**: SQLite compiled to WebAssembly; pure JS install.
- **PGlite**: Postgres compiled to WebAssembly; runs in-memory by default. Good for students who want Postgres syntax.
- **Plain `Map` objects** behind a repository class: perfectly acceptable, but students must handle atomic updates themselves.

**Python:** use the standard library: `sqlite3.connect(":memory:", check_same_thread=False)`, or plain dictionaries behind a repository class.

### 3.2 Money Rule (required for both tracks)

> **Store all money as integer cents.** Never use floats for balances. `$12.34` is stored as `1234`.

---

## 4. Suggested Repository Layout

Students may use one repository with two folders, or two repositories.

```
copilot-bank/
├─ .github/
│  ├─ copilot-instructions.md          # project-wide instructions
│  ├─ instructions/
│  │  ├─ api.instructions.md           # applyTo: bank-api/**
│  │  ├─ web.instructions.md           # applyTo: bank-web/**
│  │  └─ tests.instructions.md         # applyTo: **/*.test.*  or  **/test_*.py
│  ├─ agents/
│  │  └─ critical-reviewer.agent.md    # REQUIRED custom agent
│  ├─ prompts/
│  │  ├─ write-feature.prompt.md       # /write-feature: user story → .feature file
│  │  ├─ feature-to-tests.prompt.md    # /feature-to-tests: .feature → failing tests
│  │  └─ make-it-pass.prompt.md        # /make-it-pass: implement until one test is green
│  └─ skills/
│     ├─ money-handling/
│     │  └─ SKILL.md                   # cents math, rounding, validation
│     └─ gherkin-authoring/
│        └─ SKILL.md                   # house style for feature files (optional 2nd skill)
├─ bank-api/
│  ├─ features/                        # one .feature file per user story
│  │  ├─ 01-register.feature
│  │  ├─ 02-manage-account.feature
│  │  └─ ...
│  ├─ src/   (or app/)
│  └─ tests/
└─ bank-web/
```

> Copilot customization file locations and frontmatter fields evolve. If something isn't picked up, check the current VS Code Copilot customization docs and the Chat view's **Configure Chat** menu.

---

## 5. Required Copilot Customizations

### 5.1 Instruction files

**`.github/copilot-instructions.md`** (project-wide) should cover at minimum:
- The chosen language/track and framework
- "All money is integer cents"
- Error response format (see §8)
- Naming conventions and folder structure
- "Behavior is specified in `features/*.feature`. Never implement behavior that has no scenario. Never edit a test to make it pass."

**`.github/instructions/*.instructions.md`** must use `applyTo` frontmatter. Example:

```markdown
---
applyTo: "bank-api/**"
---
- Every route validates input with zod (or Pydantic) before touching the database.
- Balance-changing operations run inside a single database transaction.
- Never return password hashes in any response.
```

### 5.2 Prompt files / commands

Create at least **three** reusable prompt files in `.github/prompts/` that drive the test workflow in §6:

- `/write-feature`: turns a user story and its acceptance criteria into a Gherkin `.feature` file
- `/feature-to-tests`: generates **failing** tests from the current `#file` feature file
- `/make-it-pass`: implements the minimum production code to turn one failing test green

Students may add more (e.g. `/new-endpoint` for route scaffolding).

### 5.3 Skill

Create at least **one** skill in `.github/skills/<name>/SKILL.md`. Suggested: **`money-handling`**, containing:
- Rules for converting between dollars and cents
- Validation rules (positive amounts, max transaction size, two decimal places max on input)
- An example helper function and test cases Copilot should follow

Optional second skill: **`gherkin-authoring`**, describing the class's feature-file style (declarative steps, one behavior per scenario, `Scenario Outline` for boundary values, money written as `$12.34` in steps).

### 5.4 REQUIRED: Critical Code Review Agent

Students must create **`.github/agents/critical-reviewer.agent.md`** and use it to review their code **at least twice**: once mid-project, once at the end. Starter template:

```markdown
---
description: Harsh, senior-level code reviewer. Finds bugs, security holes, and sloppy code. Does not edit files.
tools: ['search', 'usages', 'problems', 'changes']
---

# Role
You are a demanding principal engineer reviewing code for a banking system.
Money and security are on the line. Your tone is blunt, direct, and critical.
Do not praise code. Do not soften findings. Do not say "great job."

# Rules
- Do NOT modify any files. Review only.
- Assume the code is wrong until proven otherwise.
- Every finding must cite the file and line, explain WHY it's a problem,
  and state the concrete fix.
- If you can't find a real problem in an area, say "No issues found" and move on.
  Do not invent problems.

# What to hunt for (in priority order)
1. **Money bugs**: floats for currency, rounding errors, negative amounts accepted,
   overdrafts, non-atomic multi-step balance updates, race conditions.
2. **Security**: missing auth checks, users accessing other users' accounts,
   password hashes or secrets leaked in responses or logs, unvalidated uploads,
   missing input validation.
3. **Correctness**: unhandled errors, wrong HTTP status codes, edge cases
   (zero, max values, missing fields, duplicate email).
4. **Tests and specs**: acceptance criteria with no Gherkin scenario, scenarios
   with no matching test, tests that don't assert anything meaningful,
   tests that were weakened or edited to force a pass, untested failure paths.
5. **Maintainability**: duplication, god functions, unclear names,
   violations of the project's instruction files.

# Output format
## Verdict: REJECT | APPROVE WITH CHANGES | APPROVE
## Critical (must fix before merge)
## Major
## Minor
## Missing scenarios / tests
```

> Tool names in the `tools` list should match the names shown in your VS Code tool picker. Keep the agent **read-only**.

**Deliverable:** save each review's output to `reviews/review-1.md` and `reviews/review-2.md`, and show that Critical findings from review 1 were fixed.

---

## 6. Test Workflow: Gherkin → Red → Green

Every user story is built **spec first**. Students do not write production code for a story until its feature file exists and its tests are failing.

### 6.1 The loop (repeat for each story)

1. **Specify**: Run `/write-feature` with the user story and acceptance criteria from §9. Copilot drafts `features/NN-story-name.feature`.
2. **Review the spec**: The student reads every scenario and fixes anything wrong or missing. Each acceptance criterion must map to at least one scenario. *Copilot drafts; the student owns the spec.*
3. **Red**: Run `/feature-to-tests` with `#file` pointing at the feature file. Copilot generates tests (step definitions or plain unit tests), one per scenario.
4. **Confirm red**: Run the tests. Every new test must **fail for the right reason** (missing route, wrong status, missing function), not because of a syntax error or bad import. Commit: `test: failing tests for story NN`.
5. **Green**: Pick one failing test. Run `/make-it-pass` with `#selection` on that test. Copilot writes the minimum code to pass it. Run the full suite. Repeat until the story is green.
6. **Refactor**: Clean up with all tests still green. Commit: `feat: story NN`.

### 6.2 Ground rules

- **Never edit a test or scenario to make it pass.** If a scenario is wrong, fix the feature file first, regenerate or update the test, confirm it's red, then implement.
- One failing test at a time during the green phase. Don't ask Copilot to "make all tests pass" in one shot.
- Git history must show the red commit **before** the green commit for each story. Instructors will check.
- Scenarios describe behavior, not implementation: "When I withdraw $50.00", not "When I POST to /api/accounts/me/withdrawals".

### 6.3 Example feature file (Story 4: Withdraw Money)

```gherkin
Feature: Withdraw money
  As a customer
  I want to withdraw money from my account
  So that I can use my funds

  Background:
    Given I am a registered customer who is logged in

  Scenario: Successful withdrawal
    Given my checking balance is $100.00
    When I withdraw $40.00
    Then my checking balance is $60.00
    And my history contains a "WITHDRAWAL" of $40.00

  Scenario: Withdrawal exceeding balance is rejected
    Given my checking balance is $25.00
    When I withdraw $25.01
    Then the request is rejected with "INSUFFICIENT_FUNDS"
    And my checking balance is $25.00

  Scenario Outline: Invalid withdrawal amounts are rejected
    Given my checking balance is $20,000.00
    When I withdraw <amount>
    Then the request is rejected with "INVALID_AMOUNT"

    Examples:
      | amount     |
      | $0.00      |
      | -$5.00     |
      | $10,000.01 |
```

### 6.4 Two ways to turn features into tests

| Option | Python | TypeScript | When to choose it |
|---|---|---|---|
| **A. Executable Gherkin** | `pytest-bdd`: `scenarios("../features/04-withdraw.feature")` plus `@given/@when/@then` step functions | `@amiceli/vitest-cucumber`: `loadFeature()` + `describeFeature()` inside a Vitest file | Feature files stay the living source of truth; drift is impossible |
| **B. Scenario-mapped unit tests** | One `test_` function per scenario, named after it | One `it()` per scenario, named after it | Simpler tooling; students who want plain pytest/Vitest |

With option B, each test must include a comment pointing to its scenario, e.g. `# features/04-withdraw.feature: "Withdrawal exceeding balance is rejected"`.

### 6.5 Starter prompt file: `feature-to-tests.prompt.md`

```markdown
---
description: Generate failing tests from a Gherkin feature file
agent: agent
---
Read the feature file provided as context.

For EVERY scenario (and every Examples row of a Scenario Outline), create a test
in the matching tests folder using the project's Gherkin runner, or plain
unit tests if the project does not use one.

Rules:
- Do NOT create or change any production code. Only test code and step definitions.
- Reuse existing step definitions and fixtures before writing new ones.
- Tests must fail because the behavior doesn't exist yet, not because of
  syntax or import errors. Stub imports only as far as needed to compile.
- Express money in cents in assertions; parse "$12.34" in steps with the
  money-handling skill's helper.
- After writing the tests, run them and report which fail and why.
```

### 6.6 Front end

Front-end tests are lighter. For each screen, write at least one scenario (e.g. "Insufficient funds error is shown on the withdraw form") and one component test (Vitest + Testing Library, or pytest for Flask views). Same red → green rule applies.

---

## 7. Domain Rules

These business rules apply across the user stories:

| Rule | Value |
|---|---|
| Starting balance on new account | $0.00 |
| Minimum transaction amount | $0.01 |
| Maximum single deposit / withdrawal / wire | $10,000.00 |
| Overdraft | Not allowed |
| Borrowing credit limit | $5,000.00 per account |
| Interest on borrowing | Optional stretch goal (see §11) |
| Wire fee | $0 by default (fee is a stretch goal) |
| Account number | System-generated, unique, 10 digits |
| Profile picture | Optional; PNG or JPEG; max 2 MB |

---

## 8. API Contract (suggested)

All endpoints except register and login require `Authorization: Bearer <token>`. A simple random token stored in an in-memory sessions table is fine; JWT is optional.

Error format:

```json
{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "Balance is too low for this withdrawal." } }
```

| Method | Path | Story |
|---|---|---|
| POST | `/api/auth/register` | 1 |
| POST | `/api/auth/login` | 1 |
| GET | `/api/me` | 2 |
| PATCH | `/api/me` | 2 |
| PUT | `/api/me/avatar` | 2 |
| DELETE | `/api/me/avatar` | 2 |
| POST | `/api/accounts/me/deposits` | 3 |
| POST | `/api/accounts/me/withdrawals` | 4 |
| POST | `/api/loans/draws` | 5 |
| POST | `/api/loans/payments` | 6 |
| POST | `/api/wires` | 7 |
| GET | `/api/accounts/me/transactions` | 8 |
| GET | `/api/accounts/me/balance` | 9 |
| GET | `/api/loans/balance` | 10 |

---

## 9. User Stories

Each story includes acceptance criteria (AC). Every AC must become at least one Gherkin scenario (§6). A story is **done** when its feature file is reviewed, its tests went red before green, and its API endpoint and front-end screen work.

### Story 1: Register / Create Account

> **As a** new customer
> **I want to** create an account with my name, email, and password
> **So that** I can start banking online.

**Acceptance criteria**
- [ ] Registration requires name, email, and password; address is optional at signup.
- [ ] Email must be valid format and **unique** (case-insensitive). Duplicate returns `409 Conflict`.
- [ ] Password is at least 8 characters and is **hashed**, never stored or returned in plain text.
- [ ] On success, returns `201 Created` with the new user profile and a generated 10-digit account number. Balance is $0.00.
- [ ] A user can log in with email and password and receive a token. Wrong credentials return `401` with a generic message (don't reveal which field was wrong).
- [ ] Front end: Registration page and Login page with client-side validation and visible error messages.

---

### Story 2: Manage Account

> **As a** customer
> **I want to** view and update my profile
> **So that** my bank has my correct contact information.

**Acceptance criteria**
- [ ] **Name**: can be updated; cannot be blank.
- [ ] **Address**: street, city, state/region, postal code, country; can be updated; all fields optional but if postal code is given it must be non-empty.
- [ ] **Email**: can be updated; must remain valid and unique (`409` if taken).
- [ ] **Optional profile picture**:
  - Upload PNG or JPEG up to 2 MB; other types return `415`, oversize returns `413`.
  - Stored in memory (buffer or base64) and served back to the front end.
  - Can be removed; when absent, the UI shows initials or a placeholder avatar.
- [ ] Partial updates are supported (`PATCH` only changes fields provided).
- [ ] Users can only view and edit **their own** profile.
- [ ] Front end: Profile page showing current values with an edit form and avatar upload/remove.

---

### Story 3: Deposit Money

> **As a** customer
> **I want to** deposit money into my account
> **So that** my balance increases.

**Acceptance criteria**
- [ ] Amount must be between $0.01 and $10,000.00; otherwise `400` with code `INVALID_AMOUNT`.
- [ ] Balance increases by exactly the amount (integer cents).
- [ ] A `DEPOSIT` transaction is recorded with amount, timestamp, optional memo, and resulting balance.
- [ ] Response returns the new balance and the transaction.
- [ ] Front end: Deposit form; success message shows the new balance.

---

### Story 4: Withdraw Money

> **As a** customer
> **I want to** withdraw money from my account
> **So that** I can use my funds.

**Acceptance criteria**
- [ ] Amount rules match deposits.
- [ ] If the amount exceeds the balance, return `422` with code `INSUFFICIENT_FUNDS`; balance is unchanged.
- [ ] A `WITHDRAWAL` transaction is recorded.
- [ ] Front end: Withdraw form; shows the error clearly when funds are insufficient.

---

### Story 5: Borrow Funds

> **As a** customer
> **I want to** borrow money against my credit line
> **So that** I can cover expenses when my balance is low.

**Acceptance criteria**
- [ ] Each account has a $5,000.00 credit limit.
- [ ] Borrowed amount is **added to the checking balance** and **added to the loan balance** atomically.
- [ ] A borrow that would push the loan balance above the limit returns `422` with code `CREDIT_LIMIT_EXCEEDED`.
- [ ] A `LOAN_DRAW` transaction is recorded.
- [ ] Front end: Borrow form showing available credit (limit minus current loan balance) before submitting.

---

### Story 6: Pay Back Funds

> **As a** customer
> **I want to** repay my loan from my checking balance
> **So that** I reduce what I owe.

**Acceptance criteria**
- [ ] Payment is deducted from checking and subtracted from the loan balance atomically.
- [ ] Payment cannot exceed the current loan balance (`422`, `OVERPAYMENT`) or the checking balance (`422`, `INSUFFICIENT_FUNDS`).
- [ ] Paying with zero loan balance returns `422`, `NO_OUTSTANDING_LOAN`.
- [ ] A `LOAN_PAYMENT` transaction is recorded.
- [ ] Front end: Payback form with a "Pay full balance" shortcut button.

---

### Story 7: Send Wire

> **As a** customer
> **I want to** send money to another customer's account
> **So that** I can pay people.

**Acceptance criteria**
- [ ] Request includes recipient account number, amount, and optional memo.
- [ ] Recipient must exist (`404`, `RECIPIENT_NOT_FOUND`); cannot wire to yourself (`400`).
- [ ] Sender must have sufficient funds (`422`, `INSUFFICIENT_FUNDS`).
- [ ] Debit from sender and credit to recipient happen in **one atomic transaction**. If anything fails, neither balance changes.
- [ ] Sender gets a `WIRE_OUT` transaction; recipient gets a `WIRE_IN` transaction. Both reference the same wire ID.
- [ ] Front end: Wire form with a confirmation step ("Send $X to account ••••1234?") before submitting.

---

### Story 8: View Transaction History

> **As a** customer
> **I want to** see my transaction history
> **So that** I can track where my money went.

**Acceptance criteria**
- [ ] Returns only the logged-in user's transactions, newest first.
- [ ] Each entry shows type, amount, signed direction (+/−), timestamp, memo, and resulting balance.
- [ ] Supports pagination (`?page=&pageSize=`, default page size 20).
- [ ] Supports filtering by type (e.g. `?type=DEPOSIT`).
- [ ] Front end: Transaction table with type filter and pagination controls; amounts formatted as currency, credits and debits visually distinct.

---

### Story 9: Get Current Account Balance

> **As a** customer
> **I want to** see my current checking balance
> **So that** I know how much I have available.

**Acceptance criteria**
- [ ] Returns balance in cents plus a formatted display string (e.g. `"$1,234.56"`).
- [ ] Balance always equals the sum of the user's transaction effects (add a test that proves this after a mix of operations).
- [ ] Front end: Dashboard shows the balance prominently and refreshes after every money operation.

---

### Story 10: Get Current Borrowing Balance

> **As a** customer
> **I want to** see how much I owe and how much credit I have left
> **So that** I can manage my debt.

**Acceptance criteria**
- [ ] Returns loan balance, credit limit, and available credit (all in cents plus formatted strings).
- [ ] Front end: Dashboard shows loan balance and available credit next to the checking balance.

---

## 10. Suggested Schedule (≈ 5 hours)

| Phase | Time | Work | Copilot skills practiced |
|---|---|---|---|
| 0. Setup | 20 min | Install Node via nvm (if needed), scaffold both projects, install the Gherkin runner, create the repo layout | Agent mode scaffolding |
| 1. Customize Copilot | 35 min | Instruction files, the three test-workflow prompt files, the `money-handling` skill, and the critical-reviewer agent | Instructions, commands, skills, custom agents |
| 2. Write all feature files | 30 min | `/write-feature` for Stories 1–10; student reviews and corrects every scenario | Commands, `#file` context, spec review |
| 3. Data + auth | 40 min | In-memory DB schema, repository layer, Story 1: red, then green | `/feature-to-tests`, `/make-it-pass` |
| 4. Profile | 25 min | Story 2 including avatar upload: red, then green | `#selection` on a single failing test |
| 5. Money ops | 55 min | Stories 3, 4, 5, 6, 9, 10: red, then green | Skill usage, one-test-at-a-time loop |
| 6. **Review #1** | 15 min | Run critical-reviewer on the API, including spec-to-test coverage; fix all Critical findings | Custom agent |
| 7. Wires + history | 30 min | Stories 7 and 8: red, then green | `#codebase` for cross-file changes |
| 8. Front end | 50 min | Login/register, dashboard, forms, profile, transaction table, plus a few UI scenarios | Agent mode, `web.instructions.md` |
| 9. **Review #2** + demo | 20 min | Final critical review, fix findings, short demo including a full test run | Custom agent |

> Writing all feature files up front (phase 2) means students see the whole system before coding, and Copilot has every spec available as context later.

---

## 11. Stretch Goals (for fast finishers)

- Monthly interest on the loan balance (simulate with a "run month-end" admin endpoint).
- Wire fee of $15 recorded as a separate `FEE` transaction.
- Daily withdrawal limit across multiple withdrawals.
- Export transaction history to CSV.
- A second custom agent, e.g. a "security auditor" or a "test-gap finder."
- A handoff from the critical-reviewer agent to an implementation agent that fixes the findings.
- A "spec writer" custom agent that only edits `.feature` files and refuses to touch code.
- A coverage report showing every scenario has a passing test.

---

## 12. Deliverables Checklist

- [ ] `bank-api` runs with one command (`npm run dev` or `uvicorn ...`) and all tests pass
- [ ] `bank-web` runs with one command and talks to the API
- [ ] `README.md` with setup, run, and **test** instructions for both projects
- [ ] One reviewed `.feature` file per user story; every acceptance criterion maps to a scenario
- [ ] Every scenario has a test; git history shows a red commit before the green commit for each story
- [ ] `.github/copilot-instructions.md` plus at least two `*.instructions.md` files with `applyTo`
- [ ] At least three prompt files (`/write-feature`, `/feature-to-tests`, `/make-it-pass`)
- [ ] At least one skill
- [ ] `critical-reviewer.agent.md`
- [ ] `reviews/review-1.md` and `reviews/review-2.md`, with Critical findings from review 1 fixed
- [ ] All 10 user stories meet their acceptance criteria
