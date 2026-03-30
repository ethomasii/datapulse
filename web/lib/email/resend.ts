import { Resend } from "resend";

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function defaultFrom(): { email: string; name: string } {
  return {
    email: process.env.RESEND_FROM_EMAIL ?? "notifications@datapulse.dev",
    name: process.env.RESEND_FROM_NAME ?? "DataPulse",
  };
}
