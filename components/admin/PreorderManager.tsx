"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database, PreorderEventStatus } from "@/lib/supabase/database";

type Client = ReturnType<typeof createClient>;
type PreorderEvent = Database["public"]["Tables"]["preorder_events"]["Row"];
type EventProductRow =
  Database["public"]["Tables"]["preorder_event_products"]["Row"];
type Product = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  "id" | "title" | "slug" | "price" | "stock" | "status"
>;
type EventProduct = Pick<
  EventProductRow,
  "id" | "event_id" | "product_id" | "preorder_price" | "preorder_stock"
> & { products: Product | null };
type EventListItem = PreorderEvent & { product_count: number };
type EventForm = {
  title: string;
  slug: string;
  description: string;
  cover_image_url: string;
  starts_at: string;
  ends_at: string;
  status: PreorderEventStatus;
};
type ItemDraft = { price: string; stock: string };

const eventStatuses: PreorderEventStatus[] = [
  "draft",
  "active",
  "closed",
  "cancelled",
];
const genericError = "Terjadi kesalahan. Silakan coba lagi.";
const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#3c8aba] focus:ring-2 focus:ring-[#3c8aba]/15 disabled:bg-slate-100";
const coverImageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const maxCoverImageSize = 5 * 1024 * 1024;

class AdminAccessError extends Error {
  constructor(public readonly code: "unauthenticated" | "forbidden") {
    super(code);
    this.name = "AdminAccessError";
  }
}

class CoverUploadError extends Error {
  constructor(public readonly stage: "upload" | "save-url") {
    super(stage);
    this.name = "CoverUploadError";
  }
}

function emptyEventForm(): EventForm {
  return {
    title: "",
    slug: "",
    description: "",
    cover_image_url: "",
    starts_at: "",
    ends_at: "",
    status: "draft",
  };
}

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function toDateTimeValue(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusClass(status: PreorderEventStatus) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "cancelled") return "bg-red-50 text-red-700";
  if (status === "closed") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
}

async function requireAdmin(client: Client) {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) throw new AdminAccessError("unauthenticated");

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || profile?.role !== "admin") {
    throw new AdminAccessError("forbidden");
  }
  return user.id;
}

