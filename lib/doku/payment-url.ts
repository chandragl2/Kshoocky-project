export function validateDokuPaymentUrl(value: unknown, expectedHost: string) {
  if (typeof value !== "string") {
    throw new Error("DOKU Checkout payment URL is missing.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DOKU Checkout payment URL is invalid.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== expectedHost ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/checkout-link-v2\/[A-Za-z0-9]+$/.test(url.pathname)
  ) {
    throw new Error("DOKU Checkout payment URL is not an allowed payment URL.");
  }
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getDokuPaymentUrlFromResponse(response: unknown) {
  if (
    !isRecord(response) ||
    typeof response.paymentUrl !== "string" ||
    typeof response.checkoutUrlHost !== "string"
  ) {
    throw new Error("DOKU payment response is missing its Checkout URL host.");
  }
  return validateDokuPaymentUrl(response.paymentUrl, response.checkoutUrlHost);
}
