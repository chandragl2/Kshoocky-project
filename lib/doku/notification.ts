import { createHash } from "node:crypto";
import type { DokuConfig } from "./config.ts";
import { isValidDokuTimestamp, verifyDokuSignature } from "./signature.ts";

const maximumBodyLength = 65_536;
const maximumNotificationAgeMs = 24 * 60 * 60 * 1000;

type JsonObject = Record<string, unknown>;

export type DokuNotificationHeaders = {
  clientId: string;
  requestId: string;
  timestamp: string;
  signature: string;
};

export type VerifiedDokuNotification = {
  amount: number;
  bodyDigest: string;
  eventId: string;
  eventTime: string | null;
  invoiceNumber: string;
  originalRequestId: string | null;
  status: string;
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

function parseEventTime(value: unknown, required: boolean) {
  if (value === undefined || value === null) {
    if (required) throw new Error("DOKU notification transaction time is missing.");
    return null;
  }
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)
  ) {
    throw new Error("DOKU notification transaction time is invalid.");
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    throw new Error("DOKU notification transaction time is invalid.");
  }
  return new Date(time).toISOString();
}

export function verifyDokuNotification({
  body,
  headers,
  config,
  notificationUrl,
  now = Date.now(),
}: {
  body: string;
  headers: DokuNotificationHeaders;
  config: Pick<DokuConfig, "clientId" | "secretKey">;
  notificationUrl: string;
  now?: number;
}): VerifiedDokuNotification {
  if (!body || body.length > maximumBodyLength) {
    throw new Error("DOKU notification body is invalid.");
  }
  if (
    !headers.requestId ||
    headers.requestId.length > 128 ||
    !headers.timestamp ||
    !headers.signature
  ) {
    throw new Error("DOKU notification headers are incomplete.");
  }
  const timestampMs = Date.parse(headers.timestamp);
  if (
    !isValidDokuTimestamp(headers.timestamp, now) ||
    now - timestampMs > maximumNotificationAgeMs
  ) {
    throw new Error("DOKU notification timestamp is invalid or expired.");
  }

  let requestTarget: string;
  try {
    requestTarget = new URL(notificationUrl).pathname;
  } catch {
    throw new Error("DOKU notification URL is invalid.");
  }
  if (
    !verifyDokuSignature({
      clientId: headers.clientId,
      expectedClientId: config.clientId,
      requestId: headers.requestId,
      timestampHeader: "Request-Timestamp",
      timestamp: headers.timestamp,
      requestTarget,
      body,
      secretKey: config.secretKey,
      signature: headers.signature,
    })
  ) {
    throw new Error("DOKU notification signature is invalid.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("DOKU notification body is not valid JSON.");
  }
  if (!isObject(parsed) || !isObject(parsed.transaction) || !isObject(parsed.order)) {
    throw new Error("DOKU notification is missing transaction or order.");
  }
  const status = parsed.transaction.status;
  const invoiceNumber = parsed.order.invoice_number;
  const amount = parseAmount(parsed.order.amount);
  const originalRequestId = parsed.transaction.original_request_id;
  if (
    typeof status !== "string" ||
    !/^[A-Za-z0-9_]{1,50}$/.test(status) ||
    typeof invoiceNumber !== "string" ||
    invoiceNumber.length < 1 ||
    invoiceNumber.length > 64 ||
    amount === null ||
    (originalRequestId !== undefined &&
      originalRequestId !== null &&
      (typeof originalRequestId !== "string" ||
        originalRequestId.length < 1 ||
        originalRequestId.length > 128))
  ) {
    throw new Error("DOKU notification fields are invalid.");
  }
  const normalizedStatus = status.toUpperCase();
  const requestId =
    typeof originalRequestId === "string" ? originalRequestId : null;
  if (
    ["SUCCESS", "EXPIRED"].includes(normalizedStatus) &&
    !requestId
  ) {
    throw new Error("DOKU notification request reference is missing.");
  }
  const eventTime = parseEventTime(
    parsed.transaction.date,
    ["SUCCESS", "EXPIRED"].includes(normalizedStatus),
  );
  return {
    amount,
    bodyDigest: createHash("sha256").update(body, "utf8").digest("base64"),
    eventId: headers.requestId,
    eventTime,
    invoiceNumber,
    originalRequestId: requestId,
    status: normalizedStatus,
  };
}
