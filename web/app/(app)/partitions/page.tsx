import { redirect } from "next/navigation";

/** Legacy URL — product copy uses "run slices" instead of framework-style "partitions". */
export default function PartitionsLegacyRedirect() {
  redirect("/run-slices");
}
