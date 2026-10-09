// icons.ts — أسماء الأيقونات التي يختار منها الذكاء الاصطناعي (كلها مرسومة في storefront/Icon).
export const ICON_NAMES = [
  "truck", "banknote", "shield-check", "rotate-ccw", "headphones", "badge-check", "star", "heart", "gift",
  "sparkles", "zap", "clock", "phone", "message-circle", "map-pin", "package", "package-open", "percent",
  "award", "thumbs-up", "leaf", "flame", "crown", "gem", "smile", "check-circle", "lock", "credit-card",
  "shopping-bag", "tag", "eye", "store", "smartphone", "shirt", "ruler", "scissors", "droplets", "baby",
  "coffee", "cake-slice", "watch", "sparkle", "flower", "feather", "footprints", "glasses", "gamepad",
  "dumbbell", "brush", "wallet", "undo-2", "repeat", "hand", "recycle", "medal", "rocket", "timer", "box",
] as const;

const SET = new Set<string>(ICON_NAMES);
export const safeIcon = (name: unknown, fallback = "sparkles"): string =>
  typeof name === "string" && SET.has(name.trim().toLowerCase()) ? name.trim().toLowerCase() : fallback;
