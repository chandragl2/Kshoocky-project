"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  ImagePlus,
  Loader2,
  LockKeyhole,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Star,
  Truck,
  X,
} from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database, ProductStatus } from "@/lib/supabase/database";
import PreorderManager from "@/components/admin/PreorderManager";

type Tab = "shipments" | "products" | "orders" | "preorder" | "settings";
type ShipmentStatus =
  | "SEOUL_WH"
  | "IN_TRANSIT"
  | "CUSTOMS"
  | "JAKARTA_WH"
  | "DELIVERED";
type Order = {
  id: string;
  order_number: string;
  total_price?: number | null;
  payment_status?: string | null;
  profiles?: { full_name?: string | null } | null;
  order_items?: { product_title: string; quantity: number }[];
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

type Product = Database["public"]["Tables"]["products"]["Row"];
type ProductImage = Database["public"]["Tables"]["product_images"]["Row"];

const shipmentStatuses: ShipmentStatus[] = [
  "SEOUL_WH",
  "IN_TRANSIT",
  "CUSTOMS",
  "JAKARTA_WH",
  "DELIVERED",
];
const productStatuses: ProductStatus[] = ["active", "inactive", "out_of_stock"];
const productImageBucket = "product-images";
const allowedProductImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const maxProductImageSize = 5 * 1024 * 1024;
const maxProductImages = 5;
const tabs = [
  { id: "shipments" as const, label: "Logistik & Resi", icon: Truck },
  { id: "products" as const, label: "Katalog Pre-Order", icon: ShoppingBag },
  {
    id: "orders" as const,
    label: "Pembayaran & Order",
    icon: CircleDollarSign,
  },
  { id: "preorder" as const, label: "Event Preorder", icon: CalendarDays },
  { id: "settings" as const, label: "Settings", icon: LockKeyhole },
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

function paymentStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    pending: "Menunggu Pembayaran",
    paid: "Dibayar",
    failed: "Gagal",
    refunded: "Refund",
    UNPAID: "Belum Dibayar",
    DP: "Dibayar Sebagian",
    PAID: "Dibayar",
  };
  return status ? (labels[status] ?? statusLabel(status)) : "Tidak tersedia";
}

