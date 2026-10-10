import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";

type Client = SupabaseClient<Database>;

export const CART_UPDATED_EVENT = "kshoocky:cart-updated";

export class CartOperationError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHENTICATED"
      | "PRODUCT_UNAVAILABLE"
      | "OUT_OF_STOCK"
      | "STOCK_LIMIT"
      | "OPTION_REQUIRED"
      | "REQUEST",
  ) {
    super(code);
    this.name = "CartOperationError";
  }
}

function mapCartRpcError(message: string): CartOperationError {
  if (message.includes("cart_unauthenticated") || message.includes("not authenticated")) {
    return new CartOperationError("UNAUTHENTICATED");
  }
  if (message.includes("cart_stock_limit")) {
    return new CartOperationError("STOCK_LIMIT");
  }
  if (message.includes("cart_variant_unavailable")) {
    return new CartOperationError("PRODUCT_UNAVAILABLE");
  }
  if (message.includes("cart_quantity_invalid")) {
    return new CartOperationError("STOCK_LIMIT");
  }
  return new CartOperationError("REQUEST");
}

export async function findUserCart(client: Client, userId: string) {
  const { data, error } = await client
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new CartOperationError("REQUEST");
  return data;
}

export async function getCurrentCartQuantity(client: Client) {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) return 0;

  const cart = await findUserCart(client, user.id);
  if (!cart) return 0;

  const { data, error } = await client
    .from("cart_items")
    .select("quantity")
    .eq("cart_id", cart.id);
  if (error) throw new CartOperationError("REQUEST");
  return (data ?? []).reduce((total, item) => total + item.quantity, 0);
}

/**
 * Variant must be selected when a product has configured option groups or more
 * than one sellable variant. Products migrated from the legacy catalog retain
 * a single default variant, which can still be added directly from ProductCard.
 */
export async function addProductToCart(
  client: Client,
  productId: string,
  variantId?: string,
  quantity = 1,
) {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) throw new CartOperationError("UNAUTHENTICATED");

  let selectedVariantId = variantId;
  if (!selectedVariantId) {
    const [{ data: variants, error: variantsError }, { data: groups, error: groupsError }] =
      await Promise.all([
        client
          .from("product_variants")
          .select("id")
          .eq("product_id", productId)
          .eq("status", "active"),
        client
          .from("product_option_groups")
          .select("id")
          .eq("product_id", productId),
      ]);

    if (variantsError || groupsError) throw new CartOperationError("REQUEST");
    if ((groups?.length ?? 0) > 0 || (variants?.length ?? 0) !== 1) {
      throw new CartOperationError("OPTION_REQUIRED");
    }
    selectedVariantId = variants![0].id;
  }

  const { error } = await client.rpc("cart_add_variant", {
    p_product_id: productId,
    p_variant_id: selectedVariantId,
    p_quantity: quantity,
  });
  if (error) throw mapCartRpcError(error.message);

  const cart = await findUserCart(client, user.id);
  if (!cart) throw new CartOperationError("REQUEST");
  return cart.id;
}

export async function updateCartItemQuantity(
  client: Client,
  cartItemId: string,
  quantity: number,
) {
  const { error } = await client.rpc("cart_update_item_quantity", {
    p_cart_item_id: cartItemId,
    p_quantity: quantity,
  });
  if (error) throw mapCartRpcError(error.message);
}

export async function removeCartItem(client: Client, cartItemId: string) {
  const { error } = await client.rpc("cart_remove_item", {
    p_cart_item_id: cartItemId,
  });
  if (error) throw mapCartRpcError(error.message);
}

export async function clearCartItems(client: Client) {
  const { error } = await client.rpc("cart_clear_items");
  if (error) throw mapCartRpcError(error.message);
}

export function dispatchCartUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  }
}
