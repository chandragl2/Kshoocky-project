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
    ...overrides,
  };
}

function reconciliationHarness({
  recoveryResult = { error: null },
  candidateResult = { data: [reconciliationCandidate()], error: null },
  status = async (candidate) => ({
    invoiceNumber: candidate.invoiceNumber,
    amount: 125000,
    originalRequestId: "checkout-request-123",
    transactionStatus: "SUCCESS",
    orderStatus: null,
  }),
  recordResult = { error: null },
  deferResult = { error: null },
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
  const request = statusFetch();
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
