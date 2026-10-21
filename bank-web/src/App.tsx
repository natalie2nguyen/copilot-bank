import { useState, type FormEvent } from "react";
import ProfilePage from "./ProfilePage";
import "./App.css";

type Mode = "register" | "login";

type RegistrationResponse = {
  profile: { name: string; email: string };
  account: {
    accountNumber: string;
    balanceCents: number;
    formattedBalance: string;
  };
};

type ApiErrorResponse = {
  error?: { message?: string };
};

function App() {
  const [mode, setMode] = useState<Mode>("register");
  const [token, setToken] = useState(
    () => sessionStorage.getItem("bankToken") ?? "",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAccount, setCreatedAccount] =
    useState<RegistrationResponse["account"] | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setCreatedAccount(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    };
    if (mode === "register") {
      payload.name = String(formData.get("name"));
    }

    try {
      const response = await fetch(
        mode === "register" ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as
        | RegistrationResponse
        | { token: string }
        | ApiErrorResponse;

      if (!response.ok) {
        const apiError = result as ApiErrorResponse;
        throw new Error(apiError.error?.message ?? "The request could not be completed.");
      }

      if (mode === "register") {
        const registration = result as RegistrationResponse;
        setCreatedAccount(registration.account);
        setMessage(`Account created for ${registration.profile.email}.`);
      } else {
        const login = result as { token: string };
        sessionStorage.setItem("bankToken", login.token);
        setToken(login.token);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not connect to the bank API. Is it running?",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage("");
    setError("");
    setCreatedAccount(null);
  }

  function signOut() {
    sessionStorage.removeItem("bankToken");
    setToken("");
    setMode("login");
    setMessage("");
    setError("");
  }

  if (token) {
    return <ProfilePage token={token} onLogout={signOut} />;
  }

  return (
    <main className="page">
      <header className="brand">
        <span className="brand-mark" aria-hidden="true">C</span>
        <span>Community Bank</span>
      </header>

      <section className="card" aria-labelledby="form-title">
        <p className="eyebrow">BANKING, MADE SIMPLE</p>
        <h1 id="form-title">
          {mode === "register" ? "Open your account" : "Welcome back"}
        </h1>
        <p className="intro">
          {mode === "register"
            ? "Create an account to get started."
            : "Sign in to your Community Bank account."}
        </p>

        <div className="mode-switch" aria-label="Account access">
          <button
            type="button"
            className={mode === "register" ? "selected" : ""}
            aria-pressed={mode === "register"}
            onClick={() => changeMode("register")}
          >
            Create account
          </button>
          <button
            type="button"
            className={mode === "login" ? "selected" : ""}
            aria-pressed={mode === "login"}
            onClick={() => changeMode("login")}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <label>
              Full name
              <input
                autoComplete="name"
                name="name"
                placeholder="Taylor Example"
                required
              />
            </label>
          )}
          <label>
            Email address
            <input
              autoComplete="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </label>
          <label>
            Password
            <input
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              minLength={mode === "register" ? 8 : 1}
              name="password"
              placeholder={mode === "register" ? "At least 8 characters" : ""}
              required
              type="password"
            />
          </label>
          <button className="submit" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? "Please wait..."
              : mode === "register"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        {error && <p className="notice error" role="alert">{error}</p>}
        {message && <p className="notice success" role="status">{message}</p>}
        {createdAccount && (
          <div className="account-summary" aria-label="Created account details">
            <span>Account number</span>
            <strong>{createdAccount.accountNumber}</strong>
            <span>Starting balance</span>
            <strong>{createdAccount.formattedBalance}</strong>
          </div>
        )}
      </section>
      <footer>For learning and demonstration only.</footer>
    </main>
  );
}

export default App;
