// media-host.ts — مساحة رفع الصور في متجرك: حساب UploadThing الخاص بك (المفتاح من «الربط والمفاتيح»).
import "server-only";
import { UTApi } from "uploadthing/server";
import { providerKey } from "@/server/settings";

export async function mediaApi(): Promise<UTApi | null> {
  const token = await providerKey("uploadthing");
  return token ? new UTApi({ token }) : null;
}
