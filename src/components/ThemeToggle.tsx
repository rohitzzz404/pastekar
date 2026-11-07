"use client";

import { Icon } from "./Icon";

// The choice lives in a cookie, so the server can render the right theme with
// no flash. Both icons are in the page, and CSS shows the one that applies.
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current =
      root.dataset.theme ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    document.cookie = `pk_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button type="button" className="btn btn-ghost btn-icon" onClick={toggle} aria-label="Toggle dark mode">
      <Icon name="moon" className="theme-moon" />
      <Icon name="sun" className="theme-sun" />
    </button>
  );
}
