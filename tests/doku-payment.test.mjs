import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getDokuConfig,
} from "../lib/doku/config.ts";
import {
  createDokuSignature,
  verifyDokuSignature,
} from "../lib/doku/signature.ts";

const checkoutModule = await import("../lib/doku/checkout.ts").catch(() => null);
const paymentUrlModule = await import("../lib/doku/payment-url.ts").catch(
  () => null,
);
const paymentRequestModule = await import("../lib/doku/payment-request.ts").catch(
  () => null,
);
const notificationModule = await import("../lib/doku/notification.ts").catch(
  () => null,
);
const checkStatusModule = await import("../lib/doku/check-status.ts").catch(
  () => null,
);
const paymentViewModule = await import("../lib/doku/payment-view.ts").catch(
  () => null,
);
const requestBodyModule = await import("../lib/doku/request-body.ts").catch(
  () => null,
);
const diagnosticModule = await import("../lib/doku/diagnostics.ts").catch(
  () => null,
);
const secretKey = "test-secret-key";
const body = JSON.stringify({ order: { amount: 125000 } });
const checkoutBody = JSON.stringify({
  order: { amount: 125000, invoice_number: "INV-123" },
  payment: { payment_due_date: 60 },
});
const checkoutUrl =
  "https://sandbox.doku.com/checkout-link-v2/ab1234567890";
const notificationUrl =
  "https://shop.example/api/payments/doku/notify";
const notificationBody = JSON.stringify({
  transaction: {
    status: "SUCCESS",
    date: "2026-11-07T04:00:00Z",
    original_request_id: "checkout-request-123",
  },
  order: { invoice_number: "INV-123", amount: 125000 },
});

function dokuExpiryAfter(milliseconds) {
  const localTime = new Date(Date.now() + milliseconds + 7 * 60 * 60 * 1000);
  return [
    localTime.getUTCFullYear(),
    String(localTime.getUTCMonth() + 1).padStart(2, "0"),
    String(localTime.getUTCDate()).padStart(2, "0"),
    String(localTime.getUTCHours()).padStart(2, "0"),
    String(localTime.getUTCMinutes()).padStart(2, "0"),
    String(localTime.getUTCSeconds()).padStart(2, "0"),
  ].join("");
}

function checkoutSuccessBody(expiredDate = dokuExpiryAfter(60 * 60 * 1000)) {
  return JSON.stringify({
    message: ["SUCCESS"],
    response: {
      order: { amount: "125000", invoice_number: "INV-123" },
      payment: {
        url: checkoutUrl,
        token_id: "token-123",
        payment_due_date: 60,
        expired_date: expiredDate,
      },
    },
  });
}

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

test("notification_verification_rejects_mutated_body", () => {
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

test("malformed_timestamp_is_rejected", () => {
  const input = signedRequest();
  const malformed = { ...input, timestamp: "not-a-timestamp" };
  assert.equal(verifyDokuSignature(malformed), false);

  const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  assert.equal(
    verifyDokuSignature(signedRequest({ timestamp: future })),
    false,
  );
});

test("order payment status overrides a stale pending payment attempt", () => {
  assert.equal(
    typeof paymentViewModule?.parseDokuPaymentDetails,
    "function",
  );
  const details = paymentViewModule.parseDokuPaymentDetails({
    orderPaymentStatus: "paid",
    paymentStatus: "pending",
    paymentSessionState: "active",
    paymentExpiresAt: "2026-11-07T04:00:00Z",
    paymentUrl: null,
  });

  assert.equal(
    paymentViewModule.resolveDisplayedPaymentStatus("pending", details),
    "paid",
  );
});

test("bounded request body reader rejects oversized streamed bodies", async () => {
  assert.equal(typeof requestBodyModule?.readBoundedText, "function");
  let wasCancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("1234"));
      controller.enqueue(new TextEncoder().encode("5678"));
    },
    cancel() {
      wasCancelled = true;
    },
  });

  await assert.rejects(
    requestBodyModule.readBoundedText(body, null, 6),
    /request_body_too_large/,
  );
  assert.equal(wasCancelled, true);
});

test("bounded request body cancels a declared oversized upload", async () => {
  let wasCancelled = false;
  const body = new ReadableStream({
    cancel() {
      wasCancelled = true;
    },
  });

  await assert.rejects(
    requestBodyModule.readBoundedText(body, "7", 6),
    /request_body_too_large/,
  );
  assert.equal(wasCancelled, true);
});

