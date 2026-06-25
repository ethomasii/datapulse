import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Canvas",
};

type SearchParamsInput = Record<string, string | string[] | undefined>;

/** Legacy route — canvas is a view on /builder. */
export default async function BuilderCanvasRedirectPage({
  searchParams,
}: {
  searchParams: SearchParamsInput | Promise<SearchParamsInput>;
}) {
  const sp = await Promise.resolve(searchParams);
  const params = new URLSearchParams();
  params.set("view", "canvas");
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value);
    }
  }
  redirect(`/builder?${params.toString()}`);
}
