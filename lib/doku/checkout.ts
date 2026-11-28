import type { DokuConfig } from "./config.ts";
import { createDokuRequestTimestamp } from "./request-metadata.ts";
import {
  createDokuSignature,
  isValidDokuTimestamp,
  verifyDokuSignature,
} from "./signature.ts";
import { validateDokuPaymentUrl } from "./payment-url.ts";
import {
  DokuCheckoutDiagnosticError,
  sanitizeDokuGatewayErrorCode,
  sanitizeDokuGatewayErrorMessage,
  type DokuCheckoutDiagnosticDetails,
  type DokuCheckoutDiagnosticReasonCode,
} from "./diagnostics.ts";

export { validateDokuPaymentUrl };
export {
  createDokuRequestId,
  createDokuRequestTimestamp,
} from "./request-metadata.ts";

const requestTarget = "/checkout/v1/payment";
const responseTimestampToleranceMs = 5 * 60 * 1000;
const requestTimeoutMs = 15_000;
const maxGatewayErrorBodyLength = 16_384;

type JsonObject = Record<string, unknown>;

export type DokuCheckoutSession = {
  amount: number;
  invoiceNumber: string;
  paymentUrl: string;
  gatewaySessionId: string;
  expiresAt: string;
  diagnostics: DokuCheckoutDiagnosticDetails;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractSafeGatewayErrorDetails(body: string): {
  gatewayErrorCode?: string;
  gatewayErrorMessage?: string;
} {
  if (!body || body.length > maxGatewayErrorBodyLength) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return {};
  }
  if (!isObject(parsed)) {
    return {};
  }

  let rawCode: unknown;
  let rawMessage: unknown;

  if (isObject(parsed.error)) {
    rawCode = parsed.error.code ?? parsed.error.type;
    rawMessage = parsed.error.message;
  }

  if (
    rawCode === undefined &&
    (typeof parsed.code === "string" || typeof parsed.code === "number")
  ) {
    rawCode = parsed.code;
  }

  if (rawMessage === undefined) {
    if (typeof parsed.message === "string") {
      rawMessage = parsed.message;
    } else if (Array.isArray(parsed.message)) {
      const stringMessages = parsed.message.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      );
      if (stringMessages.length > 0) {
        rawMessage = stringMessages.join("; ");
      }
    }
  }

  const gatewayErrorCode = sanitizeDokuGatewayErrorCode(
    typeof rawCode === "number" && Number.isInteger(rawCode)
      ? String(rawCode)
      : rawCode,
  );
  const gatewayErrorMessage = sanitizeDokuGatewayErrorMessage(rawMessage);

  return {
    ...(gatewayErrorCode ? { gatewayErrorCode } : {}),
    ...(gatewayErrorMessage ? { gatewayErrorMessage } : {}),
  };
}

function amountValue(value: unknown) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : NaN;
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function parseRequestOrder(body: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new DokuCheckoutDiagnosticError("local_request_validation");
  }
  if (!isObject(parsed) || !isObject(parsed.order)) {
    throw new DokuCheckoutDiagnosticError("local_request_validation");
  }

  const amount = amountValue(parsed.order.amount);
  const invoiceNumber = parsed.order.invoice_number;
  const paymentDueDate =
    isObject(parsed.payment) && typeof parsed.payment.payment_due_date === "number"
      ? parsed.payment.payment_due_date
      : null;
  if (
    amount === null ||
    typeof invoiceNumber !== "string" ||
    invoiceNumber.length < 1 ||
    invoiceNumber.length > 30 ||
    !Number.isInteger(paymentDueDate) ||
    paymentDueDate < 1 ||
    paymentDueDate > 999_999
  ) {
    throw new DokuCheckoutDiagnosticError("local_request_validation");
  }
  return { amount, invoiceNumber, paymentDueDate };
}

