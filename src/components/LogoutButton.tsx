"use client";

import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/session", { method: "DELETE" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
      <Icon name="logout" />
      <span>Log out</span>
    </button>
  );
}
