import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database";

const checkoutErrors: Record<string, { status: number; message: string }> = {
  checkout_address_invalid: {
    status: 400,
    message: "Alamat pengiriman belum dipilih atau tidak valid.",
  },
  checkout_cart_empty: {
    status: 400,
    message: "Keranjang kamu masih kosong.",
  },
  checkout_product_unavailable: {
    status: 409,
    message: "Produk sudah tidak tersedia.",
  },
  checkout_stock_insufficient: {
    status: 409,
    message: "Stok varian produk tidak mencukupi.",
  },
  checkout_quantity_invalid: {
    status: 400,
    message: "Jumlah produk tidak valid.",
  },
};

function getAddressId(value: unknown) {
  if (typeof value !== "object" || value === null || !("addressId" in value)) {
    return null;
  }

  const addressId = value.addressId;
  return typeof addressId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      addressId,
    )
    ? addressId
    : null;
}

export async function POST(request: NextRequest) {
  const accessToken = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return NextResponse.json(
      { error: "Silakan masuk untuk melanjutkan checkout." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Alamat pengiriman belum dipilih." },
      { status: 400 },
    );
  }

  const addressId = getAddressId(payload);
  if (!addressId) {
    return NextResponse.json(
      { error: "Alamat pengiriman belum dipilih." },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json(
      { error: "Checkout gagal dimuat. Silakan coba lagi." },
      { status: 503 },
    );
  }

  const supabase = createSupabaseClient<Database>(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return NextResponse.json(
        { error: "Silakan masuk untuk melanjutkan checkout." },
        { status: 401 },
      );
    }

    const { data: orderId, error: checkoutError } = await supabase.rpc(
      "checkout_catalog_variant",
      { p_address_id: addressId },
    );
    if (checkoutError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[Checkout] Order creation failed", {
          code: checkoutError.code,
          message: checkoutError.message,
        });
      }

      const knownError = checkoutErrors[checkoutError.message];
      return NextResponse.json(
        {
          error:
            knownError?.message ??
            "Terjadi kesalahan saat membuat pesanan. Silakan coba lagi.",
        },
        { status: knownError?.status ?? 500 },
      );
    }

    return NextResponse.json({ orderId }, { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Checkout] Unexpected order creation failure", error);
    }
    return NextResponse.json(
      { error: "Terjadi kesalahan saat membuat pesanan. Silakan coba lagi." },
      { status: 500 },
    );
  }
}
