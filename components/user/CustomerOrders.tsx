"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, PackageOpen } from "lucide-react";
import { formatCurrency } from "@/lib/format-currency";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database";

type Order = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "id"
  | "order_number"
  | "created_at"
  | "payment_status"
  | "order_status"
  | "total_price"
>;
type OrderFilter =
  | "all"
  | "pending"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled";

const filters: { id: OrderFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "pending", label: "Menunggu Pembayaran" },
  { id: "processing", label: "Diproses" },
  { id: "shipped", label: "Dikirim" },
  { id: "completed", label: "Selesai" },
  { id: "cancelled", label: "Dibatalkan" },
];

const paymentLabels: Record<string, string> = {
  pending: "Menunggu Pembayaran",
  paid: "Pembayaran Berhasil",
  failed: "Pembayaran Gagal",
  refunded: "Dana Dikembalikan",
};

const orderLabels: Record<string, string> = {
  pending: "Menunggu Diproses",
  processing: "Sedang Diproses",
  shipped: "Sedang Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "paid" || status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "failed" || status === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "shipped" || status === "processing") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default function CustomerOrders() {
  const router = useRouter();
  const [supabase] = useState(() =>
    isSupabaseConfigured ? createClient() : null,
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    if (!supabase) {
      setLoadError(true);
      setIsLoading(false);
      return;
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, created_at, payment_status, order_status, total_price",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders(data ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const visibleOrders = useMemo(() => {
    if (activeFilter === "all") return orders;
    if (activeFilter === "pending") {
      return orders.filter((order) => order.payment_status === "pending");
    }
    return orders.filter((order) => order.order_status === activeFilter);
  }, [activeFilter, orders]);

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 lg:px-10">
      <header className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c48a24]">
          KSHOOCKY SHOP
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0F3854] sm:text-3xl">
          Pesanan Saya
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Lihat status dan rincian pesanan Catalog kamu.
        </p>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
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
      )}

      {!loadError && (
        <>
          <div
            className="mb-5 flex gap-2 overflow-x-auto pb-1"
            aria-label="Filter pesanan"
          >
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={activeFilter === filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`min-h-10 shrink-0 rounded-lg border px-3.5 py-2 text-sm font-bold transition-colors ${activeFilter === filter.id ? "border-[#0F3854] bg-[#0F3854] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-[#0F3854] hover:text-[#0F3854]"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Memuat pesanan...
            </div>
          ) : orders.length === 0 ? (
            <section className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-center">
              <PackageOpen className="h-11 w-11 text-slate-300" />
              <h2 className="mt-4 text-lg font-extrabold text-[#0F3854]">
                Belum Ada Pesanan
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Pesanan Catalog kamu akan muncul di sini.
              </p>
              <Link
                href="/catalog"
                className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-[#0F3854] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#174e70]"
              >
                Mulai Belanja
              </Link>
            </section>
          ) : visibleOrders.length === 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center text-sm font-semibold text-slate-500">
              Tidak ada pesanan pada filter ini.
            </section>
          ) : (
            <div className="space-y-3">
              {visibleOrders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-extrabold text-[#0F3854] sm:text-base">
                        Pesanan #{order.order_number}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(order.created_at)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(order.payment_status)}`}
                        >
                          {paymentLabels[order.payment_status] ??
                            order.payment_status}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(order.order_status)}`}
                        >
                          {orderLabels[order.order_status] ??
                            order.order_status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                      <p className="text-base font-extrabold text-[#0F3854]">
                        {formatCurrency(order.total_price)}
                      </p>
                      <Link
                        href={`/user/orders/${encodeURIComponent(order.id)}`}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[#0F3854] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#174e70]"
                      >
                        Lihat Detail
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
