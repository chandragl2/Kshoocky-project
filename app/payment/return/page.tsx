import { redirect } from "next/navigation";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function DokuPaymentReturnPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const orderId =
    typeof searchParams.orderId === "string" ? searchParams.orderId : null;
  if (!orderId || !uuidPattern.test(orderId)) {
    redirect("/user/orders");
  }
  redirect(`/user/orders/${encodeURIComponent(orderId)}?paymentReturn=1`);
}
