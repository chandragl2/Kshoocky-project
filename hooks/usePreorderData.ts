"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product } from "@/components/ProductCard";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database";

type PreorderEvent = Database["public"]["Tables"]["preorder_events"]["Row"];
type PreorderEventProduct =
  Database["public"]["Tables"]["preorder_event_products"]["Row"];
type EventProductRow = Pick<
  PreorderEventProduct,
  "id" | "event_id" | "product_id" | "preorder_price" | "preorder_stock"
> & { products: Product | null };
type EventProduct = {
  id: string;
  event_id: string;
  preorder_price: number;
  preorder_stock: number;
  product: Product;
};

function isEventInWindow(event: PreorderEvent, now: number) {
  const startsAt = event.starts_at ? Date.parse(event.starts_at) : null;
  const endsAt = event.ends_at ? Date.parse(event.ends_at) : null;

  return (
    (startsAt === null || startsAt <= now) && (endsAt === null || endsAt > now)
  );
}

export function usePreorderData() {
  const [events, setEvents] = useState<PreorderEvent[]>([]);
  const [eventProducts, setEventProducts] = useState<EventProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setLoadError(false);
    if (!isSupabaseConfigured) {
      setLoadError(true);
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data: activeEvents, error: eventsError } = await supabase
        .from("preorder_events")
        .select(
          "id, title, slug, description, cover_image_url, status, starts_at, ends_at, created_at, updated_at",
        )
        .eq("status", "active")
        .order("starts_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (eventsError) throw eventsError;

      const activeEventIds = (activeEvents ?? []).map((event) => event.id);
      let mappedEventProducts: EventProduct[] = [];

      if (activeEventIds.length > 0) {
        const { data: rows, error: productsError } = await supabase
          .from("preorder_event_products")
          .select(
            "id, event_id, product_id, preorder_price, preorder_stock, products!inner(id, title, slug, description, category, price, stock, image_url, is_catalog, status, is_featured, created_at, updated_at)",
          )
          .in("event_id", activeEventIds)
          .gt("preorder_stock", 0)
          .eq("products.status", "active");
        if (productsError) throw productsError;

        mappedEventProducts = ((rows ?? []) as EventProductRow[]).flatMap(
          (row) =>
            row.products
              ? [
                  {
                    id: row.id,
                    event_id: row.event_id,
                    preorder_price: row.preorder_price,
                    preorder_stock: row.preorder_stock,
                    product: {
                      ...row.products,
                      price: row.preorder_price,
                      stock: row.preorder_stock,
                    },
                  },
                ]
              : [],
        );
      }

      setEvents(activeEvents ?? []);
      setEventProducts(mappedEventProducts);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[Preorder] Supabase query failed", error);
      }
      setLoadError(true);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
      void loadData(false);
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [loadData]);

  const activeEvents = useMemo(
    () => events.filter((event) => isEventInWindow(event, now)),
    [events, now],
  );
  const activeEventIds = useMemo(
    () => new Set(activeEvents.map((event) => event.id)),
    [activeEvents],
  );
  const activeEventProducts = useMemo(
    () => eventProducts.filter((item) => activeEventIds.has(item.event_id)),
    [activeEventIds, eventProducts],
  );

  return {
    events: activeEvents,
    eventProducts: activeEventProducts,
    isLoading,
    loadError,
  };
}
