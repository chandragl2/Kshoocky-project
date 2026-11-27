export type DokuCheckoutRequest = {
  amount: number;
  invoiceNumber: string;
  body: string;
  expiresAt: string;
};

export function buildDokuCheckoutRequest({
  orderNumber,
  totalPrice,
  returnUrl,
  notificationUrl,
}: {
  orderNumber: string;
  totalPrice: number | string;
  returnUrl: string;
  notificationUrl: string;
}): DokuCheckoutRequest {
  const amount = Number(totalPrice);
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > 999_999_999_999
  ) {
    throw new Error("DOKU Checkout order amount is invalid.");
  }
  if (!orderNumber || orderNumber.length > 30) {
    throw new Error("DOKU Checkout invoice number is invalid.");
  }

  const body = JSON.stringify({
    order: {
      amount,
      invoice_number: orderNumber,
      currency: "IDR",
      callback_url: returnUrl,
      callback_url_result: returnUrl,
      auto_redirect: true,
    },
    payment: { payment_due_date: 60 },
    additional_info: { override_notification_url: notificationUrl },
  });

  return {
    amount,
    invoiceNumber: orderNumber,
    body,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}
