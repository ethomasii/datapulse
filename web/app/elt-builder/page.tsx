import { redirect } from "next/navigation";

/** Old URL when the UI was proxied to FastAPI — now native Next.js at `/builder`. */
export default function LegacyEltBuilderRedirect() {
  redirect("/builder");
}
