import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type DokuTimestampHeader = "Request-Timestamp" | "Response-Timestamp";

export type DokuSignatureInput = {
  clientId: string;
  requestId: string;
  timestampHeader: DokuTimestampHeader;
  timestamp: string;
  requestTarget: string;
  body?: string;
  secretKey: string;
};

export type DokuVerificationInput = DokuSignatureInput & {
  expectedClientId: string;
  signature: string;
};

const UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export function isValidDokuTimestamp(timestamp: string, now = Date.now()) {
  if (!UTC_TIMESTAMP_PATTERN.test(timestamp)) return false;
  const timestampMs = Date.parse(timestamp);
  return (
    Number.isFinite(timestampMs) &&
    timestampMs <= now + MAX_FUTURE_SKEW_MS
  );
}

function bodyDigest(body: string) {
  return createHash("sha256").update(body, "utf8").digest("base64");
}

function signatureComponents(input: DokuSignatureInput) {
  if (!input.clientId || !input.requestId || !input.secretKey) {
    throw new Error("DOKU signature components are incomplete.");
  }
  if (!input.requestTarget.startsWith("/") || input.requestTarget.includes("#")) {
    throw new Error("DOKU request target must be an absolute path.");
  }
  if (!UTC_TIMESTAMP_PATTERN.test(input.timestamp)) {
    throw new Error("DOKU timestamp must be UTC ISO 8601.");
  }

  const lines = [
    `Client-Id:${input.clientId}`,
    `Request-Id:${input.requestId}`,
    `${input.timestampHeader}:${input.timestamp}`,
    `Request-Target:${input.requestTarget}`,
  ];
  const digest = input.body === undefined ? undefined : bodyDigest(input.body);
  if (digest !== undefined) lines.push(`Digest:${digest}`);
  return { canonical: lines.join("\n"), digest };
}

export function createDokuSignature(input: DokuSignatureInput) {
  const { canonical, digest } = signatureComponents(input);
  const signature =
    "HMACSHA256=" +
    createHmac("sha256", input.secretKey).update(canonical, "utf8").digest("base64");
  return digest === undefined ? { signature } : { signature, digest };
}

function decodeSignature(value: string) {
  const encoded = value.startsWith("HMACSHA256=")
    ? value.slice("HMACSHA256=".length)
    : "";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.toString("base64") !== encoded) return null;
  return decoded;
}

export function verifyDokuSignature(input: DokuVerificationInput) {
  if (
    input.clientId !== input.expectedClientId ||
    !isValidDokuTimestamp(input.timestamp)
  ) {
    return false;
  }

  const received = decodeSignature(input.signature);
  if (!received) return false;

  const expectedValue = createDokuSignature(input).signature;
  const expected = decodeSignature(expectedValue);
  return Boolean(
    expected &&
      expected.length === received.length &&
      timingSafeEqual(expected, received),
  );
}
