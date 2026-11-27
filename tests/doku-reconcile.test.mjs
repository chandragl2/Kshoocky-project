import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getDokuConfig } from "../lib/doku/config.ts";
import {
  createDokuSignature,
  verifyDokuSignature,
} from "../lib/doku/signature.ts";
import { getDokuCheckoutStatus } from "../lib/doku/check-status.ts";
import {
  createDokuRequestId,
  createDokuRequestTimestamp,
} from "../lib/doku/request-metadata.ts";

const reconcileHandlerModule = await import(
  "../lib/doku/reconcile-handler.ts"
).catch(() => null);
const secretKey = "test-secret-key";
const body = JSON.stringify({ order: { amount: 125000 } });
const notificationUrl = "https://shop.example/api/payments/doku/notify";
const statusRequestTarget = "/orders/v1/status/INV-123";
const cronSecret = "test-cron-secret";

test("DOKU request metadata preserves UUID and timestamp formats", () => {
  assert.match(
    createDokuRequestId(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.equal(
    createDokuRequestTimestamp(new Date("2026-11-17T05:30:45.123Z")),
    "2026-11-17T05:30:45Z",
  );
});

function signedRequest(overrides = {}) {
  const input = {
    clientId: "MCH-test",
    expectedClientId: "MCH-test",
    requestId: "55e20a19-fb95-42d2-a7f5-d1449156bc60",
    timestampHeader: "Request-Timestamp",
    timestamp: "2026-11-07T04:00:00Z",
    requestTarget: "/api/payments/doku/notify",
    body,
    secretKey,
    ...overrides,
  };
  return {
    ...input,
    signature: createDokuSignature(input).signature,
  };
}

function withDokuEnvironment(values, callback) {
  const names = [
    "DOKU_ENV",
    "DOKU_CLIENT_ID",
    "DOKU_SECRET_KEY",
    "DOKU_NOTIFICATION_URL",
    "DOKU_RETURN_URL",
    "DOKU_CHECKOUT_URL_HOST",
  ];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  for (const name of names) {
    if (Object.hasOwn(values, name)) process.env[name] = values[name];
    else delete process.env[name];
  }
  try {
    return callback();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

const baseEnvironment = {
  DOKU_CLIENT_ID: "MCH-test",
  DOKU_SECRET_KEY: secretKey,
  DOKU_NOTIFICATION_URL: notificationUrl,
  DOKU_RETURN_URL: "https://shop.example/payment/return",
};

const statusConfig = {
  environment: "sandbox",
  clientId: "MCH-test",
  secretKey,
  apiBaseUrl: "https://api-sandbox.doku.com",
  checkoutUrlHost: "sandbox.doku.com",
  notificationUrl,
  returnUrl: "https://shop.example/payment/return",
};

function statusFetch({
  invoiceNumber = "INV-123",
  amount = 125000,
  transactionStatus = "SUCCESS",
  originalRequestId = "checkout-request-123",
  gatewayTransactionId = null,
  transactionIdAlias,
  responseRequestId,
  signatureOverride,
} = {}) {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    const responseBody = JSON.stringify({
      transaction: {
        status: transactionStatus,
        original_request_id: originalRequestId,
        id: gatewayTransactionId,
        ...(transactionIdAlias !== undefined
          ? { transaction_id: transactionIdAlias }
          : {}),
      },
      order: { invoice_number: invoiceNumber, amount },
    });
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const requestId = responseRequestId ?? init.headers["Request-Id"];
    const signature = createDokuSignature({
      clientId: "MCH-test",
      requestId: init.headers["Request-Id"],
      timestampHeader: "Response-Timestamp",
      timestamp,
      requestTarget: statusRequestTarget,
      secretKey,
    }).signature;
    return new Response(responseBody, {
      status: 200,
      headers: {
        "Client-Id": "MCH-test",
        "Request-Id": requestId,
        "Response-Timestamp": timestamp,
        Signature: signatureOverride ?? signature,
      },
    });
  };
  return {
    fetchImpl,
    get captured() {
      return captured;
    },
  };
}

function getStatus(fetchImpl) {
  return getDokuCheckoutStatus({
    config: statusConfig,
    invoiceNumber: "INV-123",
    fetchImpl,
  });
}

function reconciliationCandidate(overrides = {}) {
  return {
    payment_id: "payment-123",
    invoice_number: "INV-123",
    original_request_id: "checkout-request-123",
    payment_expires_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    gateway_transaction_id: null,
    ...overrides,
  };
}

function reconciliationHarness({
  recoveryResult = { error: null },
  candidateResult = { data: [reconciliationCandidate()], error: null },
  status = async (candidate) => ({
    invoiceNumber: candidate.invoiceNumber,
    amount: 125000,
    gatewayTransactionId: null,
    originalRequestId: "checkout-request-123",
    transactionStatus: "SUCCESS",
    orderStatus: null,
  }),
  recordResult = { error: null },
  deferResult = { error: null },
  incidentResult = {
    data: "6f9619ff-8b86-d011-b42d-00cf4fc964ff",
    error: null,
  },
  incidentThrows = null,
} = {}) {
  const calls = [];
  const client = {
    recover: async () => {
      calls.push({ rpc: "recover" });
      return recoveryResult;
    },
    list: async (limit) => {
      calls.push({ rpc: "list", limit });
      return candidateResult;
    },
    record: async (args) => {
      calls.push({ rpc: "record", args });
      return recordResult;
    },
    defer: async (args) => {
      calls.push({ rpc: "defer", args });
      return deferResult;
    },
    recordIncident: async (args) => {
      calls.push({ rpc: "recordIncident", args });
      if (incidentThrows) throw incidentThrows;
      return incidentResult;
    },
  };
  const dependencies = {
    getConfig: () => statusConfig,
    createClient: () => client,
    getStatus: ({ invoiceNumber }) =>
      status({ invoiceNumber }),
  };
  return {
    calls,
    handle(request) {
      assert.equal(
        typeof reconcileHandlerModule?.handleDokuReconcile,
        "function",
        "reconciliation handler should be available for direct behavior tests",
      );
      return reconcileHandlerModule.handleDokuReconcile(request, dependencies);
    },
  };
}

async function withCronSecret(value, callback) {
  const previous = process.env.CRON_SECRET;
  if (value === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = value;
  try {
    return await callback();
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
}

function cronRequest(authorization) {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("https://shop.example/api/cron/doku-reconcile", {
    headers,
  });
}

test("request_signature_uses_doku_non_snap_components", () => {
  const input = signedRequest();
  const digest = createHash("sha256").update(body).digest("base64");
  const canonical = [
    `Client-Id:${input.clientId}`,
    `Request-Id:${input.requestId}`,
    `Request-Timestamp:${input.timestamp}`,
    `Request-Target:${input.requestTarget}`,
    `Digest:${digest}`,
  ].join("\n");
  const expected =
    "HMACSHA256=" +
    createHmac("sha256", secretKey).update(canonical).digest("base64");
  const result = createDokuSignature(input);

  assert.equal(result.digest, digest);
  assert.equal(result.signature, expected);
  assert.match(result.signature, /^HMACSHA256=[A-Za-z0-9+/]+=*$/);
});

test("signature_verification_rejects_mutated_body", () => {
  const input = signedRequest();

  assert.equal(verifyDokuSignature(input), true);
  assert.equal(
    verifyDokuSignature({ ...input, body: `${input.body} ` }),
    false,
  );
});

test("signature_verification_rejects_wrong_client_and_digest", () => {
  const input = signedRequest();

  assert.equal(
    verifyDokuSignature({ ...input, expectedClientId: "MCH-other" }),
    false,
  );
  assert.equal(
    verifyDokuSignature({
      ...input,
      signature: "HMACSHA256=invalid",
    }),
    false,
  );
});

test("malformed_and_future_timestamps_are_rejected", () => {
  const input = signedRequest();
  assert.equal(
    verifyDokuSignature({ ...input, timestamp: "not-a-timestamp" }),
    false,
  );

  const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  assert.equal(
    verifyDokuSignature(signedRequest({ timestamp: future })),
    false,
  );
});

test("production_endpoint_requires_explicit_environment", () => {
  withDokuEnvironment(baseEnvironment, () => {
    assert.equal(getDokuConfig().apiBaseUrl, "https://api-sandbox.doku.com");
  });
  withDokuEnvironment(
    {
      ...baseEnvironment,
      DOKU_ENV: "production",
      DOKU_CHECKOUT_URL_HOST: "checkout.doku.com",
    },
    () => {
      assert.equal(getDokuConfig().apiBaseUrl, "https://api.doku.com");
      assert.equal(getDokuConfig().checkoutUrlHost, "checkout.doku.com");
    },
  );
  withDokuEnvironment({ ...baseEnvironment, DOKU_ENV: "prod" }, () => {
    assert.throws(() => getDokuConfig(), /DOKU_ENV/);
  });
});

test("missing_server_credentials_fail_closed_without_exposing_secret", () => {
  withDokuEnvironment(
    {
      DOKU_CLIENT_ID: "MCH-test",
      DOKU_SECRET_KEY: secretKey,
      DOKU_NOTIFICATION_URL: notificationUrl,
    },
    () => {
      assert.throws(() => getDokuConfig(), (error) => {
        assert.match(error.message, /DOKU_RETURN_URL/);
        assert.equal(error.message.includes(secretKey), false);
        return true;
      });
    },
  );
});

test("doku_check_status_uses_signed_get_and_validates_response", async () => {
  const request = statusFetch({ gatewayTransactionId: "gateway-transaction-123" });
  const result = await getStatus(request.fetchImpl);

  assert.equal(
    request.captured.url,
    "https://api-sandbox.doku.com/orders/v1/status/INV-123",
  );
  assert.equal(request.captured.init.method, "GET");
  assert.equal(request.captured.init.body, undefined);
  assert.match(request.captured.init.headers.Signature, /^HMACSHA256=/);
  assert.equal(result.invoiceNumber, "INV-123");
  assert.equal(result.amount, 125000);
  assert.equal(result.transactionStatus, "SUCCESS");
  assert.equal(result.originalRequestId, "checkout-request-123");
  assert.equal(result.gatewayTransactionId, "gateway-transaction-123");
});

test("doku_check_status_rejects_invalid_gateway_transaction_ids", async () => {
  for (const transaction of [
    { gatewayTransactionId: "" },
    { gatewayTransactionId: " \t\n" },
    { gatewayTransactionId: 123 },
    { gatewayTransactionId: "x".repeat(129) },
    {
      gatewayTransactionId: 123,
      transactionIdAlias: "gateway-transaction-123",
    },
  ]) {
    const request = statusFetch(transaction);
    await assert.rejects(
      getStatus(request.fetchImpl),
      /transaction ID is invalid/i,
      JSON.stringify(transaction),
    );
  }
});

test("doku_check_status_accepts_128_character_gateway_transaction_id", async () => {
  const gatewayTransactionId = "x".repeat(128);
  const request = statusFetch({ gatewayTransactionId });

  const result = await getStatus(request.fetchImpl);

  assert.equal(result.gatewayTransactionId, gatewayTransactionId);
});

test("doku_check_status_rejects_invalid_response_signature", async () => {
  const request = statusFetch({ signatureOverride: "HMACSHA256=invalid" });

  await assert.rejects(getStatus(request.fetchImpl), /signature is invalid/i);
});

test("doku_check_status_rejects_invoice_and_amount_mismatches", async (t) => {
  await t.test("invoice mismatch", async () => {
    const request = statusFetch({ invoiceNumber: "INV-other" });
    await assert.rejects(getStatus(request.fetchImpl), /does not match the invoice/i);
  });
  await t.test("invalid amount", async () => {
    const request = statusFetch({ amount: 0 });
    await assert.rejects(getStatus(request.fetchImpl), /does not match the invoice/i);
  });
});

test("doku_check_status_timeout_covers_response_body_read", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  let requestSignal;
  let bodyReadStarted;
  const bodyReadStartedPromise = new Promise((resolve) => {
    bodyReadStarted = resolve;
  });
  const request = getStatus(async (_url, init) => {
    requestSignal = init.signal;
    return {
      status: 200,
      headers: new Headers(),
      text: () => {
        bodyReadStarted();
        return new Promise((_, reject) => {
          requestSignal.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        });
      },
    };
  });

  await bodyReadStartedPromise;
  t.mock.timers.runAll();
  const outcome = await Promise.race([
    request.then(
      () => null,
      (error) => error,
    ),
    new Promise((resolve) => setImmediate(() => resolve("pending"))),
  ]);

  assert.notEqual(outcome, "pending", "body read should be bounded by timeout");
  assert.ok(outcome instanceof Error);
  assert.match(outcome.message, /response could not be read/i);
  assert.equal(requestSignal.aborted, true);
});

test("doku_reconciliation_recovers_before_loading_candidates", () => {
  const route = readFileSync(
    new URL("../app/api/cron/doku-reconcile/route.ts", import.meta.url),
    "utf8",
  );

  assert.ok(
    route.indexOf('"doku_recover_creating_payment_attempts"') <
      route.indexOf('"doku_list_reconciliation_candidates"'),
    "cron must recover stale attempts before selecting reconciliation candidates",
  );
});

test("reconciliation_handler_rejects_missing_and_invalid_cron_tokens", async (t) => {
  await withCronSecret(cronSecret, async () => {
    for (const [name, authorization] of [
      ["missing token", undefined],
      ["invalid token", "Bearer wrong-token"],
    ]) {
      await t.test(name, async () => {
        const harness = reconciliationHarness();
        const response = await harness.handle(cronRequest(authorization));

        assert.equal(response.status, 401);
        assert.deepEqual(harness.calls, []);
      });
    }
  });
});

test("reconciliation_handler_accepts_valid_token_and_processes_only_batch_limit", async () => {
  const first = reconciliationCandidate();
  const extra = reconciliationCandidate({
    payment_id: "payment-456",
    invoice_number: "INV-456",
    original_request_id: "checkout-request-456",
  });
  const harness = reconciliationHarness({
    candidateResult: { data: [first, extra], error: null },
    status: async ({ invoiceNumber }) => ({
      invoiceNumber,
      amount: 125000,
      originalRequestId: first.original_request_id,
      transactionStatus: "SUCCESS",
      orderStatus: null,
    }),
  });

  await withCronSecret(cronSecret, async () => {
    const response = await harness.handle(
      cronRequest(`Bearer ${cronSecret}`),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      processed: 1,
      deferred: 0,
      skipped: 0,
      failures: 0,
    });
  });

  assert.deepEqual(
    harness.calls.map((call) => call.rpc),
    ["recover", "list", "record"],
  );
  assert.equal(harness.calls.find((call) => call.rpc === "list").limit, 1);
  const recordCall = harness.calls.find((call) => call.rpc === "record");
  assert.equal(recordCall.args.p_status, "SUCCESS");
  assert.notEqual(recordCall.args.p_status, "paid");
  assert.equal(
    harness.calls.some((call) =>
      Object.hasOwn(call.args ?? {}, "p_order_status"),
    ),
    false,
  );
});

test("reconciliation_handler_returns_service_unavailable_on_rpc_errors", async (t) => {
  const cases = [
    {
      name: "recovery RPC",
      options: { recoveryResult: { error: new Error("recovery failed") } },
      expectedMessage: "Stale DOKU payment attempts could not be recovered.",
      expectedCalls: ["recover"],
    },
    {
      name: "candidate RPC",
      options: { candidateResult: { data: null, error: new Error("list failed") } },
      expectedMessage: "DOKU reconciliation candidates could not be loaded.",
      expectedCalls: ["recover", "list"],
    },
  ];

  await withCronSecret(cronSecret, async () => {
    for (const item of cases) {
      await t.test(item.name, async () => {
        const harness = reconciliationHarness(item.options);
        const response = await harness.handle(
          cronRequest(`Bearer ${cronSecret}`),
        );

        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), {
          error: item.expectedMessage,
        });
        assert.deepEqual(
          harness.calls.map((call) => call.rpc),
          item.expectedCalls,
        );
      });
    }
  });
});

test("reconciliation_handler_rejects_missing_candidate_rpc_result", async () => {
  const harness = reconciliationHarness({
    candidateResult: { data: null, error: null },
  });

  await withCronSecret(cronSecret, async () => {
    const response = await harness.handle(
      cronRequest(`Bearer ${cronSecret}`),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "DOKU reconciliation candidates could not be loaded.",
    });
  });
});

