export type PaymentDetails = {
  orderPaymentStatus: string;
  paymentStatus: string;
  paymentSessionState: string | null;
  paymentExpiresAt: string | null;
  paymentUrl: string | null;
};

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseDokuPaymentDetails(value: unknown): PaymentDetails | null {
  if (!isUnknownRecord(value)) return null;
  const {
    orderPaymentStatus,
    paymentStatus,
    paymentSessionState,
    paymentExpiresAt,
    paymentUrl,
  } = value;
  if (
    typeof orderPaymentStatus !== "string" ||
    typeof paymentStatus !== "string" ||
    (typeof paymentSessionState !== "string" &&
      paymentSessionState !== null) ||
    (typeof paymentExpiresAt !== "string" && paymentExpiresAt !== null) ||
    (typeof paymentUrl !== "string" && paymentUrl !== null)
  ) {
    return null;
  }
  return {
    orderPaymentStatus,
    paymentStatus,
    paymentSessionState:
      typeof paymentSessionState === "string" ? paymentSessionState : null,
    paymentExpiresAt:
      typeof paymentExpiresAt === "string" ? paymentExpiresAt : null,
    paymentUrl: typeof paymentUrl === "string" ? paymentUrl : null,
  };
}

export function resolveDisplayedPaymentStatus(
  orderStatus: string,
  paymentDetails: PaymentDetails | null,
) {
  return paymentDetails?.orderPaymentStatus ?? orderStatus;
}
