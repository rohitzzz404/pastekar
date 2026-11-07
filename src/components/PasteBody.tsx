"use client";

import hljs from "highlight.js/lib/common";
import { useMemo, useState } from "react";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";

type Format = "text" | "code" | "markdown";

const AUTO_LANGUAGES = [
  "javascript", "typescript", "python", "json", "bash", "sql", "css", "xml",
  "go", "rust", "java", "yaml", "c", "cpp", "csharp", "php", "ruby", "diff", "ini",
];
const MAX_HIGHLIGHT = 300_000;
const MAX_AUTODETECT = 30_000;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// highlight.js escapes its input, so its output is safe to inject.
function toHtml(content: string, format: Format, language: string | null): string {
  if (format === "text" || content.length > MAX_HIGHLIGHT) return escapeHtml(content);
  const lang = language?.trim().toLowerCase();
  if (lang && hljs.getLanguage(lang)) {
    return hljs.highlight(content, { language: lang, ignoreIllegals: true }).value;
  }
  if (format === "code" && content.length <= MAX_AUTODETECT) {
    return hljs.highlightAuto(content, AUTO_LANGUAGES).value;
  }
  return escapeHtml(content);
}

export function PasteBody({
  content,
  format,
  language,
  slug,
}: {
  content: string;
  format: Format;
  language: string | null;
  slug: string;
}) {
  const [wrap, setWrap] = useState(false);
  const [source, setSource] = useState(false);
  const [copied, setCopied] = useState(false);

  const showRendered = format === "markdown" && !source;
  const html = useMemo(
    () => (showRendered ? "" : toHtml(content, format === "markdown" ? "code" : format, format === "markdown" ? "markdown" : language)),
    [content, format, language, showRendered],
  );
  const lines = useMemo(
    () => Array.from({ length: content.replace(/\n$/, "").split("\n").length }, (_, i) => i + 1).join("\n"),
    [content],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be blocked. The text stays selectable.
    }
  }

  function download() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.${format === "markdown" ? "md" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="card paste-card" aria-label="Paste content">
      <div className="toolbar">
        <div className="toolbar-group">
          {format === "markdown" && (
            <div className="segmented" role="group" aria-label="View mode">
              <button type="button" aria-pressed={!source} onClick={() => setSource(false)}>
                Rendered
              </button>
              <button type="button" aria-pressed={source} onClick={() => setSource(true)}>
                Source
              </button>
            </div>
          )}
          {!showRendered && (
            <button type="button" className="btn btn-ghost btn-sm" aria-pressed={wrap} onClick={() => setWrap(!wrap)}>
              <Icon name="wrap" />
              <span>Wrap</span>
            </button>
          )}
        </div>
        <div className="toolbar-group">
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
            <Icon name={copied ? "check" : "copy"} />
            <span role="status">{copied ? "Copied" : "Copy"}</span>
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={download}>
            <Icon name="download" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {showRendered ? (
        <div className="markdown">
          <Markdown source={content} />
        </div>
      ) : (
        <div className={`code${wrap ? " wrap" : ""}`}>
          {!wrap && (
            <pre className="gutter" aria-hidden="true">
              {lines}
            </pre>
          )}
          <pre className="src">
            <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        </div>
      )}
    </section>
  );
}