function parseExpiredDate(
  value: unknown,
  details: Omit<
    DokuCheckoutDiagnosticDetails,
    "stage" | "category" | "reasonCode"
  >,
) {
  if (typeof value !== "string" || !/^\d{14}$/.test(value)) {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...details,
      reasonCode: "expired_date_invalid",
    });
  }
  const parts = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!parts) {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...details,
      reasonCode: "expired_date_invalid",
    });
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const localTime = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );
  if (
    localTime.getUTCFullYear() !== year ||
    localTime.getUTCMonth() !== month - 1 ||
    localTime.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...details,
      reasonCode: "expired_date_invalid",
    });
  }
  const expiresAt = new Date(localTime.getTime() - 7 * 60 * 60 * 1000);
  if (expiresAt.getTime() <= Date.now()) {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...details,
      reasonCode: "expired_date_elapsed",
    });
  }
  return expiresAt.toISOString();
}

function getPaymentUrlFailureReason(
  value: unknown,
  expectedHost: string,
): DokuCheckoutDiagnosticReasonCode {
  if (value === undefined || value === null) return "payment_url_missing";
  if (typeof value !== "string") return "payment_url_invalid";

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "payment_url_invalid";
  }

  if (url.protocol !== "https:") return "payment_url_invalid";
  if (url.hostname !== expectedHost) return "payment_url_host_invalid";
  if (
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return "payment_url_invalid";
  }
  if (!/^\/checkout-link-v2\/[A-Za-z0-9]+$/.test(url.pathname)) {
    return "payment_url_path_invalid";
  }
  return "payment_url_invalid";
}

function verifyResponseSignature(
  response: Response,
  body: string,
  config: DokuConfig,
  requestId: string,
  requestDurationMs: number,
) {
  const clientId = response.headers.get("Client-Id") ?? "";
  const responseRequestId = response.headers.get("Request-Id") ?? "";
  const timestamp = response.headers.get("Response-Timestamp") ?? "";
  const signature = response.headers.get("Signature") ?? "";
  const timestampMs = Date.parse(timestamp);
  const responseDetails = {
    httpStatus: response.status,
    requestDurationMs,
    responseBodyRead: true,
  } as const;
  if (responseRequestId !== requestId) {
    throw new DokuCheckoutDiagnosticError("gateway_signature", {
      ...responseDetails,
      reasonCode: "response_request_id_mismatch",
    });
  }
  if (!isValidDokuTimestamp(timestamp)) {
    throw new DokuCheckoutDiagnosticError("gateway_signature", {
      ...responseDetails,
      reasonCode: "response_timestamp_invalid",
    });
  }
  if (Math.abs(Date.now() - timestampMs) > responseTimestampToleranceMs) {
    throw new DokuCheckoutDiagnosticError("gateway_signature", {
      ...responseDetails,
      reasonCode: "response_timestamp_out_of_range",
    });
  }

  let signatureValid = false;
  try {
    signatureValid = verifyDokuSignature({
      clientId,
      expectedClientId: config.clientId,
      requestId: responseRequestId,
      timestampHeader: "Response-Timestamp",
      timestamp,
      requestTarget,
      body,
      secretKey: config.secretKey,
      signature,
    });
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    throw new DokuCheckoutDiagnosticError("gateway_signature", {
      ...responseDetails,
      signatureValid: false,
      reasonCode: "response_signature_invalid",
    });
  }
}

