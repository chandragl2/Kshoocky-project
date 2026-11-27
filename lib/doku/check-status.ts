import type { DokuConfig } from "./config.ts";
import {
  createDokuRequestId,
  createDokuRequestTimestamp,
} from "./request-metadata.ts";
import {
  createDokuSignature,
  verifyDokuSignature,
} from "./signature.ts";

const responseTimestampToleranceMs = 5 * 60 * 1000;
const requestTimeoutMs = 15_000;

type JsonObject = Record<string, unknown>;

export type DokuCheckoutStatus = {
  amount: number;
  gatewayTransactionId: string | null;
  invoiceNumber: string;
  orderStatus: string | null;
  originalRequestId: string | null;
  transactionStatus: string | null;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAmount(value: unknown) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : NaN;
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export async function getDokuCheckoutStatus({
  config,
  invoiceNumber,
  fetchImpl = fetch,
}: {
  config: DokuConfig;
  invoiceNumber: string;
  fetchImpl?: typeof fetch;
}): Promise<DokuCheckoutStatus> {
  if (!invoiceNumber || invoiceNumber.length > 64) {
    throw new Error("DOKU invoice number is invalid.");
  }
  const requestTarget = `/orders/v1/status/${encodeURIComponent(invoiceNumber)}`;
  const requestId = createDokuRequestId();
  const timestamp = createDokuRequestTimestamp();
  const { signature } = createDokuSignature({
    clientId: config.clientId,
    requestId,
    timestampHeader: "Request-Timestamp",
    timestamp,
    requestTarget,
    secretKey: config.secretKey,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  let response: Response;
  let body: string;
  try {
    try {
      response = await fetchImpl(`${config.apiBaseUrl}${requestTarget}`, {
        method: "GET",
        headers: {
          "Client-Id": config.clientId,
          "Request-Id": requestId,
          "Request-Timestamp": timestamp,
          Signature: signature,
        },
        cache: "no-store",
        signal: controller.signal,
      });
    } catch {
      throw new Error("DOKU Check Status request failed.");
    }

    if (response.status !== 200) {
      throw new Error(`DOKU Check Status failed (HTTP ${response.status}).`);
    }

    try {
      body = await response.text();
    } catch {
      throw new Error("DOKU Check Status response could not be read.");
    }
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
  const responseClientId = response.headers.get("Client-Id") ?? "";
  const responseRequestId = response.headers.get("Request-Id") ?? "";
  const responseTimestamp = response.headers.get("Response-Timestamp") ?? "";
  const responseSignature = response.headers.get("Signature") ?? "";
  const responseTimestampMs = Date.parse(responseTimestamp);
  if (
    responseRequestId !== requestId ||
    !Number.isFinite(responseTimestampMs) ||
    Math.abs(Date.now() - responseTimestampMs) > responseTimestampToleranceMs ||
    !verifyDokuSignature({
      clientId: responseClientId,
      expectedClientId: config.clientId,
      requestId: responseRequestId,
      timestampHeader: "Response-Timestamp",
      timestamp: responseTimestamp,
      requestTarget,
      secretKey: config.secretKey,
      signature: responseSignature,
    })
  ) {
    throw new Error("DOKU Check Status response signature is invalid.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("DOKU Check Status response is invalid.");
  }
  if (!isObject(parsed) || !isObject(parsed.order)) {
    throw new Error("DOKU Check Status response is incomplete.");
  }
  const order = parsed.order;
  const amount = parseAmount(order.amount);
  if (
    order.invoice_number !== invoiceNumber ||
    amount === null
  ) {
    throw new Error("DOKU Check Status response does not match the invoice.");
  }
  const transaction = isObject(parsed.transaction) ? parsed.transaction : null;
  const transactionStatus =
    typeof transaction?.status === "string"
      ? transaction.status.toUpperCase()
      : null;
  const orderStatus =
    typeof order.status === "string" ? order.status.toUpperCase() : null;
  const originalRequestId =
    typeof transaction?.original_request_id === "string"
      ? transaction.original_request_id
      : null;
  const transactionId = transaction?.id ?? transaction?.transaction_id;
  const gatewayTransactionId =
    typeof transactionId === "string" ? transactionId : null;
  if (
    transactionId !== undefined &&
    transactionId !== null &&
    (typeof transactionId !== "string" ||
      transactionId.trim().length === 0 ||
      transactionId.length > 128)
  ) {
    throw new Error("DOKU Check Status transaction ID is invalid.");
  }

  return {
    amount,
    gatewayTransactionId,
    invoiceNumber,
    orderStatus,
    originalRequestId,
    transactionStatus,
  };
}
