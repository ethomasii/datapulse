import { BuilderClient } from "./builder-client";

export default function BuilderPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pipeline =
    typeof searchParams.pipeline === "string" ? searchParams.pipeline : null;
  return <BuilderClient initialEditPipelineId={pipeline} />;
}
