import { Fragment } from "react";
import { requireStore, getBlueprint } from "@/lib/tenant";
import { renderSection } from "@/blueprint/registry";
import { FrozenGate } from "@/components/storefront/FrozenGate";
import { getStoreFacts } from "@/server/repos/facts";

export default async function Home({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: sub } = await params;
  const store = await requireStore(sub);

  if (
    store.status === "frozen" ||
    store.status === "intake" ||
    store.status === "building"
  ) {
    return <FrozenGate status={store.status} />;
  }

  const bp = await getBlueprint(store.id);
  const ctx = { storeId: store.id, channels: bp.channels, facts: await getStoreFacts(store.id, bp), copy: bp.copy };

  const rendered = await Promise.all(
    bp.home.map((s, i) =>
      renderSection(s, ctx).then((node) => (
        <Fragment key={(s as { id?: string }).id ?? i}>{node}</Fragment>
      ))
    )
  );

  return <>{rendered}</>;
}