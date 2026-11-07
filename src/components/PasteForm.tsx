"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Format = "text" | "code" | "markdown";

export type EditInitial = {
  slug: string;
  title: string;
  format: Format;
  language: string;
  content: string;
  burnAfterRead: boolean;
  hasPassword: boolean;
  expiresLabel: string;
};

type Props = { mode: "create" } | { mode: "edit"; initial: EditInitial };

type SlugResult =
  | { status: "available" }
  | { status: "unavailable"; message: string }
  | { status: "unknown" };

const SLUG_MESSAGES: Record<string, string> = {
  invalid_slug: "Use lowercase letters, digits, hyphens and underscores (1 to 64).",
  reserved_slug: "That link is reserved.",
  slug_taken: "That link is already in use.",
};

const FORMATS: { value: Format; label: string }[] = [
  { value: "text", label: "Plain text" },
  { value: "code", label: "Code" },
  { value: "markdown", label: "Markdown" },
];

export function PasteForm(props: Props) {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [format, setFormat] = useState<Format>(initial?.format ?? "text");
  const [content, setContent] = useState(initial?.content ?? "");
  const [burn, setBurn] = useState(initial?.burnAfterRead ?? false);
  const [passwordMode, setPasswordMode] = useState<"keep" | "remove" | "set">(
    initial?.hasPassword ? "keep" : "set",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // A result is stored with the slug it was checked for, so a stale one never shows.
  const [checked, setChecked] = useState<{ slug: string; result: SlugResult } | null>(null);

  const value = slug.trim().toLowerCase();
  const checkable = value !== "" && value !== initial?.slug;
  const slugState = !checkable
    ? null
    : checked?.slug === value
      ? checked.result
      : ({ status: "checking" } as const);

  // The availability check only improves the experience. The database decides.
  useEffect(() => {
    if (!checkable) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/slugs/${encodeURIComponent(value)}`, { signal: controller.signal });
        if (!res.ok) return setChecked({ slug: value, result: { status: "unknown" } });
        const body = await res.json();
        setChecked({
          slug: value,
          result: body.available
            ? { status: "available" }
            : { status: "unavailable", message: SLUG_MESSAGES[body.reason] ?? "That link can't be used." },
        });
      } catch {
        // Aborted or offline. The next keystroke checks again.
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, checkable]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "");
    const password = text("password");
    if (passwordMode === "set" && initial?.hasPassword && !password) {
      setError("Enter the new password, or choose another option.");
      return;
    }

    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      let res: Response;
      if (props.mode === "create") {
        res = await fetch("/api/pastes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: slug || undefined,
            title: text("title") || undefined,
            format,
            language: format === "code" ? text("language") || undefined : undefined,
            content,
            expiresIn: text("expiresIn"),
            password: password || undefined,
            burnAfterRead: burn,
          }),
        });
      } else {
        const body: Record<string, unknown> = {
          slug: slug.trim() || props.initial.slug,
          title: text("title") || null,
          format,
          language: format === "code" ? text("language") || null : null,
          content,
          burnAfterRead: burn,
        };
        if (text("expiresIn") !== "keep") body.expiresIn = text("expiresIn");
        if (passwordMode === "remove") body.password = null;
        if (passwordMode === "set" && password) body.password = password;
        res = await fetch(`/api/pastes/${encodeURIComponent(props.initial.slug)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const body = await res.json().catch(() => null);
      if (res.status === 401 && body?.error?.code === "unauthorized") {
        router.replace("/login");
        return;
      }
      if (res.ok) {
        if (props.mode === "create") setCreated(body.url);
        else router.push(`/${body.slug}`);
        return;
      }
      // The form keeps what was typed, so the user can pick another link.
      setError(body?.error?.message ?? "Something went wrong. Try again.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (props.mode !== "edit") return;
    if (!window.confirm("Delete this paste? Its link stops working right away.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/pastes/${encodeURIComponent(props.initial.slug)}`, { method: "DELETE" });
      if (res.status === 204) {
        router.push("/");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Could not delete the paste.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked. The link is selectable in the field.
    }
  }

  const slugHintClass =
    slugState?.status === "unavailable" ? "error" : slugState?.status === "available" ? "ok" : "hint";
  const bytes = new TextEncoder().encode(content).length;

  return (
    <form className="stack-lg" onSubmit={onSubmit}>
      <section className="card form-card">
        <div className="row">
          <div className="field">
            <label htmlFor="slug">{props.mode === "edit" ? "Link" : "Custom link (optional)"}</label>
            <div className="input-prefix">
              <span aria-hidden="true">/</span>
              <input
                id="slug"
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={64}
                placeholder="standup-notes"
                aria-describedby="slug-hint"
              />
            </div>
            <p id="slug-hint" className={slugHintClass}>
              {slugState?.status === "checking" && "Checking..."}
              {slugState?.status === "available" && "Available."}
              {slugState?.status === "unavailable" && slugState.message}
              {slugState?.status === "unknown" && "Couldn't check. The server will decide."}
              {!slugState && (props.mode === "edit" ? "Renaming breaks the old link right away." : "Leave blank for a random link.")}
            </p>
          </div>
          <div className="field">
            <label htmlFor="title">Title (optional)</label>
            <input id="title" name="title" maxLength={200} autoComplete="off" defaultValue={initial?.title} />
            <p className="hint spacer" aria-hidden="true">&nbsp;</p>
          </div>
        </div>

        <div className="field">
          <span className="label" id="format-label">
            Format
          </span>
          <div className="segmented segmented-lg" role="group" aria-labelledby="format-label">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={format === f.value}
                onClick={() => setFormat(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {format === "code" && (
          <div className="field">
            <label htmlFor="language">Language (optional, detected if blank)</label>
            <input
              id="language"
              name="language"
              maxLength={50}
              autoComplete="off"
              placeholder="typescript"
              defaultValue={initial?.language}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="content">Content</label>
          <textarea
            id="content"
            name="content"
            required
            spellCheck={false}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") e.currentTarget.form?.requestSubmit();
            }}
            placeholder="Paste or type here..."
          />
          <p className="hint">
            {content.length.toLocaleString()} characters · {bytes.toLocaleString()} bytes · press Ctrl or ⌘ + Enter to
            save
          </p>
        </div>
      </section>

      <section className="card form-card">
        <h2 className="section-title">Options</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="expiresIn">Expires</label>
            <select id="expiresIn" name="expiresIn" defaultValue={initial ? "keep" : "30d"}>
              {initial && <option value="keep">Keep current ({initial.expiresLabel})</option>}
              <option value="1h">{initial ? "1 hour from now" : "In 1 hour"}</option>
              <option value="1d">{initial ? "1 day from now" : "In 1 day"}</option>
              <option value="7d">{initial ? "7 days from now" : "In 7 days"}</option>
              <option value="30d">{initial ? "30 days from now" : "In 30 days"}</option>
              <option value="never">Never</option>
            </select>
          </div>
          <div className="field">
            {initial?.hasPassword ? (
              <>
                <label htmlFor="passwordMode">Password</label>
                <select
                  id="passwordMode"
                  value={passwordMode}
                  onChange={(e) => setPasswordMode(e.target.value as "keep" | "remove" | "set")}
                >
                  <option value="keep">Keep current password</option>
                  <option value="set">Change password</option>
                  <option value="remove">Remove password</option>
                </select>
              </>
            ) : (
              <label htmlFor="password">Password (optional)</label>
            )}
            {passwordMode === "set" && (
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                maxLength={200}
                placeholder={initial?.hasPassword ? "New password" : "Leave blank for none"}
              />
            )}
          </div>
        </div>

        <label className="switch">
          <input type="checkbox" checked={burn} onChange={(e) => setBurn(e.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
          <span className="switch-text">
            <strong>Burn after reading</strong>
            <span className="hint">Deleted the first time someone opens it. Raw access is turned off.</span>
          </span>
        </label>
      </section>

      {error && (
        <div className="notice notice-error" role="alert">
          <Icon name="alert" />
          <p>{error}</p>
        </div>
      )}

      <div className="actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? "Saving..." : props.mode === "edit" ? "Save changes" : "Create paste"}
        </button>
        {props.mode === "edit" && (
          <>
            <a className="btn btn-ghost btn-lg" href={`/${props.initial.slug}`}>
              Cancel
            </a>
            <button type="button" className="btn btn-danger btn-lg push-right" onClick={remove} disabled={busy}>
              <Icon name="trash" />
              <span>Delete</span>
            </button>
          </>
        )}
      </div>

      {created && (
        <section className="card result" role="status" aria-label="Paste created">
          <h2 className="section-title">Paste created</h2>
          <label htmlFor="created-link" className="sr-only">
            Your link
          </label>
          <input id="created-link" readOnly value={created} onFocus={(e) => e.currentTarget.select()} />
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={copy}>
              <Icon name={copied ? "check" : "copy"} />
              <span>{copied ? "Copied" : "Copy link"}</span>
            </button>
            <a className="btn btn-ghost" href={created}>
              Open
            </a>
          </div>
        </section>
      )}
    </form>
  );
}
