import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  formatCentsAsCurrency,
  parseDepositAmountToCents,
  parseLoanAmountToCents,
  parseLoanPaymentAmountToCents,
  parseWithdrawalAmountToCents,
} from "./money";

type Address = {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

type Profile = {
  name: string;
  email: string;
  address?: Address;
  avatarUrl?: string;
};

type BalanceResponse = {
  balanceCents: number;
  formattedBalance: string;
};

type LoanBalance = {
  loanBalanceCents: number;
  creditLimitCents: number;
  availableCreditCents: number;
};

type LoanBalanceResponse = LoanBalance;

type DepositTransaction = {
  type: "DEPOSIT";
  amountCents: number;
  timestamp: string;
  resultingBalanceCents: number;
  memo?: string;
};

type DepositResponse = {
  newBalanceCents: number;
  transaction: DepositTransaction;
};

type WithdrawalTransaction = Omit<DepositTransaction, "type"> & {
  type: "WITHDRAWAL";
};

type WithdrawalResponse = {
  newBalanceCents: number;
  transaction: WithdrawalTransaction;
};

type LoanDrawTransaction = {
  type: "LOAN_DRAW";
  amountCents: number;
  timestamp: string;
  resultingBalanceCents: number;
};

type LoanDrawResponse = {
  balanceCents: number;
  loanBalanceCents: number;
  transaction: LoanDrawTransaction;
};

type LoanPaymentTransaction = {
  type: "LOAN_PAYMENT";
  amountCents: number;
  timestamp: string;
  resultingBalanceCents: number;
};

type LoanPaymentResponse = {
  balanceCents: number;
  loanBalanceCents: number;
  transaction: LoanPaymentTransaction;
};

type ProfileDraft = {
  name: string;
  email: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type ProfileChanges = {
  name?: string;
  email?: string;
  address?: Address;
};

type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

const invalidTransactionMessage =
  "The transaction is invalid. Enter an amount from $0.01 to $10,000.00 with no more than two decimal places.";
const invalidBorrowMessage =
  "Enter a positive amount with no more than two decimal places.";
const invalidPaymentMessage =
  "Enter a positive payment with no more than two decimal places.";

const addressFields: Array<keyof Address> = [
  "street",
  "city",
  "state",
  "postalCode",
  "country",
];

async function responseError(
  response: Response,
  messagesByCode: Record<string, string> = {},
): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.error?.code && messagesByCode[body.error.code]) {
      return messagesByCode[body.error.code];
    }
    if (body.error?.message) return body.error.message;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
  return `Request failed with status ${response.status}.`;
}

function draftFromProfile(profile: Profile): ProfileDraft {
  return {
    name: profile.name,
    email: profile.email,
    street: profile.address?.street ?? "",
    city: profile.address?.city ?? "",
    state: profile.address?.state ?? "",
    postalCode: profile.address?.postalCode ?? "",
    country: profile.address?.country ?? "",
  };
}

