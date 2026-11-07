import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { LoginForm } from "@/components/LoginForm";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) redirect("/");
  return (
    <div className="card gate">
      <div className="gate-icon">
        <Icon name="lock" />
      </div>
      <h1>Welcome back</h1>
      <p className="muted">Enter the team passcode to create and manage pastes. Anyone with a link can still view one.</p>
      <LoginForm />
    </div>
  );
}
