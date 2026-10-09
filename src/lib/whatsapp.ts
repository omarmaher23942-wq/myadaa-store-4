// whatsapp.ts — روابط واتساب من أرقام مصرية بأي صيغة كُتبت (01x، +201x، 00201x، بمسافات أو شرطات).

/** الرقم بصيغة wa.me الدولية (201xxxxxxxxx)، أو null إن لم يكن رقم موبايل مصرياً صالحاً. */
export function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/\D/g, "");
  if (d.startsWith("0020")) d = d.slice(2);
  if (d.startsWith("01") && d.length === 11) d = `2${d}`;
  else if (d.startsWith("1") && d.length === 10) d = `20${d}`;
  return /^201[0125]\d{8}$/.test(d) ? d : null;
}

/** رابط محادثة واتساب مع رسالة جاهزة اختيارية. */
export function waLink(phone: string | null | undefined, text?: string): string | null {
  const n = waNumber(phone);
  if (!n) return null;
  return text ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : `https://wa.me/${n}`;
}
