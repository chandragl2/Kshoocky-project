import AdminOrdersGuard from "@/components/admin/orders/AdminOrdersGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminOrdersGuard>{children}</AdminOrdersGuard>;
}
