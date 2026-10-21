import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

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

type ProfileDraft = {
  name: string;
  email: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type ApiErrorBody = {
  error?: { message?: string };
};

const addressFields: Array<keyof Address> = [
  "street",
  "city",
  "state",
  "postalCode",
  "country",
];

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      setError("");
      try {
        const response = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(await responseError(response));
        }
        const currentProfile = (await response.json()) as Profile;
        setProfile(currentProfile);
        setDraft(draftFromProfile(currentProfile));
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

    const changes: {
      name?: string;
      email?: string;
      address?: Address;
    } = {};
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

  if (!profile || !draft) {
    return (
      <main className="page">
        <header className="brand">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>Community Bank</span>
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
        <span>Community Bank</span>
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
          <button className="submit" disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </section>
      <footer>For learning and demonstration only.</footer>
    </main>
  );
}
