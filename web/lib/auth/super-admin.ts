/**
 * Platform / super-admin: local development or a single Clerk user id from env.
 * Same pattern as ServicePulse — tier switcher, Admin tools nav, and internal shortcuts.
 */
export function isSuperAdminClerkId(clerkId: string): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const admin = process.env.ADMIN_CLERK_USER_ID;
  return Boolean(admin && admin === clerkId);
}