export async function createDokuCheckoutSession({
  config,
  requestId,
  body,
  fetchImpl = fetch,
}: {
  config: DokuConfig;
  requestId: string;
  body: string;
  fetchImpl?: typeof fetch;
}): Promise<DokuCheckoutSession> {
  const expectedOrder = parseRequestOrder(body);
  if (!requestId || requestId.length > 128) {
    throw new DokuCheckoutDiagnosticError("local_request_validation");
  }
  let timestamp: string;
  let signature: string;
  try {
    timestamp = createDokuRequestTimestamp();
    ({ signature } = createDokuSignature({
      clientId: config.clientId,
      requestId,
      timestampHeader: "Request-Timestamp",
      timestamp,
      requestTarget,
      body,
      secretKey: config.secretKey,
    }));
  } catch {
    throw new DokuCheckoutDiagnosticError("local_signing");
  }
  const controller = new AbortController();
  let timeoutTriggered = false;
  const requestStartedAt = Date.now();
  let rejectTimeout: (reason: unknown) => void = () => {};
  const timeoutPromise = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
  });
  const timeoutSignal = Symbol();
  const timeout = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
    rejectTimeout(timeoutSignal);
  }, requestTimeoutMs);
  let response: Response;
  let responseBody: string;
  try {
    try {
      response = await Promise.race([
        fetchImpl(`${config.apiBaseUrl}${requestTarget}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Id": config.clientId,
            "Request-Id": requestId,
            "Request-Timestamp": timestamp,
            Signature: signature,
          },
          body,
          cache: "no-store",
          signal: controller.signal,
        }),
        timeoutPromise,
      ]);
    } catch {
      throw new DokuCheckoutDiagnosticError("gateway_transport", {
        requestDurationMs: Date.now() - requestStartedAt,
        transportFailure: timeoutTriggered ? "timeout" : "network_rejection",
      });
    }
    if (timeoutTriggered) {
      throw new DokuCheckoutDiagnosticError("gateway_transport", {
        httpStatus: response.status,
        requestDurationMs: Date.now() - requestStartedAt,
        responseBodyRead: false,
        transportFailure: "timeout",
      });
    }
    if (response.status !== 200 && response.status !== 409) {
      if (response.status >= 400 && response.status < 500) {
        const declaredLength = Number(response.headers.get("content-length"));
        const exceedsLimit =
          Number.isFinite(declaredLength) &&
          declaredLength > maxGatewayErrorBodyLength;
        if (!exceedsLimit) {
          let errorBody: string | null = null;
          try {
            errorBody = await Promise.race([response.text(), timeoutPromise]);
          } catch {
            errorBody = null;
          }
          if (errorBody !== null && !timeoutTriggered) {
            const safeErrorDetails = extractSafeGatewayErrorDetails(errorBody);
            throw new DokuCheckoutDiagnosticError("gateway_http", {
              httpStatus: response.status,
              requestDurationMs: Date.now() - requestStartedAt,
              responseBodyRead: true,
              ...safeErrorDetails,
            });
          }
        }
      }
      throw new DokuCheckoutDiagnosticError("gateway_http", {
        httpStatus: response.status,
        requestDurationMs: Date.now() - requestStartedAt,
        responseBodyRead: false,
      });
    }
    try {
      responseBody = await Promise.race([response.text(), timeoutPromise]);
    } catch {
      if (timeoutTriggered) {
        throw new DokuCheckoutDiagnosticError("gateway_transport", {
          httpStatus: response.status,
          requestDurationMs: Date.now() - requestStartedAt,
          responseBodyRead: false,
          transportFailure: "timeout",
        });
      }
      throw new DokuCheckoutDiagnosticError("gateway_body_read", {
        httpStatus: response.status,
        requestDurationMs: Date.now() - requestStartedAt,
        responseBodyRead: false,
      });
    }
    if (timeoutTriggered) {
      throw new DokuCheckoutDiagnosticError("gateway_transport", {
        httpStatus: response.status,
        requestDurationMs: Date.now() - requestStartedAt,
        responseBodyRead: true,
        transportFailure: "timeout",
      });
    }
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
  const requestDurationMs = Date.now() - requestStartedAt;
  try {
    verifyResponseSignature(
      response,
      responseBody,
      config,
      requestId,
      requestDurationMs,
    );
  } catch (error) {
    if (error instanceof DokuCheckoutDiagnosticError) throw error;
    throw new DokuCheckoutDiagnosticError("gateway_signature", {
      httpStatus: response.status,
      requestDurationMs,
      responseBodyRead: true,
      signatureValid: false,
      reasonCode: "response_signature_invalid",
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      httpStatus: response.status,
      requestDurationMs,
      responseBodyRead: true,
      signatureValid: true,
      reasonCode: "response_json_invalid",
    });
  }
  if (!isObject(parsed) || !Array.isArray(parsed.message) || !isObject(parsed.response)) {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      httpStatus: response.status,
      requestDurationMs,
      responseBodyRead: true,
      signatureValid: true,
      reasonCode: "response_shape_invalid",
    });
  }
  const responseObject = parsed.response;
  const order = responseObject.order;
  const payment = responseObject.payment;
  const responseDetails = {
    httpStatus: response.status,
    requestDurationMs,
    responseBodyRead: true,
    signatureValid: true,
  } as const;
  if (!isObject(order)) {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...responseDetails,
      reasonCode: "order_shape_invalid",
    });
  }
  if (!isObject(payment)) {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...responseDetails,
      reasonCode: "payment_shape_invalid",
    });
  }
  const invoiceMatches = order.invoice_number === expectedOrder.invoiceNumber;
  if (!invoiceMatches) {
    throw new DokuCheckoutDiagnosticError("gateway_invoice_validation", {
      ...responseDetails,
      invoiceMatches: false,
      reasonCode: "invoice_mismatch",
    });
  }
  const responseAmount = amountValue(order.amount);
  if (responseAmount === null) {
    throw new DokuCheckoutDiagnosticError("gateway_amount_validation", {
      ...responseDetails,
      invoiceMatches: true,
      reasonCode: "amount_invalid",
    });
  }
  const amountMatches = responseAmount === expectedOrder.amount;
  if (!amountMatches) {
    throw new DokuCheckoutDiagnosticError("gateway_amount_validation", {
      ...responseDetails,
      invoiceMatches: true,
      amountMatches: false,
      reasonCode: "amount_mismatch",
    });
  }
  const responsePaymentDueDate = amountValue(payment.payment_due_date);
  if (responsePaymentDueDate === null) {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...responseDetails,
      invoiceMatches: true,
      amountMatches: true,
      reasonCode: "payment_due_date_invalid",
    });
  }
  if (responsePaymentDueDate !== expectedOrder.paymentDueDate) {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...responseDetails,
      invoiceMatches: true,
      amountMatches: true,
      reasonCode: "payment_due_date_mismatch",
    }, "order_mismatch");
  }
  if (order.currency !== undefined && order.currency !== "IDR") {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...responseDetails,
      invoiceMatches: true,
      amountMatches: true,
      reasonCode: "currency_mismatch",
    }, "order_mismatch");
  }
  const message = parsed.message.some(
    (item) => typeof item === "string" && item.toUpperCase() === "SUCCESS",
  );
  if (!message) {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...responseDetails,
      invoiceMatches: true,
      amountMatches: true,
      reasonCode: "message_not_success",
    });
  }
  if (typeof payment.token_id !== "string" || !payment.token_id) {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...responseDetails,
      invoiceMatches: true,
      amountMatches: true,
      reasonCode: "token_id_invalid",
    });
  }
  let paymentUrl: string;
  try {
    paymentUrl = validateDokuPaymentUrl(payment.url, config.checkoutUrlHost);
  } catch {
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...responseDetails,
      invoiceMatches: true,
      amountMatches: true,
      reasonCode: getPaymentUrlFailureReason(
        payment.url,
        config.checkoutUrlHost,
      ),
    }, "payment_url_invalid");
  }
  let expiresAt: string;
  try {
    expiresAt = parseExpiredDate(payment.expired_date, {
      ...responseDetails,
      invoiceMatches: true,
      amountMatches: true,
    });
  } catch (error) {
    if (error instanceof DokuCheckoutDiagnosticError) throw error;
    throw new DokuCheckoutDiagnosticError("gateway_payload_validation", {
      ...responseDetails,
      invoiceMatches: true,
      amountMatches: true,
      reasonCode: "expired_date_invalid",
    });
  }
  return {
    amount: responseAmount,
    invoiceNumber: expectedOrder.invoiceNumber,
    paymentUrl,
    gatewaySessionId: payment.token_id,
    expiresAt,
    diagnostics: {
      stage: "gateway_payload_validation",
      category: "gateway_payload_validation",
      httpStatus: response.status,
      requestDurationMs,
      responseBodyRead: true,
      signatureValid: true,
      invoiceMatches: true,
      amountMatches: true,
    },
  };
}
