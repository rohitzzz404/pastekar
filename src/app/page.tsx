import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PasteForm } from "@/components/PasteForm";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export default async function HomePage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) redirect("/login");
  return (
    <>
      <div className="page-head">
        <h1>New paste</h1>
        <p className="muted">Share text, code or Markdown at a link you choose.</p>
      </div>
      <PasteForm mode="create" />
    </>
  );
}
