// /api/uploadthing — الرفع على حساب UploadThing الخاص بك. المفتاح من "الربط والمفاتيح"
// (أو UPLOADTHING_TOKEN في متغيرات البيئة).
import { createRouteHandler } from "uploadthing/next";
import { NextResponse } from "next/server";
import { providerKey } from "@/server/settings";
import { fileRouter } from "./core";

async function handler() {
  const token = await providerKey("uploadthing");
  return token ? createRouteHandler({ router: fileRouter, config: { token } }) : null;
}

const missing = () =>
  NextResponse.json({ error: "أضف مفتاح UploadThing من «الربط والمفاتيح» في لوحة التحكم لرفع الصور." }, { status: 503 });

export async function GET(req: Request) {
  const h = await handler();
  return h ? h.GET(req as never) : missing();
}

export async function POST(req: Request) {
  const h = await handler();
  return h ? h.POST(req as never) : missing();
}
