"use client";

import { Loader2, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ProductGallery from "@/components/ProductGallery";
import {
  addProductToCart,
  CartOperationError,
  dispatchCartUpdated,
} from "@/lib/cart";
import { formatCurrency } from "@/lib/format-currency";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database";

type Product = Database["public"]["Tables"]["products"]["Row"];

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      if (!isSupabaseConfigured) {
        setLoadError(true);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await createClient()
          .from("products")
          .select(
            "id, title, slug, description, category, price, stock, image_url, is_catalog, status, is_featured, created_at, updated_at",
          )
          .eq("slug", params.slug)
          .eq("status", "active")
          .eq("is_catalog", true)
          .maybeSingle();
        if (error) throw error;
        if (isMounted) setProduct(data);
      } catch {
        if (isMounted) setLoadError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadProduct();
    return () => {
      isMounted = false;
    };
  }, [params.slug]);

  async function handleAddToCart() {
    if (!product || product.stock < 1 || isAdding) return;
    if (!isSupabaseConfigured) {
      setFeedback("Keranjang gagal dimuat. Silakan coba lagi.");
      return;
    }

    setIsAdding(true);
    setFeedback("");
    try {
      await addProductToCart(createClient(), product.id);
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
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-80px)] bg-[#f5f6f7] px-4 py-5 text-[#172036] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1120px]">
          <Link
            href="/catalog"
            className="mb-5 inline-flex min-h-10 items-center text-sm font-semibold text-[#0F3854] hover:text-[#b86645]"
          >
            Kembali ke katalog
          </Link>

          {isLoading ? (
            <div className="flex min-h-[360px] items-center justify-center bg-white text-sm font-semibold text-[#526174]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Memuat produk...
            </div>
          ) : loadError ? (
            <div className="bg-white px-6 py-16 text-center">
              <h1 className="text-lg font-extrabold text-[#172036]">
                Detail produk gagal dimuat
              </h1>
              <p className="mt-2 text-sm text-[#526174]">
                Silakan kembali ke katalog dan coba lagi.
              </p>
            </div>
          ) : !product ? (
            <div className="bg-white px-6 py-16 text-center">
              <h1 className="text-lg font-extrabold text-[#172036]">
                Produk tidak ditemukan
              </h1>
              <p className="mt-2 text-sm text-[#526174]">
                Produk ini mungkin sudah tidak tersedia.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:gap-8">
              <div className="min-w-0 bg-white p-3 sm:p-4">
                <ProductGallery
                  productId={product.id}
                  productTitle={product.title}
                  fallbackImageUrl={product.image_url}
                />
              </div>
              <section className="bg-white p-5 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b86645]">
                  {product.category || "KSHOOCKY Select"}
                </p>
                <h1 className="mt-2 text-2xl font-extrabold leading-tight text-[#0F3854] sm:text-3xl">
                  {product.title}
                </h1>
                <p className="mt-4 text-xl font-extrabold text-[#b86645]">
                  {formatCurrency(product.price)}
                </p>
                <p className="mt-3 text-sm font-semibold text-[#526174]">
                  {product.stock > 0
                    ? `Stok tersedia: ${product.stock}`
                    : "Stok sedang habis"}
                </p>
                {product.description && (
                  <p className="mt-6 whitespace-pre-line text-sm leading-6 text-[#526174]">
                    {product.description}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void handleAddToCart()}
                  disabled={product.stock < 1 || isAdding}
                  className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#0F3854] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#174e70] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isAdding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  {isAdding
                    ? "Menambahkan..."
                    : product.stock > 0
                      ? "Tambah ke Keranjang"
                      : "Stok Habis"}
                </button>
                {feedback && (
                  <p
                    aria-live="polite"
                    className="mt-3 text-sm font-semibold text-[#0F3854]"
                  >
                    {feedback}
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
