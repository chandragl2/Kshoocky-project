import { NextRequest, NextResponse } from "next/server";
import { validateDokuPaymentUrl } from "@/lib/doku/checkout";
import { getDokuCheckoutUrlHost } from "@/lib/doku/config";
import {
  createAuthenticatedSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: { orderId: string } },
) {
  const accessToken = request.headers.get("authorization")?.match(
    /^Bearer\s+(.+)$/i,
  )?.[1];
  if (!accessToken) {
    return NextResponse.json(
      { error: "Silakan masuk untuk melihat status pembayaran." },
      { status: 401 },
    );
  }

  const orderId = context.params.orderId;
  if (!uuidPattern.test(orderId)) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  }

  let userSupabase;
  let serviceSupabase;
  let checkoutUrlHost: string;
  try {
    userSupabase = createAuthenticatedSupabaseClient(accessToken);
    serviceSupabase = createServiceRoleSupabaseClient();
    checkoutUrlHost = getDokuCheckoutUrlHost();
  } catch {
    return NextResponse.json(
      { error: "Status pembayaran belum dapat dimuat." },
      { status: 503 },
    );
  }

  const {
    data: { user },
    error: authError,
  } = await userSupabase.auth.getUser(accessToken);
  if (authError || !user) {
    return NextResponse.json(
      { error: "Silakan masuk untuk melihat status pembayaran." },
      { status: 401 },
    );
  }

  const { data: order, error: ownerError } = await serviceSupabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (ownerError) {
    return NextResponse.json(
      { error: "Status pembayaran belum dapat dimuat." },
      { status: 503 },
    );
  }
  if (!order) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  }

  const { data: statuses, error: statusError } = await serviceSupabase.rpc(
    "doku_get_order_payment_status",
    { p_order_id: orderId },
  );
  if (statusError || !statuses?.[0]) {
    return NextResponse.json(
      { error: "Status pembayaran belum dapat dimuat." },
      { status: 503 },
    );
  }
  const payment = statuses[0];
  let paymentUrl: string | null = null;
  if (
    payment.payment_url &&
    ["active", "uncertain"].includes(payment.payment_session_state ?? "") &&
    payment.payment_expires_at &&
    Date.parse(payment.payment_expires_at) > Date.now()
  ) {
    try {
      paymentUrl = validateDokuPaymentUrl(
        payment.payment_url,
        checkoutUrlHost,
      );
    } catch {
      return NextResponse.json(
        { error: "Tautan pembayaran tidak valid. Hubungi dukungan." },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({
    orderPaymentStatus: payment.order_payment_status,
    orderStatus: payment.order_status,
    paymentStatus: payment.payment_status,
    paymentSessionState: payment.payment_session_state,
    paymentExpiresAt: payment.payment_expires_at,
    paymentUrl,
  });
}