async function uploadEventCover(client: Client, eventId: string, file: File) {
  await requireAdmin(client);
  const extension = coverImageExtensions[file.type];
  if (!extension || file.size > maxCoverImageSize) {
    throw new CoverUploadError("upload");
  }

  const filePath = `preorder/${eventId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage
    .from("preorder-images")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw new CoverUploadError("upload");

  return client.storage.from("preorder-images").getPublicUrl(filePath).data
    .publicUrl;
}

async function readAdminData(client: Client) {
  const [eventsResult, productsResult] = await Promise.all([
    client.from("preorder_events").select("*").order("created_at", {
      ascending: false,
    }),
    client
      .from("products")
      .select("id, title, slug, price, stock, status")
      .eq("status", "active")
      .order("title"),
  ]);
  if (eventsResult.error || productsResult.error) throw new Error("query");

  const eventIds = eventsResult.data.map((event) => event.id);
  let eventProductRows: { event_id: string }[] = [];
  if (eventIds.length > 0) {
    const { data, error } = await client
      .from("preorder_event_products")
      .select("event_id")
      .in("event_id", eventIds);
    if (error) throw new Error("query");
    eventProductRows = data ?? [];
  }

  const productCounts = new Map<string, number>();
  for (const row of eventProductRows) {
    productCounts.set(row.event_id, (productCounts.get(row.event_id) ?? 0) + 1);
  }

  return {
    events: eventsResult.data.map((event) => ({
      ...event,
      product_count: productCounts.get(event.id) ?? 0,
    })),
    products: productsResult.data,
  };
}

export default function PreorderManager() {
  const router = useRouter();
  const [supabase] = useState(() =>
    isSupabaseConfigured ? createClient() : null,
  );
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [eventProducts, setEventProducts] = useState<EventProduct[]>([]);
  const [eventProductDrafts, setEventProductDrafts] = useState<
    Record<string, ItemDraft>
  >({});
  const [eventForm, setEventForm] = useState<EventForm>(emptyEventForm());
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverInputKey, setCoverInputKey] = useState(0);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [newProductId, setNewProductId] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductStock, setNewProductStock] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEventProducts, setIsLoadingEventProducts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refreshData = useCallback(async () => {
    if (!supabase) throw new Error("unconfigured");
    const data = await readAdminData(supabase);
    setEvents(data.events);
    setProducts(data.products);
  }, [supabase]);

  const loadEventProducts = useCallback(
    async (eventId: string) => {
      if (!supabase) return;
      setIsLoadingEventProducts(true);
      try {
        const { data, error: queryError } = await supabase
          .from("preorder_event_products")
          .select(
            "id, event_id, product_id, preorder_price, preorder_stock, products(id, title, slug, price, stock, status)",
          )
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });
        if (queryError) throw new Error("query");
        const rows = data ?? [];
        setEventProducts(rows);
        setEventProductDrafts(
          Object.fromEntries(
            rows.map((item) => [
              item.id,
              {
                price: String(item.preorder_price),
                stock: String(item.preorder_stock),
              },
            ]),
          ),
        );
      } finally {
        setIsLoadingEventProducts(false);
      }
    },
    [supabase],
  );

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);
    setError("");
    if (!supabase) {
      setIsAdmin(false);
      setError("Supabase belum dikonfigurasi.");
      setIsLoading(false);
      return;
    }

    try {
      await requireAdmin(supabase);
      setIsAdmin(true);
      await refreshData();
    } catch (loadError) {
      if (loadError instanceof AdminAccessError) {
        setIsAdmin(false);
        if (loadError.code === "unauthenticated") {
          router.replace("/login");
        } else {
          setError("Halaman ini hanya dapat diakses oleh admin.");
        }
      } else {
        setError("Data preorder gagal dimuat. Silakan coba lagi.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshData, router, supabase]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [coverFile]);

  function showSuccess(message: string) {
    setError("");
    setNotice(message);
  }

  function showOperationError(operationError: unknown, fallback: string) {
    if (operationError instanceof AdminAccessError) {
      if (operationError.code === "unauthenticated") router.replace("/login");
      else setError("Halaman ini hanya dapat diakses oleh admin.");
      return;
    }
    setError(fallback);
  }

  function openCreateForm() {
    setActiveEventId(null);
    setEventForm(emptyEventForm());
    setCoverFile(null);
    setCoverInputKey((key) => key + 1);
    setEventProducts([]);
    setEventProductDrafts({});
    setIsEventFormOpen(true);
    setError("");
    setNotice("");
  }

  async function openEditForm(event: EventListItem) {
    setActiveEventId(event.id);
    setIsEventFormOpen(true);
    setEventProducts([]);
    setEventForm({
      title: event.title,
      slug: event.slug,
      description: event.description ?? "",
      cover_image_url: event.cover_image_url ?? "",
      starts_at: toDateTimeInput(event.starts_at),
      ends_at: toDateTimeInput(event.ends_at),
      status: event.status,
    });
    setCoverFile(null);
    setCoverInputKey((key) => key + 1);
    setNewProductId("");
    setNewProductPrice("");
    setNewProductStock("");
    setError("");
    setNotice("");
    try {
      await loadEventProducts(event.id);
    } catch (loadError) {
      showOperationError(loadError, "Produk preorder gagal dimuat.");
    }
  }

  function selectCoverFile(file: File | undefined) {
    setError("");
    setNotice("");
    if (!file) {
      setCoverFile(null);
      return;
    }
    if (!coverImageExtensions[file.type]) {
      resetCoverSelection();
      setError("Pilih gambar berformat JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > maxCoverImageSize) {
      resetCoverSelection();
      setError("Ukuran gambar maksimal 5 MB.");
      return;
    }
    setCoverFile(file);
  }

  function resetCoverSelection() {
    setCoverFile(null);
    setCoverInputKey((key) => key + 1);
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || isSaving) return;
    const title = eventForm.title.trim();
    const slug = eventForm.slug.trim();
    if (!title || !slug) {
      setError("Judul dan slug wajib diisi.");
      return;
    }
    if (
      eventForm.starts_at &&
      eventForm.ends_at &&
      new Date(eventForm.ends_at) < new Date(eventForm.starts_at)
    ) {
      setError("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");
    let savedEventId: string | null = activeEventId;
    let eventWasSaved = false;
    try {
      await requireAdmin(supabase);
      const values = {
        title,
        slug,
        description: eventForm.description.trim() || null,
        cover_image_url: eventForm.cover_image_url.trim() || null,
        starts_at: toDateTimeValue(eventForm.starts_at),
        ends_at: toDateTimeValue(eventForm.ends_at),
        status: eventForm.status,
      };
      const result = activeEventId
        ? await supabase.rpc("admin_update_preorder_event", {
            p_event_id: activeEventId,
            p_title: values.title,
            p_slug: values.slug,
            p_description: values.description,
            p_cover_image_url: values.cover_image_url,
            p_starts_at: values.starts_at,
            p_ends_at: values.ends_at,
            p_status: values.status,
          })
        : await supabase.rpc("admin_create_preorder_event", {
            p_title: values.title,
            p_slug: values.slug,
            p_description: values.description,
            p_cover_image_url: null,
            p_starts_at: values.starts_at,
            p_ends_at: values.ends_at,
            p_status: values.status,
          });
      if (result.error) {
        if (result.error.code === "23505") {
          setError("Slug tersebut sudah digunakan event lain.");
          return;
        }
        throw new Error("save");
      }

      const wasCreated = !activeEventId;
      savedEventId = result.data.id;
      eventWasSaved = true;
      setActiveEventId(savedEventId);
      setEventForm({
        ...values,
        description: values.description ?? "",
        cover_image_url: result.data.cover_image_url ?? "",
        starts_at: toDateTimeInput(values.starts_at),
        ends_at: toDateTimeInput(values.ends_at),
      });
      await refreshData();
      if (wasCreated) setEventProducts([]);

      if (coverFile) {
        const publicUrl = await uploadEventCover(
          supabase,
          savedEventId,
          coverFile,
        );
        const { data: coverUpdate, error: coverUpdateError } =
          await supabase.rpc("admin_update_preorder_event", {
            p_event_id: savedEventId,
            p_title: values.title,
            p_slug: values.slug,
            p_description: values.description,
            p_cover_image_url: publicUrl,
            p_starts_at: values.starts_at,
            p_ends_at: values.ends_at,
            p_status: values.status,
          });
        if (coverUpdateError || !coverUpdate) {
          throw new CoverUploadError("save-url");
        }
        setEventForm((form) => ({ ...form, cover_image_url: publicUrl }));
        resetCoverSelection();
        await refreshData();
      }

      showSuccess(
        wasCreated ? "Event berhasil dibuat." : "Event berhasil diperbarui.",
      );
    } catch (saveError) {
      if (saveError instanceof CoverUploadError) {
        setError(
          saveError.stage === "upload"
            ? "Event tersimpan, tetapi cover gagal diupload. Pilih file dan simpan kembali untuk mencoba lagi."
            : "Cover terupload, tetapi URL gagal disimpan. Pilih ulang cover dan simpan kembali untuk mencoba lagi.",
        );
        if (savedEventId) {
          setActiveEventId(savedEventId);
          setIsEventFormOpen(true);
          await refreshData().catch(() => undefined);
        }
      } else if (eventWasSaved && savedEventId) {
        setActiveEventId(savedEventId);
        setIsEventFormOpen(true);
        setError(
          "Event berhasil disimpan, tetapi data gagal dimuat ulang. Silakan segarkan data.",
        );
      } else {
        showOperationError(
          saveError,
          "Event gagal disimpan. Silakan coba lagi.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEvent(event: EventListItem) {
    if (
      !window.confirm(
        `Hapus event "${event.title}" beserta seluruh produk preorder di dalamnya?`,
      )
    ) {
      return;
    }
    if (!supabase || isSaving) return;
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      await requireAdmin(supabase);
      const { data, error: deleteError } = await supabase.rpc(
        "admin_delete_preorder_event",
        { p_event_id: event.id },
      );
      if (deleteError || !data) throw new Error("delete");
      if (activeEventId === event.id) {
        setActiveEventId(null);
        setIsEventFormOpen(false);
        setEventForm(emptyEventForm());
        setEventProducts([]);
      }
      await refreshData();
      showSuccess("Event preorder berhasil dihapus.");
    } catch (deleteFailure) {
      showOperationError(
        deleteFailure,
        "Event gagal dihapus. Silakan coba lagi.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function selectNewProduct(productId: string) {
    setNewProductId(productId);
    const product = products.find((item) => item.id === productId);
    setNewProductPrice(product ? String(product.price) : "");
    setNewProductStock(product ? String(product.stock) : "");
  }

  async function addEventProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !activeEventId || isSaving) return;
    const price = Number(newProductPrice);
    const stock = Number(newProductStock);
    if (
      !newProductId ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setError("Pilih produk dan masukkan harga serta kuota yang valid.");
      return;
    }
    if (eventProducts.some((item) => item.product_id === newProductId)) {
      setError("Produk tersebut sudah ada di event ini.");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      await requireAdmin(supabase);
      const { error: insertError } = await supabase.rpc(
        "admin_add_preorder_product",
        {
          p_event_id: activeEventId,
          p_product_id: newProductId,
          p_preorder_price: price,
          p_preorder_stock: stock,
        },
      );
      if (insertError) {
        if (insertError.code === "23505") {
          setError("Produk tersebut sudah ada di event ini.");
          return;
        }
        throw new Error("insert");
      }
      await loadEventProducts(activeEventId);
      await refreshData();
      setNewProductId("");
      setNewProductPrice("");
      setNewProductStock("");
      showSuccess("Produk berhasil ditambahkan ke event.");
    } catch (insertFailure) {
      showOperationError(
        insertFailure,
        "Produk gagal ditambahkan. Silakan coba lagi.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function updateEventProduct(item: EventProduct) {
    if (!supabase || isSaving || busyItemId) return;
    const draft = eventProductDrafts[item.id];
    const price = Number(draft?.price);
    const stock = Number(draft?.stock);
    if (
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setError("Harga dan kuota harus berupa angka nol atau lebih.");
      return;
    }

    setBusyItemId(item.id);
    setError("");
    setNotice("");
    try {
      await requireAdmin(supabase);
      const { data, error: updateError } = await supabase.rpc(
        "admin_update_preorder_product",
        {
          p_event_product_id: item.id,
          p_event_id: item.event_id,
          p_preorder_price: price,
          p_preorder_stock: stock,
        },
      );
      if (updateError || !data) throw new Error("update");
      await loadEventProducts(item.event_id);
      showSuccess("Produk preorder berhasil diperbarui.");
    } catch (updateFailure) {
      showOperationError(updateFailure, "Perubahan produk gagal disimpan.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function removeEventProduct(item: EventProduct) {
    if (!supabase || isSaving || busyItemId) return;
    setBusyItemId(item.id);
    setError("");
    setNotice("");
    try {
      await requireAdmin(supabase);
      const { data, error: deleteError } = await supabase.rpc(
        "admin_delete_preorder_product",
        {
          p_event_product_id: item.id,
          p_event_id: item.event_id,
        },
      );
      if (deleteError || !data) throw new Error("delete");
      await loadEventProducts(item.event_id);
      await refreshData();
      showSuccess("Produk berhasil dihapus dari event.");
    } catch (deleteFailure) {
      showOperationError(deleteFailure, "Produk gagal dihapus dari event.");
    } finally {
      setBusyItemId(null);
    }
  }

  const availableProducts = products.filter(
    (product) => !eventProducts.some((item) => item.product_id === product.id),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Memuat data preorder
      </div>
    );
  }

  if (isAdmin !== true) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
        {error || "Halaman ini hanya dapat diakses oleh admin."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(error || notice) && (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
        >
          {error || notice}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-[#0F3854]">
              Event Preorder
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Atur periode dan produk untuk setiap event preorder.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadWorkspace()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-[#0F3854] transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Segarkan
            </button>
            <button
              type="button"
              onClick={() => void openCreateForm()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F3854] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#174e70]"
            >
              <Plus className="h-4 w-4" /> Buat Event
            </button>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center border-t border-slate-100 px-4 text-center">
            <CalendarDays className="h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">
              Belum ada event preorder.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Buat event untuk mulai memilih produk dan menentukan kuota.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 pr-4 font-bold">Event</th>
                  <th className="py-3 pr-4 font-bold">Status</th>
                  <th className="py-3 pr-4 font-bold">Mulai</th>
                  <th className="py-3 pr-4 font-bold">Selesai</th>
                  <th className="py-3 pr-4 font-bold">Produk</th>
                  <th className="py-3 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        {event.cover_image_url ? (
                          <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
                            <Image
                              src={event.cover_image_url}
                              alt={event.title}
                              fill
                              unoptimized
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-[#eaf3f8] text-[#2f83b8]">
                            <CalendarDays className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#0F3854]">
                            {event.title}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            /{event.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(event.status)}`}
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {formatDate(event.starts_at)}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {formatDate(event.ends_at)}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-slate-700">
                      {event.product_count}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => void openEditForm(event)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-bold text-[#0F3854] transition hover:bg-slate-100 disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteEvent(event)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isEventFormOpen ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-[#0F3854]">
                {activeEventId ? "Edit Event" : "Event Baru"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Isi informasi event; status awal event baru adalah draft.
              </p>
            </div>
            <>
              <button
                type="button"
                onClick={() => {
                  setIsEventFormOpen(false);
                  setActiveEventId(null);
                  setEventForm(emptyEventForm());
                  resetCoverSelection();
                  setEventProducts([]);
                }}
                aria-label="Tutup formulir event"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </>
          </div>

          <form onSubmit={(event) => void saveEvent(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-[#0F3854]">
                Judul Event
                <input
                  required
                  value={eventForm.title}
                  onChange={(event) =>
                    setEventForm((form) => ({
                      ...form,
                      title: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="Nama event preorder"
                  disabled={isSaving}
                />
              </label>
              <label className="text-sm font-bold text-[#0F3854]">
                Slug
                <input
                  required
                  value={eventForm.slug}
                  onChange={(event) =>
                    setEventForm((form) => ({
                      ...form,
                      slug: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="nama-event-preorder"
                  disabled={isSaving}
                />
              </label>
              <label className="text-sm font-bold text-[#0F3854] sm:col-span-2">
                Deskripsi
                <textarea
                  rows={3}
                  value={eventForm.description}
                  onChange={(event) =>
                    setEventForm((form) => ({
                      ...form,
                      description: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="Deskripsi event (opsional)"
                  disabled={isSaving}
                />
              </label>
              <div className="sm:col-span-2">
                <label className="block text-sm font-bold text-[#0F3854]">
                  Upload Cover Event
                  <input
                    key={coverInputKey}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      selectCoverFile(event.target.files?.[0])
                    }
                    className={`${inputClassName} file:mr-3 file:rounded-md file:border-0 file:bg-[#eaf3f8] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#0F3854]`}
                    disabled={isSaving}
                  />
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Format JPG, PNG, atau WebP. Ukuran maksimal 5 MB. File hanya
                  diupload saat event disimpan.
                </p>
                {(coverPreviewUrl || eventForm.cover_image_url) && (
                  <div className="mt-3">
                    <div className="relative h-40 w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <Image
                        src={coverPreviewUrl ?? eventForm.cover_image_url}
                        alt={
                          coverFile
                            ? "Preview cover yang dipilih"
                            : "Cover event saat ini"
                        }
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 100vw, 448px"
                        className="object-cover"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {coverFile ? "Preview cover baru" : "Cover tersimpan"}
                    </p>
                  </div>
                )}
              </div>
              <label className="text-sm font-bold text-[#0F3854]">
                Tanggal Mulai
                <input
                  type="datetime-local"
                  value={eventForm.starts_at}
                  onChange={(event) =>
                    setEventForm((form) => ({
                      ...form,
                      starts_at: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  disabled={isSaving}
                />
              </label>
              <label className="text-sm font-bold text-[#0F3854]">
                Tanggal Selesai
                <input
                  type="datetime-local"
                  value={eventForm.ends_at}
                  onChange={(event) =>
                    setEventForm((form) => ({
                      ...form,
                      ends_at: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  disabled={isSaving}
                />
              </label>
              <label className="text-sm font-bold text-[#0F3854] sm:max-w-xs">
                Status
                <select
                  value={eventForm.status}
                  onChange={(event) =>
                    setEventForm((form) => ({
                      ...form,
                      status: event.target.value as PreorderEventStatus,
                    }))
                  }
                  className={inputClassName}
                  disabled={isSaving}
                >
                  {eventStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end border-t border-slate-100 pt-5">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F3854] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#174e70] disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving
                  ? coverFile
                    ? "Menyimpan dan mengupload cover..."
                    : "Menyimpan..."
                  : "Simpan Event"}
              </button>
            </div>
          </form>

          {activeEventId && (
            <div className="mt-7 border-t border-slate-100 pt-6">
              <div className="mb-4">
                <h3 className="text-sm font-extrabold text-[#0F3854]">
                  Produk dalam Event
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Produk diambil dari katalog aktif. Harga dan kuota preorder
                  disimpan terpisah dari harga produk.
                </p>
              </div>

              <form
                onSubmit={(event) => void addEventProduct(event)}
                className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_150px_130px_auto] sm:items-end"
              >
                <label className="text-xs font-bold text-[#0F3854]">
                  Pilih Produk Aktif
                  <select
                    value={newProductId}
                    onChange={(event) => selectNewProduct(event.target.value)}
                    className={inputClassName}
                    disabled={
                      isSaving ||
                      isLoadingEventProducts ||
                      availableProducts.length === 0
                    }
                  >
                    <option value="">
                      {availableProducts.length
                        ? "Pilih produk"
                        : "Semua produk sudah ditambahkan"}
                    </option>
                    {availableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-[#0F3854]">
                  Harga Preorder
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newProductPrice}
                    onChange={(event) => setNewProductPrice(event.target.value)}
                    className={inputClassName}
                    disabled={isSaving}
                  />
                </label>
                <label className="text-xs font-bold text-[#0F3854]">
                  Kuota
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newProductStock}
                    onChange={(event) => setNewProductStock(event.target.value)}
                    className={inputClassName}
                    disabled={isSaving}
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    isSaving ||
                    isLoadingEventProducts ||
                    !newProductId ||
                    availableProducts.length === 0
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#3c8aba] px-4 text-sm font-bold text-white transition hover:bg-[#327ba8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PackagePlus className="h-4 w-4" />
                  )}
                  Tambah Produk
                </button>
              </form>

              {isLoadingEventProducts ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Memuat produk event...
                </p>
              ) : eventProducts.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Belum ada produk di event ini.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {eventProducts.map((item) => {
                    const draft = eventProductDrafts[item.id] ?? {
                      price: String(item.preorder_price),
                      stock: String(item.preorder_stock),
                    };
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 lg:flex-row lg:items-end"
                      >
                        <div className="min-w-0 flex-1 pb-1">
                          <p className="font-bold text-[#0F3854]">
                            {item.products?.title ?? "Produk tidak tersedia"}
                          </p>
                          {item.products && (
                            <p className="mt-1 text-xs text-slate-500">
                              Harga katalog{" "}
                              {formatCurrency(item.products.price)} · Stok
                              katalog {item.products.stock}
                            </p>
                          )}
                        </div>
                        <label className="text-xs font-bold text-[#0F3854] lg:w-44">
                          Harga Preorder
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.price}
                            onChange={(event) =>
                              setEventProductDrafts((current) => ({
                                ...current,
                                [item.id]: {
                                  ...draft,
                                  price: event.target.value,
                                },
                              }))
                            }
                            className={inputClassName}
                            disabled={busyItemId === item.id}
                          />
                        </label>
                        <label className="text-xs font-bold text-[#0F3854] lg:w-32">
                          Kuota
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.stock}
                            onChange={(event) =>
                              setEventProductDrafts((current) => ({
                                ...current,
                                [item.id]: {
                                  ...draft,
                                  stock: event.target.value,
                                },
                              }))
                            }
                            className={inputClassName}
                            disabled={busyItemId === item.id}
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void updateEventProduct(item)}
                            disabled={busyItemId !== null || isSaving}
                            aria-label={`Simpan ${item.products?.title ?? "produk"}`}
                            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-[#0F3854] transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            {busyItemId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeEventProduct(item)}
                            disabled={busyItemId !== null || isSaving}
                            aria-label={`Hapus ${item.products?.title ?? "produk"} dari event`}
                            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            {busyItemId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Hapus
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
