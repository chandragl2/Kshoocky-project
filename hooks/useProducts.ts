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
        const productsQuery = createClient()
          .from("products")
          .select(
            "id, title, slug, description, category, price, stock, image_url, status, is_featured, created_at, updated_at",
          )
          .order("created_at", { ascending: false });
        const { data, error } = status
          ? await productsQuery.eq("status", status)
          : await productsQuery;
        if (error) throw error;
        if (isMounted) setProducts(data ?? []);
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