test("production_endpoint_requires_explicit_environment", () => {
  const baseEnvironment = {
    DOKU_CLIENT_ID: "MCH-test",
    DOKU_SECRET_KEY: secretKey,
    DOKU_NOTIFICATION_URL: "https://shop.example/api/payments/doku/notify",
    DOKU_RETURN_URL: "https://shop.example/payment/return",
  };

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

test("browser-safe Checkout URL validator enforces the exact expected host", () => {
  assert.ok(paymentUrlModule, "browser-safe Checkout URL validator is available");
  const { validateDokuPaymentUrl } = paymentUrlModule;

  assert.equal(validateDokuPaymentUrl(checkoutUrl, "sandbox.doku.com"), checkoutUrl);
  assert.equal(
    validateDokuPaymentUrl(
      "https://checkout.doku.com/checkout-link-v2/ab1234567890",
      "checkout.doku.com",
    ),
    "https://checkout.doku.com/checkout-link-v2/ab1234567890",
  );
  assert.equal(
    checkoutModule.validateDokuPaymentUrl,
    validateDokuPaymentUrl,
  );

  for (const [url, host] of [
    ["https://checkout.doku.com/checkout-link-v2/token", "sandbox.doku.com"],
    ["https://sandbox.doku.com/checkout-link-v2/token", "checkout.doku.com"],
    ["http://sandbox.doku.com/checkout-link-v2/token", "sandbox.doku.com"],
    ["https://sandbox.doku.com/checkout-link-v2/token?redirect=1", "sandbox.doku.com"],
    ["https://sandbox.doku.com/other/token", "sandbox.doku.com"],
  ]) {
    assert.throws(() => validateDokuPaymentUrl(url, host));
  }
});

test("browser payment response requires its server-validated exact host", () => {
  assert.equal(
    typeof paymentUrlModule.getDokuPaymentUrlFromResponse,
    "function",
  );
  const { getDokuPaymentUrlFromResponse } = paymentUrlModule;

  assert.equal(
    getDokuPaymentUrlFromResponse({
      paymentUrl: checkoutUrl,
      checkoutUrlHost: "sandbox.doku.com",
    }),
    checkoutUrl,
  );
  assert.equal(
    getDokuPaymentUrlFromResponse({
      paymentUrl: "https://checkout.doku.com/checkout-link-v2/token",
      checkoutUrlHost: "checkout.doku.com",
    }),
    "https://checkout.doku.com/checkout-link-v2/token",
  );
  assert.throws(() =>
    getDokuPaymentUrlFromResponse({ paymentUrl: checkoutUrl }),
  );
  assert.throws(() =>
    getDokuPaymentUrlFromResponse({
      paymentUrl: checkoutUrl,
      checkoutUrlHost: "checkout.doku.com",
    }),
  );
});

function signedCheckoutResponse({
  status = 200,
  responseBody = checkoutSuccessBody(),
  signatureOverride,
  responseRequestId = "req-123",
  signatureRequestId = "req-123",
  responseTimestamp,
  signatureTimestamp,
} = {}) {
  const timestamp =
    responseTimestamp ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const responseSignature = createDokuSignature({
    clientId: "MCH-test",
    requestId: signatureRequestId,
    timestampHeader: "Response-Timestamp",
    timestamp: signatureTimestamp ?? timestamp,
    requestTarget: "/checkout/v1/payment",
    body: responseBody,
    secretKey,
  }).signature;
  return new Response(responseBody, {
    status,
    headers: {
      "Client-Id": "MCH-test",
      "Request-Id": responseRequestId,
      "Response-Timestamp": timestamp,
      Signature: signatureOverride ?? responseSignature,
    },
  });
}

function sandboxConfig() {
  return {
    environment: "sandbox",
    clientId: "MCH-test",
    secretKey,
    apiBaseUrl: "https://api-sandbox.doku.com",
    checkoutUrlHost: "sandbox.doku.com",
  };
}

async function withTrackedCheckoutTimer(run) {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = [];
  let requestSignal;
  globalThis.setTimeout = (callback, delay) => {
    const timer = { callback, delay, clearCalls: 0 };
    timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => {
    timer.clearCalls += 1;
  };
  try {
    return await run({
      timers,
      captureSignal(signal) {
        requestSignal = signal;
      },
      getRequestSignal() {
        return requestSignal;
      },
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

test("doku_checkout_request_is_signed_and_validates_the_signed_response", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");
  let captured;
  const result = await checkoutModule.createDokuCheckoutSession({
    config: sandboxConfig(),
    requestId: "req-123",
    body: checkoutBody,
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return signedCheckoutResponse();
    },
  });

  assert.equal(
    captured.url,
    "https://api-sandbox.doku.com/checkout/v1/payment",
  );
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.body, checkoutBody);
  assert.equal(captured.init.headers["Client-Id"], "MCH-test");
  assert.equal(captured.init.headers["Request-Id"], "req-123");
  assert.match(captured.init.headers["Request-Timestamp"], /^\d{4}-\d\d-/);
  assert.match(captured.init.headers.Signature, /^HMACSHA256=/);
  assert.equal(result.paymentUrl, checkoutUrl);
  assert.equal(result.invoiceNumber, "INV-123");
  assert.equal(result.amount, 125000);
  assert.equal(result.gatewaySessionId, "token-123");
  assert.ok(Date.parse(result.expiresAt) > Date.now());
  assert.ok(Date.parse(result.expiresAt) < Date.now() + 61 * 60 * 1000);
});

test("doku_checkout_rejects_an_invalid_response_signature", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");
  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl: async () =>
        signedCheckoutResponse({ signatureOverride: "HMACSHA256=invalid" }),
    }),
    /signature/i,
  );
});

test("doku_checkout_rejects_a_mismatched_response_amount_or_due_date", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");
  const mismatchedBody = checkoutSuccessBody().replace(
    '"payment_due_date":60',
    '"payment_due_date":30',
  );
  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl: async () =>
        signedCheckoutResponse({ responseBody: mismatchedBody }),
    }),
    /does not match the order/i,
  );
});

test("doku_checkout_rejects_a_payment_url_outside_the_configured_host", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");
  const responseBody = JSON.stringify({
    message: ["SUCCESS"],
    response: {
      order: { amount: "125000", invoice_number: "INV-123" },
      payment: {
        url: "https://attacker.example/checkout-link-v2/token",
        token_id: "token-123",
        payment_due_date: 60,
        expired_date: dokuExpiryAfter(60 * 60 * 1000),
      },
    },
  });
  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl: async () => signedCheckoutResponse({ responseBody }),
    }),
    /payment URL/i,
  );
});

test("doku_checkout_accepts_the_signed_conflict_replay_response", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");
  const result = await checkoutModule.createDokuCheckoutSession({
    config: sandboxConfig(),
    requestId: "req-123",
    body: checkoutBody,
    fetchImpl: async () => signedCheckoutResponse({ status: 409 }),
  });

  assert.equal(result.paymentUrl, checkoutUrl);
});

test("doku_checkout_network_failure_is_reported_as_uncertain_without_secrets", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");
  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl: async () => {
        throw new Error(secretKey);
      },
    }),
    (error) => {
      assert.match(error.message, /uncertain/i);
      assert.match(error.message, /same Request-Id and body/i);
      assert.equal(error.message.includes(secretKey), false);
      return true;
    },
  );
});

test("doku_checkout_diagnostics_distinguish_network_and_timeout", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");

  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: "{invalid request body sentinel",
      fetchImpl: async () => {
        throw new Error("must not send request");
      },
    }),
    (error) => {
      assert.equal(error.diagnostic.category, "local_request_validation");
      return true;
    },
  );

  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: { ...sandboxConfig(), clientId: "" },
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl: async () => {
        throw new Error("must not send request");
      },
    }),
    (error) => {
      assert.equal(error.diagnostic.category, "local_signing");
      return true;
    },
  );

  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl: async () => {
        throw new Error("network sentinel");
      },
    }),
    (error) => {
      assert.equal(error.diagnostic.category, "gateway_transport");
      assert.equal(error.diagnostic.transportFailure, "network_rejection");
      assert.equal(error.message.includes("network sentinel"), false);
      return true;
    },
  );

  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let clearTimeoutCalls = 0;
  globalThis.setTimeout = (callback) => {
    callback();
    return 1;
  };
  globalThis.clearTimeout = () => {
    clearTimeoutCalls += 1;
  };
  try {
    await assert.rejects(
      checkoutModule.createDokuCheckoutSession({
        config: sandboxConfig(),
        requestId: "req-123",
        body: checkoutBody,
        fetchImpl: async (_url, init) => {
          assert.equal(init.signal.aborted, true);
          throw new DOMException("timeout sentinel", "AbortError");
        },
      }),
      (error) => {
        assert.equal(error.diagnostic.category, "gateway_transport");
        assert.equal(error.diagnostic.transportFailure, "timeout");
        assert.equal(error.message.includes("timeout sentinel"), false);
        return true;
      },
    );
      assert.equal(clearTimeoutCalls, 1);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
});

