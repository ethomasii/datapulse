import { redirect } from "next/navigation";

/** Compatibility redirect — product uses "run slices" instead of framework-style "partitions". */
export default function PartitionsRedirect() {
  redirect("/run-slices");
}
