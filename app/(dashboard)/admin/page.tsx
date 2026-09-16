"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Tab = "shipments" | "products" | "orders";
type ShipmentStatus =
  | "SEOUL_WH"
  | "IN_TRANSIT"
  | "CUSTOMS"
  | "JAKARTA_WH"
  | "DELIVERED";
type PaymentStatus = "UNPAID" | "DP" | "PAID";
type ProductStatus = "PRE_ORDER" | "OUT_OF_STOCK";

type Order = {
  id: string;
  order_number: string;
  item_name?: string | null;
  quantity?: number | null;
  total_price?: number | null;
  payment_status?: PaymentStatus | null;
  profiles?: { full_name?: string | null } | null;
  products?: { title?: string | null } | null;
};

type Shipment = {
  id: string;
  order_id: string;
  tracking_number: string;
  current_status: ShipmentStatus;
  updated_at?: string | null;
  orders?: {
    order_number?: string | null;
    profiles?: { full_name?: string | null } | null;
  } | null;
};

type Product = {
  id: string;
  title: string;
  slug?: string | null;
  category?: string | null;
  price: number;
  image_url?: string | null;
  status: ProductStatus;
};

const supabase = createClient();
const shipmentStatuses: ShipmentStatus[] = [
  "SEOUL_WH",
  "IN_TRANSIT",
  "CUSTOMS",
  "JAKARTA_WH",
  "DELIVERED",
];
const paymentStatuses: PaymentStatus[] = ["UNPAID", "DP", "PAID"];
const productStatuses: ProductStatus[] = ["PRE_ORDER", "OUT_OF_STOCK"];
const tabs = [
  { id: "shipments" as const, label: "Logistik & Resi", icon: Truck },
  { id: "products" as const, label: "Katalog Pre-Order", icon: ShoppingBag },
  {
    id: "orders" as const,
    label: "Pembayaran & Order",
    icon: CircleDollarSign,
  },
];

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function displayName(name?: string | null) {
  return name?.trim() || "Nama belum tersedia";
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function Select({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm font-semibold text-[#0F3854] outline-none transition focus:border-[#E5B869] focus:ring-2 focus:ring-[#E5B869]/20"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-base font-extrabold text-[#0F3854]">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("shipments");
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [shipmentOrderId, setShipmentOrderId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [logShipmentId, setLogShipmentId] = useState("");
  const [logStatus, setLogStatus] = useState<ShipmentStatus>("IN_TRANSIT");
  const [logLocation, setLogLocation] = useState("");
  const [logDescription, setLogDescription] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    if (!isSupabaseConfigured) {
      setError(
        "Supabase belum dikonfigurasi. Tambahkan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di environment variables.",
      );
      setIsLoading(false);
      return;
    }
    const [ordersResult, shipmentsResult, productsResult] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_number, item_name, quantity, total_price, payment_status, profiles:user_id(full_name), products:product_id(title)",
        )
        .order("order_number", { ascending: false }),
      supabase
        .from("shipments")
        .select(
          "id, order_id, tracking_number, current_status, updated_at, orders(order_number, profiles:user_id(full_name))",
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("products")
        .select("id, title, slug, category, price, image_url, status")
        .order("title"),
    ]);

    const firstError =
      ordersResult.error || shipmentsResult.error || productsResult.error;
    if (firstError) setError(firstError.message);
    setOrders((ordersResult.data || []) as Order[]);
    setShipments((shipmentsResult.data || []) as Shipment[]);
    setProducts((productsResult.data || []) as Product[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("admin-dashboard-live-data")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => void loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shipments" },
        () => void loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => void loadData(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  function showResult(message: string) {
    setNotice(message);
    setError("");
    window.setTimeout(() => setNotice(""), 3500);
  }

  async function addShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shipmentOrderId || !trackingNumber.trim()) return;
    setIsSaving(true);
    const { error: insertError } = await supabase.from("shipments").insert({
      order_id: shipmentOrderId,
      tracking_number: trackingNumber.trim(),
      current_status: "SEOUL_WH",
    });
    setIsSaving(false);
    if (insertError) return setError(insertError.message);
    setShipmentOrderId("");
    setTrackingNumber("");
    showResult("Resi baru berhasil ditambahkan.");
    await loadData();
  }

  async function updateShipmentStatus(id: string, status: ShipmentStatus) {
    const { error: updateError } = await supabase
      .from("shipments")
      .update({ current_status: status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) return setError(updateError.message);
    setShipments((items) =>
      items.map((item) =>
        item.id === id ? { ...item, current_status: status } : item,
      ),
    );
    showResult("Status rute berhasil diperbarui.");
  }

  async function addShipmentLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!logShipmentId || !logLocation.trim() || !logDescription.trim()) return;
    setIsSaving(true);
    const { error: insertError } = await supabase.from("shipment_logs").insert({
      shipment_id: logShipmentId,
      status_title: logStatus,
      location: logLocation.trim(),
      description: logDescription.trim(),
      timestamp: new Date().toISOString(),
    });
    if (!insertError) {
      await supabase
        .from("shipments")
        .update({
          current_status: logStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", logShipmentId);
    }
    setIsSaving(false);
    if (insertError) return setError(insertError.message);
    setLogLocation("");
    setLogDescription("");
    showResult("Log perjalanan berhasil ditambahkan.");
    await loadData();
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productTitle.trim() || !productPrice || !productCategory.trim())
      return;
    setIsSaving(true);
    const slug = productTitle
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const { error: insertError } = await supabase.from("products").insert({
      title: productTitle.trim(),
      slug,
      category: productCategory.trim(),
      price: Number(productPrice),
      image_url: productImageUrl.trim() || null,
      status: "PRE_ORDER",
    });
    setIsSaving(false);
    if (insertError) return setError(insertError.message);
    setProductTitle("");
    setProductPrice("");
    setProductCategory("");
    setProductImageUrl("");
    showResult("Produk PO berhasil ditambahkan.");
    await loadData();
  }

  async function updateProductStatus(id: string, status: ProductStatus) {
    const { error: updateError } = await supabase
      .from("products")
      .update({ status })
      .eq("id", id);
    if (updateError) return setError(updateError.message);
    setProducts((items) =>
      items.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    showResult("Status produk berhasil diperbarui.");
  }

  async function updatePaymentStatus(id: string, paymentStatus: PaymentStatus) {
    const { error: updateError } = await supabase
      .from("orders")
      .update({ payment_status: paymentStatus })
      .eq("id", id);
    if (updateError) return setError(updateError.message);
    setOrders((items) =>
      items.map((item) =>
        item.id === id ? { ...item, payment_status: paymentStatus } : item,
      ),
    );
    showResult("Status pembayaran berhasil diperbarui.");
  }

  const filteredShipments = shipments.filter((item) =>
    `${item.tracking_number} ${item.orders?.order_number || ""} ${item.orders?.profiles?.full_name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredOrders = orders.filter((item) =>
    `${item.order_number} ${item.item_name || item.products?.title || ""} ${item.profiles?.full_name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] px-4 py-8 text-slate-700 sm:px-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#E5B869]">
              KSHOOCKY OPERATIONS
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0F3854] sm:text-4xl">
              Admin Control Room
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Kelola perjalanan paket, katalog PO, dan verifikasi pembayaran
              dari satu ruang kerja.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#0F3854] shadow-sm transition hover:border-[#E5B869]"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />{" "}
            Segarkan data
          </button>
        </header>

        {(error || notice) && (
          <div
            className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
          >
            {error ? (
              <AlertCircle className="h-5 w-5 shrink-0" />
            ) : (
              <Check className="h-5 w-5 shrink-0" />
            )}
            <span>{error || notice}</span>
          </div>
        )}

        <nav
          className="mb-8 grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-3"
          aria-label="Admin features"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold transition ${activeTab === id ? "bg-[#0F3854] text-white shadow-md" : "text-slate-500 hover:bg-slate-50 hover:text-[#0F3854]"}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        {activeTab === "shipments" && (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <SectionCard
                title="Input Resi Baru"
                description="Hubungkan nomor tracking ke order pelanggan."
              >
                <form onSubmit={addShipment} className="space-y-4">
                  <label className="block text-sm font-bold text-[#0F3854]">
                    Order ID
                    <Select
                      ariaLabel="Pilih order"
                      value={shipmentOrderId}
                      onChange={setShipmentOrderId}
                    >
                      <option value="">
                        Pilih order yang belum memiliki resi
                      </option>
                      {orders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.order_number} ·{" "}
                          {displayName(order.profiles?.full_name)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block text-sm font-bold text-[#0F3854]">
                    Nomor resi
                    <input
                      required
                      value={trackingNumber}
                      onChange={(event) =>
                        setTrackingNumber(event.target.value)
                      }
                      placeholder="KSH-88902"
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E5B869] focus:ring-2 focus:ring-[#E5B869]/20"
                    />
                  </label>
                  <button
                    disabled={isSaving || !shipmentOrderId}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#E5B869] px-4 py-2.5 text-sm font-extrabold text-[#0F3854] transition hover:bg-[#d9a852] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Tambah resi
                  </button>
                </form>
              </SectionCard>
              <SectionCard
                title="Tambah Log Perjalanan"
                description="Catat peristiwa terbaru agar pelanggan mendapat timeline yang jelas."
              >
                <form
                  onSubmit={addShipmentLog}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <label className="text-sm font-bold text-[#0F3854] sm:col-span-2">
                    Resi
                    <Select
                      ariaLabel="Pilih resi"
                      value={logShipmentId}
                      onChange={setLogShipmentId}
                    >
                      <option value="">Pilih nomor resi</option>
                      {shipments.map((shipment) => (
                        <option key={shipment.id} value={shipment.id}>
                          {shipment.tracking_number}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="text-sm font-bold text-[#0F3854]">
                    Status
                    <Select
                      ariaLabel="Pilih status log"
                      value={logStatus}
                      onChange={(value) =>
                        setLogStatus(value as ShipmentStatus)
                      }
                    >
                      {shipmentStatuses.map((status) => (
                        <option key={status}>{statusLabel(status)}</option>
                      ))}
                    </Select>
                  </label>
                  <label className="text-sm font-bold text-[#0F3854]">
                    Lokasi
                    <input
                      required
                      value={logLocation}
                      onChange={(event) => setLogLocation(event.target.value)}
                      placeholder="Bea Cukai Jakarta"
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E5B869]"
                    />
                  </label>
                  <label className="text-sm font-bold text-[#0F3854] sm:col-span-2">
                    Catatan perjalanan
                    <textarea
                      required
                      value={logDescription}
                      onChange={(event) =>
                        setLogDescription(event.target.value)
                      }
                      placeholder="Paket lolos pemeriksaan Bea Cukai"
                      rows={2}
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E5B869]"
                    />
                  </label>
                  <button
                    disabled={isSaving || !logShipmentId}
                    className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#0F3854] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#174e70] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ClipboardList className="h-4 w-4" /> Simpan log
                  </button>
                </form>
              </SectionCard>
            </div>
            <SectionCard
              title="Kelola Resi"
              description={`${shipments.length} resi terdaftar. Perubahan status tersimpan langsung ke database.`}
            >
              <div className="mb-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:max-w-sm">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari resi atau pelanggan"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                      <th className="pb-3 font-bold">Nomor resi</th>
                      <th className="pb-3 font-bold">Pelanggan</th>
                      <th className="pb-3 font-bold">Order</th>
                      <th className="pb-3 font-bold">Status rute</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShipments.map((shipment) => (
                      <tr
                        key={shipment.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-4 font-extrabold text-[#0F3854]">
                          {shipment.tracking_number}
                        </td>
                        <td className="py-4">
                          {displayName(shipment.orders?.profiles?.full_name)}
                        </td>
                        <td className="py-4 text-slate-500">
                          {shipment.orders?.order_number || shipment.order_id}
                        </td>
                        <td className="py-4">
                          <Select
                            ariaLabel={`Status ${shipment.tracking_number}`}
                            value={shipment.current_status}
                            onChange={(value) =>
                              void updateShipmentStatus(
                                shipment.id,
                                value as ShipmentStatus,
                              )
                            }
                          >
                            {shipmentStatuses.map((status) => (
                              <option key={status} value={status}>
                                {statusLabel(status)}
                              </option>
                            ))}
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!isLoading && !filteredShipments.length && (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Belum ada data resi yang cocok.
                  </p>
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === "products" && (
          <div className="space-y-6">
            <SectionCard
              title="Tambah Produk PO Baru"
              description="Publikasikan item baru ke katalog pre-order pelanggan."
            >
              <form
                onSubmit={addProduct}
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
              >
                <label className="text-sm font-bold text-[#0F3854] lg:col-span-2">
                  Judul produk
                  <input
                    required
                    value={productTitle}
                    onChange={(event) => setProductTitle(event.target.value)}
                    placeholder="Album K-Pop terbaru"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E5B869]"
                  />
                </label>
                <label className="text-sm font-bold text-[#0F3854]">
                  Harga (IDR)
                  <input
                    required
                    type="number"
                    min="0"
                    value={productPrice}
                    onChange={(event) => setProductPrice(event.target.value)}
                    placeholder="350000"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E5B869]"
                  />
                </label>
                <label className="text-sm font-bold text-[#0F3854]">
                  Kategori
                  <input
                    required
                    value={productCategory}
                    onChange={(event) => setProductCategory(event.target.value)}
                    placeholder="K-Pop"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E5B869]"
                  />
                </label>
                <label className="text-sm font-bold text-[#0F3854] md:col-span-2 lg:col-span-3">
                  URL gambar
                  <input
                    type="url"
                    value={productImageUrl}
                    onChange={(event) => setProductImageUrl(event.target.value)}
                    placeholder="https://..."
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E5B869]"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#E5B869] px-4 py-2.5 text-sm font-extrabold text-[#0F3854] transition hover:bg-[#d9a852] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Tambah produk
                  </button>
                </div>
              </form>
            </SectionCard>
            <SectionCard
              title="Daftar Produk PO"
              description={`${products.length} produk di katalog saat ini.`}
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {products.map((product) => (
                  <article
                    key={product.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <div
                      role="img"
                      aria-label={product.title}
                      className="flex aspect-[4/3] items-center justify-center bg-[#0F3854] bg-cover bg-center"
                      style={
                        product.image_url
                          ? { backgroundImage: `url(${product.image_url})` }
                          : undefined
                      }
                    >
                      {!product.image_url && (
                        <Package className="h-12 w-12 text-[#E5B869]" />
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#E5B869]">
                        {product.category || "Tanpa kategori"}
                      </p>
                      <h3 className="mt-1 min-h-10 font-extrabold text-[#0F3854]">
                        {product.title}
                      </h3>
                      <p className="mt-2 font-bold text-slate-700">
                        {formatCurrency(product.price)}
                      </p>
                      <div className="mt-4">
                        <Select
                          ariaLabel={`Status ${product.title}`}
                          value={product.status}
                          onChange={(value) =>
                            void updateProductStatus(
                              product.id,
                              value as ProductStatus,
                            )
                          }
                        >
                          {productStatuses.map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!isLoading && !products.length && (
                <p className="py-8 text-center text-sm text-slate-500">
                  Belum ada produk PO.
                </p>
              )}
            </SectionCard>
          </div>
        )}

        {activeTab === "orders" && (
          <SectionCard
            title="Daftar Pesanan Masuk"
            description="Verifikasi pembayaran pelanggan dan pantau total order secara realtime."
          >
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:max-w-sm">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari order atau pembeli"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <th className="pb-3 font-bold">Order number</th>
                    <th className="pb-3 font-bold">Pembeli</th>
                    <th className="pb-3 font-bold">Produk</th>
                    <th className="pb-3 font-bold">Total harga</th>
                    <th className="pb-3 font-bold">Pembayaran</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-4 font-extrabold text-[#0F3854]">
                        {order.order_number}
                      </td>
                      <td className="py-4">
                        {displayName(order.profiles?.full_name)}
                      </td>
                      <td className="py-4 text-slate-600">
                        {order.item_name ||
                          order.products?.title ||
                          "Produk tidak tersedia"}
                        {order.quantity ? (
                          <span className="ml-1 text-xs text-slate-400">
                            ×{order.quantity}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-4 font-bold text-[#0F3854]">
                        {formatCurrency(order.total_price)}
                      </td>
                      <td className="py-4">
                        <Select
                          ariaLabel={`Pembayaran ${order.order_number}`}
                          value={order.payment_status || "UNPAID"}
                          onChange={(value) =>
                            void updatePaymentStatus(
                              order.id,
                              value as PaymentStatus,
                            )
                          }
                        >
                          {paymentStatuses.map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isLoading && !filteredOrders.length && (
                <p className="py-8 text-center text-sm text-slate-500">
                  Belum ada order yang cocok.
                </p>
              )}
            </div>
          </SectionCard>
        )}
        {isLoading && (
          <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-[#0F3854] px-4 py-2.5 text-sm font-bold text-white shadow-xl">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data
          </div>
        )}
      </div>
    </div>
  );
}