test("doku_checkout_timeout_covers_response_body_read", async () => {
    assert.ok(checkoutModule, "expected DOKU Checkout request utilities");

    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    let clearTimeoutCalls = 0;
    let timeoutCallback;
    let timeoutWasCleared = false;
    let requestSignal;
    globalThis.setTimeout = (callback) => {
      timeoutCallback = callback;
      return 1;
    };
    globalThis.clearTimeout = () => {
      clearTimeoutCalls += 1;
      timeoutWasCleared = true;
    };
    try {
      await assert.rejects(
        checkoutModule.createDokuCheckoutSession({
          config: sandboxConfig(),
          requestId: "req-123",
          body: checkoutBody,
          fetchImpl: async (_url, init) => {
            requestSignal = init.signal;
            const response = signedCheckoutResponse();
            response.text = async () => {
              assert.equal(timeoutWasCleared, false);
              timeoutCallback();
              assert.equal(requestSignal.aborted, true);
              return new Promise(() => {});
            };
            return response;
          },
        }),
        (error) => {
          assert.equal(error.diagnostic.category, "gateway_transport");
          assert.equal(error.diagnostic.transportFailure, "timeout");
          assert.equal(error.diagnostic.responseBodyRead, false);
          return true;
        },
      );
      assert.equal(clearTimeoutCalls, 1);
      assert.equal(requestSignal.aborted, true);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
});

test("doku_checkout_cleans_up_timeout_for_success_and_validation_failures", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");

  const invalidPayload = signedCheckoutResponse({
    responseBody: JSON.stringify({ message: ["SUCCESS"], response: {} }),
  });
  const unreadableResponse = signedCheckoutResponse();
  unreadableResponse.text = async () => {
    throw new Error("body-read sentinel");
  };
  const cases = [
    {
      name: "success",
      response: () => signedCheckoutResponse(),
      expectedCategory: null,
    },
    {
      name: "HTTP error",
      response: () => new Response("http body sentinel", { status: 401 }),
      expectedCategory: "gateway_http",
    },
    {
      name: "body-read error",
      response: () => unreadableResponse,
      expectedCategory: "gateway_body_read",
    },
    {
      name: "signature failure",
      response: () =>
        signedCheckoutResponse({ signatureOverride: "signature sentinel" }),
      expectedCategory: "gateway_signature",
    },
    {
      name: "payload failure",
      response: () => invalidPayload,
      expectedCategory: "gateway_payload_validation",
    },
  ];

  for (const testCase of cases) {
    await withTrackedCheckoutTimer(
      async ({ timers, captureSignal, getRequestSignal }) => {
        const checkout = checkoutModule.createDokuCheckoutSession({
          config: sandboxConfig(),
          requestId: "req-123",
          body: checkoutBody,
          fetchImpl: async (_url, init) => {
            captureSignal(init.signal);
            return testCase.response();
          },
        });

        if (testCase.expectedCategory === null) {
          const result = await checkout;
          assert.equal(result.paymentUrl, checkoutUrl, testCase.name);
        } else {
          await assert.rejects(
            checkout,
            (error) => {
              assert.equal(error.diagnostic.category, testCase.expectedCategory);
              return true;
            },
            testCase.name,
          );
        }

        assert.equal(timers.length, 1, `${testCase.name}: one timeout is set`);
        assert.equal(
          timers[0].delay,
          15_000,
          `${testCase.name}: 15 second limit`,
        );
        assert.equal(
          timers[0].clearCalls,
          1,
          `${testCase.name}: timer is cleared`,
        );
        assert.equal(
          getRequestSignal().aborted,
          true,
          `${testCase.name}: signal is aborted`,
        );
      },
    );
  }
});

test("doku_checkout_response_finishing_before_timeout_succeeds", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");

  await withTrackedCheckoutTimer(
    async ({ timers, captureSignal, getRequestSignal }) => {
      const result = await checkoutModule.createDokuCheckoutSession({
        config: sandboxConfig(),
        requestId: "req-123",
        body: checkoutBody,
        fetchImpl: async (_url, init) => {
          captureSignal(init.signal);
          return signedCheckoutResponse();
        },
      });

      assert.equal(result.paymentUrl, checkoutUrl);
      assert.equal(timers[0].clearCalls, 1);
      assert.equal(getRequestSignal().aborted, true);
    },
  );
});

test("doku_checkout_timeout_wins_when_body_finishes_at_the_deadline", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");

  await withTrackedCheckoutTimer(
    async ({ timers, captureSignal, getRequestSignal }) => {
      const response = signedCheckoutResponse();
      response.text = async () => {
        timers[0].callback();
        return checkoutSuccessBody();
      };

      await assert.rejects(
        checkoutModule.createDokuCheckoutSession({
          config: sandboxConfig(),
          requestId: "req-123",
          body: checkoutBody,
          fetchImpl: async (_url, init) => {
            captureSignal(init.signal);
            return response;
          },
        }),
        (error) => {
          assert.equal(error.diagnostic.category, "gateway_transport");
          assert.equal(error.diagnostic.transportFailure, "timeout");
          return true;
        },
      );
      assert.equal(timers[0].clearCalls, 1);
      assert.equal(getRequestSignal().aborted, true);
    },
  );
});

test("doku_checkout_timeout_wins_when_response_and_deadline_race", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");

  await withTrackedCheckoutTimer(
    async ({ timers, captureSignal, getRequestSignal }) => {
      await assert.rejects(
        checkoutModule.createDokuCheckoutSession({
          config: sandboxConfig(),
          requestId: "req-123",
          body: checkoutBody,
          fetchImpl: async (_url, init) => {
            captureSignal(init.signal);
            timers[0].callback();
            return signedCheckoutResponse();
          },
        }),
        (error) => {
          assert.equal(error.diagnostic.category, "gateway_transport");
          assert.equal(error.diagnostic.transportFailure, "timeout");
          return true;
        },
      );
      assert.equal(timers[0].clearCalls, 1);
      assert.equal(getRequestSignal().aborted, true);
    },
  );
});

test("doku_checkout_helper_keeps_parallel_mocked_requests_independent", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");

  let activeRequests = 0;
  let maximumActiveRequests = 0;
  const signals = [];
  const fetchImpl = async (_url, init) => {
    signals.push(init.signal);
    activeRequests += 1;
    maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
    await Promise.resolve();
    activeRequests -= 1;
    return signedCheckoutResponse();
  };

  const results = await Promise.all([
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl,
    }),
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl,
    }),
  ]);

  assert.equal(maximumActiveRequests, 2);
  assert.equal(results.length, 2);
  assert.ok(results.every((result) => result.paymentUrl === checkoutUrl));
  assert.notEqual(signals[0], signals[1]);
  assert.ok(signals.every((signal) => signal.aborted));
});