test("reconciliation_handler_defers_a_failed_candidate_without_aborting_invocation", async () => {
  const harness = reconciliationHarness({
    status: async () => {
      throw new Error("DOKU unavailable");
    },
  });

  await withCronSecret(cronSecret, async () => {
    const response = await harness.handle(
      cronRequest(`Bearer ${cronSecret}`),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      processed: 0,
      deferred: 1,
      skipped: 0,
      failures: 0,
    });
  });

  const deferCall = harness.calls.find((call) => call.rpc === "defer");
  assert.deepEqual(deferCall.args, {
    p_payment_id: "payment-123",
    p_error_code: "gateway_reconciliation_unavailable",
  });
  assert.equal(harness.calls.some((call) => call.rpc === "record"), false);
});

test("reconciliation_handler_defers_unknown_gateway_status_instead_of_recording_paid", async () => {
  const harness = reconciliationHarness({
    status: async ({ invoiceNumber }) => ({
      invoiceNumber,
      amount: 125000,
      originalRequestId: "checkout-request-123",
      transactionStatus: "PAID",
      orderStatus: null,
    }),
  });

  await withCronSecret(cronSecret, async () => {
    const response = await harness.handle(
      cronRequest(`Bearer ${cronSecret}`),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      processed: 0,
      deferred: 1,
      skipped: 0,
      failures: 0,
    });
  });

  assert.equal(harness.calls.some((call) => call.rpc === "record"), false);
  assert.deepEqual(harness.calls.find((call) => call.rpc === "defer").args, {
    p_payment_id: "payment-123",
    p_error_code: "gateway_reconciliation_unavailable",
  });
});

