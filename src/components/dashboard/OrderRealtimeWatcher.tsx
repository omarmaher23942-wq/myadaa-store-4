"use client";

// components/dashboard/OrderRealtimeWatcher.tsx — يستمع لأحداث الطلب.
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useRealtimeEvent } from "@/lib/realtime-hooks";
import { channels, type OrderStatusChangedPayload } from "@/server/realtime/events";

export function OrderRealtimeWatcher({ storeId, orderCode }: { storeId: string; orderCode: string }) {
  const router = useRouter();

  useRealtimeEvent<OrderStatusChangedPayload>(
    channels.order(storeId, orderCode),
    "order:status-changed",
    (payload) => {
      toast.info(`تم تحديث حالة الطلب إلى "${payload.toStatus}"`);
      router.refresh();
    }
  );

  return null;
}