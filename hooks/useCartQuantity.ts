"use client";

import { useEffect, useState } from "react";
import { CART_UPDATED_EVENT, getCurrentCartQuantity } from "@/lib/cart";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function useCartQuantity() {
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const client = createClient();
    let isMounted = true;

    async function refreshQuantity() {
      try {
        const nextQuantity = await getCurrentCartQuantity(client);
        if (isMounted) setQuantity(nextQuantity);
      } catch {
        if (isMounted) setQuantity(0);
      }
    }

    const scheduleRefresh = () => {
      window.setTimeout(() => void refreshQuantity(), 0);
    };
    void refreshQuantity();
    window.addEventListener(CART_UPDATED_EVENT, scheduleRefresh);
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) setQuantity(0);
      else scheduleRefresh();
    });

    return () => {
      isMounted = false;
      window.removeEventListener(CART_UPDATED_EVENT, scheduleRefresh);
      subscription.unsubscribe();
    };
  }, []);

  return quantity;
}