test("reconciliation_handler_rejects_candidate_without_transaction_id_field", async () => {
  const candidate = reconciliationCandidate();
  delete candidate.gateway_transaction_id;
  let statusCalls = 0;
  const harness = reconciliationHarness({
    candidateResult: { data: [candidate], error: null },
    status: async () => {
      statusCalls += 1;
      return {
        invoiceNumber: "INV-123",
        amount: 125000,
        gatewayTransactionId: null,
        originalRequestId: "checkout-request-123",
        transactionStatus: "SUCCESS",
        orderStatus: null,
      };
    },
  });

  await withCronSecret(cronSecret, async () => {
    const response = await harness.handle(
      cronRequest(`Bearer ${cronSecret}`),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      processed: 0,
      deferred: 0,
      skipped: 0,
      failures: 1,
    });
  });

  assert.equal(statusCalls, 0);
  assert.equal(harness.calls.some((call) => call.rpc === "record"), false);
});

test("reconciliation_handler_records_a_separate_mismatch_incident", async () => {
  const harness = reconciliationHarness({
    candidateResult: {
      data: [
        reconciliationCandidate({
          gateway_transaction_id: "existing-transaction-id",
        }),
      ],
      error: null,
    },
    recordResult: { error: { message: "doku_reconciliation_transaction_mismatch" } },
  });

  await withCronSecret(cronSecret, async () => {
    const response = await harness.handle(
      cronRequest(`Bearer ${cronSecret}`),
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      processed: 0,
      deferred: 0,
      skipped: 0,
      failures: 1,
      incidentRecorded: true,
    });
  });

  const incidentCall = harness.calls.find((call) => call.rpc === "recordIncident");
  assert.equal(incidentCall.args.p_source, "reconciliation");
  assert.equal(incidentCall.args.p_reason_code, "transaction_id_mismatch");
  assert.equal(incidentCall.args.p_payment_id, "payment-123");
  assert.equal(incidentCall.args.p_invoice_number, "INV-123");
  assert.equal(incidentCall.args.p_gateway_status, "SUCCESS");
  assert.equal(
    incidentCall.args.p_existing_gateway_transaction_id,
    "existing-transaction-id",
  );
  assert.equal(incidentCall.args.p_gateway_transaction_id, null);
});

