import { redirect } from "next/navigation";

/** Old path — product name is Gateway. */
export default function AgentPathRedirect() {
  redirect("/gateway");
}
