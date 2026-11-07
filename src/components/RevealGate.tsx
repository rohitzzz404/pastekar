"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { PasteBody } from "./PasteBody";

type Revealed = {
  title: string | null;
  format: "text" | "code" | "markdown";
  language: string | null;
  content: string | null;
};

export function RevealGate({ slug }: { slug: string }) {
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pastes/${encodeURIComponent(slug)}/reveal`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setRevealed(body);
      } else if (res.status === 404) {
        setError("This paste has already been opened, so it no longer exists.");
      } else {
        setError(body?.error?.message ?? "Could not reveal the paste.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (revealed) {
    return (
      <div className="stack">
        <div className="notice notice-warn" role="status">
          <Icon name="flame" />
          <p>
            <strong>This paste is now deleted.</strong> Copy or download it before you leave. It can&apos;t be
            opened again.
          </p>
        </div>
        {revealed.title && <h1 className="paste-title">{revealed.title}</h1>}
        <PasteBody content={revealed.content ?? ""} format={revealed.format} language={revealed.language} slug={slug} />
      </div>
    );
  }

  return (
    <div className="card gate">
      <div className="gate-icon gate-icon-warn">
        <Icon name="flame" />
      </div>
      <h1>This paste burns after reading</h1>
      <p className="muted">
        It is deleted the moment you open it, and nobody else can see it afterwards. Only continue if you&apos;re
        ready to read it now.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-primary" onClick={reveal} disabled={busy}>
        <Icon name="eye" />
        <span>{busy ? "Opening..." : "Reveal paste"}</span>
      </button>
    </div>
  );
}