test("reconciliation_handler_surfaces_returned_incident_rpc_error_without_details", async () => {
  const harness = reconciliationHarness({
    recordResult: { error: { message: "doku_reconciliation_transaction_mismatch" } },
    incidentResult: {
      data: null,
      error: { message: "sensitive database detail" },
    },
  });

  await withCronSecret(cronSecret, async () => {
    const response = await harness.handle(
      cronRequest(`Bearer ${cronSecret}`),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      processed: 0,
      deferred: 0,
      skipped: 0,
      failures: 1,
      incidentRecorded: false,
      error: "incident_recording_failed",
    });
  });
});

test("reconciliation_handler_treats_incident_rpc_error_as_failure_even_with_data", async () => {
  const harness = reconciliationHarness({
    recordResult: { error: { message: "doku_reconciliation_transaction_mismatch" } },
    incidentResult: {
      data: "6f9619ff-8b86-d011-b42d-00cf4fc964ff",
      error: { message: "sensitive database detail" },
    },
  });

  await withCronSecret(cronSecret, async () => {
    const response = await harness.handle(
      cronRequest(`Bearer ${cronSecret}`),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      processed: 0,
      deferred: 0,
      skipped: 0,
      failures: 1,
      incidentRecorded: false,
      error: "incident_recording_failed",
    });
  });
});

