"use client";

import {
  Truck, Banknote, ShieldCheck, RotateCcw, Headphones, BadgeCheck, Star, Heart, Gift,
  Sparkles, Zap, Clock, Phone, MessageCircle, Instagram, MapPin, Package, Percent,
  Award, ThumbsUp, Leaf, Flame, Crown, Gem, Smile, CheckCircle, Lock, CreditCard,
  ShoppingBag, Tag, Mail, MessageSquare, PackageOpen, Check, X, Plus, Minus,
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, AlertTriangle, CheckCircle2, CalendarDays, Save, Send,
  Pencil, Trash2, Wand2, Image as ImageIcon, Upload, Camera, Palette, Pipette,
  Users, ShoppingCart, BarChart3, Settings, LogOut, Search, Filter, Download,
  UploadCloud, Eye, EyeOff, Copy, Share2, Link2, ExternalLink, Play, Pause,
  Facebook, Twitter, Youtube, Globe, Home, Info, HelpCircle, Bookmark, Bell,
  Sun, Moon, RefreshCw, MoreHorizontal, Store, Smartphone, Shirt, Ruler, Scissors, Droplets, Baby,
  Coffee, CakeSlice, Watch, Sparkle, Flower2, Feather, Footprints, Glasses, Gamepad2, Dumbbell, Brush,
  Wallet, Undo2, Repeat, Hand, Recycle, Medal, Rocket, Timer, Box, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** الوزن الموحد لكل أيقونات المنصة والمتاجر (بديل الإيموجي الحصري) */
export const ICON_STROKE = 1.75;

/**
 * Map ثابت لأسماء الأيقونات المستخدمة في الـ Blueprint والواجهات.
 * أي اسم غير موجود يسقط لـ Info (لمنع الشاشات الفارغة).
 */
const ICON_MAP: Record<string, LucideIcon> = {
  truck: Truck,
  banknote: Banknote,
  "shield-check": ShieldCheck,
  "rotate-ccw": RotateCcw,
  headphones: Headphones,
  "badge-check": BadgeCheck,
  star: Star,
  heart: Heart,
  gift: Gift,
  sparkles: Sparkles,
  zap: Zap,
  clock: Clock,
  phone: Phone,
  "message-circle": MessageCircle,
  "message-square": MessageSquare,
  instagram: Instagram,
  "map-pin": MapPin,
  package: Package,
  "package-open": PackageOpen,
  percent: Percent,
  award: Award,
  "thumbs-up": ThumbsUp,
  leaf: Leaf,
  flame: Flame,
  crown: Crown,
  gem: Gem,
  smile: Smile,
  "check-circle": CheckCircle,
  "check-circle-2": CheckCircle2,
  check: Check,
  x: X,
  plus: Plus,
  minus: Minus,
  lock: Lock,
  "credit-card": CreditCard,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  tag: Tag,
  mail: Mail,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "loader-2": Loader2,
  "alert-circle": AlertCircle,
  "alert-triangle": AlertTriangle,
  "calendar-days": CalendarDays,
  save: Save,
  send: Send,
  pencil: Pencil,
  "trash-2": Trash2,
  "wand-2": Wand2,
  image: ImageIcon,
  upload: Upload,
  "upload-cloud": UploadCloud,
  camera: Camera,
  palette: Palette,
  pipette: Pipette,
  users: Users,
  "bar-chart-3": BarChart3,
  settings: Settings,
  "log-out": LogOut,
  search: Search,
  filter: Filter,
  download: Download,
  eye: Eye,
  "eye-off": EyeOff,
  copy: Copy,
  "share-2": Share2,
  "link-2": Link2,
  "external-link": ExternalLink,
  play: Play,
  pause: Pause,
  facebook: Facebook,
  twitter: Twitter,
  youtube: Youtube,
  globe: Globe,
  home: Home,
  info: Info,
  "help-circle": HelpCircle,
  bookmark: Bookmark,
  bell: Bell,
  sun: Sun,
  moon: Moon,
  "refresh-cw": RefreshCw,
  "more-horizontal": MoreHorizontal,
  store: Store,
  smartphone: Smartphone,
  shirt: Shirt,
  ruler: Ruler,
  scissors: Scissors,
  droplets: Droplets,
  baby: Baby,
  coffee: Coffee,
  "cake-slice": CakeSlice,
  watch: Watch,
  sparkle: Sparkle,
  flower: Flower2,
  feather: Feather,
  footprints: Footprints,
  glasses: Glasses,
  gamepad: Gamepad2,
  dumbbell: Dumbbell,
  brush: Brush,
  wallet: Wallet,
  "undo-2": Undo2,
  repeat: Repeat,
  hand: Hand,
  recycle: Recycle,
  medal: Medal,
  rocket: Rocket,
  timer: Timer,
  box: Box,
};

/** للاختبار: كل اسم في قائمة الذكاء الاصطناعي (blueprint/icons) يجب أن يُرسم. */
export const KNOWN_ICONS = new Set(Object.keys(ICON_MAP));

function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/_/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

export function Icon({
  name,
  className,
  size,
  strokeWidth = ICON_STROKE,
  label,
}: {
  name: string;
  className?: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const key = normalizeName(name);
  const Component = ICON_MAP[key] ?? Info;
  return (
    <Component
      className={cn("inline-block shrink-0", className)}
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}