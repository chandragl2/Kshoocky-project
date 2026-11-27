import { NextRequest, NextResponse } from "next/server";
import { createDokuCheckoutSession, createDokuRequestId, validateDokuPaymentUrl } from "@/lib/doku/checkout";
import { getDokuConfig } from "@/lib/doku/config";
import {
  DokuCheckoutDiagnosticError,
  logDokuCheckoutDiagnostic,
} from "@/lib/doku/diagnostics";
import { buildDokuCheckoutRequest } from "@/lib/doku/payment-request";
import { readBoundedText } from "@/lib/doku/request-body";
import {
  createAuthenticatedSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getAccessToken(request: NextRequest) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
}

async function getOrderId(request: NextRequest) {
  let body: string;
  try {
    body = await readBoundedText(
      request.body,
      request.headers.get("content-length"),
      2048,
    );
  } catch {
    return null;
  }
  if (!body) return null;
  try {
    const payload: unknown = JSON.parse(body);
    if (
      typeof payload === "object" &&
      payload !== null &&
      "orderId" in payload &&
      typeof payload.orderId === "string" &&
      uuidPattern.test(payload.orderId)
    ) {
      return payload.orderId;
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const correlationId = createDokuRequestId();
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Silakan masuk untuk melanjutkan pembayaran." },
      { status: 401 },
    );
  }

  const orderId = await getOrderId(request);
  if (!orderId) {
    return NextResponse.json(
      { error: "Pesanan tidak valid." },
      { status: 400 },
    );
  }

  let config;
  let userSupabase;
  let serviceSupabase;
  try {
    config = getDokuConfig();
    userSupabase = createAuthenticatedSupabaseClient(accessToken);
    serviceSupabase = createServiceRoleSupabaseClient();
  } catch {
    logDokuCheckoutDiagnostic({
      correlationId,
      stage: "configuration_missing",
      category: "configuration_missing",
    });
    return NextResponse.json(
      { error: "Pembayaran belum dapat diproses. Silakan coba lagi nanti." },
      { status: 503 },
    );
  }

  const {
    data: { user },
    error: authError,
  } = await userSupabase.auth.getUser(accessToken);
  if (authError || !user) {
    return NextResponse.json(
      { error: "Silakan masuk untuk melanjutkan pembayaran." },
      { status: 401 },
    );
  }

  const { data: order, error: orderError } = await serviceSupabase
    .from("orders")
    .select("id, order_number, total_price, payment_status, order_status")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (orderError) {
    logDokuCheckoutDiagnostic({
      correlationId,
      stage: "database_persistence_failed",
      category: "database_persistence_failed",
    });
    return NextResponse.json(
      { error: "Pesanan tidak dapat dimuat. Silakan coba lagi." },
      { status: 503 },
    );
  }
  if (!order) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  }
  if (order.payment_status !== "pending" || order.order_status !== "pending") {
    return NextResponse.json(
      { error: "Pesanan ini tidak menunggu pembayaran." },
      { status: 409 },
    );
  }

  let checkoutRequest;
  try {
    const returnUrl = new URL(config.returnUrl);
    returnUrl.searchParams.set("orderId", order.id);
    checkoutRequest = buildDokuCheckoutRequest({
      orderNumber: order.order_number,
      totalPrice: order.total_price,
      returnUrl: returnUrl.toString(),
      notificationUrl: config.notificationUrl,
    });
  } catch {
    logDokuCheckoutDiagnostic({
      correlationId,
      stage: "local_request_validation",
      category: "local_request_validation",
    });
    return NextResponse.json(
      { error: "Nominal atau referensi pesanan tidak valid." },
      { status: 409 },
    );
  }

  const { data: attempts, error: beginError } = await serviceSupabase.rpc(
    "doku_begin_payment",
    {
      p_order_id: order.id,
      p_request_id: createDokuRequestId(),
      p_request_body: checkoutRequest.body,
      p_expires_at: checkoutRequest.expiresAt,
    },
  );
  if (beginError) {
    logDokuCheckoutDiagnostic({
      correlationId,
      stage: "database_persistence_failed",
      category: "database_persistence_failed",
    });
    return NextResponse.json(
      { error: "Pembayaran tidak dapat dimulai. Silakan muat ulang pesanan." },
      { status: 409 },
    );
  }
  const attempt = attempts?.[0];
  if (
    !attempt ||
    !attempt.payment_id ||
    !attempt.gateway_request_id ||
    !attempt.gateway_request_body ||
    !attempt.gateway_expires_at
  ) {
    logDokuCheckoutDiagnostic({
      correlationId,
      stage: "database_persistence_failed",
      category: "database_persistence_failed",
    });
    return NextResponse.json(
      { error: "Pembayaran tidak dapat dimulai. Silakan coba lagi." },
      { status: 503 },
    );
  }
  if (attempt.payment_status !== "pending") {
    return NextResponse.json(
      { error: "Pesanan ini tidak menunggu pembayaran." },
      { status: 409 },
    );
  }

  if (
    attempt.payment_url &&
    ["active", "uncertain"].includes(attempt.payment_session_state) &&
    Date.parse(attempt.gateway_expires_at) > Date.now()
  ) {
    try {
      return NextResponse.json({
        orderId,
        paymentUrl: validateDokuPaymentUrl(
          attempt.payment_url,
          config.checkoutUrlHost,
        ),
        paymentExpiresAt: attempt.gateway_expires_at,
        checkoutUrlHost: config.checkoutUrlHost,
      });
    } catch {
      logDokuCheckoutDiagnostic({
        correlationId,
        gatewayRequestId: attempt.gateway_request_id,
        stage: "gateway_payload_validation",
        category: "gateway_payload_validation",
        reasonCode: "payment_url_invalid",
      });
      return NextResponse.json(
        { error: "Tautan pembayaran tidak valid. Hubungi dukungan." },
        { status: 503 },
      );
    }
  }

  let supabaseSaveSucceeded: boolean | undefined;
  try {
    const session = await createDokuCheckoutSession({
      config,
      requestId: attempt.gateway_request_id,
      body: attempt.gateway_request_body,
    });
    if (session.invoiceNumber !== checkoutRequest.invoiceNumber) {
      throw new DokuCheckoutDiagnosticError("gateway_invoice_validation", {
        ...session.diagnostics,
        invoiceMatches: false,
        amountMatches: true,
        reasonCode: "invoice_mismatch",
      });
    }
    if (session.amount !== checkoutRequest.amount) {
      throw new DokuCheckoutDiagnosticError("gateway_amount_validation", {
        ...session.diagnostics,
        invoiceMatches: true,
        amountMatches: false,
        reasonCode: "amount_mismatch",
      });
    }
    let saveError: unknown;
    try {
      ({ error: saveError } = await serviceSupabase.rpc(
        "doku_save_checkout_response",
        {
          p_payment_id: attempt.payment_id,
          p_payment_url: session.paymentUrl,
          p_gateway_expires_at: session.expiresAt,
        },
      ));
    } catch {
      supabaseSaveSucceeded = false;
      throw new DokuCheckoutDiagnosticError("supabase_save", {
        ...session.diagnostics,
        supabaseSaveSucceeded: false,
      });
    }
    if (saveError) {
      supabaseSaveSucceeded = false;
      throw new DokuCheckoutDiagnosticError("supabase_save", {
        ...session.diagnostics,
        supabaseSaveSucceeded: false,
      });
    }
    supabaseSaveSucceeded = true;

    return NextResponse.json({
      orderId,
      paymentUrl: session.paymentUrl,
      paymentExpiresAt: session.expiresAt,
      checkoutUrlHost: config.checkoutUrlHost,
    });
  } catch (error) {
    const failure =
      error instanceof DokuCheckoutDiagnosticError
        ? error.diagnostic
        : {
            stage: "checkout_internal" as const,
            category: "checkout_internal" as const,
          };
    let uncertainError: unknown;
    try {
      ({ error: uncertainError } = await serviceSupabase.rpc(
        "doku_mark_payment_uncertain",
        {
          p_payment_id: attempt.payment_id,
        },
      ));
    } catch {
      logDokuCheckoutDiagnostic({
        correlationId,
        gatewayRequestId: attempt.gateway_request_id,
        ...failure,
        supabaseSaveSucceeded,
        supabaseMarkUncertainSucceeded: false,
      });
      logDokuCheckoutDiagnostic({
        correlationId,
        gatewayRequestId: attempt.gateway_request_id,
        stage: "supabase_mark_uncertain",
        category: "supabase_mark_uncertain",
        supabaseMarkUncertainSucceeded: false,
      });
      throw new Error("DOKU payment state update failed.");
    }
    if (uncertainError) {
      logDokuCheckoutDiagnostic({
        correlationId,
        gatewayRequestId: attempt.gateway_request_id,
        ...failure,
        supabaseSaveSucceeded,
        supabaseMarkUncertainSucceeded: false,
      });
      logDokuCheckoutDiagnostic({
        correlationId,
        gatewayRequestId: attempt.gateway_request_id,
        stage: "supabase_mark_uncertain",
        category: "supabase_mark_uncertain",
        supabaseMarkUncertainSucceeded: false,
      });
      return NextResponse.json(
        {
          error:
            "Status sesi pembayaran tidak dapat dicatat. Hubungi dukungan sebelum mencoba kembali.",
        },
        { status: 503 },
      );
    }
    logDokuCheckoutDiagnostic({
      correlationId,
      gatewayRequestId: attempt.gateway_request_id,
      stage: "checkout_response_uncertain",
      category: "checkout_response_uncertain",
      supabaseSaveSucceeded,
      supabaseMarkUncertainSucceeded: true,
    });
    logDokuCheckoutDiagnostic({
      correlationId,
      gatewayRequestId: attempt.gateway_request_id,
      ...failure,
      supabaseSaveSucceeded,
      supabaseMarkUncertainSucceeded: true,
    });
    return NextResponse.json(
      {
        error:
          "Status sesi pembayaran belum dapat dipastikan. Coba lanjutkan pembayaran dari detail pesanan.",
      },
      { status: 503 },
    );
  }
}
