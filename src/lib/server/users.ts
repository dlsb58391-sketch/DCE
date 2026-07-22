/**
 * Staff-account pure helpers (Sprint 15, Multi-branch Phase 4a).
 *
 * Normalization + validation for User (staff account) management, kept free of
 * Prisma/IO so it is deterministic and unit-testable. The service layer
 * (users-ops.ts) owns the database reads/writes; the API routes own auth + audit.
 *
 * Role model (unchanged from the rest of the app):
 *   - "admin"  = clinic owner / full back-office access + manages staff accounts.
 *   - "doctor" = owner-level practitioner account (also in OWNER_ROLES).
 *   - "staff"  = limited account (e.g. reception) — signed in, branch-scoped reads.
 * Only "admin" may manage accounts (create/edit/delete), so privilege escalation
 * is never delegated to a non-owner.
 */

/** The three valid account roles. */
export const USER_ROLES = ["admin", "doctor", "staff"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Minimum password length for a staff account. */
export const MIN_PASSWORD_LEN = 8;
/** Upper bound so an absurd password can never be used to DoS bcrypt hashing. */
export const MAX_PASSWORD_LEN = 200;

export function isValidRole(role: unknown): role is UserRole {
  return typeof role === "string" && (USER_ROLES as readonly string[]).includes(role);
}

/** Coerce any input to a valid role, defaulting to the least-privileged "staff". */
export function normalizeRole(role: unknown): UserRole {
  const r = typeof role === "string" ? role.trim().toLowerCase() : "";
  return isValidRole(r) ? (r as UserRole) : "staff";
}

/** Lowercased, trimmed email. */
export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/** Pragmatic email shape check (one @, a dot in the domain, no spaces). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Lowercased, trimmed username, or null when blank. Usernames are an optional
 * convenience login (the seed uses one), so an empty value is legitimately null.
 */
export function normalizeUsername(username: unknown): string | null {
  if (typeof username !== "string") return null;
  const u = username.trim().toLowerCase();
  return u.length ? u : null;
}

/** A provided username must be 3–32 chars of [a-z0-9._-]. Null (none) is allowed. */
export function isValidUsername(username: string | null): boolean {
  if (username === null) return true;
  return /^[a-z0-9._-]{3,32}$/.test(username);
}

/** Trimmed display name. */
export function normalizeName(name: unknown): string {
  return typeof name === "string" ? name.trim() : "";
}

/** Password length policy (content rules are intentionally lenient). */
export function isValidPassword(password: unknown): boolean {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LEN && password.length <= MAX_PASSWORD_LEN;
}

/**
 * Guard: may `actor` delete `target`? Blocks deleting your own account (you would
 * lock yourself out) and deleting the final admin (the clinic must always keep at
 * least one owner who can manage accounts). Returns a machine code or null (ok).
 */
export function deleteUserBlock(p: {
  actorId: string;
  targetId: string;
  targetRole: string;
  adminCount: number;
}): "cannot_delete_self" | "last_admin" | null {
  if (p.actorId === p.targetId) return "cannot_delete_self";
  if (normalizeRole(p.targetRole) === "admin" && p.adminCount <= 1) return "last_admin";
  return null;
}

/**
 * Guard: does changing `target` from `currentRole` to `newRole` remove the last
 * admin? Demoting the only admin would leave nobody able to manage accounts.
 * Returns a machine code or null (ok).
 */
export function changeRoleBlock(p: {
  currentRole: string;
  newRole: string;
  adminCount: number;
}): "last_admin" | null {
  const from = normalizeRole(p.currentRole);
  const to = normalizeRole(p.newRole);
  if (from === "admin" && to !== "admin" && p.adminCount <= 1) return "last_admin";
  return null;
}