test("doku_checkout_diagnostics_distinguish_http_and_body_read_failures", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");

  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl: async () => new Response("http body sentinel", { status: 401 }),
    }),
    (error) => {
      assert.equal(error.diagnostic.category, "gateway_http");
      assert.equal(error.diagnostic.httpStatus, 401);
      assert.equal(error.diagnostic.responseBodyRead, false);
      assert.equal(error.message.includes("http body sentinel"), false);
      return true;
    },
  );

  const unreadableResponse = signedCheckoutResponse();
  unreadableResponse.text = async () => {
    throw new Error("body read sentinel");
  };
  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl: async () => unreadableResponse,
    }),
    (error) => {
      assert.equal(error.diagnostic.category, "gateway_body_read");
      assert.equal(error.diagnostic.httpStatus, 200);
      assert.equal(error.diagnostic.responseBodyRead, false);
      assert.equal(error.message.includes("body read sentinel"), false);
      return true;
    },
  );
});

test("doku_checkout_diagnostics_distinguish_signature_and_payload_validation", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");

  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl: async () =>
        signedCheckoutResponse({ signatureOverride: "signature sentinel" }),
    }),
    (error) => {
      assert.equal(error.diagnostic.category, "gateway_signature");
      assert.equal(error.diagnostic.responseBodyRead, true);
      assert.equal(error.diagnostic.signatureValid, false);
      assert.equal(error.message.includes("signature sentinel"), false);
      return true;
    },
  );

  const wrongInvoiceBody = checkoutSuccessBody().replace(
    '"invoice_number":"INV-123"',
    '"invoice_number":"other-invoice-sentinel"',
  );
  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl: async () =>
        signedCheckoutResponse({ responseBody: wrongInvoiceBody }),
    }),
    (error) => {
      assert.equal(error.diagnostic.category, "gateway_invoice_validation");
      assert.equal(error.diagnostic.signatureValid, true);
      assert.equal(error.diagnostic.invoiceMatches, false);
      assert.equal(error.message.includes("other-invoice-sentinel"), false);
      return true;
    },
  );

  const wrongAmountBody = checkoutSuccessBody().replace(
    '"amount":"125000"',
    '"amount":"999999"',
  );
  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl: async () =>
        signedCheckoutResponse({ responseBody: wrongAmountBody }),
    }),
    (error) => {
      assert.equal(error.diagnostic.category, "gateway_amount_validation");
      assert.equal(error.diagnostic.signatureValid, true);
      assert.equal(error.diagnostic.amountMatches, false);
      assert.equal(error.message.includes("999999"), false);
      return true;
    },
  );

  const invalidPayload = JSON.stringify({
    message: ["DECLINED"],
    response: {
      order: { amount: "125000", invoice_number: "INV-123" },
      payment: {
        url: checkoutUrl,
        token_id: "token-123",
        payment_due_date: 60,
        expired_date: dokuExpiryAfter(60 * 60 * 1000),
      },
    },
  });
  await assert.rejects(
    checkoutModule.createDokuCheckoutSession({
      config: sandboxConfig(),
      requestId: "req-123",
      body: checkoutBody,
      fetchImpl: async () =>
        signedCheckoutResponse({ responseBody: invalidPayload }),
    }),
    (error) => {
      assert.equal(error.diagnostic.category, "gateway_payload_validation");
      assert.equal(error.diagnostic.signatureValid, true);
      return true;
    },
  );
});

test("doku_checkout_reports_allowlisted_reason_codes_for_response_validation_failures", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");
  assert.ok(diagnosticModule, "expected DOKU diagnostic logging utilities");

  const withPayload = (mutate) => {
    const payload = JSON.parse(checkoutSuccessBody());
    mutate(payload);
    return JSON.stringify(payload);
  };
  const cases = [
    {
      reasonCode: "response_json_invalid",
      category: "gateway_payload_validation",
      responseBody: "not-json-sentinel",
    },
    {
      reasonCode: "response_shape_invalid",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.message = "SUCCESS";
      }),
    },
    {
      reasonCode: "order_shape_invalid",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.response.order = null;
      }),
    },
    {
      reasonCode: "payment_shape_invalid",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.response.payment = null;
      }),
    },
    {
      reasonCode: "invoice_mismatch",
      category: "gateway_invoice_validation",
      responseBody: withPayload((payload) => {
        payload.response.order.invoice_number = "private-invoice-sentinel";
      }),
    },
    {
      reasonCode: "amount_invalid",
      category: "gateway_amount_validation",
      responseBody: withPayload((payload) => {
        payload.response.order.amount = "invalid-amount-sentinel";
      }),
    },
    {
      reasonCode: "amount_mismatch",
      category: "gateway_amount_validation",
      responseBody: withPayload((payload) => {
        payload.response.order.amount = "125001";
      }),
    },
    {
      reasonCode: "payment_due_date_invalid",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.response.payment.payment_due_date = "invalid-due-date-sentinel";
      }),
    },
    {
      reasonCode: "payment_due_date_mismatch",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.response.payment.payment_due_date = 30;
      }),
    },
    {
      reasonCode: "currency_mismatch",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.response.order.currency = "USD";
      }),
    },
    {
      reasonCode: "message_not_success",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.message = ["DECLINED"];
      }),
    },
    {
      reasonCode: "token_id_invalid",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.response.payment.token_id = "";
      }),
    },
    {
      reasonCode: "payment_url_missing",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        delete payload.response.payment.url;
      }),
    },
    {
      reasonCode: "payment_url_invalid",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.response.payment.url = "not-a-url-sentinel";
      }),
    },
    {
      reasonCode: "payment_url_host_invalid",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.response.payment.url =
          "https://attacker.example/checkout-link-v2/token-sentinel";
      }),
    },
    {
      reasonCode: "payment_url_path_invalid",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.response.payment.url = "https://sandbox.doku.com/not-a-checkout-link";
      }),
    },
    {
      reasonCode: "expired_date_invalid",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.response.payment.expired_date = "20261301000000";
      }),
    },
    {
      reasonCode: "expired_date_elapsed",
      category: "gateway_payload_validation",
      responseBody: withPayload((payload) => {
        payload.response.payment.expired_date = dokuExpiryAfter(-60 * 60 * 1000);
      }),
    },
  ];

  const originalError = console.error;
  let logOutput = "";
  console.error = (message) => {
    logOutput += `${String(message)}\n`;
  };
  try {
    for (const testCase of cases) {
      await assert.rejects(
        checkoutModule.createDokuCheckoutSession({
          config: sandboxConfig(),
          requestId: "req-123",
          body: checkoutBody,
          fetchImpl: async () =>
            signedCheckoutResponse({ responseBody: testCase.responseBody }),
        }),
        (error) => {
          assert.equal(error.diagnostic.category, testCase.category);
          assert.equal(error.diagnostic.reasonCode, testCase.reasonCode);
          diagnosticModule.logDokuCheckoutDiagnostic({
            correlationId: "123e4567-e89b-42d3-a456-426614174000",
            gatewayRequestId: "123e4567-e89b-42d3-a456-426614174001",
            ...error.diagnostic,
          });
          return true;
        },
        testCase.reasonCode,
      );
    }
  } finally {
    console.error = originalError;
  }

  for (const sentinel of [
    "not-json-sentinel",
    "private-invoice-sentinel",
    "invalid-amount-sentinel",
    "125001",
    "invalid-due-date-sentinel",
    "USD",
    "DECLINED",
    "token-123",
    checkoutUrl,
    "attacker.example",
    "token-sentinel",
    secretKey,
    "20261301000000",
  ]) {
    assert.equal(logOutput.includes(sentinel), false);
  }

  const loggedRecords = logOutput
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    loggedRecords.map((record) => record.reasonCode),
    cases.map((testCase) => testCase.reasonCode),
  );
  assert.ok(
    loggedRecords.every(
      (record) =>
        record.correlationId === "123e4567-e89b-42d3-a456-426614174000" &&
        record.gatewayRequestId === "123e4567-e89b-42d3-a456-426614174001",
    ),
  );
});

