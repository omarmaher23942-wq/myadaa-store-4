// tenant.ts — الطريق الوحيد إلى بيانات المتجر (جداول TENANT_TABLES في planes.ts).
//
// المنصة تستضيف المتجر أثناء التجربة وحتى يستلمه التاجر على حساباته ("امتلك متجرك")،
// فبيانات كل متجر هنا في قاعدة المنصة. نسخة التاجر الخاصة لها قاعدتها هي، ولا تمر بهذا الملف.
// يبقى getTenantDb المدخل الإلزامي لبيانات المتجر (يفرضه اختبار الحارس) ليبقى العزل في مكان واحد.
import "server-only";
import { db, type DB } from "@/db/client";

export async function getTenantDb(_storeId: string): Promise<DB> {
  return db;
}

/** لاستعلامات تجمع عدة متاجر (لوحة المالك): استعلام واحد للقاعدة. */
export async function groupStoresByTenantDb(storeIds: string[]): Promise<Map<DB, string[]>> {
  return new Map(storeIds.length ? [[db, storeIds]] : []);
}