function getProfileChanges(
  profile: Profile,
  draft: ProfileDraft,
): ProfileChanges {
  const changes: ProfileChanges = {};
  if (draft.name !== profile.name) changes.name = draft.name;
  if (draft.email !== profile.email) changes.email = draft.email;

  const addressChanges: Address = {};
  for (const field of addressFields) {
    const value = draft[field];
    if (value === (profile.address?.[field] ?? "")) continue;
    if (value !== "" || field === "postalCode") {
      addressChanges[field] = value;
    }
  }
  if (Object.keys(addressChanges).length > 0) {
    changes.address = addressChanges;
  }
  return changes;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words.length === 1
    ? words[0].slice(0, 2).toUpperCase()
    : `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

type ProfilePageProps = {
  token: string;
  onLogout: () => void;
};

export default function ProfilePage({ token, onLogout }: ProfilePageProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [avatarSource, setAvatarSource] = useState("");
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [loanBalance, setLoanBalance] = useState<LoanBalance | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMemo, setDepositMemo] = useState("");
  const [depositError, setDepositError] = useState("");
  const [depositTransaction, setDepositTransaction] =
    useState<DepositTransaction | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalMemo, setWithdrawalMemo] = useState("");
  const [withdrawalError, setWithdrawalError] = useState("");
  const [withdrawalTransaction, setWithdrawalTransaction] =
    useState<WithdrawalTransaction | null>(null);
  const [borrowAmount, setBorrowAmount] = useState("");
  const [borrowError, setBorrowError] = useState("");
  const [borrowTransaction, setBorrowTransaction] =
    useState<LoanDrawTransaction | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentTransaction, setPaymentTransaction] =
    useState<LoanPaymentTransaction | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      setError("");
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [profileResponse, balanceResponse, loanBalanceResponse] = await Promise.all([
          fetch("/api/me", { headers, signal: controller.signal }),
          fetch("/api/accounts/me/balance", { headers, signal: controller.signal }),
          fetch("/api/loans/balance", { headers, signal: controller.signal }),
        ]);
        if (!profileResponse.ok) {
          throw new Error(await responseError(profileResponse));
        }
        if (!balanceResponse.ok) {
          throw new Error(await responseError(balanceResponse));
        }
        if (!loanBalanceResponse.ok) {
          throw new Error(await responseError(loanBalanceResponse));
        }
        const [currentProfile, balance, currentLoanBalance] = await Promise.all([
          profileResponse.json() as Promise<Profile>,
          balanceResponse.json() as Promise<BalanceResponse>,
          loanBalanceResponse.json() as Promise<LoanBalanceResponse>,
        ]);
        setProfile(currentProfile);
        setDraft(draftFromProfile(currentProfile));
        setBalanceCents(balance.balanceCents);
        setLoanBalance(currentLoanBalance);
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Could not load your profile.");
      }
    }

    void loadProfile();
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    let objectUrl = "";
    const controller = new AbortController();

    async function loadAvatar() {
      if (!profile?.avatarUrl) {
        setAvatarSource("");
        return;
      }

      try {
        const response = await fetch(profile.avatarUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(await responseError(response));
        }
        objectUrl = URL.createObjectURL(await response.blob());
        setAvatarSource(objectUrl);
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Could not load your picture.");
      }
    }

    void loadAvatar();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile?.avatarUrl, token, avatarRevision]);

  function updateDraft(field: keyof ProfileDraft, value: string) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
    setMessage("");
    setError("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !draft) return;

    const changes = getProfileChanges(profile, draft);

    if (Object.keys(changes).length === 0) {
      setMessage("There are no profile changes to save.");
      setError("");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const updatedProfile = (await response.json()) as Profile;
      setProfile(updatedProfile);
      setDraft(draftFromProfile(updatedProfile));
      setMessage("Your profile has been updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessage("");
    setError("");
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const response = await fetch("/api/me/avatar", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) throw new Error(await responseError(response));
      const updatedProfile = (await response.json()) as Profile;
      setProfile(updatedProfile);
      setDraft(draftFromProfile(updatedProfile));
      setAvatarRevision((revision) => revision + 1);
      setMessage("Your profile picture has been uploaded.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload your picture.");
    } finally {
      input.value = "";
      setIsUploading(false);
    }
  }

  async function removeAvatar() {
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/me/avatar", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(await responseError(response));
      setProfile((current) => current
        ? { ...current, avatarUrl: undefined }
        : current);
      setAvatarSource("");
      setMessage("Your profile picture has been removed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove your picture.");
    }
  }

  async function submitDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setDepositError("");
    setDepositTransaction(null);

    let amountCents: number;
    try {
      amountCents = parseDepositAmountToCents(depositAmount);
    } catch {
      setDepositError(invalidTransactionMessage);
      return;
    }

    setIsDepositing(true);
    try {
      const response = await fetch("/api/accounts/me/deposits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amountCents,
          ...(depositMemo.trim() ? { memo: depositMemo.trim() } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, {
          INVALID_AMOUNT: invalidTransactionMessage,
        }));
      }
      const result = (await response.json()) as DepositResponse;
      setBalanceCents(result.newBalanceCents);
      setDepositTransaction(result.transaction);
      setDepositAmount("");
      setDepositMemo("");
      setMessage(`Deposit complete. Your new balance is ${formatCentsAsCurrency(result.newBalanceCents)}.`);
    } catch (caught) {
      setDepositError(
        caught instanceof Error
          ? caught.message
          : "Could not complete the deposit.",
      );
    } finally {
      setIsDepositing(false);
    }
  }

  async function submitWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setWithdrawalError("");
    setWithdrawalTransaction(null);

    let amountCents: number;
    try {
      amountCents = parseWithdrawalAmountToCents(withdrawalAmount);
    } catch {
      setWithdrawalError(invalidTransactionMessage);
      return;
    }

    setIsWithdrawing(true);
    try {
      const response = await fetch("/api/accounts/me/withdrawals", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amountCents,
          ...(withdrawalMemo.trim() ? { memo: withdrawalMemo.trim() } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, {
          INVALID_AMOUNT: invalidTransactionMessage,
        }));
      }
      const result = (await response.json()) as WithdrawalResponse;
      setBalanceCents(result.newBalanceCents);
      setWithdrawalTransaction(result.transaction);
      setWithdrawalAmount("");
      setWithdrawalMemo("");
      setMessage(`Withdrawal complete. Your new balance is ${formatCentsAsCurrency(result.newBalanceCents)}.`);
    } catch (caught) {
      setWithdrawalError(
        caught instanceof Error
          ? caught.message
          : "Could not complete the withdrawal.",
      );
    } finally {
      setIsWithdrawing(false);
    }
  }

  async function submitBorrow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBorrowError("");
    setBorrowTransaction(null);

    let amountCents: number;
    try {
      amountCents = parseLoanAmountToCents(borrowAmount);
    } catch {
      setBorrowError(invalidBorrowMessage);
      return;
    }

    setIsBorrowing(true);
    try {
      const response = await fetch("/api/loans/draws", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amountCents }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, {
          CREDIT_LIMIT_EXCEEDED:
            "Credit limit exceeded (CREDIT_LIMIT_EXCEEDED). Reduce the amount and try again.",
          INVALID_AMOUNT: invalidBorrowMessage,
        }));
      }
      const result = (await response.json()) as LoanDrawResponse;
      setBalanceCents(result.balanceCents);
      setLoanBalance((current) => current
        ? {
            ...current,
            loanBalanceCents: result.loanBalanceCents,
            availableCreditCents: current.creditLimitCents - result.loanBalanceCents,
          }
        : current);
      setBorrowTransaction(result.transaction);
      setBorrowAmount("");
      setMessage(
        `Borrow complete. Your checking balance is ${formatCentsAsCurrency(result.balanceCents)}.`,
      );
    } catch (caught) {
      setBorrowError(
        caught instanceof Error ? caught.message : "Could not complete the borrow.",
      );
    } finally {
      setIsBorrowing(false);
    }
  }

  async function submitLoanPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setPaymentError("");
    setPaymentTransaction(null);

    let amountCents: number;
    try {
      amountCents = parseLoanPaymentAmountToCents(paymentAmount);
    } catch {
      setPaymentError(invalidPaymentMessage);
      return;
    }

    setIsPaying(true);
    try {
      const response = await fetch("/api/loans/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amountCents }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, {
          OVERPAYMENT:
            "Payment exceeds the outstanding loan balance (OVERPAYMENT).",
          INSUFFICIENT_FUNDS:
            "Checking balance is too low for this payment (INSUFFICIENT_FUNDS).",
          NO_OUTSTANDING_LOAN:
            "There is no outstanding loan to pay (NO_OUTSTANDING_LOAN).",
          INVALID_AMOUNT: invalidPaymentMessage,
        }));
      }
      const result = (await response.json()) as LoanPaymentResponse;
      setBalanceCents(result.balanceCents);
      setLoanBalance((current) => current
        ? {
            ...current,
            loanBalanceCents: result.loanBalanceCents,
            availableCreditCents: current.creditLimitCents - result.loanBalanceCents,
          }
        : current);
      setPaymentTransaction(result.transaction);
      setPaymentAmount("");
      setMessage("Loan payment complete.");
    } catch (caught) {
      setPaymentError(
        caught instanceof Error ? caught.message : "Could not complete the loan payment.",
      );
    } finally {
      setIsPaying(false);
    }
  }

  function setFullPaymentAmount() {
    if (!loanBalance || loanBalance.loanBalanceCents === 0) return;
    setPaymentAmount(formatCentsAsCurrency(loanBalance.loanBalanceCents));
    setPaymentError("");
    setPaymentTransaction(null);
    setMessage("");
  }

  if (!profile || !draft) {
    return (
      <main className="page">
        <header className="brand">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>Copilot Bank</span>
        </header>
        {error
          ? <p className="notice error" role="alert">{error}</p>
          : <p className="intro">Loading your profile...</p>}
        {error && <button className="secondary-button" onClick={onLogout}>Back to sign in</button>}
      </main>
    );
  }

  return (
    <main className="page profile-page">
      <header className="brand">
        <span className="brand-mark" aria-hidden="true">C</span>
        <span>Copilot Bank</span>
        <button className="logout-button" onClick={onLogout} type="button">
          Sign out
        </button>
      </header>

      <section className="card profile-card" aria-labelledby="profile-title">
        <div className="profile-heading">
          <div className="avatar" aria-label="Profile picture">
            {avatarSource
              ? <img alt={`${profile.name}'s profile`} src={avatarSource} />
              : <span>{initials(profile.name)}</span>}
          </div>
          <div>
            <p className="eyebrow">YOUR ACCOUNT</p>
            <h1 id="profile-title">Profile settings</h1>
            <p className="intro">Keep your contact details up to date.</p>
          </div>
        </div>

        {error && <p className="notice error" role="alert">{error}</p>}
        {message && <p className="notice success" role="status">{message}</p>}

        {balanceCents !== null && (
          <section className="balance-panel" aria-label="Checking balance">
            <span>Checking balance</span>
            <strong>{formatCentsAsCurrency(balanceCents)}</strong>
            <small>{balanceCents.toLocaleString("en-US")} cents</small>
          </section>
        )}
        {loanBalance && (
          <section className="loan-balance-panel" aria-label="Loan balance and available credit">
            <div>
              <span>Loan balance</span>
              <strong>{formatCentsAsCurrency(loanBalance.loanBalanceCents)}</strong>
            </div>
            <div>
              <span>Credit limit</span>
              <strong>{formatCentsAsCurrency(loanBalance.creditLimitCents)}</strong>
            </div>
            <div>
              <span>Available credit</span>
              <strong>{formatCentsAsCurrency(loanBalance.availableCreditCents)}</strong>
            </div>
          </section>
        )}

        <section className="deposit-section" aria-labelledby="deposit-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ADD FUNDS</p>
              <h2 id="deposit-title">Make a deposit</h2>
            </div>
          </div>
          <form className="deposit-form" onSubmit={(event) => void submitDeposit(event)}>
            <label>
              Amount
              <input
                aria-describedby={`deposit-amount-hint${depositError ? " deposit-amount-error" : ""}`}
                autoComplete="off"
                inputMode="decimal"
                onChange={(event) => {
                  setDepositAmount(event.target.value);
                  setDepositError("");
                }}
                placeholder="0.00"
                required
                type="text"
                value={depositAmount}
              />
            </label>
            {depositError && (
              <p className="field-error" id="deposit-amount-error" role="alert">
                {depositError}
              </p>
            )}
            <p className="field-hint" id="deposit-amount-hint">
              Enter $0.01 to $10,000.00, with up to two decimal places.
            </p>
            <label>
              Memo <span className="optional-label">Optional</span>
              <input
                maxLength={500}
                onChange={(event) => setDepositMemo(event.target.value)}
                placeholder="e.g. Paycheck"
                value={depositMemo}
              />
            </label>
            <button
              className="submit"
              disabled={isDepositing || !depositAmount.trim()}
              type="submit"
            >
              {isDepositing ? "Processing..." : "Deposit money"}
            </button>
          </form>
          {depositTransaction && (
            <div className="deposit-result" aria-label="Deposit confirmation">
              <div>
                <strong>Deposit successful</strong>
                <span>{formatCentsAsCurrency(depositTransaction.amountCents)} added</span>
              </div>
              <div>
                <strong>New balance</strong>
                <span>{formatCentsAsCurrency(depositTransaction.resultingBalanceCents)}</span>
              </div>
              {depositTransaction.memo && (
                <div>
                  <strong>Memo</strong>
                  <span>{depositTransaction.memo}</span>
                </div>
              )}
              <div>
                <strong>Recorded</strong>
                <span>{new Date(depositTransaction.timestamp).toLocaleString()}</span>
              </div>
            </div>
          )}
        </section>

        <section className="withdrawal-section" aria-labelledby="withdrawal-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">USE YOUR FUNDS</p>
              <h2 id="withdrawal-title">Withdraw money</h2>
            </div>
          </div>
          <form className="withdrawal-form" onSubmit={(event) => void submitWithdrawal(event)}>
            <label>
              Amount
              <input
                aria-describedby={`withdrawal-amount-hint${withdrawalError ? " withdrawal-amount-error" : ""}`}
                autoComplete="off"
                inputMode="decimal"
                onChange={(event) => {
                  setWithdrawalAmount(event.target.value);
                  setWithdrawalError("");
                }}
                placeholder="0.00"
                required
                type="text"
                value={withdrawalAmount}
              />
            </label>
            {withdrawalError && (
              <p className="field-error" id="withdrawal-amount-error" role="alert">
                {withdrawalError}
              </p>
            )}
            <p className="field-hint" id="withdrawal-amount-hint">
              Enter $0.01 to $10,000.00, with up to two decimal places.
            </p>
            <label>
              Memo <span className="optional-label">Optional</span>
              <input
                maxLength={500}
                onChange={(event) => setWithdrawalMemo(event.target.value)}
                placeholder="e.g. Cash withdrawal"
                value={withdrawalMemo}
              />
            </label>
            <button
              className="withdraw-submit"
              disabled={isWithdrawing || !withdrawalAmount.trim()}
              type="submit"
            >
              {isWithdrawing ? "Processing..." : "Withdraw money"}
            </button>
          </form>
          {withdrawalTransaction && (
            <div className="withdrawal-result" aria-label="Withdrawal confirmation">
              <div>
                <strong>Withdrawal successful</strong>
                <span>{formatCentsAsCurrency(withdrawalTransaction.amountCents)} withdrawn</span>
              </div>
              <div>
                <strong>New balance</strong>
                <span>{formatCentsAsCurrency(withdrawalTransaction.resultingBalanceCents)}</span>
              </div>
              {withdrawalTransaction.memo && (
                <div>
                  <strong>Memo</strong>
                  <span>{withdrawalTransaction.memo}</span>
                </div>
              )}
              <div>
                <strong>Recorded</strong>
                <span>{new Date(withdrawalTransaction.timestamp).toLocaleString()}</span>
              </div>
            </div>
          )}
        </section>

        <section className="borrow-section" aria-labelledby="borrow-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CREDIT LINE</p>
              <h2 id="borrow-title">Borrow funds</h2>
            </div>
          </div>
          <form className="borrow-form" onSubmit={(event) => void submitBorrow(event)}>
            <label>
              Amount
              <input
                aria-describedby={`borrow-amount-hint${borrowError ? " borrow-amount-error" : ""}`}
                autoComplete="off"
                inputMode="decimal"
                onChange={(event) => {
                  setBorrowAmount(event.target.value);
                  setBorrowError("");
                }}
                placeholder="0.00"
                required
                type="text"
                value={borrowAmount}
              />
            </label>
            {borrowError && (
              <p className="field-error" id="borrow-amount-error" role="alert">
                {borrowError}
              </p>
            )}
            <p className="field-hint" id="borrow-amount-hint">
              Available credit:{" "}
              {loanBalance
                ? formatCentsAsCurrency(loanBalance.availableCreditCents)
                : "Loading..."}
              . Enter a positive amount with up to two decimal places.
            </p>
            <button
              className="submit"
              disabled={isBorrowing || !borrowAmount.trim()}
              type="submit"
            >
              {isBorrowing ? "Processing..." : "Borrow funds"}
            </button>
          </form>
          {borrowTransaction && (
            <div className="borrow-result" aria-label="Borrow confirmation">
              <div>
                <strong>Borrow successful</strong>
                <span>{formatCentsAsCurrency(borrowTransaction.amountCents)} added to checking</span>
              </div>
              <div>
                <strong>Loan balance</strong>
                <span>
                  {loanBalance
                    ? formatCentsAsCurrency(loanBalance.loanBalanceCents)
                    : ""}
                </span>
              </div>
              <div>
                <strong>Transaction</strong>
                <span>LOAN_DRAW</span>
              </div>
              <div>
                <strong>Recorded</strong>
                <span>{new Date(borrowTransaction.timestamp).toLocaleString()}</span>
              </div>
            </div>
          )}
        </section>

        <section className="payment-section" aria-labelledby="payment-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">REDUCE YOUR BALANCE</p>
              <h2 id="payment-title">Pay back funds</h2>
            </div>
          </div>
          <form className="payment-form" onSubmit={(event) => void submitLoanPayment(event)}>
            <label>
              Amount
              <input
                aria-describedby={`payment-amount-hint${paymentError ? " payment-amount-error" : ""}`}
                autoComplete="off"
                inputMode="decimal"
                onChange={(event) => {
                  setPaymentAmount(event.target.value);
                  setPaymentError("");
                }}
                placeholder="0.00"
                required
                type="text"
                value={paymentAmount}
              />
            </label>
            {paymentError && (
              <p className="field-error" id="payment-amount-error" role="alert">
                {paymentError}
              </p>
            )}
            <p className="field-hint" id="payment-amount-hint">
              Loan balance:{" "}
              {loanBalance
                ? formatCentsAsCurrency(loanBalance.loanBalanceCents)
                : "Loading..."}
              . Checking balance:{" "}
              {balanceCents === null
                ? "Loading..."
                : formatCentsAsCurrency(balanceCents)}
              .
            </p>
            <div className="payment-actions">
              <button
                className="secondary-button"
                disabled={isPaying || !loanBalance || loanBalance.loanBalanceCents === 0}
                onClick={setFullPaymentAmount}
                type="button"
              >
                Pay full balance
              </button>
              <button
                className="submit"
                disabled={isPaying || !paymentAmount.trim()}
                type="submit"
              >
                {isPaying ? "Processing..." : "Make loan payment"}
              </button>
            </div>
          </form>
          {paymentTransaction && (
            <div className="payment-result" aria-label="Loan payment confirmation">
              <div>
                <strong>Payment successful</strong>
                <span>{formatCentsAsCurrency(paymentTransaction.amountCents)} paid</span>
              </div>
              <div>
                <strong>Checking balance</strong>
                <span>{formatCentsAsCurrency(paymentTransaction.resultingBalanceCents)}</span>
              </div>
              <div>
                <strong>Loan balance</strong>
                <span>
                  {loanBalance
                    ? formatCentsAsCurrency(loanBalance.loanBalanceCents)
                    : ""}
                </span>
              </div>
              <div>
                <strong>Transaction</strong>
                <span>LOAN_PAYMENT</span>
              </div>
              <div>
                <strong>Recorded</strong>
                <span>{new Date(paymentTransaction.timestamp).toLocaleString()}</span>
              </div>
            </div>
          )}
        </section>

        <section className="picture-section" aria-labelledby="picture-title">
          <div>
            <h2 id="picture-title">Profile picture</h2>
            <p>PNG or JPEG, up to 2 MB.</p>
          </div>
          <div className="picture-actions">
            <label className="upload-button">
              {isUploading ? "Uploading..." : "Choose picture"}
              <input
                aria-label="Upload profile picture"
                disabled={isUploading}
                onChange={(event) => void uploadAvatar(event)}
                type="file"
              />
            </label>
            {profile.avatarUrl && (
              <button className="secondary-button" onClick={() => void removeAvatar()} type="button">
                Remove
              </button>
            )}
          </div>
        </section>

        <form className="profile-form" onSubmit={(event) => void saveProfile(event)}>
          <h2>Contact information</h2>
          <div className="form-grid">
            <label>
              Full name
              <input
                autoComplete="name"
                onChange={(event) => updateDraft("name", event.target.value)}
                required
                value={draft.name}
              />
            </label>
            <label>
              Email address
              <input
                autoComplete="email"
                onChange={(event) => updateDraft("email", event.target.value)}
                required
                type="email"
                value={draft.email}
              />
            </label>
          </div>

          <h2 className="address-heading">Address <span>Optional</span></h2>
          <label>
            Street
            <input
              autoComplete="street-address"
              onChange={(event) => updateDraft("street", event.target.value)}
              value={draft.street}
            />
          </label>
          <div className="form-grid">
            <label>
              City
              <input
                autoComplete="address-level2"
                onChange={(event) => updateDraft("city", event.target.value)}
                value={draft.city}
              />
            </label>
            <label>
              State / region
              <input
                autoComplete="address-level1"
                onChange={(event) => updateDraft("state", event.target.value)}
                value={draft.state}
              />
            </label>
            <label>
              Postal code
              <input
                autoComplete="postal-code"
                onChange={(event) => updateDraft("postalCode", event.target.value)}
                value={draft.postalCode}
              />
            </label>
            <label>
              Country
              <input
                autoComplete="country-name"
                onChange={(event) => updateDraft("country", event.target.value)}
                value={draft.country}
              />
            </label>
          </div>
          <p className="field-hint">
            Address fields are optional. A postal code must contain a value if you change it.
          </p>
          <button
            className="submit"
            disabled={
              isSaving ||
              !profile ||
              !draft ||
              Object.keys(getProfileChanges(profile, draft)).length === 0
            }
            type="submit"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </section>
      <footer>For learning and demonstration only.</footer>
    </main>
  );
}
