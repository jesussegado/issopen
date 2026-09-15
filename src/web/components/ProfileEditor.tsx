import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ImageImportError } from "../../shared/image-validation.js";
import {
  displayNameSchema,
  type PersonalProfile,
} from "../../shared/profile-contract.js";
import { ApiError, apiRequest } from "../lib/api.js";
import { importAvatar } from "../lib/avatar-import.js";
import { Button, Field, Skeleton, StatusBanner, TextInput } from "./ui.js";

export function ProfileEditor({
  onSaved,
}: {
  onSaved?: ((name: string) => void) | undefined;
}) {
  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [name, setName] = useState(""),
    [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false),
    [compare, setCompare] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const file = useRef<HTMLInputElement>(null),
    generation = useRef(0);
  const load = useCallback(async (keepDraft = false, signal?: AbortSignal) => {
    setBusy(true);
    const request = generation.current;
    try {
      const { profile: current } = await apiRequest<{
        profile: PersonalProfile;
      }>("/api/v1/account/profile", {
        cache: "no-store",
        signal: signal ?? null,
      });
      if (signal?.aborted || request !== generation.current) return;
      setProfile(current);
      if (!keepDraft) {
        setName(current.name);
        setAvatar(current.avatarPng);
      }
      setCompare(keepDraft);
      setConflict(false);
      setError("");
    } catch {
      if (!signal?.aborted && request === generation.current)
        setError(
          "Couldn't load your profile. Retry without leaving this page.",
        );
    } finally {
      if (!signal?.aborted && request === generation.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(false, controller.signal);
    return () => {
      generation.current++;
      controller.abort();
    };
  }, [load]);
  const dirty =
    profile !== null && (name !== profile.name || avatar !== profile.avatarPng);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile || busy || conflict) return;
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(
        "Use a name of 1–120 characters, without markup or control characters.",
      );
      return;
    }
    const request = generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { profile: saved } = await apiRequest<{ profile: PersonalProfile }>(
        "/api/v1/account/profile",
        {
          method: "PATCH",
          body: JSON.stringify({
            expectedVersion: profile.version,
            name: parsed.data,
            avatarPng: avatar,
          }),
        },
      );
      if (request !== generation.current) return;
      setProfile(saved);
      setName(saved.name);
      setAvatar(saved.avatarPng);
      setCompare(false);
      setNotice(
        "Profile saved. Your login identity and previous activity are unchanged.",
      );
      onSaved?.(saved.name);
    } catch (caught) {
      if (request !== generation.current) return;
      setConflict(caught instanceof ApiError && caught.status === 409);
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Couldn't confirm the save. Your draft is still here; retry or reload the current profile to compare.",
      );
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  if (!profile)
    return (
      <section className="detail-panel form-stack">
        <h2>Edit profile</h2>
        {error ? (
          <>
            <StatusBanner error>{error}</StatusBanner>
            <Button onClick={() => void load()} disabled={busy}>
              Retry profile
            </Button>
          </>
        ) : (
          <Skeleton label="Loading profile…" />
        )}
      </section>
    );
  return (
    <section className="detail-panel form-stack">
      <h2>Edit profile</h2>
      <p className="metadata">
        Your name and avatar identify you in shared projects across your
        workspaces. Login email and Google identity do not change here.
      </p>
      {error ? <StatusBanner error>{error}</StatusBanner> : null}
      {notice ? <StatusBanner>{notice}</StatusBanner> : null}
      {conflict ? (
        <Button
          disabled={busy}
          variant="secondary"
          onClick={() => void load(true)}
        >
          Load current profile to compare
        </Button>
      ) : null}
      {compare ? (
        <div className="status-banner">
          <p>
            Current saved name: <strong>{profile.name}</strong>. Your draft
            remains below. Review before saving again.
          </p>
          {profile.avatarPng ? (
            <img
              className="profile-avatar"
              src={profile.avatarPng}
              alt="Current saved avatar"
            />
          ) : (
            <p>Current saved avatar: none.</p>
          )}
        </div>
      ) : null}
      <form className="form-stack" onSubmit={save}>
        <Field label="Display name" required htmlFor="profile-name">
          <TextInput
            id="profile-name"
            value={name}
            maxLength={120}
            required
            disabled={busy}
            onChange={(event) => {
              setName(event.target.value);
              setNotice("");
            }}
          />
        </Field>
        {avatar ? (
          <img
            className="profile-avatar"
            src={avatar}
            alt="Your avatar preview"
          />
        ) : (
          <p className="metadata">No custom avatar.</p>
        )}
        <div className="button-row">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => file.current?.click()}
          >
            Choose avatar
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !avatar}
            onClick={() => {
              setAvatar(null);
              setNotice("");
            }}
          >
            Remove avatar
          </Button>
        </div>
        <input
          ref={file}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp"
          aria-label="Choose avatar image"
          disabled={busy}
          onChange={async (event) => {
            const selected = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!selected) return;
            const request = generation.current;
            setBusy(true);
            setError("");
            setNotice("");
            try {
              const next = await importAvatar(selected);
              if (request === generation.current) setAvatar(next);
            } catch (caught) {
              if (request === generation.current)
                setError(
                  caught instanceof ImageImportError
                    ? caught.message
                    : "The image could not be prepared. Choose a valid PNG, JPEG or WebP.",
                );
            } finally {
              if (request === generation.current) setBusy(false);
            }
          }}
        />
        <p className="helper-copy">
          Up to 4 MiB and 8 megapixels. Prepared locally as a small PNG (up to
          128×128). Nothing uploads until Save profile. Removal also takes
          effect on Save.
        </p>
        <div className="button-row">
          <Button type="submit" disabled={busy || conflict || !dirty}>
            {busy ? "Working…" : "Save profile"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !dirty}
            onClick={() => {
              setName(profile.name);
              setAvatar(profile.avatarPng);
              setNotice("Draft discarded.");
            }}
          >
            Cancel profile changes
          </Button>
        </div>
      </form>
    </section>
  );
}
