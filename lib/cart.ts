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
      | "REQUEST",
  ) {
    super(code);
    this.name = "CartOperationError";
  }
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

export async function getOrCreateUserCart(client: Client, userId: string) {
  const existingCart = await findUserCart(client, userId);
  if (existingCart) return existingCart;

  const { data: createdCart, error: createError } = await client
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (!createError) return createdCart;

  if (createError.code === "23505") {
    const racedCart = await findUserCart(client, userId);
    if (racedCart) return racedCart;
  }
  throw new CartOperationError("REQUEST");
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

export async function addProductToCart(client: Client, productId: string) {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) throw new CartOperationError("UNAUTHENTICATED");

  const { data: product, error: productError } = await client
    .from("products")
    .select("id, stock, status")
    .eq("id", productId)
    .maybeSingle();
  if (productError) throw new CartOperationError("REQUEST");
  if (!product) throw new CartOperationError("PRODUCT_UNAVAILABLE");
  if (product.stock <= 0) throw new CartOperationError("OUT_OF_STOCK");
  if (product.status !== "active") {
    throw new CartOperationError("PRODUCT_UNAVAILABLE");
  }

  const cart = await getOrCreateUserCart(client, user.id);
  const { data: existingItem, error: itemError } = await client
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cart.id)
    .eq("product_id", product.id)
    .maybeSingle();
  if (itemError) throw new CartOperationError("REQUEST");

  if (existingItem) {
    const nextQuantity = existingItem.quantity + 1;
    if (nextQuantity > product.stock) {
      throw new CartOperationError("STOCK_LIMIT");
    }
    const { data: updatedItem, error: updateError } = await client
      .from("cart_items")
      .update({ quantity: nextQuantity })
      .eq("id", existingItem.id)
      .eq("cart_id", cart.id)
      .select("id")
      .maybeSingle();
    if (updateError || !updatedItem) throw new CartOperationError("REQUEST");
    return cart.id;
  }

  const { error: insertError } = await client.from("cart_items").insert({
    cart_id: cart.id,
    product_id: product.id,
    quantity: 1,
  });
  if (!insertError) return cart.id;

  if (insertError.code === "23505") {
    const { data: racedItem, error: racedItemError } = await client
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cart.id)
      .eq("product_id", product.id)
      .maybeSingle();
    if (!racedItemError && racedItem) {
      const nextQuantity = racedItem.quantity + 1;
      if (nextQuantity > product.stock) {
        throw new CartOperationError("STOCK_LIMIT");
      }
      const { data: updatedItem, error: updateError } = await client
        .from("cart_items")
        .update({ quantity: nextQuantity })
        .eq("id", racedItem.id)
        .eq("cart_id", cart.id)
        .select("id")
        .maybeSingle();
      if (!updateError && updatedItem) return cart.id;
    }
  }

  throw new CartOperationError("REQUEST");
}

export function dispatchCartUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  }
}
