export function getOverviewDisplayName(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmedFullName = fullName?.trim();
  if (trimmedFullName) return trimmedFullName;

  const trimmedEmail = email?.trim();
  return trimmedEmail || "Pelanggan";
}

export function normalizeOverviewCounts(counts: {
  catalogOrders: number | null;
  forwarding: number | null;
  unpaid: number | null;
}) {
  return {
    catalogOrders: counts.catalogOrders ?? 0,
    forwarding: counts.forwarding ?? 0,
    unpaid: counts.unpaid ?? 0,
  };
}

export const UNPAID_PAYMENT_STATUS = "pending";

export function getOrderDetailHref(orderId: string): string {
  return `/user/orders/${encodeURIComponent(orderId)}`;
}

export const OVERVIEW_QUICK_ACTIONS = [
  { label: "Jelajahi katalog", href: "/catalog" },
  { label: "Lihat keranjang", href: "/user/cart" },
  { label: "Kelola profil", href: "/user/profile" },
] as const;

export function getOverviewViewState(
  isLoading: boolean,
  hasError: boolean,
  recentOrderCount: number,
): "loading" | "error" | "empty" | "ready" {
  if (isLoading) return "loading";
  if (hasError) return "error";
  if (recentOrderCount === 0) return "empty";
  return "ready";
}
