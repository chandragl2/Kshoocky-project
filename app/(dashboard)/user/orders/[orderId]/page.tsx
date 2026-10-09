"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Circle, CircleDot, Loader2, PackageOpen } from "lucide-react";
import { formatCurrency } from "@/lib/format-currency";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderItem = Pick<
  Database["public"]["Tables"]["order_items"]["Row"],
  | "id"
  | "product_title"
  | "quantity"
  | "unit_price"
  | "subtotal"
  | "variant_sku_snapshot"
  | "variant_label_snapshot"
  | "variant_options_snapshot"
>;
type ShippingAddress = {
  label?: string;
  recipient_name?: string;
  phone_number?: string;
  address_line?: string;
  city?: string;
  province?: string;
  postal_code?: string;
};

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

const timelineSteps = [
  "Pesanan Dibuat",
  "Pembayaran Berhasil",
  "Diproses",
  "Dikirim",
  "Selesai",
];

const timelineProgress: Record<string, number> = {
  pending: 1,
  processing: 2,
  shipped: 3,
  completed: 5,
};

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: Json | undefined) {
  return typeof value === "string" ? value : "";
}

function parseShippingAddress(value: Json): ShippingAddress | null {
  if (!isRecord(value)) return null;
  return {
    label: stringValue(value.label),
    recipient_name: stringValue(value.recipient_name),
    phone_number: stringValue(value.phone_number),
    address_line: stringValue(value.address_line),
    city: stringValue(value.city),
    province: stringValue(value.province),
    postal_code: stringValue(value.postal_code),
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function OrderResultPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadOrder() {
      if (!isSupabaseConfigured) {
        setLoadError(true);
        setIsLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select(
            "id, user_id, order_number, subtotal, shipping_fee, discount, total_price, payment_status, order_status, shipping_address, notes, created_at, updated_at",
          )
          .eq("id", params.orderId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (orderError) throw orderError;
        if (!orderData) {
          if (isMounted) setOrder(null);
          return;
        }

        const { data: itemData, error: itemsError } = await supabase
          .from("order_items")
          .select("id, product_title, quantity, unit_price, subtotal, variant_sku_snapshot, variant_label_snapshot, variant_options_snapshot")
          .eq("order_id", orderData.id)
          .order("created_at", { ascending: true });
        if (itemsError) throw itemsError;

        if (isMounted) {
          setOrder(orderData);
          setItems(itemData ?? []);
        }
      } catch {
        if (isMounted) setLoadError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadOrder();
    return () => {
      isMounted = false;
    };
  }, [params.orderId, router]);

  const addressData = order
    ? parseShippingAddress(order.shipping_address)
    : null;
  const addressLocation = addressData
    ? [
        addressData.address_line ?? "",
        [
          addressData.city ?? "",
          addressData.province ?? "",
          addressData.postal_code ?? "",
        ]
          .filter(Boolean)
          .join(" "),
      ].filter(Boolean)
    : [];

  return (
    <main className="mx-auto max-w-[980px] px-5 py-8 sm:px-8 lg:px-10">
      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Memuat pesanan...
        </div>
      ) : loadError ? (
        <section className="rounded-xl border border-red-200 bg-red-50 px-5 py-12 text-center">
          <h1 className="text-lg font-extrabold text-red-800">
            Pesanan gagal dimuat
          </h1>
          <p className="mt-2 text-sm text-red-700">
            Silakan coba lagi beberapa saat.
          </p>
        </section>
      ) : !order ? (
        <section className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center">
          <PackageOpen className="mx-auto h-9 w-9 text-slate-400" />
          <h1 className="mt-4 text-lg font-extrabold text-[#0F3854]">
            Pesanan tidak ditemukan
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Pesanan tidak tersedia atau kamu tidak memiliki akses.
          </p>
          <Link
            href="/user/orders"
            className="mt-5 inline-flex min-h-10 items-center text-sm font-bold text-[#0F3854] hover:text-[#b86645]"
          >
            ← Kembali ke Pesanan
          </Link>
        </section>
      ) : (
        <>
          <Link
            href="/user/orders"
            className="mb-5 inline-flex min-h-10 items-center text-sm font-bold text-[#0F3854] hover:text-[#b86645]"
          >
            ← Kembali ke Pesanan
          </Link>
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b86645]">
              Detail Pesanan
            </p>
            <h1 className="mt-2 break-words text-2xl font-extrabold text-[#0F3854] sm:text-3xl">
              {order.order_number}
            </h1>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Tanggal Order</p>
                <p className="mt-1 font-semibold text-slate-800">
                  {formatDate(order.created_at)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status Pembayaran</p>
                <p className="mt-1 font-semibold text-slate-800">
                  {paymentLabels[order.payment_status] ?? order.payment_status}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status Pesanan</p>
                <p className="mt-1 font-semibold text-slate-800">
                  {orderLabels[order.order_status] ?? order.order_status}
                </p>
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-base font-extrabold text-[#0F3854]">
                  Produk Pesanan
                </h2>
                <div className="mt-4 divide-y divide-slate-100">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-bold text-slate-800">
                            {item.product_title}
                          </h3>
                          {item.variant_label_snapshot && item.variant_label_snapshot !== "Default" && (
                            <p className="mt-1 text-xs font-semibold text-slate-600">
                              Varian: {item.variant_label_snapshot}
                            </p>
                          )}
                          {item.variant_sku_snapshot && (
                            <p className="mt-1 text-[11px] text-slate-500">
                              SKU: {item.variant_sku_snapshot}
                            </p>
                          )}
                          {Array.isArray(item.variant_options_snapshot) &&
                            item.variant_options_snapshot.length > 0 && (
                              <p className="mt-1 text-xs text-slate-500">
                                {item.variant_options_snapshot
                                  .map((option) => {
                                    if (!isRecord(option)) return "";
                                    const group = stringValue(option.group);
                                    const value = stringValue(option.value);
                                    return group && value ? `${group}: ${value}` : value;
                                  })
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                          <p className="mt-1 text-xs text-slate-500">
                            {item.quantity} × {formatCurrency(item.unit_price)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-extrabold text-[#0F3854]">
                          {formatCurrency(item.subtotal)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-base font-extrabold text-[#0F3854]">
                  Alamat Pengiriman
                </h2>
                {addressData ? (
                  <div className="mt-3 text-sm leading-6 text-slate-600">
                    {addressData.label && (
                      <p className="font-bold text-slate-800">
                        {addressData.label}
                      </p>
                    )}
                    <p className="font-semibold text-slate-700">
                      {addressData.recipient_name} · {addressData.phone_number}
                    </p>
                    {addressLocation.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Alamat pengiriman tidak tersedia.
                  </p>
                )}
              </section>
            </div>

            <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-extrabold text-[#0F3854]">
                Rincian Pesanan
              </h2>
              <dl className="mt-4 space-y-3 border-b border-slate-100 pb-4 text-sm">
                <div className="flex justify-between gap-3 text-slate-600">
                  <dt>Subtotal</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatCurrency(order.subtotal)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 text-slate-600">
                  <dt>Shipping</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatCurrency(order.shipping_fee)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 text-slate-600">
                  <dt>Discount</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatCurrency(order.discount)}
                  </dd>
                </div>
              </dl>
              <div className="flex items-center justify-between gap-3 pt-4">
                <span className="font-extrabold text-[#0F3854]">Total</span>
                <span className="text-lg font-extrabold text-[#0F3854]">
                  {formatCurrency(order.total_price)}
                </span>
              </div>
              {order.payment_status === "pending" && (
                <button
                  type="button"
                  disabled
                  className="mt-5 min-h-11 w-full cursor-not-allowed rounded-lg bg-slate-300 px-4 py-3 text-sm font-bold text-white"
                >
                  Pembayaran Segera Tersedia
                </button>
              )}
            </aside>
          </div>

          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-base font-extrabold text-[#0F3854]">
              Status Pesanan
            </h2>
            {order.order_status === "cancelled" ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                Pesanan Dibatalkan
              </div>
            ) : (
              <ol className="mt-5 grid gap-4 sm:grid-cols-5">
                {timelineSteps.map((step, index) => {
                  const progress = timelineProgress[order.order_status] ?? 1;
                  const isComplete = index < progress;
                  const isCurrent = index === progress;
                  const Icon = isComplete
                    ? Check
                    : isCurrent
                      ? CircleDot
                      : Circle;

                  return (
                    <li
                      key={step}
                      aria-current={isCurrent ? "step" : undefined}
                      className="flex items-start gap-3 sm:flex-col sm:gap-2"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isComplete ? "bg-emerald-100 text-emerald-700" : isCurrent ? "bg-[#eaf3f8] text-[#0F3854]" : "bg-slate-100 text-slate-400"}`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span
                        className={`pt-1 text-sm font-semibold sm:pt-0 ${isComplete || isCurrent ? "text-[#0F3854]" : "text-slate-400"}`}
                      >
                        {step}
                        {isCurrent && (
                          <span className="ml-1 text-xs font-normal text-slate-500">
                            (Saat ini)
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </>
      )}
    </main>
  );
}
