"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CreditCard,
  Loader2,
  Package,
  PackageOpen,
  Plane,
  ShoppingBag,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-currency";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database";
import {
  getOrderDetailHref,
  getOverviewDisplayName,
  getOverviewViewState,
  normalizeOverviewCounts,
  OVERVIEW_QUICK_ACTIONS,
  UNPAID_PAYMENT_STATUS,
} from "./dashboard-overview-data";

type OverviewOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "id"
  | "order_number"
  | "created_at"
  | "payment_status"
  | "order_status"
  | "total_price"
>;
type OverviewCounts = ReturnType<typeof normalizeOverviewCounts>;
type QuickActionHref = (typeof OVERVIEW_QUICK_ACTIONS)[number]["href"];

const paymentLabels: Record<string, string> = {
  pending: "Menunggu Pembayaran",
  paid: "Pembayaran Berhasil",
  failed: "Pembayaran Gagal",
  refunded: "Dana Dikembalikan",
};

const quickActionIcons: Record<QuickActionHref, LucideIcon> = {
  "/catalog": ShoppingBag,
  "/user/cart": ShoppingCart,
  "/user/profile": UserRound,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (
    status === "paid" ||
    status === "delivered" ||
    status === "completed"
  ) {
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

export default function CustomerDashboardOverview() {
  const router = useRouter();
  const [supabase] = useState(() =>
    isSupabaseConfigured ? createClient() : null,
  );
  const [displayName, setDisplayName] = useState("Pelanggan");
  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [recentOrders, setRecentOrders] = useState<OverviewOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const requestId = useRef(0);

  const loadOverview = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setIsLoading(true);
    setHasError(false);
    setCounts(null);
    setRecentOrders([]);
    setDisplayName("Pelanggan");

    if (!supabase) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        router.replace("/login");
        return;
      }

      const [
        profileResult,
        catalogOrdersResult,
        unpaidOrdersResult,
        forwardingResult,
        recentOrdersResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("payment_status", UNPAID_PAYMENT_STATUS),
        supabase
          .from("shipments")
          .select("id, orders!inner(user_id)", { count: "exact", head: true })
          .eq("orders.user_id", user.id),
        supabase
          .from("orders")
          .select(
            "id, order_number, created_at, payment_status, order_status, total_price",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (catalogOrdersResult.error) throw catalogOrdersResult.error;
      if (unpaidOrdersResult.error) throw unpaidOrdersResult.error;
      if (forwardingResult.error) throw forwardingResult.error;
      if (recentOrdersResult.error) throw recentOrdersResult.error;

      if (currentRequestId !== requestId.current) return;

      setDisplayName(
        getOverviewDisplayName(profileResult.data?.full_name, user.email),
      );
      setCounts(
        normalizeOverviewCounts({
          catalogOrders: catalogOrdersResult.count,
          forwarding: forwardingResult.count,
          unpaid: unpaidOrdersResult.count,
        }),
      );
      setRecentOrders(recentOrdersResult.data ?? []);
    } catch (error) {
      if (currentRequestId === requestId.current) {
        console.error(
          "[CustomerDashboardOverview] Failed to load overview",
          error,
        );
        setHasError(true);
      }
    } finally {
      if (currentRequestId === requestId.current) setIsLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadOverview();
    return () => {
      requestId.current += 1;
    };
  }, [loadOverview]);

  const viewState = getOverviewViewState(
    isLoading,
    hasError,
    recentOrders.length,
  );
  const summaryCards: {
    title: string;
    description: string;
    value: number | string;
    href: string;
    icon: LucideIcon;
    iconClass: string;
  }[] = [
    {
      title: "Pesanan Katalog",
      description: "Seluruh pesanan katalog Anda",
      value: counts?.catalogOrders ?? "—",
      href: "/user/orders",
      icon: Package,
      iconClass: "bg-slate-100 text-[#0F3854]",
    },
    {
      title: "Forwarding",
      description: "Semua kiriman terkait pesanan Anda",
      value: counts?.forwarding ?? "—",
      href: "/user/shipments",
      icon: Plane,
      iconClass: "bg-[#f6f0e2] text-[#a87a28]",
    },
    {
      title: "Belum Dibayar",
      description: "Pesanan yang menunggu pembayaran",
      value: counts?.unpaid ?? "—",
      href: "/user/orders",
      icon: CreditCard,
      iconClass: "bg-[#f5f2eb] text-[#a87a28]",
    },
  ];

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a87a28]">
            Customer workspace
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0F3854] sm:text-3xl">
            Selamat datang, {displayName}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Pantau pesanan dan aktivitas akun Anda dalam satu tempat.
          </p>
        </div>
        <Link
          href="/user/orders"
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg bg-[#0F3854] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#174e70] sm:self-auto"
        >
          Lihat semua pesanan
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      <section aria-labelledby="overview-summary-title">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="overview-summary-title"
            className="text-lg font-extrabold text-[#0F3854]"
          >
            Ringkasan aktivitas
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map(
            ({ title, description, value, href, icon: Icon, iconClass }) => (
              <Link
                key={title}
                href={href}
                aria-label={`${title}: ${value}. ${description}`}
                className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#c48a24] focus-visible:ring-offset-2"
              >
                <article className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[#d7c49f] group-hover:shadow-md sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-[0.13em] text-slate-500">
                        {title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">
                        {description}
                      </p>
                    </div>
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="mt-6 text-3xl font-extrabold tracking-tight text-[#0F3854]">
                    {value}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#a87a28]">
                    Lihat detail
                    <ArrowUpRight
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </article>
              </Link>
            ),
          )}
        </div>
      </section>

      <section className="mt-9" aria-labelledby="recent-orders-title">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a87a28]">
              Aktivitas terbaru
            </p>
            <h2
              id="recent-orders-title"
              className="mt-1 text-lg font-extrabold text-[#0F3854]"
            >
              Pesanan terbaru
            </h2>
          </div>
          <Link
            href="/user/orders"
            className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-bold text-[#0F3854] hover:text-[#a87a28]"
          >
            Semua pesanan
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {viewState === "loading" && (
          <div
            className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-500"
            aria-live="polite"
          >
            <Loader2 className="h-5 w-5 animate-spin text-[#a87a28]" />
            Memuat ringkasan akun...
          </div>
        )}

        {viewState === "error" && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 sm:p-6"
          >
            <p className="font-bold">Ringkasan akun gagal dimuat.</p>
            <p className="mt-1">
              Periksa koneksi Anda, lalu coba muat ulang data.
            </p>
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-800 transition-colors hover:bg-red-100"
            >
              Coba lagi
            </button>
          </div>
        )}

        {viewState === "empty" && (
          <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
            <PackageOpen
              className="h-10 w-10 text-slate-300"
              aria-hidden="true"
            />
            <h3 className="mt-4 text-base font-extrabold text-[#0F3854]">
              Belum ada pesanan
            </h3>
            <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
              Pesanan katalog Anda akan muncul di sini setelah checkout.
            </p>
            <Link
              href="/catalog"
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#0F3854] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#174e70]"
            >
              Jelajahi katalog
            </Link>
          </div>
        )}

        {viewState === "ready" && (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
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
                        {ORDER_STATUS_LABELS[order.order_status] ??
                          order.order_status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                    <p className="text-base font-extrabold text-[#0F3854]">
                      {formatCurrency(order.total_price)}
                    </p>
                    <Link
                      href={getOrderDetailHref(order.id)}
                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-lg bg-[#0F3854] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#174e70]"
                    >
                      Lihat detail
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-9" aria-labelledby="quick-actions-title">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a87a28]">
            Akses cepat
          </p>
          <h2
            id="quick-actions-title"
            className="mt-1 text-lg font-extrabold text-[#0F3854]"
          >
            Aksi untuk akun Anda
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {OVERVIEW_QUICK_ACTIONS.map(({ label, href }) => {
            const Icon = quickActionIcons[href];
            return (
              <Link
                key={href}
                href={href}
                className="group flex min-h-16 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-[#0F3854] transition-colors hover:border-[#d7c49f] hover:bg-[#fbfaf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c48a24] focus-visible:ring-offset-2"
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className="h-5 w-5 text-[#a87a28]"
                    aria-hidden="true"
                  />
                  {label}
                </span>
                <ArrowUpRight
                  className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
