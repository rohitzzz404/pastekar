import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import "./globals.css";

// Every page is rendered per request. A CDN-cached page could outlive its paste,
// and the Content Security Policy nonce must be new for each response.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Pastekar", template: "%s · Pastekar" },
  description: "Private sharing for the team.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const loggedIn = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  const theme = jar.get("pk_theme")?.value;
  return (
    <html lang="en" data-theme={theme === "dark" || theme === "light" ? theme : undefined}>
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand">
              <span className="brand-mark">
                <Icon name="raw" />
              </span>
              Pastekar
            </Link>
            <nav className="header-nav" aria-label="Main">
              {loggedIn && (
                <>
                  <Link href="/" className="btn btn-primary btn-sm">
                    <Icon name="plus" />
                    <span>New paste</span>
                  </Link>
                  <LogoutButton />
                </>
              )}
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="container page">{children}</main>
      </body>
    </html>
  );
}
