import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateDokuPaymentUrl } from "@/lib/doku/checkout";
import { getDokuCheckoutUrlHost } from "@/lib/doku/config";
import {
  logDokuPaymentStatusDiagnostic,
  type DokuPaymentStatusDiagnosticCategory,
} from "@/lib/doku/diagnostics";
import {
  createAuthenticatedSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function statusLoadFailureResponse(
  correlationId: string,
  category: DokuPaymentStatusDiagnosticCategory,
  httpStatus = 503,
) {
  logDokuPaymentStatusDiagnostic({
    correlationId,
    stage: category,
    category,
    httpStatus,
  });
  return NextResponse.json(
    { error: "Status pembayaran belum dapat dimuat." },
    { status: httpStatus },
  );
}

export async function GET(
  request: NextRequest,
  context: { params: { orderId: string } },
) {
  const correlationId = randomUUID();

  try {
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
      return NextResponse.json(
        { error: "Pesanan tidak ditemukan." },
        { status: 404 },
      );
    }

    let userSupabase;
    try {
      userSupabase = createAuthenticatedSupabaseClient(accessToken);
    } catch {
      return statusLoadFailureResponse(
        correlationId,
        "auth_client_init_failed",
      );
    }

    let serviceSupabase;
    try {
      serviceSupabase = createServiceRoleSupabaseClient();
    } catch {
      return statusLoadFailureResponse(
        correlationId,
        "service_client_init_failed",
      );
    }

    let checkoutUrlHost: string;
    try {
      checkoutUrlHost = getDokuCheckoutUrlHost();
    } catch {
      return statusLoadFailureResponse(correlationId, "doku_config_invalid");
    }

    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser(accessToken);
    if (authError || !user) {
      logDokuPaymentStatusDiagnostic({
        correlationId,
        stage: "auth_verification_failed",
        category: "auth_verification_failed",
        httpStatus: 401,
      });
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
      return statusLoadFailureResponse(correlationId, "order_lookup_failed");
    }
    if (!order) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemukan." },
        { status: 404 },
      );
    }

    const { data: statuses, error: statusError } = await serviceSupabase.rpc(
      "doku_get_order_payment_status",
      { p_order_id: orderId },
    );
    if (statusError || !statuses?.[0]) {
      return statusLoadFailureResponse(
        correlationId,
        "payment_status_rpc_failed",
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
        logDokuPaymentStatusDiagnostic({
          correlationId,
          stage: "payment_url_validation_failed",
          category: "payment_url_validation_failed",
          httpStatus: 503,
        });
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
  } catch {
    return statusLoadFailureResponse(
      correlationId,
      "payment_status_unexpected_error",
    );
  }
}
