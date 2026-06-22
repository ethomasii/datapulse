import { redirect } from "next/navigation";

/** Team lives under Account & Settings (ServicePulse-style). */
export default function TeamRedirectPage() {
  redirect("/account/team");
}