test("doku_checkout_distinguishes_response_request_id_timestamp_and_signature_failures", async () => {
  assert.ok(checkoutModule, "expected DOKU Checkout request utilities");
  assert.ok(diagnosticModule, "expected DOKU diagnostic logging utilities");

  const currentTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
  const cases = [
    {
      reasonCode: "response_request_id_mismatch",
      signatureValid: undefined,
      response: () =>
        signedCheckoutResponse({ responseRequestId: "different-request-id" }),
    },
    {
      reasonCode: "response_timestamp_invalid",
      signatureValid: undefined,
      response: () =>
        signedCheckoutResponse({
          responseTimestamp: "invalid-timestamp-sentinel",
          signatureTimestamp: currentTimestamp,
        }),
    },
    {
      reasonCode: "response_timestamp_out_of_range",
      signatureValid: undefined,
      response: () =>
        signedCheckoutResponse({ responseTimestamp: staleTimestamp }),
    },
    {
      reasonCode: "response_signature_invalid",
      signatureValid: false,
      response: () =>
        signedCheckoutResponse({
          signatureOverride: "signature-sentinel",
        }),
    },
  ];

  const originalError = console.error;
  let logOutput = "";
  console.error = (message) => {
    logOutput += `${String(message)}\n`;
  };
  try {
    for (const testCase of cases) {
      await assert.rejects(
        checkoutModule.createDokuCheckoutSession({
          config: sandboxConfig(),
          requestId: "req-123",
          body: checkoutBody,
          fetchImpl: async () => testCase.response(),
        }),
        (error) => {
          assert.equal(error.diagnostic.category, "gateway_signature");
          assert.equal(error.diagnostic.reasonCode, testCase.reasonCode);
          diagnosticModule.logDokuCheckoutDiagnostic({
            correlationId: "123e4567-e89b-42d3-a456-426614174000",
            gatewayRequestId: "123e4567-e89b-42d3-a456-426614174001",
            ...error.diagnostic,
          });
          return true;
        },
        testCase.reasonCode,
      );
    }
  } finally {
    console.error = originalError;
  }

  for (const sentinel of [
    "invalid-timestamp-sentinel",
    "signature-sentinel",
    checkoutUrl,
    "token-123",
    "INV-123",
    "125000",
    secretKey,
  ]) {
    assert.equal(logOutput.includes(sentinel), false);
  }
  const loggedRecords = logOutput
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    loggedRecords.map((record) => record.reasonCode),
    cases.map((testCase) => testCase.reasonCode),
  );
  assert.ok(
    loggedRecords.every((record, index) => {
      assert.equal(record.category, "gateway_signature");
      assert.equal(record.responseBodyRead, true);
      assert.equal(record.signatureValid, cases[index].signatureValid);
      return true;
    }),
  );
});

test("doku_checkout_diagnostics_log_only_allowlisted_safe_fields", () => {
  assert.ok(diagnosticModule, "expected DOKU diagnostic logging utilities");
  const originalError = console.error;
  let logOutput = "";
  console.error = (message) => {
    logOutput += String(message);
  };
  try {
    diagnosticModule.logDokuCheckoutDiagnostic({
      correlationId: "123e4567-e89b-42d3-a456-426614174000",
      gatewayRequestId: "123e4567-e89b-42d3-a456-426614174001",
      stage: "supabase_save",
      category: "supabase_save",
      requestDurationMs: 42,
      responseBodyRead: true,
      signatureValid: true,
      invoiceMatches: true,
      amountMatches: true,
      supabaseSaveSucceeded: false,
      supabaseMarkUncertainSucceeded: true,
      clientId: "client sentinel",
      secretKey: "secret sentinel",
      signature: "signature sentinel",
      authorization: "authorization sentinel",
      token: "token sentinel",
      paymentUrl: "payment url sentinel",
      body: "body sentinel",
      responseBody: "response body sentinel",
      email: "private data sentinel",
      name: "name sentinel",
      address: "address sentinel",
      invoice: "invoice sentinel",
      amount: "amount sentinel",
      error: new Error("raw error sentinel"),
      reasonCode: "raw response body sentinel",
    });
    diagnosticModule.logDokuCheckoutDiagnostic({
      correlationId: "123e4567-e89b-42d3-a456-426614174000",
      stage: "gateway_payload_validation",
      category: "gateway_payload_validation",
      reasonCode: "payment_url_invalid",
    });
    const saveFailure = new diagnosticModule.DokuCheckoutDiagnosticError(
      "supabase_save",
      {
        supabaseSaveSucceeded: false,
      },
    );
    assert.equal(saveFailure.diagnostic.stage, "supabase_save");
    assert.equal(saveFailure.diagnostic.category, "supabase_save");
    diagnosticModule.logDokuCheckoutDiagnostic({
      correlationId: "123e4567-e89b-42d3-a456-426614174000",
      stage: "supabase_mark_uncertain",
      category: "supabase_mark_uncertain",
      supabaseMarkUncertainSucceeded: false,
    });
    const signatureFailure = new diagnosticModule.DokuCheckoutDiagnosticError(
      "gateway_signature",
      {
        reasonCode: "response_signature_invalid",
        responseBodyRead: true,
        signatureValid: false,
      },
    );
    diagnosticModule.logDokuCheckoutDiagnostic({
      correlationId: "123e4567-e89b-42d3-a456-426614174000",
      gatewayRequestId: "123e4567-e89b-42d3-a456-426614174001",
      ...signatureFailure.diagnostic,
      supabaseSaveSucceeded: false,
      supabaseMarkUncertainSucceeded: false,
    });
  } finally {
    console.error = originalError;
  }

  for (const sentinel of [
    "client sentinel",
    "secret sentinel",
    "signature sentinel",
    "authorization sentinel",
    "token sentinel",
    "payment url sentinel",
    "body sentinel",
    "response body sentinel",
    "private data sentinel",
    "name sentinel",
    "address sentinel",
    "invoice sentinel",
    "amount sentinel",
    "raw error sentinel",
    "raw response body sentinel",
  ]) {
    assert.equal(logOutput.includes(sentinel), false);
  }
  assert.match(logOutput, /"reasonCode":"payment_url_invalid"/);
  assert.match(logOutput, /"category":"supabase_save"/);
  assert.match(logOutput, /"supabaseSaveSucceeded":false/);
  assert.match(logOutput, /"category":"supabase_mark_uncertain"/);
  assert.match(logOutput, /"supabaseMarkUncertainSucceeded":false/);
  assert.match(logOutput, /"reasonCode":"response_signature_invalid"/);
  assert.match(logOutput, /"signatureValid":false/);

  console.error = () => {
    throw new Error("logger failure sentinel");
  };
  try {
    assert.doesNotThrow(() =>
      diagnosticModule.logDokuCheckoutDiagnostic({
        correlationId: "123e4567-e89b-42d3-a456-426614174000",
        stage: "supabase_mark_uncertain",
        category: "supabase_mark_uncertain",
      }),
    );
  } finally {
    console.error = originalError;
  }
});

