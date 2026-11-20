import { timingSafeEqual } from "node:crypto";
import type { DokuCheckoutStatus } from "./check-status.ts";
import type { DokuConfig } from "./config.ts";

export const dokuReconciliationBatchLimit = 1;

export type DokuReconciliationCandidate = {
  payment_id: string;
  invoice_number: string;
  original_request_id: string;
  payment_expires_at: string;
};

export type DokuReconciliationRecord = {
  p_payment_id: string;
  p_status: string;
  p_invoice_number: string;
  p_amount: number;
  p_original_request_id: string;
  p_gateway_transaction_id: string | null;
};

export type DokuReconciliationClient = {
  recover(): Promise<{ error: unknown | null }>;
  list(
    limit: number,
  ): Promise<{
    data: DokuReconciliationCandidate[] | null;
    error: unknown | null;
  }>;
  record(args: DokuReconciliationRecord): Promise<{ error: unknown | null }>;
  defer(args: {
    p_payment_id: string;
    p_error_code: string;
  }): Promise<{ error: unknown | null }>;
};

export type DokuReconciliationDependencies = {
  getConfig(): DokuConfig;
  createClient(): DokuReconciliationClient;
  getStatus(input: {
    config: DokuConfig;
    invoiceNumber: string;
  }): Promise<DokuCheckoutStatus>;
};

const checkoutExpiryGraceMs = 60 * 1000;

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.match(
    /^Bearer\s+(.+)$/i,
  )?.[1];
  if (!expected || !provided) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}

export async function handleDokuReconcile(
  request: Request,
  dependencies: DokuReconciliationDependencies,
) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let config: DokuConfig;
  let client: DokuReconciliationClient;
  try {
    config = dependencies.getConfig();
    client = dependencies.createClient();
  } catch {
    return Response.json(
      { error: "DOKU reconciliation is not configured." },
      { status: 503 },
    );
  }

  try {
    const { error } = await client.recover();
    if (error) {
      return Response.json(
        { error: "Stale DOKU payment attempts could not be recovered." },
        { status: 503 },
      );
    }
  } catch {
    return Response.json(
      { error: "Stale DOKU payment attempts could not be recovered." },
      { status: 503 },
    );
  }

  let candidates: DokuReconciliationCandidate[] | null;
  try {
    const result = await client.list(dokuReconciliationBatchLimit);
    if (result.error) {
      return Response.json(
        { error: "DOKU reconciliation candidates could not be loaded." },
        { status: 503 },
      );
    }
    candidates = result.data;
  } catch {
    return Response.json(
      { error: "DOKU reconciliation candidates could not be loaded." },
      { status: 503 },
    );
  }

  let processed = 0;
  let deferred = 0;
  let skipped = 0;
  let failures = 0;

  for (const candidate of (candidates ?? []).slice(
    0,
    dokuReconciliationBatchLimit,
  )) {
    const expiresAt = Date.parse(candidate.payment_expires_at);
    if (
      !Number.isFinite(expiresAt) ||
      Date.now() < expiresAt + checkoutExpiryGraceMs
    ) {
      skipped += 1;
      continue;
    }

    try {
      const status = await dependencies.getStatus({
        config,
        invoiceNumber: candidate.invoice_number,
      });
      if (
        status.invoiceNumber !== candidate.invoice_number ||
        status.amount <= 0 ||
        status.originalRequestId !== candidate.original_request_id
      ) {
        throw new Error("DOKU reconciliation reference mismatch.");
      }

      let transactionStatus: string;
      if (status.transactionStatus === "SUCCESS") {
        transactionStatus = "SUCCESS";
      } else if (
        status.orderStatus === "ORDER_EXPIRED" ||
        status.transactionStatus === "ORDER_EXPIRED"
      ) {
        transactionStatus = "EXPIRED";
      } else if (
        status.transactionStatus === null ||
        status.transactionStatus === "PENDING"
      ) {
        transactionStatus = "PENDING";
      } else if (status.transactionStatus === "FAILED") {
        transactionStatus = "FAILED";
      } else {
        throw new Error("DOKU reconciliation status is not recognized.");
      }
      const { error: updateError } = await client.record({
        p_payment_id: candidate.payment_id,
        p_status: transactionStatus,
        p_invoice_number: status.invoiceNumber,
        p_amount: status.amount,
        p_original_request_id: status.originalRequestId,
        p_gateway_transaction_id: null,
      });
      if (updateError) throw new Error("DOKU reconciliation update failed.");
      processed += 1;
    } catch {
      try {
        const { error: deferError } = await client.defer({
          p_payment_id: candidate.payment_id,
          p_error_code: "gateway_reconciliation_unavailable",
        });
        if (deferError) failures += 1;
        else deferred += 1;
      } catch {
        failures += 1;
      }
    }
  }

  return Response.json(
    { processed, deferred, skipped, failures },
    { status: failures ? 503 : 200 },
  );
}
