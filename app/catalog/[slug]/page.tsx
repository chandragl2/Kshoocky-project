"use client";

import Image from "next/image";
import { Loader2, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
type Variant = Database["public"]["Tables"]["product_variants"]["Row"];
type OptionGroup = Database["public"]["Tables"]["product_option_groups"]["Row"];
type OptionValue = Database["public"]["Tables"]["product_option_values"]["Row"];
type VariantOptionValue =
  Database["public"]["Tables"]["product_variant_option_values"]["Row"];

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [optionValues, setOptionValues] = useState<OptionValue[]>([]);
  const [variantOptionValues, setVariantOptionValues] = useState<VariantOptionValue[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
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
        const client = createClient();
        const { data, error } = await client
          .from("products")
          .select(
            "id, title, slug, description, category, price, stock, image_url, is_catalog, status, is_featured, created_at, updated_at",
          )
          .eq("slug", params.slug)
          .eq("status", "active")
          .eq("is_catalog", true)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          if (isMounted) setProduct(null);
          return;
        }

        const [variantResult, groupResult, valueResult, variantValueResult] =
          await Promise.all([
            client
              .from("product_variants")
              .select("id, product_id, sku, label, price, stock, status, image_url, created_at, updated_at")
              .eq("product_id", data.id)
              .eq("status", "active")
              .order("created_at", { ascending: true }),
            client
              .from("product_option_groups")
              .select("id, product_id, name, is_required, sort_order, created_at")
              .eq("product_id", data.id)
              .order("sort_order", { ascending: true }),
            client
              .from("product_option_values")
              .select("id, product_id, option_group_id, value, sort_order, created_at")
              .eq("product_id", data.id)
              .order("sort_order", { ascending: true }),
            client
              .from("product_variant_option_values")
              .select("variant_id, product_id, option_group_id, option_value_id")
              .eq("product_id", data.id),
          ]);

        if (
          variantResult.error ||
          groupResult.error ||
          valueResult.error ||
          variantValueResult.error
        ) {
          throw variantResult.error ?? groupResult.error ?? valueResult.error ?? variantValueResult.error;
        }

        if (isMounted) {
          setProduct(data);
          setVariants(variantResult.data ?? []);
          setOptionGroups(groupResult.data ?? []);
          setOptionValues(valueResult.data ?? []);
          setVariantOptionValues(variantValueResult.data ?? []);
          setSelectedOptions({});
        }
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

  const selectedVariant = useMemo(() => {
    if (optionGroups.some((group) => group.is_required && !selectedOptions[group.id])) {
      return null;
    }
    if (optionGroups.length === 0) return variants.length === 1 ? variants[0] : null;

    return (
      variants.find((variant) => {
        const mappings = variantOptionValues.filter((row) => row.variant_id === variant.id);
        return optionGroups.every((group) => {
          const selectedValueId = selectedOptions[group.id];
          const mapping = mappings.find((row) => row.option_group_id === group.id);
          if (selectedValueId) return mapping?.option_value_id === selectedValueId;
          return mapping === undefined;
        });
      }) ?? null
    );
  }, [optionGroups, selectedOptions, variantOptionValues, variants]);

  const lowestPrice = variants.length
    ? Math.min(...variants.map((variant) => variant.price))
    : product?.price ?? 0;

  async function handleAddToCart() {
    if (!product || !selectedVariant || selectedVariant.stock < 1 || isAdding) return;
    if (!isSupabaseConfigured) {
      setFeedback("Keranjang gagal dimuat. Silakan coba lagi.");
      return;
    }

    setIsAdding(true);
    setFeedback("");
    try {
      await addProductToCart(createClient(), product.id, selectedVariant.id);
      dispatchCartUpdated();
      setFeedback("Varian ditambahkan ke keranjang.");
    } catch (error) {
      if (error instanceof CartOperationError) {
        if (error.code === "UNAUTHENTICATED") {
          router.push("/login");
          return;
        }
        if (error.code === "OUT_OF_STOCK") {
          setFeedback("Varian sedang habis.");
          return;
        }
        if (error.code === "STOCK_LIMIT") {
          setFeedback("Jumlah melebihi stok varian yang tersedia.");
          return;
        }
        if (error.code === "PRODUCT_UNAVAILABLE") {
          setFeedback("Produk atau varian sedang tidak tersedia.");
          return;
        }
      }
      setFeedback("Gagal menambahkan varian ke keranjang.");
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
                {selectedVariant?.image_url ? (
                  <div className="relative mb-3 aspect-square overflow-hidden bg-[#f8f8f6]">
                    <Image
                      src={selectedVariant.image_url}
                      alt={selectedVariant.label}
                      fill
                      unoptimized
                      sizes="(min-width: 1024px) 48vw, 100vw"
                      className="object-contain p-5"
                    />
                  </div>
                ) : null}
                <ProductGallery
                  productId={product.id}
                  productTitle={product.title}
                  fallbackImageUrl={selectedVariant?.image_url ?? product.image_url}
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
                  {selectedVariant
                    ? formatCurrency(selectedVariant.price)
                    : optionGroups.length
                      ? `Mulai dari ${formatCurrency(lowestPrice)}`
                      : formatCurrency(lowestPrice)}
                </p>

                {optionGroups.map((group) => {
                  const values = optionValues.filter((value) => value.option_group_id === group.id);
                  return (
                    <fieldset key={group.id} className="mt-6">
                      <legend className="text-sm font-extrabold text-[#0F3854]">
                        {group.name}
                        {group.is_required ? " *" : " (opsional)"}
                      </legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {values.map((value) => {
                          const active = selectedOptions[group.id] === value.id;
                          return (
                            <button
                              key={value.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => {
                                setSelectedOptions((current) => ({
                                  ...current,
                                  [group.id]: active ? "" : value.id,
                                }));
                                setFeedback("");
                              }}
                              className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold transition ${active ? "border-[#0F3854] bg-[#0F3854] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-[#0F3854]"}`}
                            >
                              {value.value}
                            </button>
                          );
                        })}
                        {!group.is_required && (
                          <button
                            type="button"
                            aria-pressed={!selectedOptions[group.id]}
                            onClick={() => setSelectedOptions((current) => ({
                              ...current,
                              [group.id]: "",
                            }))}
                            className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold transition ${!selectedOptions[group.id] ? "border-[#0F3854] bg-[#eaf3f8] text-[#0F3854]" : "border-slate-200 bg-white text-slate-600"}`}
                          >
                            Lewati
                          </button>
                        )}
                      </div>
                    </fieldset>
                  );
                })}

                {selectedVariant ? (
                  <div className="mt-4 rounded-lg bg-[#f3f8fb] px-3 py-3 text-sm text-[#526174]">
                    <p className="font-bold text-[#0F3854]">{selectedVariant.label}</p>
                    <p className="mt-1">SKU: {selectedVariant.sku}</p>
                    <p className="mt-1">
                      {selectedVariant.stock > 0
                        ? `Stok tersedia: ${selectedVariant.stock}`
                        : "Varian sedang habis"}
                    </p>
                  </div>
                ) : optionGroups.length > 0 ? (
                  <p className="mt-4 text-sm font-semibold text-slate-500">
                    Pilih opsi produk untuk melihat harga dan stok varian.
                  </p>
                ) : variants.length === 0 ? (
                  <p className="mt-4 text-sm font-semibold text-red-700">
                    Varian produk belum tersedia. Hubungi admin.
                  </p>
                ) : null}

                {product.description && (
                  <p className="mt-6 whitespace-pre-line text-sm leading-6 text-[#526174]">
                    {product.description}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void handleAddToCart()}
                  disabled={!selectedVariant || selectedVariant.stock < 1 || isAdding}
                  className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#0F3854] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#174e70] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isAdding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  {isAdding
                    ? "Menambahkan..."
                    : selectedVariant && selectedVariant.stock > 0
                      ? "Tambah ke Keranjang"
                      : selectedVariant
                        ? "Varian Habis"
                        : "Pilih Varian"}
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
