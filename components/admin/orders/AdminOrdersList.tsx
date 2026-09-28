"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { formatCurrency } from "@/lib/format-currency";
import { createClient } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database";

type Order = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "id"
  | "order_number"
  | "created_at"
  | "subtotal"
  | "shipping_fee"
  | "discount"
  | "total_price"
  | "payment_status"
  | "order_status"
  | "user_id"
  | "shipping_address"
> & {
  profile: Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "full_name" | "phone_number"
  > | null;
};
type CustomerProfile = NonNullable<Order["profile"]>;
type ShippingAddress = { recipient_name?: string; phone_number?: string };

type PaymentFilter = "all" | "pending" | "paid" | "failed" | "refunded";
type OrderFilter =
  | "all"
  | "pending"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled";

const paymentFilters: { value: PaymentFilter; label: string }[] = [
  { value: "all", label: "Semua pembayaran" },
  { value: "pending", label: "Menunggu Pembayaran" },
  { value: "paid", label: "Dibayar" },
  { value: "failed", label: "Gagal" },
  { value: "refunded", label: "Refund" },
];

const orderFilters: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "Semua pesanan" },
  { value: "pending", label: "Menunggu Diproses" },
  { value: "processing", label: "Diproses" },
  { value: "shipped", label: "Dikirim" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

const paymentLabels: Record<string, string> = {
  pending: "Menunggu Pembayaran",
  paid: "Dibayar",
  failed: "Gagal",
  refunded: "Refund",
};

const orderLabels: Record<string, string> = {
  pending: "Menunggu Diproses",
  processing: "Diproses",
  shipped: "Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSnapshotCustomer(value: Json): ShippingAddress {
  if (!isRecord(value)) return {};
  return {
    recipient_name:
      typeof value.recipient_name === "string" ? value.recipient_name : "",
    phone_number:
      typeof value.phone_number === "string" ? value.phone_number : "",
  };
}

function badgeClass(status: string) {
  if (["paid", "completed"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["failed", "cancelled"].includes(status)) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (["processing", "shipped"].includes(status)) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default function AdminOrdersList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, user_id, order_number, created_at, subtotal, shipping_fee, discount, total_price, payment_status, order_status, shipping_address",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;

      const loadedOrders = data ?? [];
      const userIds = Array.from(
        new Set(loadedOrders.map((order) => order.user_id)),
      );
      let profilesByUserId = new Map<string, CustomerProfile>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, phone_number")
          .in("id", userIds);
        profilesByUserId = new Map(
          (profiles ?? []).map(({ id, full_name, phone_number }) => [
            id,
            { full_name, phone_number },
          ]),
        );
      }

      setOrders(
        loadedOrders.map((order) => ({
          ...order,
          profile: profilesByUserId.get(order.user_id) ?? null,
        })),
      );
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const visibleOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("id-ID");
    return orders.filter((order) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        order.order_number
          .toLocaleLowerCase("id-ID")
          .includes(normalizedSearch) ||
        (
          order.profile?.full_name ||
          getSnapshotCustomer(order.shipping_address).recipient_name ||
          ""
        )
          .toLocaleLowerCase("id-ID")
          .includes(normalizedSearch);
      return (
        matchesSearch &&
        (paymentFilter === "all" || order.payment_status === paymentFilter) &&
        (orderFilter === "all" || order.order_status === orderFilter)
      );
    });
  }, [orderFilter, orders, paymentFilter, search]);

  function customerName(order: Order) {
    return (
      order.profile?.full_name?.trim() ||
      getSnapshotCustomer(order.shipping_address).recipient_name?.trim() ||
      "Customer tidak tersedia"
    );
  }

  return (
    <main className="mx-auto max-w-[1320px] px-4 py-7 text-slate-700 sm:px-6 lg:px-10">
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#E5B869]">
            KSHOOCKY OPERATIONS
          </p>
          <h1 className="text-2xl font-extrabold text-[#0F3854] sm:text-3xl">
            Admin Order Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Lihat pesanan customer dan kelola status proses pesanan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadOrders()}
          disabled={isLoading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#0F3854] transition hover:border-[#E5B869] disabled:opacity-60"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Segarkan
        </button>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px_220px]">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-500 focus-within:border-[#0F3854]">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari order number atau customer"
              className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>
          <label className="sr-only" htmlFor="payment-filter">
            Filter payment status
          </label>
          <select
            id="payment-filter"
            value={paymentFilter}
            onChange={(event) =>
              setPaymentFilter(event.target.value as PaymentFilter)
            }
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#0F3854]"
          >
            {paymentFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="order-filter">
            Filter order status
          </label>
          <select
            id="order-filter"
            value={orderFilter}
            onChange={(event) =>
              setOrderFilter(event.target.value as OrderFilter)
            }
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#0F3854]"
          >
            {orderFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>

        {loadError ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            Pesanan gagal dimuat. Silakan coba lagi.
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="ml-2 underline underline-offset-2"
            >
              Coba lagi
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Memuat pesanan...
          </div>
        ) : orders.length === 0 ? (
          <p className="py-16 text-center text-sm font-semibold text-slate-500">
            Belum ada pesanan.
          </p>
        ) : visibleOrders.length === 0 ? (
          <p className="py-16 text-center text-sm font-semibold text-slate-500">
            Tidak ada pesanan yang cocok dengan pencarian atau filter.
          </p>
        ) : (
          <>
            <p className="mt-4 text-xs font-semibold text-slate-500">
              {visibleOrders.length} dari {orders.length} pesanan
            </p>
            <div className="mt-3 space-y-3 md:hidden">
              {visibleOrders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <p className="break-all text-sm font-extrabold text-[#0F3854]">
                    {order.order_number}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {customerName(order)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(order.created_at)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClass(order.payment_status)}`}
                    >
                      {paymentLabels[order.payment_status] ??
                        order.payment_status}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClass(order.order_status)}`}
                    >
                      {orderLabels[order.order_status] ?? order.order_status}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <p className="text-sm font-extrabold text-[#0F3854]">
                      {formatCurrency(order.total_price)}
                    </p>
                    <Link
                      href={`/admin/orders/${encodeURIComponent(order.id)}`}
                      className="inline-flex min-h-10 items-center rounded-lg bg-[#0F3854] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#174e70]"
                    >
                      Lihat Detail
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-3 font-bold">Order Number</th>
                    <th className="px-3 py-3 font-bold">Customer</th>
                    <th className="px-3 py-3 font-bold">Tanggal</th>
                    <th className="px-3 py-3 font-bold">Total</th>
                    <th className="px-3 py-3 font-bold">Pembayaran</th>
                    <th className="px-3 py-3 font-bold">Pesanan</th>
                    <th className="px-3 py-3 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-3 py-4 font-extrabold text-[#0F3854]">
                        {order.order_number}
                      </td>
                      <td className="px-3 py-4 font-semibold text-slate-700">
                        {customerName(order)}
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-3 py-4 font-bold text-[#0F3854]">
                        {formatCurrency(order.total_price)}
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClass(order.payment_status)}`}
                        >
                          {paymentLabels[order.payment_status] ??
                            order.payment_status}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClass(order.order_status)}`}
                        >
                          {orderLabels[order.order_status] ??
                            order.order_status}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <Link
                          href={`/admin/orders/${encodeURIComponent(order.id)}`}
                          className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#0F3854] hover:border-[#0F3854]"
                        >
                          Lihat Detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