test("reconciliation_handler_rejects_missing_or_invalid_incident_ids", async () => {
  for (const incidentResult of [
    { data: null, error: null },
    { data: "not-a-uuid", error: null },
  ]) {
    const harness = reconciliationHarness({
      recordResult: {
        error: { message: "doku_reconciliation_transaction_mismatch" },
      },
      incidentResult,
    });

    await withCronSecret(cronSecret, async () => {
      const response = await harness.handle(
        cronRequest(`Bearer ${cronSecret}`),
      );

      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        processed: 0,
        deferred: 0,
        skipped: 0,
        failures: 1,
        incidentRecorded: false,
        error: "incident_recording_failed",
      });
    });
  }
});

test("reconciliation_handler_keeps_incident_rpc_exception_as_a_failure", async () => {
  const harness = reconciliationHarness({
    recordResult: { error: { message: "doku_reconciliation_transaction_mismatch" } },
    incidentThrows: new Error("database unavailable"),
  });

  await withCronSecret(cronSecret, async () => {
    const response = await harness.handle(
      cronRequest(`Bearer ${cronSecret}`),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      processed: 0,
      deferred: 0,
      skipped: 0,
      failures: 1,
      incidentRecorded: false,
      error: "incident_recording_failed",
    });
  });

  assert.equal(harness.calls.some((call) => call.rpc === "defer"), false);
});

