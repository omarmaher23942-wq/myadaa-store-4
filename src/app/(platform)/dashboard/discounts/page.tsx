import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { discounts } from "@/db/schema";
import { DiscountsManager } from "@/components/dashboard/DiscountsManager";
import { NO_STORE_HREF } from "@/lib/edition";

export const dynamic = "force-dynamic";
export const metadata = { title: "أكواد الخصم" };

export default async function DiscountsPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/discounts");
  if (!session.storeId) redirect(NO_STORE_HREF);
  const db = await getTenantDb(session.storeId!);

  const rows = await db
    .select()
    .from(discounts)
    .where(eq(discounts.storeId, session.storeId))
    .orderBy(desc(discounts.createdAt));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-b border-edge/10 pb-4">
        <h1 className="text-2xl font-black text-ink">أكواد الخصم</h1>
        <p className="mt-1 text-xs text-ink-3">
          أنشئ أكواد خصم لجذب عملاء جدد ومكافأة العائدين
        </p>
      </header>

      <DiscountsManager
        rows={rows.map((d) => ({
          id: d.id,
          code: d.code,
          type: d.type,
          value: d.type === "fixed" ? d.value / 100 : d.value,
          minSubtotal: d.minSubtotalPiasters ? d.minSubtotalPiasters / 100 : null,
          maxUses: d.maxUses,
          usedCount: d.usedCount,
          perCustomerLimit: d.perCustomerLimit,
          endsAt: d.endsAt?.toISOString().slice(0, 16) ?? null,
          isActive: d.isActive,
        }))}
      />
    </div>
  );
}