test("doku_create_route_preserves_existing_uncertain_api_responses", () => {
  const route = readFileSync(
    new URL("../app/api/payments/doku/create/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    route,
    /new DokuCheckoutDiagnosticError\("supabase_save"/,
  );
  assert.match(
    route,
    /stage:\s*"supabase_mark_uncertain",\s*category:\s*"supabase_mark_uncertain"/,
  );
  assert.match(
    route,
    /logDokuCheckoutDiagnostic\(\{\s*correlationId,\s*gatewayRequestId:\s*attempt\.gateway_request_id,\s*\.\.\.failure,/,
  );
  assert.match(
    route,
    /new DokuCheckoutDiagnosticError\("gateway_invoice_validation",\s*\{[\s\S]*?invoiceMatches:\s*false,\s*amountMatches:\s*true,\s*reasonCode:\s*"invoice_mismatch"/,
  );
  assert.match(
    route,
    /new DokuCheckoutDiagnosticError\("gateway_amount_validation",\s*\{[\s\S]*?invoiceMatches:\s*true,\s*amountMatches:\s*false,\s*reasonCode:\s*"amount_mismatch"/,
  );
  assert.match(
    route,
    /supabaseSaveSucceeded:\s*false/,
  );
  assert.match(
    route,
    /error:\s*"Status sesi pembayaran belum dapat dipastikan\. Coba lanjutkan pembayaran dari detail pesanan\."\s*,\s*\}\s*,\s*\{\s*status:\s*503\s*\}/,
  );
  assert.match(
    route,
    /error:\s*"Status sesi pembayaran tidak dapat dicatat\. Hubungi dukungan sebelum mencoba kembali\."\s*,\s*\}\s*,\s*\{\s*status:\s*503\s*\}/,
  );
});

test("doku_create_route_logs_safe_categories_for_checkout_503_paths", () => {
  const route = readFileSync(
    new URL("../app/api/payments/doku/create/route.ts", import.meta.url),
    "utf8",
  );
  assert.ok(diagnosticModule, "expected DOKU diagnostic logging utilities");

  for (const category of [
    "configuration_missing",
    "database_persistence_failed",
    "local_request_validation",
    "gateway_payload_validation",
    "checkout_response_uncertain",
  ]) {
    assert.ok(
      diagnosticModule.dokuCheckoutDiagnosticCategories.includes(category),
      `expected allowlisted diagnostic category ${category}`,
    );
    assert.match(
      route,
      new RegExp(
        `stage:\\s*"${category}",\\s*category:\\s*"${category}"`,
      ),
    );
  }
  assert.match(route, /reasonCode:\s*"payment_url_invalid"/);
});

test("payment_request_uses_only_the_persisted_order_amount_and_invoice", () => {
  assert.ok(paymentRequestModule, "expected DOKU payment request builder");
  const request = paymentRequestModule.buildDokuCheckoutRequest({
    orderNumber: "INV-123",
    totalPrice: 125000,
    returnUrl: "https://shop.example/payment/return",
    notificationUrl: "https://shop.example/api/payments/doku/notify",
  });
  const body = JSON.parse(request.body);

  assert.equal(request.amount, 125000);
  assert.equal(request.invoiceNumber, "INV-123");
  assert.equal(body.order.amount, 125000);
  assert.equal(body.order.invoice_number, "INV-123");
  assert.equal(body.order.currency, "IDR");
  assert.equal(body.order.auto_redirect, true);
  assert.equal(body.order.callback_url, "https://shop.example/payment/return");
  assert.equal(
    body.order.callback_url_result,
    "https://shop.example/payment/return",
  );
  assert.equal(body.payment.payment_due_date, 60);
  assert.equal(
    body.additional_info.override_notification_url,
    "https://shop.example/api/payments/doku/notify",
  );
  assert.ok(Date.parse(request.expiresAt) > Date.now());
  assert.ok(Date.parse(request.expiresAt) < Date.now() + 61 * 60 * 1000);
});

test("payment_request_rejects_non_integer_amount_and_long_invoice", () => {
  assert.ok(paymentRequestModule, "expected DOKU payment request builder");
  const values = {
    orderNumber: "INV-123",
    totalPrice: 125000,
    returnUrl: "https://shop.example/payment/return",
    notificationUrl: "https://shop.example/api/payments/doku/notify",
  };
  assert.throws(
    () =>
      paymentRequestModule.buildDokuCheckoutRequest({
        ...values,
        totalPrice: 125000.5,
      }),
    /amount/i,
  );
  assert.throws(
    () =>
      paymentRequestModule.buildDokuCheckoutRequest({
        ...values,
        orderNumber: "I".repeat(31),
      }),
    /invoice/i,
  );
});

function signedNotification({
  rawBody = notificationBody,
  timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  clientId = "MCH-test",
  requestId = "notification-123",
  signatureOverride,
} = {}) {
  const signature = createDokuSignature({
    clientId,
    requestId,
    timestampHeader: "Request-Timestamp",
    timestamp,
    requestTarget: "/api/payments/doku/notify",
    body: rawBody,
    secretKey,
  }).signature;
  return {
    body: rawBody,
    headers: {
      clientId,
      requestId,
      timestamp,
      signature: signatureOverride ?? signature,
    },
  };
}

test("notification_verification_accepts_valid_signed_checkout_event", () => {
  assert.ok(notificationModule, "expected DOKU notification verifier");
  const notification = signedNotification();
  const result = notificationModule.verifyDokuNotification({
    ...notification,
    config: {
      clientId: "MCH-test",
      secretKey,
    },
    notificationUrl,
  });

  assert.equal(result.invoiceNumber, "INV-123");
  assert.equal(result.amount, 125000);
  assert.equal(result.eventId, "notification-123");
  assert.equal(
    result.bodyDigest,
    createHash("sha256").update(notificationBody, "utf8").digest("base64"),
  );
  assert.match(result.bodyDigest, /^[A-Za-z0-9+/]{43}=$/);
  assert.equal(result.originalRequestId, "checkout-request-123");
  assert.equal(result.status, "SUCCESS");
  assert.match(result.bodyDigest, /^[A-Za-z0-9+/]{43}=$/);
  assert.equal(result.eventTime, "2026-11-07T04:00:00.000Z");
});

test("notification_verification_preserves_optional_gateway_transaction_id", () => {
  assert.ok(notificationModule, "expected DOKU notification verifier");
  const rawBody = JSON.stringify({
    transaction: {
      status: "SUCCESS",
      date: "2026-11-07T04:00:00Z",
      original_request_id: "checkout-request-123",
      id: "gateway-transaction-123",
    },
    order: { invoice_number: "INV-123", amount: 125000 },
  });
  const notification = signedNotification({ rawBody });
  const result = notificationModule.verifyDokuNotification({
    ...notification,
    config: {
      clientId: "MCH-test",
      secretKey,
    },
    notificationUrl,
  });

  assert.equal(result.gatewayTransactionId, "gateway-transaction-123");
});

test("notification_verification_accepts_128_character_gateway_transaction_id", () => {
  assert.ok(notificationModule, "expected DOKU notification verifier");
  const gatewayTransactionId = "x".repeat(128);
  const rawBody = JSON.stringify({
    transaction: {
      status: "SUCCESS",
      date: "2026-11-07T04:00:00Z",
      original_request_id: "checkout-request-123",
      id: gatewayTransactionId,
    },
    order: { invoice_number: "INV-123", amount: 125000 },
  });
  const notification = signedNotification({ rawBody });
  const result = notificationModule.verifyDokuNotification({
    ...notification,
    config: { clientId: "MCH-test", secretKey },
    notificationUrl,
  });

  assert.equal(result.gatewayTransactionId, gatewayTransactionId);
});

test("notification_verification_rejects_invalid_gateway_transaction_ids", () => {
  assert.ok(notificationModule, "expected DOKU notification verifier");
  const config = { clientId: "MCH-test", secretKey };
  for (const transactionOverrides of [
    { id: "" },
    { id: " \t\n" },
    { id: 123 },
    { id: "x".repeat(129) },
    { transaction_id: false },
    { id: 123, transaction_id: "gateway-transaction-123" },
  ]) {
    const rawBody = JSON.stringify({
      transaction: {
        status: "SUCCESS",
        date: "2026-11-07T04:00:00Z",
        original_request_id: "checkout-request-123",
        ...transactionOverrides,
      },
      order: { invoice_number: "INV-123", amount: 125000 },
    });
    const notification = signedNotification({ rawBody });

    assert.throws(
      () =>
        notificationModule.verifyDokuNotification({
          ...notification,
          config,
          notificationUrl,
        }),
      /notification fields are invalid/i,
      JSON.stringify(transactionOverrides),
    );
  }
});

test("notification_verification_rejects_wrong_client_and_mutated_body", () => {
  assert.ok(notificationModule, "expected DOKU notification verifier");
  const notification = signedNotification();
  assert.throws(
    () =>
      notificationModule.verifyDokuNotification({
        ...notification,
        headers: { ...notification.headers, clientId: "MCH-other" },
        config: { clientId: "MCH-test", secretKey },
        notificationUrl,
      }),
    /signature/i,
  );
  assert.throws(
    () =>
      notificationModule.verifyDokuNotification({
        ...notification,
        body: `${notification.body} `,
        config: { clientId: "MCH-test", secretKey },
        notificationUrl,
      }),
    /signature/i,
  );
});

test("notification_verification_rejects_stale_and_future_timestamps", () => {
  assert.ok(notificationModule, "expected DOKU notification verifier");
  const config = { clientId: "MCH-test", secretKey };
  const stale = signedNotification({
    timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
  });
  assert.throws(
    () =>
      notificationModule.verifyDokuNotification({
        ...stale,
        config,
        notificationUrl,
      }),
    /timestamp/i,
  );
  const future = signedNotification({
    timestamp: new Date(Date.now() + 10 * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
  });
  assert.throws(
    () =>
      notificationModule.verifyDokuNotification({
        ...future,
        config,
        notificationUrl,
      }),
    /timestamp/i,
  );
});

test("doku_check_status_uses_signed_get_without_a_body_digest", async () => {
  assert.ok(checkStatusModule, "expected DOKU Check Status client");
  let captured;
  const result = await checkStatusModule.getDokuCheckoutStatus({
    config: {
      environment: "sandbox",
      clientId: "MCH-test",
      secretKey,
      apiBaseUrl: "https://api-sandbox.doku.com",
      checkoutUrlHost: "sandbox.doku.com",
      notificationUrl,
      returnUrl: "https://shop.example/payment/return",
    },
    invoiceNumber: "INV-123",
    fetchImpl: async (url, init) => {
      captured = { url, init };
      const body = JSON.stringify({
        transaction: {
          status: "SUCCESS",
          original_request_id: "checkout-request-123",
        },
        order: { invoice_number: "INV-123", amount: 125000 },
      });
      const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const signature = createDokuSignature({
        clientId: "MCH-test",
        requestId: init.headers["Request-Id"],
        timestampHeader: "Response-Timestamp",
        timestamp,
        requestTarget: "/orders/v1/status/INV-123",
        secretKey,
      }).signature;
      return new Response(body, {
        status: 200,
        headers: {
          "Client-Id": "MCH-test",
          "Request-Id": init.headers["Request-Id"],
          "Response-Timestamp": timestamp,
          Signature: signature,
        },
      });
    },
  });

  assert.equal(
    captured.url,
    "https://api-sandbox.doku.com/orders/v1/status/INV-123",
  );
  assert.equal(captured.init.method, "GET");
  assert.equal(captured.init.body, undefined);
  assert.match(captured.init.headers.Signature, /^HMACSHA256=/);
  assert.equal(result.invoiceNumber, "INV-123");
  assert.equal(result.amount, 125000);
  assert.equal(result.transactionStatus, "SUCCESS");
  assert.equal(result.originalRequestId, "checkout-request-123");
});

test("doku_check_status_timeout_covers_response_body_read", async (t) => {
  assert.ok(checkStatusModule, "expected DOKU Check Status client");
  t.mock.timers.enable({ apis: ["setTimeout"] });

  let requestSignal;
  let bodyReadStarted;
  const bodyReadStartedPromise = new Promise((resolve) => {
    bodyReadStarted = resolve;
  });
  const request = checkStatusModule.getDokuCheckoutStatus({
    config: {
      environment: "sandbox",
      clientId: "MCH-test",
      secretKey,
      apiBaseUrl: "https://api-sandbox.doku.com",
      checkoutUrlHost: "sandbox.doku.com",
      notificationUrl,
      returnUrl: "https://shop.example/payment/return",
    },
    invoiceNumber: "INV-123",
    fetchImpl: async (_url, init) => {
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
    },
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

test("missing_server_credentials_fail_closed_without_exposing_secret", () => {
  withDokuEnvironment(
    {
      DOKU_CLIENT_ID: "MCH-test",
      DOKU_SECRET_KEY: secretKey,
      DOKU_NOTIFICATION_URL: "https://shop.example/api/payments/doku/notify",
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

test("doku_supabase_cron_recovers_expired_creating_attempts_without_failing_them", () => {
  const migrationPath = new URL(
    "../supabase/migrations/20261108120000_doku_checkout_safety_followups.sql",
    import.meta.url,
  );
  let migration = "";
  try {
    migration = readFileSync(migrationPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.doku_recover_creating_payment_attempts/i,
  );
  assert.match(migration, /payment_session_state\s*=\s*'creating'/i);
  assert.match(migration, /gateway_expires_at\s*<=\s*pg_catalog\.now\(\)/i);
  assert.match(migration, /SET payment_session_state\s*=\s*'uncertain'/i);

  const cronRoute = readFileSync(
    new URL("../app/api/cron/doku-reconcile/route.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    cronRoute.indexOf('"doku_recover_creating_payment_attempts"') <
      cronRoute.indexOf('"doku_list_reconciliation_candidates"'),
    "cron must recover stale attempts before selecting reconciliation candidates",
  );
});

test("admin_and_contradictory_webhook_migration_preserves_manual_review_only", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20261108120000_doku_checkout_safety_followups.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /p_order_status\s*=\s*'processing'[\s\S]{0,500}payment_status\s*<>\s*'paid'/i,
  );
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.doku_list_webhook_incidents/i,
  );
  assert.match(
    migration,
    /ORDER BY\s*\(event\.reviewed_at IS NOT NULL\),\s*event\.created_at DESC/is,
  );
  assert.match(migration, /OFFSET p_offset/i);
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.doku_mark_webhook_incident_reviewed/i,
  );
  assert.match(migration, /reviewed_by\s*=\s*auth\.uid\(\)/i);
  assert.match(migration, /outcome\s+IN\s*\([^)]*contradictory_success/is);
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.doku_list_webhook_incidents/i,
  );
});

test("doku_reconciliation_schedule_is_manual_supabase_cron_not_vercel_cron", () => {
  const vercelConfig = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  assert.equal(vercelConfig.crons, undefined);

  const runbook = readFileSync(
    new URL("../docs/doku-checkout.md", import.meta.url),
    "utf8",
  );
  assert.match(runbook, /Supabase Cron/i);
  assert.match(runbook, /\*\/15 \* \* \* \*/);
  assert.match(runbook, /manual/i);
  assert.match(runbook, /Vault|secret store/i);
  assert.match(runbook, /processes at most 1 reconciliation candidate/i);
});

test("doku_notification_amount_mismatch_is_recorded_without_marking_paid", () => {
  const route = readFileSync(
    new URL("../app/api/payments/doku/notify/route.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20261123100000_doku_incident_observations.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(route, /processingMessage\.includes\("doku_notification_amount_mismatch"\)/);
  assert.match(
    route,
    /p_reason_code:[\s\S]*?processingMessage\.includes\(\s*"doku_notification_amount_mismatch",?\s*\)[\s\S]*?\?\s*"amount_mismatch"/,
  );
  assert.match(
    migration,
    /IF v_payment\.order_id IS DISTINCT FROM v_order\.id\s+OR v_payment\.amount IS DISTINCT FROM p_amount\s+THEN\s+RAISE EXCEPTION USING ERRCODE = '22023',\s+MESSAGE = 'doku_notification_amount_mismatch';\s+END IF;/,
  );
  const mismatchGuard = migration.indexOf(
    "MESSAGE = 'doku_notification_amount_mismatch'",
  );
  const paidTransition = migration.indexOf(
    "SET payment_status = 'paid'",
    mismatchGuard,
  );
  assert.ok(mismatchGuard >= 0);
  assert.ok(paidTransition > mismatchGuard);
});

test("doku_payment_status_diagnostics_emit_only_safe_allowlisted_fields", () => {
  const originalConsoleError = console.error;
  const loggedLines = [];
  console.error = (...args) => {
    loggedLines.push(args.map(String).join(" "));
  };

  try {
    diagnosticModule.logDokuPaymentStatusDiagnostic({
      correlationId: "11111111-1111-4111-8111-111111111111",
      stage: "service_client_init_failed",
      category: "service_client_init_failed",
      httpStatus: 503,
      // Extra fields must never be serialized.
      secret: "should-not-appear",
    });
    diagnosticModule.logDokuPaymentStatusDiagnostic({
      correlationId: "not-a-uuid",
      stage: "service_client_init_failed",
      category: "service_client_init_failed",
      httpStatus: 503,
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(loggedLines.length, 1);
  const parsed = JSON.parse(loggedLines[0]);
  assert.deepEqual(parsed, {
    event: "doku.payment_status.diagnostic",
    correlationId: "11111111-1111-4111-8111-111111111111",
    stage: "service_client_init_failed",
    category: "service_client_init_failed",
    httpStatus: 503,
  });

  const statusRoute = readFileSync(
    new URL("../app/api/payments/doku/status/[orderId]/route.ts", import.meta.url),
    "utf8",
  );
  for (const category of [
    "auth_client_init_failed",
    "service_client_init_failed",
    "auth_verification_failed",
    "order_lookup_failed",
    "payment_status_rpc_failed",
    "doku_config_invalid",
    "payment_url_validation_failed",
    "payment_status_unexpected_error",
  ]) {
    assert.ok(
      statusRoute.includes(category),
      `Expected status route to log category ${category}`,
    );
  }
  assert.doesNotMatch(statusRoute, /console\.(log|error|warn)\(/);
});