test("doku_reconciliation_migration_contains_rollback_safe_incident_design", () => {
  const migrationPath = new URL(
    "../supabase/migrations/20261121000000_doku_reconciliation_success.sql",
    import.meta.url,
  );
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.doku_reconciliation_incidents/);
  assert.match(migration, /doku_record_reconciliation_incident/);
  assert.match(migration, /paid_state_repaired/);
  assert.match(migration, /contradictory_success/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.doku_reconciliation_incidents/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.doku_record_reconciliation_incident/);
});

test("doku_reconciliation_migration_has_full_incident_schema_preflight", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20261121000000_doku_reconciliation_success.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /doku_validate_reconciliation_incident_schema/);
  assert.match(migration, /doku_reconciliation_incident_missing_column/);
  assert.match(migration, /doku_reconciliation_incident_invalid_type/);
  assert.match(migration, /doku_reconciliation_incident_missing_check/);
  assert.match(migration, /doku_reconciliation_incident_missing_unique_index/);
  assert.match(migration, /doku_reconciliation_incident_privilege/);
  assert.match(migration, /doku_reconciliation_incident_rls/);
  assert.match(migration, /doku_reconciliation_incident_foreign_key/);
});

test("doku_reconciliation_concurrency_test_is_explicitly_not_run", () => {
  const testPath = new URL(
    "../supabase/tests/doku_reconciliation_concurrency.test.sql",
    import.meta.url,
  );
  const testSql = readFileSync(testPath, "utf8");

  assert.match(testSql, /NOT RUN/i);
  assert.match(testSql, /external PostgreSQL runner/i);
  assert.doesNotMatch(testSql, /CREATE EXTENSION IF NOT EXISTS dblink/i);
  assert.doesNotMatch(testSql, /pg_advisory/i);
});

