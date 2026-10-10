"use client";

import { Heart, Loader2, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/supabase/database";
import {
  addProductToCart,
  CartOperationError,
  dispatchCartUpdated,
} from "@/lib/cart";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format-currency";

export type Product = Database["public"]["Tables"]["products"]["Row"];

export default function ProductCard({
  product,
  detailHref,
  isPreorder = false,
}: {
  product: Product;
  detailHref?: string;
  isPreorder?: boolean;
}) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [feedback, setFeedback] = useState("");
  const isAvailable = product.status === "active" && product.stock > 0;

  async function handleAddToCart() {
    if (!isAvailable || isAdding) return;
    if (!isSupabaseConfigured) {
      setFeedback("Keranjang gagal dimuat. Silakan coba lagi.");
      return;
    }

    setIsAdding(true);
    setFeedback("");
    try {
      const client = createClient();
      await addProductToCart(client, product.id);
      dispatchCartUpdated();
      setFeedback("Produk ditambahkan ke keranjang.");
    } catch (error) {
      if (error instanceof CartOperationError) {
        if (error.code === "UNAUTHENTICATED") {
          router.push("/login");
          return;
        }
        if (error.code === "OUT_OF_STOCK") {
          setFeedback("Produk sedang habis.");
          return;
        }
        if (error.code === "STOCK_LIMIT") {
          setFeedback("Jumlah melebihi stok yang tersedia.");
          return;
        }
        if (error.code === "PRODUCT_UNAVAILABLE") {
          setFeedback("Produk sedang tidak tersedia.");
          return;
        }
      }
      setFeedback("Gagal menambahkan produk ke keranjang.");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <article className="group flex h-full min-w-0 flex-col">
      <div className="relative aspect-[0.88] overflow-hidden rounded-[3px] bg-[#f1f1ef]">
        <span className="absolute left-3 top-3 z-10 bg-[#292421] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">
          {isPreorder
            ? "Pre Order"
            : isAvailable
              ? "Tersedia"
              : product.status === "active"
                ? "Habis"
                : "Tidak tersedia"}
        </span>
        <button
          type="button"
          aria-label={`Simpan ${product.title}`}
          aria-pressed={isFavorite}
          onClick={() => setIsFavorite(!isFavorite)}
          className={`absolute bottom-3 right-3 z-10 transition-transform group-hover:scale-110 ${isFavorite ? "text-[#e85d75]" : "text-white"}`}
        >
          <Heart
            className="h-5 w-5"
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.title}
            fill
            sizes="(min-width: 1024px) 260px, (min-width: 640px) 30vw, 45vw"
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-[13%] flex flex-col items-center justify-center text-center text-[#706c69]">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-70">
              KSHOOCKY SELECT
            </span>
            <strong className="mt-3 max-w-[80%] text-2xl font-extrabold leading-[0.95] sm:text-3xl">
              {product.title.split(" ").slice(0, 3).join(" ")}
            </strong>
          </div>
        )}
        {detailHref && (
          <Link
            href={detailHref}
            aria-label={`Lihat detail ${product.title}`}
            className="absolute inset-0 z-[1]"
          />
        )}
      </div>
      <h2 className="mt-3 line-clamp-2 text-sm font-medium leading-5 text-[#332d2a]">
        {detailHref ? (
          <Link href={detailHref} className="hover:text-[#0F3854]">
            {product.title}
          </Link>
        ) : (
          product.title
        )}
      </h2>
      <div className="mt-auto">
        <p className="mt-1 text-sm font-semibold text-[#b86645]">
          {formatCurrency(product.price)}
        </p>
        <p className="mt-1 text-xs text-[#8c817a]">
          {product.category || "KSHOOCKY Select"}
        </p>
        <button
          type="button"
          onClick={() => void handleAddToCart()}
          disabled={!isAvailable || isAdding}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-[#0F3854] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#174e70] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          {isAdding
            ? "Menambahkan..."
            : isAvailable
              ? "Tambah ke Keranjang"
              : "Tidak tersedia"}
        </button>
        {feedback && (
          <p
            aria-live="polite"
            className="mt-2 text-xs font-semibold text-[#0F3854]"
          >
            {feedback}
          </p>
        )}
      </div>
    </article>
  );
}
