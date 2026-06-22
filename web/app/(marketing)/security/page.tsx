import { redirect } from "next/navigation";

/** Top-level /security matches ServicePulse nav; content lives under docs. */
export default function SecurityPage() {
  redirect("/docs/security");
}