test("doku_reconciliation_preflight_pgtest_covers_behavioral_schema_failures", () => {
  const testSql = readFileSync(
    new URL(
      "../supabase/tests/doku_reconciliation_preflight.test.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(testSql, /ALTER TABLE public\.doku_reconciliation_incidents DROP COLUMN reason_code/);
  assert.match(testSql, /ALTER COLUMN amount TYPE text/);
  assert.match(testSql, /DROP CONSTRAINT doku_reconciliation_incidents_reason_code_check/);
  assert.match(testSql, /DROP CONSTRAINT doku_reconciliation_incidents_unique_key/);
  assert.match(testSql, /GRANT SELECT ON TABLE public\.doku_reconciliation_incidents TO authenticated/);
  assert.match(testSql, /DISABLE ROW LEVEL SECURITY/);
  assert.match(testSql, /SELECT \* FROM finish\(\)/);
});

test("doku_reconciliation_returns_gateway_transaction_id_for_mismatch_evidence", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20261121000000_doku_reconciliation_success.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const statusModule = readFileSync(
    new URL("../lib/doku/check-status.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    migration,
    /gateway_transaction_id text/,
  );
  assert.match(
    migration,
    /payment\.gateway_transaction_id/,
  );
  assert.match(
    statusModule,
    /gatewayTransactionId/,
  );
});

test("doku_reconciliation_migration_has_valid_validator_call_and_paid_guard", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20261121000000_doku_reconciliation_success.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(
    migration,
    /^PERFORM public\.doku_validate_reconciliation_incident_schema\(\);$/m,
  );
  assert.match(
    migration,
    /DO \$doku_validate_incident_call\$[\s\S]*PERFORM public\.doku_validate_reconciliation_incident_schema\(\)/,
  );
  assert.match(
    migration,
    /IF v_status IN \('PENDING', 'FAILED'\)[\s\S]*v_payment\.payment_status = 'paid'/,
  );
  assert.match(migration, /incident_key text NOT NULL/);
  assert.match(migration, /UNIQUE \(gateway, incident_key\)/);
  assert.doesNotMatch(migration, /doku_reconciliation_incidents_event_key/);
});

test("incident observation preflight validates index definitions and observation reason", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20261123100000_doku_incident_observations.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const preflightTest = readFileSync(
    new URL(
      "../supabase/tests/doku_reconciliation_preflight.test.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const successTest = readFileSync(
    new URL(
      "../supabase/tests/doku_reconciliation_success.test.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /pg_catalog\.unnest\(index_row\.indkey\)/);
  assert.match(migration, /pg_catalog\.pg_get_expr\(index_row\.indpred/);
  assert.match(preflightTest, /same-name notification index with wrong columns/);
  assert.match(preflightTest, /same-name notification index with wrong predicate/);
  assert.match(preflightTest, /same-name first-event index with wrong columns/);
  assert.match(preflightTest, /same-name first-event index with wrong predicate/);
  assert.match(
    preflightTest,
    /DROP INDEX public\.doku_reconciliation_incident_observations_notification_event_key;\s*SELECT throws_ok\(\s*'SELECT public\.doku_validate_reconciliation_incident_observations_schema\(\)'/,
  );
  assert.match(successTest, /observation\.reason_code = 'notification_replay_conflict'/);
});
