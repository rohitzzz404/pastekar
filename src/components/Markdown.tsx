import ReactMarkdown from "react-markdown";

// Raw HTML is never rendered (react-markdown drops it), only the elements below
// are allowed, and only http, https and mailto links survive. See docs/security.md.
const ALLOWED_ELEMENTS = [
  "p", "br", "hr", "strong", "em", "del", "a", "code", "pre", "blockquote",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
];

function safeUrl(url: string): string {
  try {
    const { protocol } = new URL(url);
    return ["http:", "https:", "mailto:"].includes(protocol) ? url : "";
  } catch {
    return "";
  }
}

export function Markdown({ source }: { source: string }) {
  return (
    <ReactMarkdown
      allowedElements={ALLOWED_ELEMENTS}
      unwrapDisallowed
      urlTransform={safeUrl}
      components={{
        // A link whose URL was refused becomes plain text, not a link to this page.
        a: ({ href, children }) =>
          href ? (
            <a href={href} rel="noopener noreferrer nofollow" target="_blank">
              {children}
            </a>
          ) : (
            <span>{children}</span>
          ),
      }}
    >
      {source}
    </ReactMarkdown>
  );
}
