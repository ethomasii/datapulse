/** True when real Clerk API keys are set (not empty or .env.example placeholders). */
export function isClerkConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!key || key.includes("...")) return false;
  return key.startsWith("pk_test_") || key.startsWith("pk_live_");
}
