import { NextRequest, NextResponse } from "next/server";
import { getDokuConfig } from "@/lib/doku/config";
import { verifyDokuNotification } from "@/lib/doku/notification";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const maximumBodyLength = 65_536;

async function readRawBody(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBodyLength) {
    throw new Error("notification_body_too_large");
  }
  if (!request.body) throw new Error("notification_body_missing");

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let bytesRead = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maximumBodyLength) {
      await reader.cancel();
      throw new Error("notification_body_too_large");
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

export async function POST(request: NextRequest) {
  let body: string;
  try {
    body = await readRawBody(request);
  } catch {
    return NextResponse.json(
      { error: "Notifikasi tidak valid." },
      { status: 413 },
    );
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { error: "Format notifikasi tidak didukung." },
      { status: 415 },
    );
  }

  let config;
  let serviceSupabase;
  try {
    config = getDokuConfig();
    serviceSupabase = createServiceRoleSupabaseClient();
  } catch {
    return NextResponse.json(
      { error: "Notifikasi belum dapat diproses." },
      { status: 503 },
    );
  }

  let notification;
  try {
    notification = verifyDokuNotification({
      body,
      headers: {
        clientId: request.headers.get("Client-Id") ?? "",
        requestId: request.headers.get("Request-Id") ?? "",
        timestamp: request.headers.get("Request-Timestamp") ?? "",
        signature: request.headers.get("Signature") ?? "",
      },
      config,
      notificationUrl: config.notificationUrl,
    });
  } catch {
    return NextResponse.json(
      { error: "Signature atau isi notifikasi tidak valid." },
      { status: 401 },
    );
  }

  const { data: outcome, error: processingError } = await serviceSupabase.rpc(
    "doku_record_notification",
    {
      p_event_id: notification.eventId,
      p_body_digest: notification.bodyDigest,
      p_invoice_number: notification.invoiceNumber,
      p_amount: notification.amount,
      p_original_request_id: notification.originalRequestId,
      p_gateway_transaction_id: null,
      p_status: notification.status,
      p_event_time: notification.eventTime,
    },
  );
  if (processingError || !outcome) {
    return NextResponse.json(
      { error: "Notifikasi belum dapat dicatat. DOKU dapat mengirim ulang." },
      { status: 503 },
    );
  }

  return NextResponse.json({ received: true, outcome }, { status: 200 });
}