function Select({
  value,
  onChange,
  children,
  ariaLabel,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
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

class DuplicateProductSlugError extends Error {
  constructor() {
    super("duplicate-product-slug");
    this.name = "DuplicateProductSlugError";
  }
}

class ProductImagesUploadError extends Error {
  constructor(
    public readonly cleanupFailed: boolean,
    public readonly reason: "limit" | "upload" = "upload",
  ) {
    super("product-images-upload-failed");
    this.name = "ProductImagesUploadError";
  }
}

function productSlugBase(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "produk";
}

async function insertProductWithUniqueSlug(
  client: ReturnType<typeof createClient>,
  product: {
    title: string;
    description: string | null;
    category: string;
    price: number;
    stock: number;
    image_url: string | null;
    is_catalog: boolean;
    status: ProductStatus;
    is_featured: boolean;
  },
  title: string,
) {
  const baseSlug = productSlugBase(title);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await client.rpc("admin_create_product", {
      p_title: product.title,
      p_description: product.description,
      p_category: product.category,
      p_price: product.price,
      p_stock: product.stock,
      p_image_url: product.image_url,
      p_is_catalog: product.is_catalog,
      p_status: product.status,
      p_is_featured: product.is_featured,
      p_slug: slug,
    });
    if (!error) return data;
    if (error.code !== "23505") throw error;
  }
  throw new DuplicateProductSlugError();
}

function getProductStoragePath(
  client: ReturnType<typeof createClient>,
  productId: string,
  imageUrl: string,
) {
  try {
    const bucketRootUrl = new URL(
      client.storage.from(productImageBucket).getPublicUrl("").data.publicUrl,
    );
    const image = new URL(imageUrl);
    const rootPath = bucketRootUrl.pathname.endsWith("/")
      ? bucketRootUrl.pathname
      : `${bucketRootUrl.pathname}/`;
    if (
      image.origin !== bucketRootUrl.origin ||
      !image.pathname.startsWith(rootPath)
    ) {
      return null;
    }
    const path = decodeURIComponent(image.pathname.slice(rootPath.length));
    if (
      !path.startsWith(`products/${productId}/`) ||
      path.split("/").some((segment) => segment === "..")
    ) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

async function verifyAdmin(client: ReturnType<typeof createClient>) {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) return false;

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  return profile?.role === "admin";
}

export default function AdminPage() {
  const [supabase] = useState(() =>
    isSupabaseConfigured ? createClient() : null,
  );
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [selectedProductFiles, setSelectedProductFiles] = useState<File[]>([]);
  const [productPreviewUrls, setProductPreviewUrls] = useState<string[]>([]);
  const [productImageInputKey, setProductImageInputKey] = useState(0);
  const [busyProductImageId, setBusyProductImageId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
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
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productStock, setProductStock] = useState("0");
  const [productCategory, setProductCategory] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [productStatus, setProductStatus] = useState<ProductStatus>("active");
  const [productIsFeatured, setProductIsFeatured] = useState(false);
  const [isCatalog, setIsCatalog] = useState(true);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    if (!supabase) {
      setIsAdmin(false);
      setError(
        "Supabase belum dikonfigurasi. Tambahkan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di environment variables.",
      );
      setIsLoading(false);
      return;
    }
    try {
      const admin = await verifyAdmin(supabase);
      setIsAdmin(admin);
      if (!admin) {
        setOrders([]);
        setShipments([]);
        setProducts([]);
        return;
      }

      const [ordersResult, shipmentsResult, productsResult] = await Promise.all(
        [
          supabase
            .from("orders")
            .select(
              "id, order_number, total_price, payment_status, profiles:user_id(full_name), order_items(product_title, quantity)",
            )
            .order("order_number", { ascending: false }),
          supabase
            .from("shipments")
            .select(
              "id, order_id, tracking_number, current_status, updated_at, orders(order_number, profiles:user_id(full_name))",
            )
            .order("updated_at", { ascending: false }),
          supabase.from("products").select("*").order("title"),
        ],
      );

      const firstError =
        ordersResult.error || shipmentsResult.error || productsResult.error;
      if (firstError) setError(firstError.message);
      setOrders((ordersResult.data || []) as Order[]);
      setShipments((shipmentsResult.data || []) as Shipment[]);
      const loadedProducts = productsResult.error
        ? []
        : (productsResult.data ?? []);
      setProducts(loadedProducts);

      if (productsResult.error || loadedProducts.length === 0) {
        setProductImages([]);
      } else {
        const { data: imageRows, error: imagesError } = await supabase
          .from("product_images")
          .select("*")
          .in(
            "product_id",
            loadedProducts.map((product) => product.id),
          )
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });
        if (imagesError) {
          setProductImages([]);
          setError("Galeri foto produk gagal dimuat.");
        } else {
          const loadedImages = imageRows ?? [];
          const imageGroups = new Map<string, ProductImage[]>();
          for (const image of loadedImages) {
            const group = imageGroups.get(image.product_id) ?? [];
            group.push(image);
            imageGroups.set(image.product_id, group);
          }

          const primaryFallbackIds = new Set<string>();
          for (const group of Array.from(imageGroups.values())) {
            if (!group.some((image) => image.is_primary) && group[0]) {
              const { error: primaryError } = await supabase.rpc(
                "admin_set_primary_product_image",
                {
                  p_product_id: group[0].product_id,
                  p_image_id: group[0].id,
                },
              );
              if (!primaryError) primaryFallbackIds.add(group[0].id);
            }
          }

          setProductImages(
            loadedImages.map((image) =>
              primaryFallbackIds.has(image.id)
                ? { ...image, is_primary: true }
                : image,
            ),
          );
        }
      }
    } catch {
      setIsAdmin(false);
      setError("Data admin gagal dimuat. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
    if (!supabase) return;
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_images" },
        () => void loadData(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  useEffect(() => {
    const previewUrls = selectedProductFiles.map((file) =>
      URL.createObjectURL(file),
    );
    setProductPreviewUrls(previewUrls);
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [selectedProductFiles]);

  function showResult(message: string) {
    setNotice(message);
    setError("");
    window.setTimeout(() => setNotice(""), 3500);
  }

  async function changeAdminPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return setError("Supabase belum dikonfigurasi.");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("Semua kolom password wajib diisi.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Konfirmasi password baru tidak cocok.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("Password baru harus berbeda dari password saat ini.");
      return;
    }

    setIsChangingPassword(true);
    setError("");
    setNotice("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.email) {
        throw userError ?? new Error("Admin session tidak ditemukan.");
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (reauthError) {
        setError("Password saat ini salah.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      showResult("Password admin berhasil diubah.");
    } catch {
      setError("Password gagal diubah. Silakan coba lagi.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function addShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shipmentOrderId || !trackingNumber.trim()) return;
    if (!supabase) return setError("Supabase belum dikonfigurasi.");
    setIsSaving(true);
    setError("");
    try {
      const admin = await verifyAdmin(supabase);
      if (!admin) {
        setIsAdmin(false);
        setError("Halaman ini hanya dapat diakses oleh admin.");
        return;
      }
      const { error: insertError } = await supabase.from("shipments").insert({
        order_id: shipmentOrderId,
        tracking_number: trackingNumber.trim(),
        current_status: "SEOUL_WH",
      });
      if (insertError) throw insertError;
      setShipmentOrderId("");
      setTrackingNumber("");
      showResult("Resi baru berhasil ditambahkan.");
      await loadData();
    } catch {
      setError("Resi gagal ditambahkan. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateShipmentStatus(id: string, status: ShipmentStatus) {
    if (!supabase) return setError("Supabase belum dikonfigurasi.");
    setError("");
    try {
      const admin = await verifyAdmin(supabase);
      if (!admin) {
        setIsAdmin(false);
        setError("Halaman ini hanya dapat diakses oleh admin.");
        return;
      }
      const { error: updateError } = await supabase
        .from("shipments")
        .update({
          current_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (updateError) throw updateError;
      setShipments((items) =>
        items.map((item) =>
          item.id === id ? { ...item, current_status: status } : item,
        ),
      );
      showResult("Status rute berhasil diperbarui.");
    } catch {
      setError("Status rute gagal diperbarui. Silakan coba lagi.");
    }
  }

  async function addShipmentLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!logShipmentId || !logLocation.trim() || !logDescription.trim()) return;
    if (!supabase) return setError("Supabase belum dikonfigurasi.");
    setIsSaving(true);
    setError("");
    try {
      const admin = await verifyAdmin(supabase);
      if (!admin) {
        setIsAdmin(false);
        setError("Halaman ini hanya dapat diakses oleh admin.");
        return;
      }
      const { error: insertError } = await supabase
        .from("shipment_logs")
        .insert({
          shipment_id: logShipmentId,
          status_title: logStatus,
          location: logLocation.trim(),
          description: logDescription.trim(),
        });
      if (insertError) throw insertError;
      const { error: shipmentError } = await supabase
        .from("shipments")
        .update({
          current_status: logStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", logShipmentId);
      if (shipmentError) throw shipmentError;
      setLogLocation("");
      setLogDescription("");
      showResult("Log perjalanan berhasil ditambahkan.");
      await loadData();
    } catch {
      setError("Log perjalanan gagal ditambahkan. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  function resetProductForm() {
    setEditingProductId(null);
    setProductTitle("");
    setProductDescription("");
    setProductPrice("");
    setProductStock("0");
    setProductCategory("");
    setProductImageUrl("");
    setProductStatus("active");
    setProductIsFeatured(false);
    setIsCatalog(true);
    setSelectedProductFiles([]);
    setProductImageInputKey((key) => key + 1);
  }

  function startProductEdit(product: Product) {
    setEditingProductId(product.id);
    setProductTitle(product.title);
    setProductDescription(product.description ?? "");
    setProductPrice(String(product.price));
    setProductStock(String(product.stock));
    setProductCategory(product.category ?? "");
    setProductImageUrl(product.image_url ?? "");
    setProductStatus(product.status);
    setProductIsFeatured(product.is_featured);
    setIsCatalog(product.is_catalog);
    setSelectedProductFiles([]);
    setProductImageInputKey((key) => key + 1);
    setError("");
    setNotice("");
  }

  function productImagesFor(productId: string) {
    return productImages
      .filter((image) => image.product_id === productId)
      .sort(
        (left, right) =>
          left.sort_order - right.sort_order ||
          left.created_at.localeCompare(right.created_at),
      );
  }

  function selectProductImageFiles(fileList: FileList | null) {
    setError("");
    setNotice("");
    const incomingFiles = Array.from(fileList ?? []);
    if (!incomingFiles.length) return;

    const currentProduct = editingProductId
      ? products.find((product) => product.id === editingProductId)
      : undefined;
    const existingImages = editingProductId
      ? productImagesFor(editingProductId)
      : [];
    const legacyImageCount =
      editingProductId &&
      existingImages.length === 0 &&
      currentProduct?.image_url
        ? 1
        : 0;
    const totalCount =
      existingImages.length +
      legacyImageCount +
      selectedProductFiles.length +
      incomingFiles.length;
    if (totalCount > maxProductImages) {
      setError("Maksimal 5 foto per produk.");
      setProductImageInputKey((key) => key + 1);
      return;
    }

    const invalidType = incomingFiles.find(
      (file) => !allowedProductImageTypes[file.type],
    );
    if (invalidType) {
      setError("Format foto harus JPG, PNG, atau WebP.");
      setProductImageInputKey((key) => key + 1);
      return;
    }
    if (incomingFiles.some((file) => file.size > maxProductImageSize)) {
      setError("Ukuran maksimal setiap foto adalah 5 MB.");
      setProductImageInputKey((key) => key + 1);
      return;
    }

    setSelectedProductFiles((files) => [...files, ...incomingFiles]);
    setProductImageInputKey((key) => key + 1);
  }

  function removePendingProductImage(index: number) {
    setSelectedProductFiles((files) => files.filter((_, i) => i !== index));
  }

  async function uploadProductImages(productId: string, files: File[]) {
    if (!supabase || files.length === 0) return;
    const admin = await verifyAdmin(supabase);
    if (!admin) {
      setIsAdmin(false);
      throw new Error("unauthorized");
    }

    const existingImages = productImagesFor(productId);
    const product = products.find((item) => item.id === productId);
    const existingCount =
      existingImages.length === 0 && product?.image_url
        ? 1
        : existingImages.length;
    if (existingCount + files.length > maxProductImages) {
      throw new ProductImagesUploadError(false, "limit");
    }

    const uploadedPaths: string[] = [];
    const insertedIds: string[] = [];
    const hasPrimary = existingImages.some((image) => image.is_primary);
    let nextSortOrder =
      existingImages.reduce(
        (maximum, image) => Math.max(maximum, image.sort_order),
        -1,
      ) + 1;

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const extension = allowedProductImageTypes[file.type];
        if (!extension || file.size > maxProductImageSize) {
          throw new Error("invalid-file");
        }
        const path = `products/${productId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(productImageBucket)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);

        const { data: imageId, error: insertError } = await supabase.rpc(
          "admin_add_product_image",
          {
            p_product_id: productId,
            p_image_url: supabase.storage
              .from(productImageBucket)
              .getPublicUrl(path).data.publicUrl,
            p_is_primary: !hasPrimary && index === 0,
            p_sort_order: nextSortOrder,
          },
        );
        if (insertError) throw insertError;
        insertedIds.push(imageId);
        nextSortOrder += 1;
      }
    } catch {
      let cleanupFailed = false;
      if (insertedIds.length > 0) {
        const cleanupResults = await Promise.all(
          insertedIds.map((imageId) =>
            supabase.rpc("admin_delete_product_image", {
              p_product_id: productId,
              p_image_id: imageId,
            }),
          ),
        );
        cleanupFailed = cleanupResults.some((result) => result.error);
      }
      if (!cleanupFailed && uploadedPaths.length > 0) {
        const { error: filesCleanupError } = await supabase.storage
          .from(productImageBucket)
          .remove(uploadedPaths);
        cleanupFailed = Boolean(filesCleanupError);
      }
      if (cleanupFailed && process.env.NODE_ENV === "development") {
        console.error("[Admin Catalog] Product image rollback was incomplete.");
      }
      throw new ProductImagesUploadError(cleanupFailed);
    }
  }

  async function applyPrimaryProductImage(productId: string, imageId: string) {
    if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
    const previousPrimary = productImagesFor(productId).find(
      (image) => image.is_primary,
    );
    if (previousPrimary?.id === imageId) return;

    const { error: primaryError } = await supabase.rpc(
      "admin_set_primary_product_image",
      { p_product_id: productId, p_image_id: imageId },
    );
    if (primaryError) throw primaryError;

    setProductImages((images) =>
      images.map((image) =>
        image.product_id === productId
          ? { ...image, is_primary: image.id === imageId }
          : image,
      ),
    );
  }

  async function setPrimaryProductImage(image: ProductImage) {
    if (!supabase || busyProductImageId || isSaving) return;
    setBusyProductImageId(image.id);
    setError("");
    setNotice("");
    try {
      const admin = await verifyAdmin(supabase);
      if (!admin) {
        setIsAdmin(false);
        setError("Halaman ini hanya dapat diakses oleh admin.");
        return;
      }
      await applyPrimaryProductImage(image.product_id, image.id);
      showResult("Foto utama berhasil diperbarui.");
    } catch {
      setError("Foto utama gagal diperbarui. Silakan coba lagi.");
    } finally {
      setBusyProductImageId(null);
    }
  }

  async function deleteProductImage(image: ProductImage) {
    if (!supabase || busyProductImageId || isSaving) return;
    if (!window.confirm("Hapus foto ini dari gallery produk?")) return;

    setBusyProductImageId(image.id);
    setError("");
    setNotice("");
    try {
      const admin = await verifyAdmin(supabase);
      if (!admin) {
        setIsAdmin(false);
        setError("Halaman ini hanya dapat diakses oleh admin.");
        return;
      }

      const storagePath = getProductStoragePath(
        supabase,
        image.product_id,
        image.image_url,
      );
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from(productImageBucket)
          .remove([storagePath]);
        if (storageError) {
          setError(
            "File foto gagal dihapus dari Storage; data gallery tetap aman.",
          );
          return;
        }
      }

      const { data, error: recordError } = await supabase.rpc(
        "admin_delete_product_image",
        { p_product_id: image.product_id, p_image_id: image.id },
      );
      if (recordError || !data) {
        setError(
          storagePath
            ? "File foto terhapus, tetapi record gallery gagal dihapus. Segarkan data sebelum mencoba lagi."
            : "Record foto gagal dihapus dari gallery.",
        );
        return;
      }

      const remainingImages = productImagesFor(image.product_id).filter(
        (item) => item.id !== image.id,
      );
      setProductImages((items) => items.filter((item) => item.id !== image.id));
      if (image.is_primary && remainingImages.length > 0) {
        try {
          await applyPrimaryProductImage(
            image.product_id,
            remainingImages[0].id,
          );
        } catch {
          setError(
            "Foto terhapus, tetapi foto utama pengganti gagal ditetapkan. Silakan pilih foto utama kembali.",
          );
          return;
        }
      }
      showResult("Foto produk berhasil dihapus.");
    } catch {
      setError("Foto gagal dihapus. Silakan coba lagi.");
    } finally {
      setBusyProductImageId(null);
    }
  }

  async function moveProductImage(image: ProductImage, direction: -1 | 1) {
    if (!supabase || busyProductImageId || isSaving) return;
    const orderedImages = productImagesFor(image.product_id);
    const currentIndex = orderedImages.findIndex(
      (item) => item.id === image.id,
    );
    const targetIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= orderedImages.length
    ) {
      return;
    }
    const current = orderedImages[currentIndex];
    const target = orderedImages[targetIndex];

    setBusyProductImageId(image.id);
    setError("");
    setNotice("");
    try {
      const admin = await verifyAdmin(supabase);
      if (!admin) {
        setIsAdmin(false);
        setError("Halaman ini hanya dapat diakses oleh admin.");
        return;
      }
      const [currentResult, targetResult] = await Promise.all([
        supabase.rpc("admin_update_product_image_sort_order", {
          p_product_id: image.product_id,
          p_image_id: current.id,
          p_sort_order: target.sort_order,
        }),
        supabase.rpc("admin_update_product_image_sort_order", {
          p_product_id: image.product_id,
          p_image_id: target.id,
          p_sort_order: current.sort_order,
        }),
      ]);
      if (currentResult.error || targetResult.error) {
        await loadData();
        throw new Error("sort-update");
      }
      setProductImages((items) =>
        items.map((item) => {
          if (item.id === current.id) {
            return { ...item, sort_order: target.sort_order };
          }
          if (item.id === target.id) {
            return { ...item, sort_order: current.sort_order };
          }
          return item;
        }),
      );
      showResult("Urutan foto berhasil diperbarui.");
    } catch {
      setError("Urutan foto gagal diperbarui. Silakan coba lagi.");
    } finally {
      setBusyProductImageId(null);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = productTitle.trim();
    const category = productCategory.trim();
    const price = Number(productPrice);
    const stock = Number(productStock);
    if (!title) return setError("Judul produk wajib diisi.");
    if (!category) return setError("Kategori produk wajib diisi.");
    if (!productPrice.trim() || !Number.isFinite(price) || price < 0) {
      return setError("Harga harus berupa angka nol atau lebih.");
    }
    if (!productStock.trim() || !Number.isInteger(stock) || stock < 0) {
      return setError("Stok harus berupa bilangan bulat nol atau lebih.");
    }
    if (!supabase) return setError("Supabase belum dikonfigurasi.");
    if (isSaving) return;

    setIsSaving(true);
    setError("");
    setNotice("");
    const hasNewPhotos = selectedProductFiles.length > 0;
    let savedProductId: string | null = editingProductId;
    let createdProduct = false;
    try {
      const admin = await verifyAdmin(supabase);
      if (!admin) {
        setIsAdmin(false);
        setError("Halaman ini hanya dapat diakses oleh admin.");
        return;
      }

      const values = {
        title,
        description: productDescription.trim() || null,
        category,
        price,
        stock,
        image_url: productImageUrl.trim() || null,
        is_catalog: isCatalog,
        status: productStatus,
        is_featured: productIsFeatured,
      };

      if (editingProductId) {
        const { data, error: updateError } = await supabase.rpc(
          "admin_update_product",
          {
            p_product_id: editingProductId,
            p_title: values.title,
            p_description: values.description,
            p_category: values.category,
            p_price: values.price,
            p_stock: values.stock,
            p_image_url: values.image_url,
            p_is_catalog: values.is_catalog,
            p_status: values.status,
            p_is_featured: values.is_featured,
          },
        );
        if (updateError) throw updateError;
        if (!data) throw new Error("product-not-found");
      } else {
        savedProductId = await insertProductWithUniqueSlug(
          supabase,
          values,
          title,
        );
        createdProduct = true;
        setEditingProductId(savedProductId);
      }

      if (savedProductId && selectedProductFiles.length > 0) {
        await uploadProductImages(savedProductId, selectedProductFiles);
      }

      resetProductForm();
      await loadData();
      showResult(
        createdProduct
          ? hasNewPhotos
            ? "Produk dan foto berhasil ditambahkan."
            : "Produk berhasil ditambahkan."
          : hasNewPhotos
            ? "Produk dan foto berhasil diperbarui."
            : "Produk berhasil diperbarui.",
      );
    } catch (saveError) {
      if (saveError instanceof ProductImagesUploadError) {
        if (savedProductId) {
          setEditingProductId(savedProductId);
          await loadData();
        }
        if (saveError.reason === "limit") {
          setError("Foto produk sudah mencapai batas maksimal 5 foto.");
        } else {
          setError(
            saveError.cleanupFailed
              ? "Upload foto gagal dan sebagian file sementara tidak dapat dibersihkan. Produk tetap tersimpan; periksa gallery sebelum mencoba lagi."
              : "Upload foto gagal. Produk tetap tersimpan dan file pilihan masih tersedia untuk dicoba kembali.",
          );
        }
      } else if (saveError instanceof DuplicateProductSlugError) {
        setError(
          "Slug produk tidak dapat dibuat unik. Ubah judul lalu coba lagi.",
        );
      } else if (
        typeof saveError === "object" &&
        saveError !== null &&
        "code" in saveError &&
        saveError.code === "23505"
      ) {
        setError("Produk dengan slug yang sama sudah ada. Coba judul lain.");
      } else {
        setError("Produk gagal disimpan. Periksa data lalu coba lagi.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function updateProductStatus(id: string, status: ProductStatus) {
    if (!supabase || isSaving || busyProductId) return;
    setBusyProductId(id);
    setError("");
    setNotice("");
    try {
      const admin = await verifyAdmin(supabase);
      if (!admin) {
        setIsAdmin(false);
        setError("Halaman ini hanya dapat diakses oleh admin.");
        return;
      }
      const { data, error: updateError } = await supabase.rpc(
        "admin_update_product_status",
        { p_product_id: id, p_status: status },
      );
      if (updateError || !data) throw new Error("status-update");
      setProducts((items) =>
        items.map((item) => (item.id === id ? { ...item, status } : item)),
      );
      showResult("Status produk berhasil diperbarui.");
    } catch {
      setError("Status produk gagal diperbarui. Silakan coba lagi.");
    } finally {
      setBusyProductId(null);
    }
  }

  async function deleteProduct(product: Product) {
    if (
      !window.confirm(
        `Hapus produk "${product.title}"? Produk yang sedang dipakai oleh data lain tidak akan dihapus otomatis.`,
      )
    ) {
      return;
    }
    if (!supabase || isSaving || busyProductId) return;

    setBusyProductId(product.id);
    setError("");
    setNotice("");
    try {
      const admin = await verifyAdmin(supabase);
      if (!admin) {
        setIsAdmin(false);
        setError("Halaman ini hanya dapat diakses oleh admin.");
        return;
      }
      const { data, error: deleteError } = await supabase.rpc(
        "admin_delete_product",
        { p_product_id: product.id },
      );
      if (deleteError?.code === "23503") {
        setError(
          "Produk tidak dapat dihapus karena masih digunakan pada data lain.",
        );
        return;
      }
      if (deleteError) throw deleteError;
      if (!data) throw new Error("product-not-found");
      if (editingProductId === product.id) resetProductForm();
      showResult("Produk berhasil dihapus.");
      await loadData();
    } catch {
      setError("Produk gagal dihapus. Silakan coba lagi.");
    } finally {
      setBusyProductId(null);
    }
  }

  const filteredShipments = shipments.filter((item) =>
    `${item.tracking_number} ${item.orders?.order_number || ""} ${item.orders?.profiles?.full_name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredOrders = orders.filter((item) =>
    `${item.order_number} ${item.order_items?.map((orderItem) => orderItem.product_title).join(" ") || ""} ${item.profiles?.full_name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const editingProduct = products.find(
    (product) => product.id === editingProductId,
  );
  const editingProductImages = editingProductId
    ? productImagesFor(editingProductId)
    : [];
  const legacyEditingImage =
    editingProductImages.length === 0 ? editingProduct?.image_url : null;
  const editingPhotoCount =
    editingProductImages.length +
    (legacyEditingImage ? 1 : 0) +
    selectedProductFiles.length;

  function mainProductImage(product: Product) {
    const images = productImagesFor(product.id);
    return (
      images.find((image) => image.is_primary)?.image_url ??
      images[0]?.image_url ??
      product.image_url
    );
  }

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
              Kelola katalog PO dan verifikasi pembayaran dari satu ruang kerja.
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
          className="mb-8 grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Admin features"
        >
          {tabs
            .filter(({ id }) => id !== "shipments")
            .map(({ id, label, icon: Icon }) => (
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

        {activeTab === "settings" && (
          <div className="space-y-6">
            <SectionCard
              title="Keamanan Akun Admin"
              description="Kelola keamanan akun admin dan ubah password akun."
            >
              <form onSubmit={changeAdminPassword} className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-[#0F3854]">
                  Password saat ini
                  <input
                    required
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Masukkan password saat ini"
                    disabled={isChangingPassword}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium outline-none transition focus:border-[#E5B869] focus:ring-2 focus:ring-[#E5B869]/20 disabled:opacity-60"
                  />
                </label>

                <div className="hidden sm:block" aria-hidden="true" />

                <label className="text-sm font-bold text-[#0F3854]">
                  Password baru
                  <input
                    required
                    minLength={8}
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Minimal 8 karakter"
                    disabled={isChangingPassword}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium outline-none transition focus:border-[#E5B869] focus:ring-2 focus:ring-[#E5B869]/20 disabled:opacity-60"
                  />
                </label>

                <label className="text-sm font-bold text-[#0F3854]">
                  Konfirmasi password baru
                  <input
                    required
                    minLength={8}
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Ulangi password baru"
                    disabled={isChangingPassword}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium outline-none transition focus:border-[#E5B869] focus:ring-2 focus:ring-[#E5B869]/20 disabled:opacity-60"
                  />
                </label>

                <div className="flex items-end sm:col-span-2">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0F3854] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#174e70] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isChangingPassword ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LockKeyhole className="h-4 w-4" />
                    )}
                    {isChangingPassword ? "Mengubah..." : "Change Password"}
                  </button>
                </div>
              </form>
            </SectionCard>
          </div>
        )}

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

        {activeTab === "products" &&
          (isAdmin === false ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              Halaman ini hanya dapat diakses oleh admin.
            </div>
          ) : (
            <div className="space-y-6">
              <SectionCard
                title={
                  editingProductId ? "Edit Produk" : "Tambah Produk PO Baru"
                }
                description={
                  editingProductId
                    ? "Perbarui informasi produk tanpa mengubah slug yang sudah digunakan."
                    : "Publikasikan item baru ke katalog pre-order pelanggan."
                }
              >
                <form
                  onSubmit={(event) => void saveProduct(event)}
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
                      disabled={isSaving}
                    />
                  </label>
                  <label className="text-sm font-bold text-[#0F3854] md:col-span-2 lg:col-span-4">
                    Deskripsi
                    <textarea
                      rows={3}
                      value={productDescription}
                      onChange={(event) =>
                        setProductDescription(event.target.value)
                      }
                      placeholder="Deskripsi produk (opsional)"
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E5B869]"
                      disabled={isSaving}
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
                      step="any"
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E5B869]"
                      disabled={isSaving}
                    />
                  </label>
                  <label className="text-sm font-bold text-[#0F3854]">
                    Stock
                    <input
                      required
                      type="number"
                      min="0"
                      step="1"
                      value={productStock}
                      onChange={(event) => setProductStock(event.target.value)}
                      placeholder="0"
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E5B869]"
                      disabled={isSaving}
                    />
                  </label>
                  <label className="text-sm font-bold text-[#0F3854]">
                    Kategori
                    <input
                      required
                      value={productCategory}
                      onChange={(event) =>
                        setProductCategory(event.target.value)
                      }
                      placeholder="K-Pop"
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E5B869]"
                      disabled={isSaving}
                    />
                  </label>
                  <label className="text-sm font-bold text-[#0F3854] md:col-span-2 lg:col-span-3">
                    URL gambar
                    <input
                      type="url"
                      value={productImageUrl}
                      onChange={(event) =>
                        setProductImageUrl(event.target.value)
                      }
                      placeholder="https://..."
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#E5B869]"
                      disabled={isSaving}
                    />
                  </label>
                  <section className="space-y-3 rounded-lg border border-slate-200 p-4 md:col-span-2 lg:col-span-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-extrabold text-[#0F3854]">
                          Foto Produk
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Pilih JPG, PNG, atau WebP. Maksimal 5 MB per foto.
                          Upload dilakukan saat produk disimpan.
                        </p>
                      </div>
                      <span className="text-xs font-bold text-slate-500">
                        {editingPhotoCount}/{maxProductImages} foto
                      </span>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-[#0F3854] transition hover:bg-slate-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                      <ImagePlus className="h-4 w-4" />
                      Tambah Foto
                      <input
                        key={productImageInputKey}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          selectProductImageFiles(event.target.files)
                        }
                        className="sr-only"
                        disabled={
                          isSaving || editingPhotoCount >= maxProductImages
                        }
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {legacyEditingImage && (
                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <div className="relative aspect-square bg-slate-100">
                            <Image
                              src={legacyEditingImage}
                              alt="Foto produk lama"
                              fill
                              unoptimized
                              sizes="160px"
                              className="object-cover"
                            />
                          </div>
                          <p className="px-2 py-1.5 text-[11px] font-semibold text-slate-500">
                            Foto lama
                          </p>
                        </div>
                      )}
                      {editingProductImages.map((image) => (
                        <div
                          key={image.id}
                          className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                        >
                          <div className="relative aspect-square bg-slate-100">
                            <Image
                              src={image.image_url}
                              alt="Foto produk"
                              fill
                              unoptimized
                              sizes="160px"
                              className="object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => void setPrimaryProductImage(image)}
                              disabled={isSaving || busyProductImageId !== null}
                              aria-label={
                                image.is_primary
                                  ? "Foto utama produk"
                                  : "Jadikan foto utama"
                              }
                              className={`absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full shadow-sm disabled:opacity-60 ${image.is_primary ? "bg-[#E5B869] text-[#0F3854]" : "bg-white/95 text-slate-500 hover:text-[#0F3854]"}`}
                            >
                              {busyProductImageId === image.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Star
                                  className="h-4 w-4"
                                  fill={
                                    image.is_primary ? "currentColor" : "none"
                                  }
                                />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteProductImage(image)}
                              disabled={isSaving || busyProductImageId !== null}
                              aria-label="Hapus foto produk"
                              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-60"
                            >
                              {busyProductImageId === image.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <p className="px-2 py-1.5 text-[11px] font-semibold text-slate-500">
                            {image.is_primary
                              ? "Foto utama"
                              : `Urutan ${image.sort_order + 1}`}
                          </p>
                        </div>
                      ))}
                      {selectedProductFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${file.lastModified}-${index}`}
                          className="overflow-hidden rounded-lg border border-dashed border-[#3c8aba] bg-[#f3f9fc]"
                        >
                          <div className="relative aspect-square">
                            {productPreviewUrls[index] && (
                              <Image
                                src={productPreviewUrls[index]}
                                alt={`Preview ${file.name}`}
                                fill
                                unoptimized
                                sizes="160px"
                                className="object-cover"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => removePendingProductImage(index)}
                              disabled={isSaving}
                              aria-label={`Batalkan ${file.name}`}
                              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-60"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-[#0F3854]">
                            Belum diupload
                          </p>
                        </div>
                      ))}
                      {editingProductImages.length === 0 &&
                        !legacyEditingImage &&
                        selectedProductFiles.length === 0 && (
                          <p className="col-span-full py-4 text-sm text-slate-400">
                            Belum ada foto produk.
                          </p>
                        )}
                    </div>
                  </section>
                  <label className="text-sm font-bold text-[#0F3854]">
                    Status
                    <Select
                      ariaLabel="Status produk"
                      value={productStatus}
                      onChange={(value) =>
                        setProductStatus(value as ProductStatus)
                      }
                      disabled={isSaving}
                    >
                      {productStatuses.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold text-[#0F3854]">
                    <input
                      type="checkbox"
                      checked={isCatalog}
                      onChange={(event) => setIsCatalog(event.target.checked)}
                      className="h-4 w-4 accent-[#0F3854]"
                      disabled={isSaving}
                    />
                    Tampilkan di Katalog
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold text-[#0F3854]">
                    <input
                      type="checkbox"
                      checked={productIsFeatured}
                      onChange={(event) =>
                        setProductIsFeatured(event.target.checked)
                      }
                      className="h-4 w-4 accent-[#0F3854]"
                      disabled={isSaving}
                    />
                    Featured
                  </label>
                  <div className="flex items-end gap-2">
                    <button
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#E5B869] px-4 py-2.5 text-sm font-extrabold text-[#0F3854] transition hover:bg-[#d9a852] disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : editingProductId ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {isSaving
                        ? "Menyimpan..."
                        : editingProductId
                          ? "Simpan perubahan"
                          : "Tambah produk"}
                    </button>
                    {editingProductId && (
                      <button
                        type="button"
                        onClick={resetProductForm}
                        disabled={isSaving}
                        className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Batal
                      </button>
                    )}
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
                          mainProductImage(product)
                            ? {
                                backgroundImage: `url(${mainProductImage(product)})`,
                              }
                            : undefined
                        }
                      >
                        {!mainProductImage(product) && (
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
                        <p className="mt-1 text-xs text-slate-500">
                          Stock: {product.stock}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Featured: {product.is_featured ? "Ya" : "Tidak"}
                        </p>
                        <div className="mt-4">
                          <Select
                            ariaLabel={`Status ${product.title}`}
                            value={product.status}
                            disabled={isSaving || busyProductId === product.id}
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
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => startProductEdit(product)}
                            disabled={isSaving || busyProductId !== null}
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#0F3854] transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteProduct(product)}
                            disabled={isSaving || busyProductId !== null}
                            className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            {busyProductId === product.id
                              ? "Memproses..."
                              : "Hapus"}
                          </button>
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
          ))}

        {activeTab === "orders" && (
          <SectionCard
            title="Daftar Pesanan Masuk"
            description="Pantau pesanan customer dan status pembayaran secara realtime."
          >
            <div className="mb-5 flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center">
              <p className="text-sm text-slate-600">
                Pengelolaan status pesanan customer tersedia di halaman khusus.
              </p>
              <Link
                href="/admin/orders"
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[#0F3854] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#174e70]"
              >
                Kelola Pesanan
              </Link>
            </div>
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
                        {order.order_items?.length
                          ? order.order_items
                              .map(
                                (orderItem) =>
                                  `${orderItem.product_title} ×${orderItem.quantity}`,
                              )
                              .join(", ")
                          : "Produk tidak tersedia"}
                      </td>
                      <td className="py-4 font-bold text-[#0F3854]">
                        {formatCurrency(order.total_price)}
                      </td>
                      <td className="py-4">
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                          {paymentStatusLabel(order.payment_status)}
                        </span>
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
        {activeTab === "preorder" && <PreorderManager />}
        {isLoading && (
          <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-[#0F3854] px-4 py-2.5 text-sm font-bold text-white shadow-xl">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data
          </div>
        )}
      </div>
    </div>
  );
}
