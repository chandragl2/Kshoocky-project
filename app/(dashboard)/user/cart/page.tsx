"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Minus,
  PackageOpen,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { dispatchCartUpdated, getOrCreateUserCart } from "@/lib/cart";
import { formatCurrency } from "@/lib/format-currency";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database";

type CartRow = Database["public"]["Tables"]["cart_items"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type CartLine = Pick<CartRow, "id" | "cart_id" | "product_id" | "quantity"> & {
  products: Pick<
    ProductRow,
    "id" | "title" | "slug" | "price" | "image_url" | "stock" | "status"
  > | null;
};

const genericError = "Keranjang gagal dimuat. Silakan coba lagi.";

export default function UserCartPage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    isSupabaseConfigured ? createClient() : null,
  );
  const [cartId, setCartId] = useState<string | null>(null);
  const [items, setItems] = useState<CartLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadCart = useCallback(async () => {
    setIsLoading(true);
    setError("");
    if (!supabase) {
      setError(genericError);
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

      const cart = await getOrCreateUserCart(supabase, user.id);
      const { data, error: itemsError } = await supabase
        .from("cart_items")
        .select(
          "id, cart_id, product_id, quantity, products(id, title, slug, price, image_url, stock, status)",
        )
        .eq("cart_id", cart.id)
        .order("created_at", { ascending: true });
      if (itemsError) throw itemsError;

      setCartId(cart.id);
      setItems(data ?? []);
    } catch {
      setError(genericError);
    } finally {
      setIsLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  async function getOwnedCartId() {
    if (!supabase) throw new Error("Cart unavailable");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      router.replace("/login");
      return null;
    }

    const { data, error: cartError } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (cartError || !data || (cartId && data.id !== cartId)) {
      throw new Error("Cart unavailable");
    }
    return data.id;
  }

  async function updateQuantity(item: CartLine, nextQuantity: number) {
    if (busyItemId || isClearing || !supabase) return;
    const product = item.products;
    if (!product || product.status !== "active" || product.stock <= 0) return;
    if (nextQuantity < 1) return;
    if (nextQuantity > product.stock) {
      setError("Jumlah melebihi stok yang tersedia.");
      return;
    }

    setBusyItemId(item.id);
    setError("");
    setNotice("");
    try {
      const ownedCartId = await getOwnedCartId();
      if (!ownedCartId) return;
      const { data, error: updateError } = await supabase
        .from("cart_items")
        .update({ quantity: nextQuantity })
        .eq("id", item.id)
        .eq("cart_id", ownedCartId)
        .select("id")
        .maybeSingle();
      if (updateError || !data)
        throw updateError ?? new Error("Item unavailable");

      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, quantity: nextQuantity }
            : currentItem,
        ),
      );
      dispatchCartUpdated();
    } catch {
      setError("Gagal mengubah jumlah produk.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function removeItem(itemId: string) {
    if (busyItemId || isClearing || !supabase) return;
    setBusyItemId(itemId);
    setError("");
    setNotice("");
    try {
      const ownedCartId = await getOwnedCartId();
      if (!ownedCartId) return;
      const { data, error: deleteError } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", itemId)
        .eq("cart_id", ownedCartId)
        .select("id")
        .maybeSingle();
      if (deleteError || !data)
        throw deleteError ?? new Error("Item unavailable");

      setItems((current) => current.filter((item) => item.id !== itemId));
      dispatchCartUpdated();
    } catch {
      setError("Gagal menghapus produk.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function clearCart() {
    if (!items.length || busyItemId || isClearing || !supabase) return;
    if (!window.confirm("Yakin ingin mengosongkan keranjang?")) return;

    setIsClearing(true);
    setError("");
    setNotice("");
    try {
      const ownedCartId = await getOwnedCartId();
      if (!ownedCartId) return;
      const { error: deleteError } = await supabase
        .from("cart_items")
        .delete()
        .eq("cart_id", ownedCartId);
      if (deleteError) throw deleteError;

      setItems([]);
      setNotice("Keranjang berhasil dikosongkan.");
      dispatchCartUpdated();
    } catch {
      setError("Gagal mengosongkan keranjang.");
    } finally {
      setIsClearing(false);
    }
  }

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce(
    (total, item) =>
      total + (item.products ? item.products.price * item.quantity : 0),
    0,
  );

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 lg:px-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c48a24]">
            KSHOOCKY SHOP
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0F3854] sm:text-3xl">
            Keranjang
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Periksa pilihan produkmu sebelum checkout tersedia.
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => void clearCart()}
            disabled={isClearing || busyItemId !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-red-200 hover:text-red-700 disabled:opacity-50"
          >
            {isClearing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Kosongkan Keranjang
          </button>
        )}
      </header>

      {(error || notice) && (
        <div
          role={error ? "alert" : "status"}
          className={`mb-5 rounded-lg border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
        >
          {error || notice}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Memuat keranjang
        </div>
      ) : error && !cartId ? null : items.length === 0 ? (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf3f8] text-[#2f83b8]">
            <PackageOpen className="h-7 w-7" strokeWidth={1.6} />
          </div>
          <h2 className="mt-4 text-lg font-extrabold text-[#0F3854]">
            Keranjang kamu masih kosong
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Produk pilihanmu akan muncul di sini.
          </p>
          <Link
            href="/catalog"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0F3854] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#174e70]"
          >
            <ShoppingBag className="h-4 w-4" /> Belanja Sekarang
          </Link>
        </section>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-label="Produk di keranjang" className="space-y-3">
            {items.map((item) => {
              const product = item.products;
              const isAvailable =
                product?.status === "active" && product.stock > 0;
              const isBusy = busyItemId === item.id;

              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex gap-4 sm:gap-5">
                    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-md bg-[#f1f1ef] sm:h-28 sm:w-24">
                      {product?.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.title}
                          fill
                          unoptimized
                          sizes="96px"
                          className="object-contain p-2"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-400">
                          <PackageOpen className="h-7 w-7" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="break-words text-sm font-extrabold text-[#0F3854] sm:text-base">
                            {product?.title ?? "Produk tidak tersedia"}
                          </h2>
                          <p className="mt-1 text-sm font-bold text-[#b86645]">
                            {product
                              ? formatCurrency(product.price)
                              : "Harga tidak tersedia"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeItem(item.id)}
                          disabled={isBusy || isClearing}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Hapus
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        {isAvailable ? (
                          <div className="inline-flex items-center rounded-md border border-slate-200">
                            <button
                              type="button"
                              aria-label={`Kurangi jumlah ${product.title}`}
                              onClick={() =>
                                void updateQuantity(item, item.quantity - 1)
                              }
                              disabled={
                                isBusy || isClearing || item.quantity <= 1
                              }
                              className="flex h-9 w-9 items-center justify-center text-[#0F3854] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-10 text-center text-sm font-bold text-[#0F3854]">
                              {isBusy ? (
                                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                              ) : (
                                item.quantity
                              )}
                            </span>
                            <button
                              type="button"
                              aria-label={`Tambah jumlah ${product.title}`}
                              onClick={() =>
                                void updateQuantity(item, item.quantity + 1)
                              }
                              disabled={
                                isBusy ||
                                isClearing ||
                                item.quantity >= product.stock
                              }
                              className="flex h-9 w-9 items-center justify-center text-[#0F3854] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="rounded-md bg-red-50 px-2.5 py-2 text-xs font-bold text-red-700">
                            Produk tidak tersedia
                          </span>
                        )}
                        <span className="text-sm font-extrabold text-[#0F3854]">
                          {product
                            ? formatCurrency(product.price * item.quantity)
                            : "-"}
                        </span>
                      </div>
                      {product && product.status !== "active" && (
                        <p className="mt-2 text-xs font-semibold text-red-700">
                          Produk sedang tidak tersedia.
                        </p>
                      )}
                      {product?.status === "active" && product.stock <= 0 && (
                        <p className="mt-2 text-xs font-semibold text-red-700">
                          Produk sedang habis.
                        </p>
                      )}
                      {product?.status === "active" &&
                        product.stock > 0 &&
                        item.quantity > product.stock && (
                          <p className="mt-2 text-xs font-semibold text-amber-700">
                            Jumlah saat ini melebihi stok. Kurangi jumlah untuk
                            melanjutkan nanti.
                          </p>
                        )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <h2 className="text-base font-extrabold text-[#0F3854]">
              Ringkasan Keranjang
            </h2>
            <div className="mt-5 flex items-center justify-between border-b border-slate-100 pb-4 text-sm text-slate-500">
              <span>Total quantity</span>
              <span className="font-bold text-slate-700">{itemCount}</span>
            </div>
            <div className="flex items-center justify-between py-4">
              <span className="text-sm font-bold text-slate-700">Subtotal</span>
              <span className="text-lg font-extrabold text-[#0F3854]">
                {formatCurrency(subtotal)}
              </span>
            </div>
            <Link
              href="/user/checkout"
              className="mt-2 flex w-full items-center justify-center rounded-lg bg-[#0F3854] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#174e70]"
            >
              Lanjut ke Checkout
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
