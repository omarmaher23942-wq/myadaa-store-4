/** المحافظات المصرية بأكواد ثابتة، مع تجميع افتراضي لرسوم الشحن (القاهرة الكبرى، الدلتا، الصعيد، القناة، سيناء والحدود) */
export const GOVERNORATES = [
    { code: "cairo", name: "القاهرة", group: "gc" },
    { code: "giza", name: "الجيزة", group: "gc" },
    { code: "qalyubia", name: "القليوبية", group: "gc" },
    { code: "alexandria", name: "الإسكندرية", group: "alex" },
    { code: "beheira", name: "البحيرة", group: "delta" },
    { code: "kafr_el_sheikh", name: "كفر الشيخ", group: "delta" },
    { code: "dakahlia", name: "الدقهلية", group: "delta" },
    { code: "damietta", name: "دمياط", group: "delta" },
    { code: "sharqia", name: "الشرقية", group: "delta" },
    { code: "gharbia", name: "الغربية", group: "delta" },
    { code: "monufia", name: "المنوفية", group: "delta" },
    { code: "port_said", name: "بورسعيد", group: "canal" },
    { code: "ismailia", name: "الإسماعيلية", group: "canal" },
    { code: "suez", name: "السويس", group: "canal" },
    { code: "faiyum", name: "الفيوم", group: "upper" },
    { code: "beni_suef", name: "بني سويف", group: "upper" },
    { code: "minya", name: "المنيا", group: "upper" },
    { code: "asyut", name: "أسيوط", group: "upper" },
    { code: "sohag", name: "سوهاج", group: "upper" },
    { code: "qena", name: "قنا", group: "upper" },
    { code: "luxor", name: "الأقصر", group: "upper" },
    { code: "aswan", name: "أسوان", group: "upper" },
    { code: "red_sea", name: "البحر الأحمر", group: "remote" },
    { code: "new_valley", name: "الوادي الجديد", group: "remote" },
    { code: "matrouh", name: "مطروح", group: "remote" },
    { code: "north_sinai", name: "شمال سيناء", group: "remote" },
    { code: "south_sinai", name: "جنوب سيناء", group: "remote" },
  ] as const;
  
  export type GovernorateCode = (typeof GOVERNORATES)[number]["code"];
  export type ShippingGroup = (typeof GOVERNORATES)[number]["group"];
  
  export const governorateName = (code: string) =>
    GOVERNORATES.find((g) => g.code === code)?.name ?? code;
  
  /**
   * رسوم شحن افتراضية معقولة (بالقروش) لكل مجموعة، يُنشأ منها جدول shipping_zones للمتجر الجديد.
   * التاجر يعدّلها من الداشبورد بضغطة، والوكيل يسأله عنها أثناء الاستقبال.
   */
  export const DEFAULT_SHIPPING_BY_GROUP: Record<ShippingGroup, { fee: number; etaMin: number; etaMax: number }> = {
    gc:     { fee: 5000,  etaMin: 1, etaMax: 3 },  // القاهرة الكبرى: 50 ج
    alex:   { fee: 6000,  etaMin: 2, etaMax: 4 },
    delta:  { fee: 6500,  etaMin: 2, etaMax: 4 },
    canal:  { fee: 7000,  etaMin: 2, etaMax: 5 },
    upper:  { fee: 8000,  etaMin: 3, etaMax: 6 },
    remote: { fee: 10000, etaMin: 4, etaMax: 8 },
  };
  
  export function defaultShippingZones() {
    return GOVERNORATES.map((g) => {
      const d = DEFAULT_SHIPPING_BY_GROUP[g.group];
      return { governorate: g.code, feePiasters: d.fee, codExtraPiasters: 0, etaMinDays: d.etaMin, etaMaxDays: d.etaMax, isActive: true };
    });
  }
  