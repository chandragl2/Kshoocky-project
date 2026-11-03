export const ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "Menunggu Diproses" },
  { value: "processing", label: "Diproses" },
  { value: "shipped", label: "Dikirim" },
  { value: "delivered", label: "Diterima" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
] as const;

export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number]["value"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Menunggu Diproses",
  processing: "Diproses",
  shipped: "Dikirim",
  delivered: "Diterima",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export const ORDER_TIMELINE_STEPS: {
  status: Exclude<OrderStatus, "cancelled">;
  label: string;
}[] = [
  { status: "pending", label: "Menunggu Diproses" },
  { status: "processing", label: "Diproses" },
  { status: "shipped", label: "Dikirim" },
  { status: "delivered", label: "Diterima" },
  { status: "completed", label: "Selesai" },
];

export function canTransitionOrderStatus(
  current: string,
  next: OrderStatus,
) {
  if (current === next) return true;
  if (current === "pending")
    return next === "processing" || next === "cancelled";
  if (current === "processing")
    return next === "shipped" || next === "cancelled";
  if (current === "shipped") return next === "delivered";
  if (current === "delivered") return next === "completed";
  return false;
}

export function orderTimelineProgress(status: string) {
  if (status === "completed") return ORDER_TIMELINE_STEPS.length;
  return ORDER_TIMELINE_STEPS.findIndex((step) => step.status === status);
}
