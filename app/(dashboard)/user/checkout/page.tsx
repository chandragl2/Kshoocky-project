"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, PackageOpen, ShoppingBag } from "lucide-react";
import { dispatchCartUpdated, findUserCart } from "@/lib/cart";
import { formatCurrency } from "@/lib/format-currency";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database";

type CartItem = Database["public"]["Tables"]["cart_items"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type Variant = Database["public"]["Tables"]["product_variants"]["Row"];
type Address = Database["public"]["Tables"]["addresses"]["Row"];
type CheckoutItem = Pick<CartItem, "id" | "product_id" | "variant_id" | "quantity"> & {
  products: Pick<
    Product,
    "id" | "title" | "image_url" | "price" | "stock" | "status" | "is_catalog"
  > | null;
  product_variants: Pick<
    Variant,
    "id" | "sku" | "label" | "image_url" | "price" | "stock" | "status"
  > | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    isSupabaseConfigured ? createClient() : null,
  );
  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadCheckout = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    setError("");
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

      const [cart, addressResult] = await Promise.all([
        findUserCart(supabase, user.id),
        supabase
          .from("addresses")
          .select(
            "id, user_id, label, recipient_name, phone_number, address_line, city, province, postal_code, is_default, created_at, updated_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (addressResult.error) throw addressResult.error;

      let loadedItems: CheckoutItem[] = [];
      if (cart) {
        const { data, error: itemsError } = await supabase
          .from("cart_items")
          .select(
            "id, product_id, variant_id, quantity, products(id, title, image_url, price, stock, status, is_catalog), product_variants(id, sku, label, image_url, price, stock, status)",
          )
          .eq("cart_id", cart.id)
          .order("created_at", { ascending: true });
        if (itemsError) throw itemsError;
        loadedItems = data ?? [];
      }

      const loadedAddresses = addressResult.data ?? [];
      setItems(loadedItems);
      setAddresses(loadedAddresses);
      setSelectedAddressId((currentId) => {
        if (loadedAddresses.some((address) => address.id === currentId)) {
          return currentId;
        }
        return (
          loadedAddresses.find((address) => address.is_default)?.id ??
          loadedAddresses[0]?.id ??
          ""
        );
      });
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadCheckout();
  }, [loadCheckout]);

  const subtotal = items.reduce(
    (total, item) =>
      total + ((item.product_variants?.price ?? 0) * item.quantity),
    0,
  );
  const shippingFee = 0;
  const discount = 0;
  const total = subtotal + shippingFee - discount;
  const unavailableItems = items.filter(
    (item) =>
      !item.products ||
      item.products.status !== "active" ||
      !item.products.is_catalog ||
      !item.product_variants ||
      item.product_variants.status !== "active",
  );
  const insufficientStockItems = items.filter(
    (item) =>
      item.product_variants && item.quantity > item.product_variants.stock,
  );

  async function submitOrder() {
    if (isSubmitting) return;
    if (!selectedAddressId) {
      setError("Alamat pengiriman belum dipilih.");
      return;
    }
    if (!items.length) {
      setError("Keranjang kamu masih kosong.");
      return;
    }
    if (unavailableItems.length) {
      setError("Produk sudah tidak tersedia.");
      return;
    }
    if (insufficientStockItems.length) {
      setError("Stok produk tidak mencukupi.");
      return;
    }
    if (!supabase) {
      setError("Terjadi kesalahan saat membuat pesanan. Silakan coba lagi.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ addressId: selectedAddressId }),
      });
      const responseBody: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const serverMessage =
          isRecord(responseBody) && typeof responseBody.error === "string"
            ? responseBody.error
            : "Terjadi kesalahan saat membuat pesanan. Silakan coba lagi.";
        setError(serverMessage);
        return;
      }

      const orderId =
        isRecord(responseBody) && typeof responseBody.orderId === "string"
          ? responseBody.orderId
          : null;
      if (!orderId) {
        setError("Terjadi kesalahan saat membuat pesanan. Silakan coba lagi.");
        return;
      }

      dispatchCartUpdated();
      router.push(`/user/orders/${encodeURIComponent(orderId)}`);
    } catch {
      setError("Terjadi kesalahan saat membuat pesanan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 lg:px-10">
      <header className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c48a24]">
          KSHOOCKY SHOP
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0F3854] sm:text-3xl">
          Checkout
        </h1>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Memuat keranjang dan alamat...
        </div>
      ) : loadError ? (
        <section className="rounded-xl border border-red-200 bg-red-50 px-5 py-10 text-center">
          <p className="text-sm font-semibold text-red-700">
            Checkout gagal dimuat. Silakan coba lagi.
          </p>
          <button
            type="button"
            onClick={() => void loadCheckout()}
            className="mt-4 rounded-lg bg-[#0F3854] px-4 py-2.5 text-sm font-bold text-white"
          >
            Coba Lagi
          </button>
        </section>
      ) : items.length === 0 ? (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf3f8] text-[#2f83b8]">
            <PackageOpen className="h-7 w-7" strokeWidth={1.6} />
          </div>
          <h2 className="mt-4 text-lg font-extrabold text-[#0F3854]">
            Keranjang kamu masih kosong.
          </h2>
          <Link
            href="/catalog"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0F3854] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#174e70]"
          >
            <ShoppingBag className="h-4 w-4" /> Belanja Sekarang
          </Link>
        </section>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#0F3854]" />
                <h2 className="text-base font-extrabold text-[#0F3854]">
                  Alamat Pengiriman
                </h2>
              </div>

              {addresses.length === 0 ? (
                <div className="mt-5 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-600">
                    Kamu belum memiliki alamat pengiriman.
                  </p>
                  <Link
                    href="/user/addresses"
                    className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#0F3854] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#174e70]"
                  >
                    Tambah Alamat
                  </Link>
                </div>
              ) : (
                <fieldset className="mt-4 space-y-3">
                  <legend className="sr-only">Pilih alamat pengiriman</legend>
                  {addresses.map((address) => (
                    <label
                      key={address.id}
                      className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition ${selectedAddressId === address.id ? "border-[#0F3854] bg-[#f3f8fb]" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <input
                        type="radio"
                        name="shipping-address"
                        value={address.id}
                        checked={selectedAddressId === address.id}
                        onChange={() => setSelectedAddressId(address.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-[#0F3854]"
                      />
                      <span className="min-w-0 text-sm text-slate-600">
                        <span className="flex flex-wrap items-center gap-2 font-extrabold text-[#0F3854]">
                          {address.label}
                          {address.is_default && (
                            <span className="rounded bg-[#fff5dc] px-2 py-0.5 text-[10px] font-bold uppercase text-[#93651b]">
                              Default
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block font-semibold text-slate-700">
                          {address.recipient_name} · {address.phone_number}
                        </span>
                        <span className="mt-1 block leading-5">
                          {address.address_line}, {address.city},{" "}
                          {address.province} {address.postal_code}
                        </span>
                      </span>
                    </label>
                  ))}
                  <Link
                    href="/user/addresses"
                    className="inline-flex min-h-10 items-center text-sm font-bold text-[#0F3854] hover:text-[#b86645]"
                  >
                    Kelola alamat
                  </Link>
                </fieldset>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-base font-extrabold text-[#0F3854]">
                Ringkasan Produk
              </h2>
              <div className="mt-4 divide-y divide-slate-100">
                {items.map((item) => {
                  const product = item.products;
                  const variant = item.product_variants;
                  const lineUnavailable =
                    !product ||
                    product.status !== "active" ||
                    !product.is_catalog ||
                    !variant ||
                    variant.status !== "active";
                  const lineOutOfStock =
                    Boolean(variant && item.quantity > variant.stock);

                  return (
                    <article
                      key={item.id}
                      className="flex gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md bg-[#f1f1ef] sm:h-24 sm:w-20">
                        {(variant?.image_url ?? product?.image_url) ? (
                          <Image
                            src={(variant?.image_url ?? product?.image_url)!}
                            alt={product.title}
                            fill
                            unoptimized
                            sizes="80px"
                            className="object-contain p-1.5"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-400">
                            <PackageOpen className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-sm font-extrabold text-[#0F3854]">
                          {product?.title ?? "Produk tidak tersedia"}
                        </h3>
                        {variant && variant.label !== "Default" && (
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {variant.label} · SKU {variant.sku}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          {item.quantity} ×{" "}
                          {variant
                            ? formatCurrency(variant.price)
                            : "Harga tidak tersedia"}
                        </p>
                        <p className="mt-2 text-sm font-bold text-slate-700">
                          Subtotal:{" "}
                          {variant
                            ? formatCurrency(variant.price * item.quantity)
                            : "-"}
                        </p>
                        {(lineUnavailable || lineOutOfStock) && (
                          <p className="mt-2 text-xs font-semibold text-red-700">
                            {lineUnavailable
                              ? "Produk sudah tidak tersedia."
                              : "Stok produk tidak mencukupi."}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <h2 className="text-base font-extrabold text-[#0F3854]">
              Ringkasan Harga
            </h2>
            <div className="mt-5 space-y-3 border-b border-slate-100 pb-4 text-sm">
              <div className="flex items-center justify-between gap-3 text-slate-600">
                <span>Subtotal</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-600">
                <span>Shipping Fee</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(shippingFee)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-600">
                <span>Discount</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(discount)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 py-4">
              <span className="text-sm font-extrabold text-[#0F3854]">
                Total
              </span>
              <span className="text-lg font-extrabold text-[#0F3854]">
                {formatCurrency(total)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void submitOrder()}
              disabled={
                isSubmitting ||
                !addresses.length ||
                !selectedAddressId ||
                unavailableItems.length > 0 ||
                insufficientStockItems.length > 0
              }
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0F3854] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#174e70] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Membuat Pesanan..." : "Pesan Sekarang"}
            </button>
            {!selectedAddressId && addresses.length > 0 && (
              <p className="mt-2 text-xs font-semibold text-red-700">
                Alamat pengiriman belum dipilih.
              </p>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
