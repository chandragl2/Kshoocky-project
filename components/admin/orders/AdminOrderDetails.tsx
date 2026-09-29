"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, Circle, CircleDot, Loader2, PackageOpen } from "lucide-react";
import { formatCurrency } from "@/lib/format-currency";
import { createClient } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database";

type Order = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "id"
  | "user_id"
  | "order_number"
  | "subtotal"
  | "shipping_fee"
  | "discount"
  | "total_price"
  | "payment_status"
  | "order_status"
  | "shipping_address"
  | "created_at"
  | "updated_at"
>;
type CustomerProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "full_name" | "phone_number"
>;
type OrderItem = Pick<
  Database["public"]["Tables"]["order_items"]["Row"],
  "id" | "product_title" | "quantity" | "unit_price" | "subtotal"
>;
type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled";
type ShippingAddress = {
  label?: string;
  recipient_name?: string;
  phone_number?: string;
  address_line?: string;
  city?: string;
  province?: string;
  postal_code?: string;
};

const orderStatuses: { value: OrderStatus; label: string }[] = [
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

const orderLabels: Record<string, string> = Object.fromEntries(
  orderStatuses.map(({ value, label }) => [value, label]),
);

const timelineSteps = [
  "Pesanan Dibuat",
  "Menunggu Diproses",
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

function parseAddress(value: Json): ShippingAddress | null {
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

function canTransition(current: string, next: OrderStatus) {
  if (current === next) return true;
  if (current === "pending")
    return next === "processing" || next === "cancelled";
  if (current === "processing")
    return next === "shipped" || next === "cancelled";
  if (current === "shipped")
    return next === "completed" || next === "cancelled";
  return false;
}

export default function AdminOrderDetails() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [customerProfile, setCustomerProfile] =
    useState<CustomerProfile | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const supabase = createClient();
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          "id, user_id, order_number, subtotal, shipping_fee, discount, total_price, payment_status, order_status, shipping_address, created_at, updated_at",
        )
        .eq("id", params.orderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!orderData) {
        setOrder(null);
        setCustomerProfile(null);
        setItems([]);
        return;
      }

      const [itemsResult, profileResult] = await Promise.all([
        supabase
          .from("order_items")
          .select("id, product_title, quantity, unit_price, subtotal")
          .eq("order_id", orderData.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("full_name, phone_number")
          .eq("id", orderData.user_id)
          .maybeSingle(),
      ]);
      if (itemsResult.error) throw itemsResult.error;

      setOrder(orderData);
      setCustomerProfile(profileResult.error ? null : profileResult.data);
      setItems(itemsResult.data ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [params.orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  async function updateOrderStatus(nextStatus: OrderStatus) {
    if (!order || isSaving || nextStatus === order.order_status) return;
    if (!canTransition(order.order_status, nextStatus)) {
      setError("Perubahan status tersebut tidak diizinkan.");
      return;
    }

    const nextLabel = orderLabels[nextStatus] ?? nextStatus;
    if (
      !window.confirm(
        `Ubah status pesanan ${order.order_number} menjadi "${nextLabel}"?`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("not-admin");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError || profile?.role !== "admin") {
        throw new Error("not-admin");
      }

      const { error: updateError } = await supabase.rpc(
        "admin_update_order_status",
        {
          p_order_id: order.id,
          p_order_status: nextStatus,
        },
      );
      if (updateError) throw new Error("update-failed");

      setNotice("Status pesanan berhasil diperbarui.");
      await loadOrder();
    } catch {
      setError("Status pesanan gagal diperbarui. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }
  const address = order ? parseAddress(order.shipping_address) : null;
  const addressParts = address
    ? [
        address.address_line,
        address.city,
        address.province,
        address.postal_code,
      ].filter(Boolean)
    : [];
  const customerName =
    customerProfile?.full_name?.trim() ||
    address?.recipient_name?.trim() ||
    "Nama customer tidak tersedia";
  const customerPhone =
    customerProfile?.phone_number?.trim() ||
    address?.phone_number?.trim() ||
    "Tidak tersedia";

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-7 text-slate-700 sm:px-6 lg:px-10">
      <Link
        href="/admin/orders"
        className="mb-5 inline-flex min-h-10 items-center text-sm font-bold text-[#0F3854] hover:text-[#b86645]"
      >
        ← Kembali ke Pesanan
      </Link>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
        >
          {notice}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Memuat detail pesanan...
        </div>
      ) : loadError ? (
        <section className="rounded-xl border border-red-200 bg-red-50 px-5 py-12 text-center">
          <p className="text-sm font-semibold text-red-700">
            Detail pesanan gagal dimuat. Silakan coba lagi.
          </p>
          <button
            type="button"
            onClick={() => void loadOrder()}
            className="mt-4 rounded-lg bg-[#0F3854] px-4 py-2.5 text-sm font-bold text-white"
          >
            Coba Lagi
          </button>
        </section>
      ) : !order ? (
        <section className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center">
          <PackageOpen className="mx-auto h-9 w-9 text-slate-400" />
          <h1 className="mt-4 text-lg font-extrabold text-[#0F3854]">
            Pesanan tidak ditemukan
          </h1>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b86645]">
                  Detail Pesanan
                </p>
                <h1 className="mt-2 break-all text-2xl font-extrabold text-[#0F3854] sm:text-3xl">
                  {order.order_number}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {formatDate(order.created_at)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                    Pembayaran:{" "}
                    {paymentLabels[order.payment_status] ??
                      order.payment_status}
                  </span>
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800">
                    Pesanan:{" "}
                    {orderLabels[order.order_status] ?? order.order_status}
                  </span>
                </div>
              </div>
              <div className="w-full lg:max-w-xs">
                <label
                  htmlFor="order-status"
                  className="text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  Ubah Status Pesanan
                </label>
                <select
                  id="order-status"
                  value={order.order_status}
                  disabled={isSaving}
                  onChange={(event) =>
                    void updateOrderStatus(event.target.value as OrderStatus)
                  }
                  className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#0F3854] outline-none focus:border-[#E5B869] disabled:bg-slate-100"
                >
                  {orderStatuses.map(({ value, label }) => (
                    <option
                      key={value}
                      value={value}
                      disabled={!canTransition(order.order_status, value)}
                    >
                      {label}
                    </option>
                  ))}
                </select>
                {isSaving && (
                  <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan
                    status...
                  </p>
                )}
              </div>
            </div>
          </section>

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-extrabold text-[#0F3854]">
                  Customer
                </h2>
                <p className="mt-3 text-sm font-bold text-slate-800">
                  {customerName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  WhatsApp: {customerPhone}
                </p>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-extrabold text-[#0F3854]">
                  Alamat Pengiriman
                </h2>
                {address ? (
                  <div className="mt-3 text-sm leading-6 text-slate-600">
                    {address.label && (
                      <p className="font-bold text-slate-800">
                        {address.label}
                      </p>
                    )}
                    {address.recipient_name && (
                      <p className="font-semibold text-slate-800">
                        {address.recipient_name}
                      </p>
                    )}
                    {address.phone_number && <p>{address.phone_number}</p>}
                    {addressParts.map((part, index) => (
                      <p key={`${part}-${index}`}>{part}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Snapshot alamat tidak tersedia.
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-extrabold text-[#0F3854]">
                  Produk Pesanan
                </h2>
                {items.length ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                          <th className="py-3 pr-3 font-bold">Produk</th>
                          <th className="px-3 py-3 text-right font-bold">
                            Jumlah
                          </th>
                          <th className="px-3 py-3 text-right font-bold">
                            Harga Satuan
                          </th>
                          <th className="py-3 pl-3 text-right font-bold">
                            Subtotal
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="py-4 pr-3 font-semibold text-slate-800">
                              {item.product_title}
                            </td>
                            <td className="px-3 py-4 text-right">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-4 text-right">
                              {formatCurrency(item.unit_price)}
                            </td>
                            <td className="py-4 pl-3 text-right font-bold text-[#0F3854]">
                              {formatCurrency(item.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Tidak ada item pada pesanan ini.
                  </p>
                )}
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-extrabold text-[#0F3854]">
                  Ringkasan
                </h2>
                <dl className="mt-4 space-y-3 border-b border-slate-100 pb-4 text-sm">
                  <div className="flex justify-between gap-3 text-slate-600">
                    <dt>Subtotal</dt>
                    <dd className="font-semibold text-slate-800">
                      {formatCurrency(order.subtotal)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-600">
                    <dt>Diskon</dt>
                    <dd className="font-semibold text-slate-800">
                      {formatCurrency(order.discount)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-600">
                    <dt>Ongkir</dt>
                    <dd className="font-semibold text-slate-800">
                      {formatCurrency(order.shipping_fee)}
                    </dd>
                  </div>
                </dl>
                <div className="flex justify-between gap-3 pt-4">
                  <span className="font-extrabold text-[#0F3854]">Total</span>
                  <span className="text-lg font-extrabold text-[#0F3854]">
                    {formatCurrency(order.total_price)}
                  </span>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-extrabold text-[#0F3854]">
                  Timeline Status
                </h2>
                {order.order_status === "cancelled" ? (
                  <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700">
                    Pesanan Dibatalkan
                  </p>
                ) : (
                  <ol className="mt-4 space-y-3">
                    {timelineSteps.map((step, index) => {
                      const progress =
                        timelineProgress[order.order_status] ?? 1;
                      const complete = index < progress;
                      const current = index === progress;
                      const Icon = complete
                        ? Check
                        : current
                          ? CircleDot
                          : Circle;
                      return (
                        <li key={step} className="flex items-center gap-3">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full ${complete ? "bg-emerald-100 text-emerald-700" : current ? "bg-[#eaf3f8] text-[#0F3854]" : "bg-slate-100 text-slate-400"}`}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span
                            className={`text-sm font-semibold ${complete || current ? "text-[#0F3854]" : "text-slate-400"}`}
                          >
                            {step}
                            {current ? " (Saat ini)" : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
