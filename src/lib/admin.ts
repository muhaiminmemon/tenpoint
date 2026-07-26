import type { SessionUser } from "@/db/schema";

/**
 * Moderators, as an env allowlist rather than a database role.
 *
 * There is exactly one privileged action in this product (reading and closing
 * reports), and a `users.role` column would mean a schema, a UI to grant it,
 * and a way to escalate. A comma-separated env var can't be changed by anyone
 * who doesn't already have deploy access.
 *
 * ADMIN_USERNAMES="ali,sam"
 */
export function adminUsernames(): Set<string> {
  const raw = process.env.ADMIN_USERNAMES ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdmin(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  return adminUsernames().has(user.username.toLowerCase());
}
