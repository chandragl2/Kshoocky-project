"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/components/ProductCard";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ProductStatus } from "@/lib/supabase/database";

export function useProducts(status?: ProductStatus) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      if (!isSupabaseConfigured) {
        setLoadError(true);
        setIsLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const productsQuery = supabase
          .from("products")
          .select(
            "id, title, slug, description, category, price, stock, image_url, is_catalog, status, is_featured, created_at, updated_at",
          )
          .eq("is_catalog", true)
          .order("created_at", { ascending: false });
        const { data, error } = status
          ? await productsQuery.eq("status", status)
          : await productsQuery;
        if (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("[Catalog] Supabase products query failed", {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
            });
          }
          throw error;
        }
        const loadedProducts = data ?? [];
        let mappedProducts = loadedProducts;

        if (loadedProducts.length > 0) {
          const { data: imageRows, error: imageError } = await supabase
            .from("product_images")
            .select("product_id, image_url, is_primary, sort_order")
            .in(
              "product_id",
              loadedProducts.map((product) => product.id),
            )
            .order("sort_order", { ascending: true });

          if (imageError) {
            if (process.env.NODE_ENV === "development") {
              console.error("[Catalog] Product gallery query failed", {
                code: imageError.code,
                message: imageError.message,
              });
            }
          } else {
            const imagesByProduct = new Map<
              string,
              NonNullable<typeof imageRows>
            >();
            for (const image of imageRows ?? []) {
              const images = imagesByProduct.get(image.product_id) ?? [];
              images.push(image);
              imagesByProduct.set(image.product_id, images);
            }

            mappedProducts = loadedProducts.map((product) => {
              const images = imagesByProduct.get(product.id) ?? [];
              const primaryImage =
                images.find((image) => image.is_primary) ?? images[0];
              return primaryImage
                ? { ...product, image_url: primaryImage.image_url }
                : product;
            });
          }
        }

        if (isMounted) setProducts(mappedProducts);
      } catch {
        if (isMounted) setLoadError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadProducts();
    return () => {
      isMounted = false;
    };
  }, [status]);

  return { products, isLoading, loadError };
}
