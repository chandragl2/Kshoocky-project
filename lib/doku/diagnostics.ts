export const dokuCheckoutDiagnosticCategories = [
  "configuration_missing",
  "database_persistence_failed",
  "local_request_validation",
  "local_signing",
  "gateway_transport",
  "gateway_http",
  "gateway_body_read",
  "gateway_signature",
  "gateway_payload_validation",
  "gateway_invoice_validation",
  "gateway_amount_validation",
  "supabase_save",
  "supabase_mark_uncertain",
  "checkout_response_uncertain",
  "checkout_internal",
] as const;

export const dokuCheckoutDiagnosticReasonCodes = [
  "response_json_invalid",
  "response_shape_invalid",
  "order_shape_invalid",
  "payment_shape_invalid",
  "response_request_id_mismatch",
  "response_timestamp_invalid",
  "response_timestamp_out_of_range",
  "response_signature_invalid",
  "invoice_mismatch",
  "amount_invalid",
  "amount_mismatch",
  "payment_due_date_invalid",
  "payment_due_date_mismatch",
  "currency_mismatch",
  "message_not_success",
  "token_id_invalid",
  "payment_url_missing",
  "payment_url_invalid",
  "payment_url_host_invalid",
  "payment_url_path_invalid",
  "expired_date_invalid",
  "expired_date_elapsed",
] as const;

export type DokuCheckoutDiagnosticCategory =
  (typeof dokuCheckoutDiagnosticCategories)[number];

export type DokuCheckoutDiagnosticReasonCode =
  (typeof dokuCheckoutDiagnosticReasonCodes)[number];

export type DokuCheckoutDiagnosticDetails = {
  stage: DokuCheckoutDiagnosticCategory;
  category: DokuCheckoutDiagnosticCategory;
  reasonCode?: DokuCheckoutDiagnosticReasonCode;
  httpStatus?: number;
  requestDurationMs?: number;
  responseBodyRead?: boolean;
  signatureValid?: boolean;
  invoiceMatches?: boolean;
  amountMatches?: boolean;
  supabaseSaveSucceeded?: boolean;
  supabaseMarkUncertainSucceeded?: boolean;
  transportFailure?: "timeout" | "network_rejection";
  gatewayErrorCode?: string;
  gatewayErrorMessage?: string;
};

export type DokuCheckoutDiagnosticLog = DokuCheckoutDiagnosticDetails & {
  correlationId: string;
  gatewayRequestId?: string;
};

const diagnosticCategorySet = new Set<string>(
  dokuCheckoutDiagnosticCategories,
);
const diagnosticReasonCodeSet = new Set<string>(
  dokuCheckoutDiagnosticReasonCodes,
);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const safeFailureMessages: Record<DokuCheckoutDiagnosticCategory, string> = {
  configuration_missing: "DOKU Checkout configuration is unavailable.",
  database_persistence_failed: "DOKU Checkout data could not be loaded or saved.",
  local_request_validation: "DOKU Checkout request is invalid.",
  local_signing: "DOKU Checkout request signing failed.",
  gateway_transport:
    "DOKU Checkout request outcome is uncertain; retry only with the same Request-Id and body.",
  gateway_http: "DOKU Checkout rejected the request.",
  gateway_body_read: "DOKU Checkout response could not be read.",
  gateway_signature: "DOKU Checkout response signature is invalid.",
  gateway_payload_validation: "DOKU Checkout response is invalid.",
  gateway_invoice_validation: "DOKU Checkout response does not match the order.",
  gateway_amount_validation: "DOKU Checkout response does not match the order.",
  supabase_save: "DOKU Checkout response could not be saved.",
  supabase_mark_uncertain: "DOKU Checkout uncertainty could not be recorded.",
  checkout_response_uncertain: "DOKU Checkout response is uncertain.",
  checkout_internal: "DOKU Checkout processing failed.",
};

const safeFailureReasons = {
  order_mismatch: "DOKU Checkout response does not match the order.",
  payment_url_invalid: "DOKU Checkout payment URL is not allowed.",
} as const;

export class DokuCheckoutDiagnosticError extends Error {
  readonly diagnostic: DokuCheckoutDiagnosticDetails;

  constructor(
    category: DokuCheckoutDiagnosticCategory,
    details: Omit<DokuCheckoutDiagnosticDetails, "stage" | "category"> = {},
    reason?: keyof typeof safeFailureReasons,
  ) {
    super(reason ? safeFailureReasons[reason] : safeFailureMessages[category]);
    this.name = "DokuCheckoutDiagnosticError";
    this.diagnostic = { ...details, stage: category, category };
  }
}

const maxGatewayErrorCodeLength = 64;
const maxGatewayErrorMessageLength = 160;
const gatewayErrorCodePattern = /^[A-Za-z0-9._-]{1,64}$/;
const sensitiveGatewayCodePattern =
  /https?:\/\/|@|HMACSHA256|Bearer|\b(?:BRN|MCH|SK)-[A-Za-z0-9_-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function isOptionalBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isOptionalNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function sanitizeDokuGatewayErrorCode(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > maxGatewayErrorCodeLength ||
    sensitiveGatewayCodePattern.test(trimmed) ||
    !gatewayErrorCodePattern.test(trimmed)
  ) {
    return undefined;
  }
  return trimmed;
}

export function sanitizeDokuGatewayErrorMessage(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const redacted = value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\S+@\S+/g, " ")
    .replace(/\b(?:HMACSHA256|Bearer|Basic)\s*[:=]?\s*\S+/gi, " ")
    .replace(
      /\b(?:secret(?:_?key)?|token|signature|authorization|password|client[_-]?id|api[_-]?key|digest)\s*[:=]\s*\S+/gi,
      " ",
    )
    .replace(/\b(?:BRN|MCH|SK)-[A-Za-z0-9_-]+/g, " ")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      " ",
    )
    .replace(/\b\d{8,}\b/g, " ")
    .replace(/\b(?=[A-Za-z0-9+/=_-]{24,}\b)(?=.*\d)[A-Za-z0-9+/=_-]+\b/g, " ");

  const sanitized = redacted
    .replace(/[^A-Za-z0-9 .,;:_'()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxGatewayErrorMessageLength)
    .trim();

  return sanitized.length > 0 ? sanitized : undefined;
}

export function logDokuCheckoutDiagnostic(
  input: DokuCheckoutDiagnosticLog,
) {
  try {
    if (
      !uuidPattern.test(input.correlationId) ||
      !diagnosticCategorySet.has(input.stage) ||
      !diagnosticCategorySet.has(input.category)
    ) {
      return;
    }

    const record: Record<string, string | number | boolean> = {
      event: "doku.checkout.diagnostic",
      correlationId: input.correlationId,
      stage: input.stage,
      category: input.category,
    };

    if (input.gatewayRequestId && uuidPattern.test(input.gatewayRequestId)) {
      record.gatewayRequestId = input.gatewayRequestId;
    }
    if (
      input.reasonCode &&
      diagnosticReasonCodeSet.has(input.reasonCode)
    ) {
      record.reasonCode = input.reasonCode;
    }
    if (
      typeof input.httpStatus === "number" &&
      Number.isInteger(input.httpStatus) &&
      input.httpStatus >= 100 &&
      input.httpStatus <= 599
    ) {
      record.httpStatus = input.httpStatus;
    }
    if (isOptionalNumber(input.requestDurationMs)) {
      record.requestDurationMs = input.requestDurationMs;
    }
    if (isOptionalBoolean(input.responseBodyRead)) {
      record.responseBodyRead = input.responseBodyRead;
    }
    if (isOptionalBoolean(input.signatureValid)) {
      record.signatureValid = input.signatureValid;
    }
    if (isOptionalBoolean(input.invoiceMatches)) {
      record.invoiceMatches = input.invoiceMatches;
    }
    if (isOptionalBoolean(input.amountMatches)) {
      record.amountMatches = input.amountMatches;
    }
    if (isOptionalBoolean(input.supabaseSaveSucceeded)) {
      record.supabaseSaveSucceeded = input.supabaseSaveSucceeded;
    }
    if (isOptionalBoolean(input.supabaseMarkUncertainSucceeded)) {
      record.supabaseMarkUncertainSucceeded =
        input.supabaseMarkUncertainSucceeded;
    }
    if (
      input.transportFailure === "timeout" ||
      input.transportFailure === "network_rejection"
    ) {
      record.transportFailure = input.transportFailure;
    }
    const gatewayErrorCode = sanitizeDokuGatewayErrorCode(
      input.gatewayErrorCode,
    );
    if (gatewayErrorCode) {
      record.gatewayErrorCode = gatewayErrorCode;
    }
    const gatewayErrorMessage = sanitizeDokuGatewayErrorMessage(
      input.gatewayErrorMessage,
    );
    if (gatewayErrorMessage) {
      record.gatewayErrorMessage = gatewayErrorMessage;
    }

    console.error(JSON.stringify(record));
  } catch {
    // Diagnostics must never interrupt checkout processing.
  }
}

export const dokuPaymentStatusDiagnosticCategories = [
  "auth_client_init_failed",
  "service_client_init_failed",
  "auth_verification_failed",
  "order_lookup_failed",
  "payment_status_rpc_failed",
  "doku_config_invalid",
  "payment_url_validation_failed",
  "payment_status_unexpected_error",
] as const;

export type DokuPaymentStatusDiagnosticCategory =
  (typeof dokuPaymentStatusDiagnosticCategories)[number];

export type DokuPaymentStatusDiagnosticLog = {
  correlationId: string;
  stage: DokuPaymentStatusDiagnosticCategory;
  category: DokuPaymentStatusDiagnosticCategory;
  httpStatus?: number;
};

const statusDiagnosticCategorySet = new Set<string>(
  dokuPaymentStatusDiagnosticCategories,
);

export function logDokuPaymentStatusDiagnostic(
  input: DokuPaymentStatusDiagnosticLog,
) {
  try {
    if (
      !uuidPattern.test(input.correlationId) ||
      !statusDiagnosticCategorySet.has(input.stage) ||
      !statusDiagnosticCategorySet.has(input.category)
    ) {
      return;
    }

    const record: Record<string, string | number> = {
      event: "doku.payment_status.diagnostic",
      correlationId: input.correlationId,
      stage: input.stage,
      category: input.category,
    };

    if (
      typeof input.httpStatus === "number" &&
      Number.isInteger(input.httpStatus) &&
      input.httpStatus >= 100 &&
      input.httpStatus <= 599
    ) {
      record.httpStatus = input.httpStatus;
    }

    console.error(JSON.stringify(record));
  } catch {
    // Diagnostics must never interrupt payment status responses.
  }
}
