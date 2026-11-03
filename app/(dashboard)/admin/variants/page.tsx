"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, PackagePlus, Pencil, Plus, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/format-currency";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database";

type Product = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  "id" | "title" | "slug" | "price" | "stock" | "status" | "is_catalog"
>;
type Group = Database["public"]["Tables"]["product_option_groups"]["Row"];
type OptionValue = Database["public"]["Tables"]["product_option_values"]["Row"];
type Variant = Pick<
  Database["public"]["Tables"]["product_variants"]["Row"],
  | "id"
  | "product_id"
  | "sku"
  | "label"
  | "price"
  | "stock"
  | "status"
  | "image_url"
  | "created_at"
  | "updated_at"
>;
type Mapping = Database["public"]["Tables"]["product_variant_option_values"]["Row"];
type VariantStatus = Database["public"]["Tables"]["product_variants"]["Row"]["status"];

const emptyVariantForm = {
  sku: "",
  label: "",
  price: "",
  stock: "0",
  status: "active" as VariantStatus,
  imageUrl: "",
};

function prettyError(message: string) {
  if (message.includes("admin_variant_combination_duplicate")) {
    return "Kombinasi opsi tersebut sudah dimiliki varian lain.";
  }
  if (message.includes("admin_variant_required_option_missing")) {
    return "Perubahan ini membuat satu atau beberapa varian tidak memenuhi semua opsi wajib.";
  }
  if (message.includes("admin_variant_options_invalid")) {
    return "Pilihan opsi tidak valid. Periksa kembali nilai yang dipilih.";
  }
  if (message.includes("23505") || message.toLowerCase().includes("duplicate key")) {
    return "SKU atau nama/nilai opsi sudah digunakan.";
  }
  if (message.includes("admin_variant_forbidden")) {
    return "Akses admin diperlukan untuk mengelola varian.";
  }
  return "Operasi gagal. Periksa data lalu coba lagi.";
}

export default function AdminVariantsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [returnToEdit, setReturnToEdit] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [values, setValues] = useState<OptionValue[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const configRequestId = useRef(0);

  const [groupName, setGroupName] = useState("");
  const [groupRequired, setGroupRequired] = useState(true);
  const [groupOrder, setGroupOrder] = useState("0");
  const [valueGroupId, setValueGroupId] = useState("");
  const [valueName, setValueName] = useState("");
  const [valueOrder, setValueOrder] = useState("0");
  const [editingGroupId, setEditingGroupId] = useState("");
  const [groupEditForm, setGroupEditForm] = useState({
    name: "",
    isRequired: true,
    sortOrder: "0",
  });
  const [editingValueId, setEditingValueId] = useState("");
  const [valueEditForm, setValueEditForm] = useState({
    value: "",
    sortOrder: "0",
  });

  const [editingVariantId, setEditingVariantId] = useState("");
  const [variantForm, setVariantForm] = useState(emptyVariantForm);
  const [variantOptions, setVariantOptions] = useState<Record<string, string>>({});

  const selectedProduct = products.find((product) => product.id === productId) ?? null;
  const legacySku = `LEGACY-${productId.replaceAll("-", "")}`;
  const legacyVariant = variants.find((variant) => variant.sku === legacySku);
  const loadProducts = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase belum dikonfigurasi.");
      setIsLoadingProducts(false);
      return;
    }
    setIsLoadingProducts(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const requestedProductId = params.get("productId");
      setReturnToEdit(params.get("returnTo") === "edit");
      const { data, error: queryError } = await createClient()
        .from("products")
        .select("id, title, slug, price, stock, status, is_catalog")
        .eq("is_catalog", true)
        .order("title", { ascending: true });
      if (queryError) throw queryError;
      const loaded = data ?? [];
      setProducts(loaded);
      if (requestedProductId) {
        if (loaded.some((product) => product.id === requestedProductId)) {
          setProductId(requestedProductId);
        } else {
          setProductId("");
          setError(
            "Produk yang diminta tidak ditemukan atau tidak tersedia di katalog admin.",
          );
        }
      } else {
        setProductId((current) =>
          loaded.some((product) => product.id === current)
            ? current
            : loaded[0]?.id ?? "",
        );
      }
    } catch {
      setError("Daftar produk gagal dimuat.");
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  const loadProductConfig = useCallback(async () => {
    const requestId = ++configRequestId.current;
    const isCurrentRequest = () => configRequestId.current === requestId;

    if (!productId || !isSupabaseConfigured) {
      setGroups([]);
      setValues([]);
      setVariants([]);
      setMappings([]);
      setIsLoadingConfig(false);
      return;
    }
    setIsLoadingConfig(true);
    setError("");
    try {
      const client = createClient();
      const [groupResult, valueResult, variantResult, mappingResult] = await Promise.all([
        client
          .from("product_option_groups")
          .select("id, product_id, name, is_required, sort_order, created_at")
          .eq("product_id", productId)
          .order("sort_order", { ascending: true }),
        client
          .from("product_option_values")
          .select("id, product_id, option_group_id, value, sort_order, created_at")
          .eq("product_id", productId)
          .order("sort_order", { ascending: true }),
        client
          .from("product_variants")
          .select("id, product_id, sku, label, price, stock, status, image_url, created_at, updated_at")
          .eq("product_id", productId)
          .order("created_at", { ascending: true }),
        client
          .from("product_variant_option_values")
          .select("variant_id, product_id, option_group_id, option_value_id")
          .eq("product_id", productId),
      ]);
      if (groupResult.error || valueResult.error || variantResult.error || mappingResult.error) {
        throw groupResult.error ?? valueResult.error ?? variantResult.error ?? mappingResult.error;
      }
      if (!isCurrentRequest()) return;

      setGroups(groupResult.data ?? []);
      setValues(valueResult.data ?? []);
      setVariants(variantResult.data ?? []);
      setMappings(mappingResult.data ?? []);
      setEditingVariantId("");
      setVariantForm(emptyVariantForm);
      setVariantOptions({});
      setValueGroupId((current) =>
        (groupResult.data ?? []).some((group) => group.id === current)
          ? current
          : groupResult.data?.[0]?.id ?? "",
      );
    } catch (reason) {
      if (!isCurrentRequest()) return;

      console.error("[Admin Variants] Configuration load failed.", reason);
      setError(
        "Konfigurasi variasi tidak dapat dimuat. Periksa koneksi, ketersediaan tabel/RPC, dan hak akses admin; pastikan migration tersedia di lingkungan ini.",
      );
    } finally {
      if (isCurrentRequest()) setIsLoadingConfig(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    void loadProductConfig();
    return () => {
      configRequestId.current += 1;
    };
  }, [loadProductConfig]);

  async function createOptionGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productId || !groupName.trim() || isSaving) return;
    const order = Number(groupOrder);
    if (!Number.isInteger(order) || order < 0) {
      setError("Urutan opsi harus bilangan bulat nol atau lebih.");
      return;
    }
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: rpcError } = await createClient().rpc("admin_create_product_option_group", {
        p_product_id: productId,
        p_name: groupName.trim(),
        p_is_required: groupRequired,
        p_sort_order: order,
      });
      if (rpcError) throw rpcError;
      setGroupName("");
      setNotice("Grup opsi berhasil dibuat. Varian default legacy dinonaktifkan agar tidak bisa dibeli tanpa pilihan.");
      await loadProductConfig();
      await loadProducts();
    } catch (reason) {
      setError(prettyError(reason instanceof Error ? reason.message : ""));
    } finally {
      setIsSaving(false);
    }
  }

  async function createOptionValue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valueGroupId || !valueName.trim() || isSaving) return;
    const order = Number(valueOrder);
    if (!Number.isInteger(order) || order < 0) {
      setError("Urutan nilai opsi harus bilangan bulat nol atau lebih.");
      return;
    }
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: rpcError } = await createClient().rpc("admin_create_product_option_value", {
        p_option_group_id: valueGroupId,
        p_value: valueName.trim(),
        p_sort_order: order,
      });
      if (rpcError) throw rpcError;
      setValueName("");
      setNotice("Nilai opsi berhasil ditambahkan.");
      await loadProductConfig();
    } catch (reason) {
      setError(prettyError(reason instanceof Error ? reason.message : ""));
    } finally {
      setIsSaving(false);
    }
  }

  function startEditGroup(group: Group) {
    setEditingGroupId(group.id);
    setGroupEditForm({
      name: group.name,
      isRequired: group.is_required,
      sortOrder: String(group.sort_order),
    });
    setError("");
    setNotice("");
  }

  async function saveOptionGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingGroupId || !groupEditForm.name.trim() || isSaving) return;
    const order = Number(groupEditForm.sortOrder);
    if (!Number.isInteger(order) || order < 0) {
      setError("Urutan opsi harus bilangan bulat nol atau lebih.");
      return;
    }
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: rpcError } = await createClient().rpc(
        "admin_update_product_option_group",
        {
          p_option_group_id: editingGroupId,
          p_name: groupEditForm.name.trim(),
          p_is_required: groupEditForm.isRequired,
          p_sort_order: order,
        },
      );
      if (rpcError) throw rpcError;
      setEditingGroupId("");
      setNotice("Grup opsi berhasil diperbarui.");
      await loadProductConfig();
    } catch (reason) {
      setError(prettyError(reason instanceof Error ? reason.message : ""));
    } finally {
      setIsSaving(false);
    }
  }

  function startEditOptionValue(value: OptionValue) {
    setEditingValueId(value.id);
    setValueEditForm({
      value: value.value,
      sortOrder: String(value.sort_order),
    });
    setError("");
    setNotice("");
  }

  async function saveOptionValue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingValueId || !valueEditForm.value.trim() || isSaving) return;
    const order = Number(valueEditForm.sortOrder);
    if (!Number.isInteger(order) || order < 0) {
      setError("Urutan nilai opsi harus bilangan bulat nol atau lebih.");
      return;
    }
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: rpcError } = await createClient().rpc(
        "admin_update_product_option_value",
        {
          p_option_value_id: editingValueId,
          p_value: valueEditForm.value.trim(),
          p_sort_order: order,
        },
      );
      if (rpcError) throw rpcError;
      setEditingValueId("");
      setNotice("Nilai opsi berhasil diperbarui.");
      await loadProductConfig();
    } catch (reason) {
      setError(prettyError(reason instanceof Error ? reason.message : ""));
    } finally {
      setIsSaving(false);
    }
  }

  function startCreateVariant() {
    setEditingVariantId("");
    setVariantForm(emptyVariantForm);
    setVariantOptions({});
    setError("");
    setNotice("");
  }

  function startEditVariant(variant: Variant) {
    setEditingVariantId(variant.id);
    setVariantForm({
      sku: variant.sku,
      label: variant.label,
      price: String(variant.price),
      stock: String(variant.stock),
      status: variant.status,
      imageUrl: variant.image_url ?? "",
    });
    const selected: Record<string, string> = {};
    for (const mapping of mappings.filter((row) => row.variant_id === variant.id)) {
      selected[mapping.option_group_id] = mapping.option_value_id;
    }
    setVariantOptions(selected);
    setError("");
    setNotice("");
  }

  async function saveVariant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productId || isSaving || !variantForm.label.trim()) return;
    const price = Number(variantForm.price);
    const stock = Number(variantForm.stock);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setError("Harga harus angka nol atau lebih dan stok harus bilangan bulat nol atau lebih.");
      return;
    }
    const missingRequired = groups.find(
      (group) => group.is_required && !variantOptions[group.id],
    );
    if (missingRequired) {
      setError(`Pilih nilai untuk opsi wajib "${missingRequired.name}".`);
      return;
    }
    if (groups.length === 0 && !editingVariantId && variants.length > 0) {
      setError("Produk tanpa opsi sudah memiliki varian default. Edit varian tersebut, atau buat grup opsi terlebih dahulu.");
      return;
    }
    const optionValueIds = groups
      .map((group) => variantOptions[group.id])
      .filter((valueId): valueId is string => Boolean(valueId));

    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const client = createClient();
      let sku = variantForm.sku.trim();
      if (!sku) {
        const labelSlug = variantForm.label
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const productSlug = (selectedProduct?.slug ?? productId)
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const baseSku = `KSH-${productSlug}-${labelSlug}`.slice(0, 90);
        const { data: matchingSkus, error: skuError } = await client
          .from("product_variants")
          .select("sku")
          .like("sku", `${baseSku}%`);
        if (skuError) throw skuError;
        const usedSkus = new Set((matchingSkus ?? []).map((row) => row.sku));
        sku = baseSku;
        let suffix = 2;
        while (usedSkus.has(sku)) {
          sku = `${baseSku.slice(0, 96 - String(suffix).length)}-${suffix}`;
          suffix += 1;
        }
        setVariantForm((current) => ({ ...current, sku }));
      }
      const { error: rpcError } = editingVariantId
        ? await client.rpc("admin_update_product_variant_with_options", {
            p_variant_id: editingVariantId,
            p_sku: sku,
            p_label: variantForm.label.trim(),
            p_price: price,
            p_stock: stock,
            p_status: variantForm.status,
            p_image_url: variantForm.imageUrl.trim() || null,
            p_option_value_ids: optionValueIds,
          })
        : await client.rpc("admin_create_product_variant_with_options", {
            p_product_id: productId,
            p_sku: sku,
            p_label: variantForm.label.trim(),
            p_price: price,
            p_stock: stock,
            p_status: variantForm.status,
            p_image_url: variantForm.imageUrl.trim() || null,
            p_option_value_ids: optionValueIds,
          });
      if (rpcError) throw rpcError;
      setNotice(editingVariantId ? "Varian berhasil diperbarui." : "Varian berhasil dibuat.");
      await loadProductConfig();
      await loadProducts();
    } catch (reason) {
      setError(prettyError(reason instanceof Error ? reason.message : ""));
    } finally {
      setIsSaving(false);
    }
  }

  async function deactivateVariant(variant: Variant) {
    if (isSaving || !window.confirm(`Nonaktifkan varian "${variant.label}"?`)) {
      return;
    }
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const optionValueIds = mappings
        .filter((mapping) => mapping.variant_id === variant.id)
        .map((mapping) => mapping.option_value_id);
      const { error: rpcError } = await createClient().rpc(
        "admin_update_product_variant_with_options",
        {
          p_variant_id: variant.id,
          p_sku: variant.sku,
          p_label: variant.label,
          p_price: variant.price,
          p_stock: variant.stock,
          p_status: "inactive",
          p_image_url: variant.image_url,
          p_option_value_ids: optionValueIds,
        },
      );
      if (rpcError) throw rpcError;
      setNotice("Varian dinonaktifkan dan tidak dapat dibeli.");
      await loadProductConfig();
      await loadProducts();
    } catch (reason) {
      setError(prettyError(reason instanceof Error ? reason.message : ""));
    } finally {
      setIsSaving(false);
    }
  }

  const variantOptionsLabel = (variantId: string) =>
    mappings
      .filter((mapping) => mapping.variant_id === variantId)
      .map((mapping) => {
        const group = groups.find((row) => row.id === mapping.option_group_id);
        const value = values.find((row) => row.id === mapping.option_value_id);
        return group && value ? `${group.name}: ${value.value}` : "";
      })
      .filter(Boolean)
      .join(" · ");
  const returnHref =
    returnToEdit && productId
      ? `/admin?tab=products&editProduct=${encodeURIComponent(productId)}`
      : "/admin";

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-7 text-slate-700 sm:px-6 lg:px-10">
      <Link
        href={returnHref}
        className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#0F3854] hover:text-[#b86645]"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke Admin
      </Link>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b86645]">
            KSHOOCKY · Admin
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#0F3854] sm:text-3xl">
            Tambah Variasi
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Atribut menjelaskan jenis pilihan (misalnya Warna), nilai adalah opsinya (misalnya nama warna), dan varian adalah kombinasi yang benar-benar dijual beserta harga dan stoknya.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void loadProducts(); void loadProductConfig(); }}
          disabled={isLoadingProducts || isLoadingConfig}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0F3854] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoadingProducts || isLoadingConfig ? "animate-spin" : ""}`} />
          Muat Ulang
        </button>
      </header>

      {(error || notice) && (
        <div
          role={error ? "alert" : "status"}
          className={`mb-5 rounded-lg border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
        >
          {error || notice}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <label className="block text-sm font-bold text-[#0F3854]">
          Pilih Produk Katalog
          <select
            value={productId}
            onChange={(event) => { setProductId(event.target.value); setNotice(""); setError(""); }}
            disabled={isLoadingProducts || products.length === 0}
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title} · {product.status}
              </option>
            ))}
          </select>
        </label>
        {selectedProduct && (
          <p className="mt-3 text-xs text-slate-500">
            Harga ringkasan: {formatCurrency(selectedProduct.price)} · Stok ringkasan: {selectedProduct.stock} · Slug: {selectedProduct.slug}
          </p>
        )}
        {selectedProduct && selectedProduct.status !== "active" && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Produk masih nonaktif. Setelah semua varian siap, kembali ke halaman edit produk dan ubah status produk menjadi aktif agar varian aktif dapat dibeli.
          </p>
        )}
        {legacyVariant && groups.length > 0 && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Varian legacy &quot;{legacyVariant.sku}&quot; sudah dinonaktifkan karena produk memiliki grup opsi. Konfigurasikan kombinasi varian di bawah.
          </p>
        )}
      </section>

      {isLoadingConfig ? (
        <div className="mt-5 flex min-h-48 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat konfigurasi varian...
        </div>
      ) : !productId ? (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Belum ada produk katalog yang bisa dikelola.
        </section>
      ) : (
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
          <section className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-extrabold text-[#0F3854]">1. Atribut</h2>
              <p className="mt-1 text-sm text-slate-500">Buat atribut berdasarkan informasi produk sebenarnya, misalnya Warna, Ukuran, atau Versi Album.</p>
              <form onSubmit={(event) => void createOptionGroup(event)} className="mt-4 space-y-3">
                <label className="block text-sm font-semibold">
                  Nama atribut
                  <input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={80} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="Contoh: Versi Album" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    Urutan
                    <input type="number" min="0" step="1" value={groupOrder} onChange={(event) => setGroupOrder(event.target.value)} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2" />
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
                    <input type="checkbox" checked={groupRequired} onChange={(event) => setGroupRequired(event.target.checked)} className="h-4 w-4 accent-[#0F3854]" />
                    Wajib dipilih
                  </label>
                </div>
                <button type="submit" disabled={isSaving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0F3854] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah Grup
                </button>
              </form>

              <div className="mt-5 space-y-3">
                {groups.map((group) => (
                  <article key={group.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-[#0F3854]">{group.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{group.is_required ? "Wajib dipilih" : "Opsional"} · Urutan {group.sort_order}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                        {values.filter((value) => value.option_group_id === group.id).length} nilai
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEditGroup(group)}
                      disabled={isSaving}
                      className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-bold text-[#0F3854] disabled:opacity-50"
                    >
                      <Pencil className="h-3 w-3" /> Edit grup
                    </button>
                    {editingGroupId === group.id && (
                      <form
                        onSubmit={(event) => void saveOptionGroup(event)}
                        className="mt-3 space-y-2 rounded-md bg-slate-50 p-3"
                      >
                        <label className="block text-xs font-semibold">
                          Nama grup
                          <input
                            value={groupEditForm.name}
                            onChange={(event) =>
                              setGroupEditForm((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            maxLength={80}
                            required
                            className="mt-1 min-h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
                          />
                        </label>
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-2 text-xs font-semibold">
                            <input
                              type="checkbox"
                              checked={groupEditForm.isRequired}
                              onChange={(event) =>
                                setGroupEditForm((current) => ({
                                  ...current,
                                  isRequired: event.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-[#0F3854]"
                            />
                            Wajib dipilih
                          </label>
                          <label className="text-xs font-semibold">
                            Urutan
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={groupEditForm.sortOrder}
                              onChange={(event) =>
                                setGroupEditForm((current) => ({
                                  ...current,
                                  sortOrder: event.target.value,
                                }))
                              }
                              required
                              className="ml-2 min-h-9 w-24 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
                            />
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="min-h-8 rounded-md bg-[#0F3854] px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                          >
                            {isSaving ? "Menyimpan..." : "Simpan"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGroupId("")}
                            disabled={isSaving}
                            className="min-h-8 rounded-md border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 disabled:opacity-50"
                          >
                            Batal
                          </button>
                        </div>
                      </form>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {values.filter((value) => value.option_group_id === group.id).map((value) => (
                        <span key={value.id} className="inline-flex items-center gap-1 rounded-md bg-[#f3f8fb] pl-2.5 text-xs font-semibold text-[#0F3854]">
                          <span className="py-1.5">{value.value}</span>
                          <button
                            type="button"
                            aria-label={`Edit nilai ${value.value}`}
                            onClick={() => startEditOptionValue(value)}
                            disabled={isSaving}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-r-md text-[#0F3854] hover:bg-[#e4f0f6] disabled:opacity-50"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      {!values.some((value) => value.option_group_id === group.id) && (
                        <span className="text-xs text-amber-700">Belum ada nilai opsi.</span>
                      )}
                    </div>
                    {values.some((value) => value.id === editingValueId && value.option_group_id === group.id) && (
                      <form
                        onSubmit={(event) => void saveOptionValue(event)}
                        className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-3"
                      >
                        <label className="min-w-[140px] flex-1 text-xs font-semibold">
                          Nilai opsi
                          <input
                            value={valueEditForm.value}
                            onChange={(event) =>
                              setValueEditForm((current) => ({
                                ...current,
                                value: event.target.value,
                              }))
                            }
                            maxLength={80}
                            required
                            className="mt-1 min-h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
                          />
                        </label>
                        <label className="text-xs font-semibold">
                          Urutan
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={valueEditForm.sortOrder}
                            onChange={(event) =>
                              setValueEditForm((current) => ({
                                ...current,
                                sortOrder: event.target.value,
                              }))
                            }
                            required
                            className="mt-1 min-h-9 w-24 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="min-h-9 rounded-md bg-[#0F3854] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {isSaving ? "Menyimpan..." : "Simpan"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingValueId("")}
                          disabled={isSaving}
                          className="min-h-9 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-50"
                        >
                          Batal
                        </button>
                      </form>
                    )}
                  </article>
                ))}
                {groups.length === 0 && (
                  <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    Belum ada atribut. Produk menggunakan varian default tunggal dan tetap dapat dibeli.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-extrabold text-[#0F3854]">2. Nilai atribut</h2>
              {groups.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Buat atribut terlebih dahulu.</p>
              ) : (
                <form onSubmit={(event) => void createOptionValue(event)} className="mt-4 space-y-3">
                  <label className="block text-sm font-semibold">
                    Atribut
                    <select value={valueGroupId} onChange={(event) => setValueGroupId(event.target.value)} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2">
                      {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                    <label className="block text-sm font-semibold">
                      Nilai opsi
                      <input value={valueName} onChange={(event) => setValueName(event.target.value)} maxLength={80} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="Contoh: Version A" />
                    </label>
                    <label className="block text-sm font-semibold">
                      Urutan
                      <input type="number" min="0" step="1" value={valueOrder} onChange={(event) => setValueOrder(event.target.value)} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2" />
                    </label>
                  </div>
                  <button type="submit" disabled={isSaving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0F3854] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah Nilai
                  </button>
                </form>
              )}
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-[#0F3854]">3. Varian & Stok</h2>
                  <p className="mt-1 text-sm text-slate-500">Tambahkan hanya kombinasi yang benar-benar tersedia untuk dibeli.</p>
                </div>
                <button type="button" onClick={startCreateVariant} disabled={isSaving || (groups.length === 0 && variants.some((variant) => variant.status === "active" && variant.sku !== legacySku))} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#0F3854] disabled:opacity-40">
                  <PackagePlus className="h-4 w-4" /> Varian Baru
                </button>
              </div>

              <form onSubmit={(event) => void saveVariant(event)} className="mt-5 space-y-3 rounded-lg border border-[#dbe8ef] bg-[#f8fbfd] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-[#0F3854]">{editingVariantId ? "Edit Varian" : "Buat Varian"}</h3>
                  {editingVariantId && (
                    <button type="button" onClick={startCreateVariant} className="text-xs font-bold text-slate-500 underline">Batalkan edit</button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    SKU unik (opsional)
                    <input value={variantForm.sku} onChange={(event) => setVariantForm((current) => ({ ...current, sku: event.target.value }))} maxLength={100} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="Otomatis dari produk dan label" />
                  </label>
                  <label className="block text-sm font-semibold">
                    Label varian
                    <input value={variantForm.label} onChange={(event) => setVariantForm((current) => ({ ...current, label: event.target.value }))} maxLength={120} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="Version A · With POB" />
                  </label>
                  <label className="block text-sm font-semibold">
                    Harga (Rp)
                    <input type="number" min="0" step="1" value={variantForm.price} onChange={(event) => setVariantForm((current) => ({ ...current, price: event.target.value }))} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2" />
                  </label>
                  <label className="block text-sm font-semibold">
                    Stok
                    <input type="number" min="0" step="1" value={variantForm.stock} onChange={(event) => setVariantForm((current) => ({ ...current, stock: event.target.value }))} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2" />
                  </label>
                  <label className="block text-sm font-semibold">
                    Status
                    <select value={variantForm.status} onChange={(event) => setVariantForm((current) => ({ ...current, status: event.target.value as VariantStatus }))} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2">
                      <option value="active">Aktif</option>
                      <option value="inactive">Nonaktif</option>
                      <option value="out_of_stock">Habis</option>
                    </select>
                  </label>
                  <label className="block text-sm font-semibold">
                    URL gambar varian (opsional)
                    <input type="url" value={variantForm.imageUrl} onChange={(event) => setVariantForm((current) => ({ ...current, imageUrl: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="https://..." />
                  </label>
                </div>

                {groups.map((group) => (
                  <label key={group.id} className="block text-sm font-semibold">
                    {group.name}{group.is_required ? " *" : " (opsional)"}
                    <select
                      value={variantOptions[group.id] ?? ""}
                      onChange={(event) => setVariantOptions((current) => ({ ...current, [group.id]: event.target.value }))}
                      required={group.is_required}
                      className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <option value="">{group.is_required ? "Pilih nilai" : "Tidak ada pilihan"}</option>
                      {values.filter((value) => value.option_group_id === group.id).map((value) => (
                        <option key={value.id} value={value.id}>{value.value}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <button type="submit" disabled={isSaving || isLoadingConfig} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#0F3854] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {editingVariantId ? "Simpan Perubahan" : "Simpan Varian"}
                </button>
              </form>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-extrabold text-[#0F3854]">Daftar Varian</h2>
              {variants.length === 0 ? (
                <p className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  Belum ada varian pada produk ini. Tambahkan atribut, nilai, lalu buat varian yang akan dijual.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-3 font-bold">Pilihan</th>
                        <th className="px-3 py-3 font-bold">SKU</th>
                        <th className="px-3 py-3 font-bold">Harga</th>
                        <th className="px-3 py-3 font-bold">Stok</th>
                        <th className="px-3 py-3 font-bold">Status</th>
                        <th className="px-3 py-3 font-bold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((variant) => {
                        const isLegacyDisabled =
                          groups.length > 0 && variant.sku === legacySku;
                        const optionLabel =
                          variantOptionsLabel(variant.id) ||
                          (isLegacyDisabled ? "Varian default lama" : variant.label);
                        return (
                          <tr
                            key={variant.id}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="px-3 py-3 font-semibold text-[#0F3854]">
                              <span>{optionLabel}</span>
                              {isLegacyDisabled && (
                                <span className="mt-1 block text-[11px] font-medium text-amber-700">
                                  Nonaktif karena atribut sudah digunakan.
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-slate-600">
                              {variant.sku}
                            </td>
                            <td className="px-3 py-3 font-bold text-[#b86645]">
                              {formatCurrency(variant.price)}
                            </td>
                            <td className="px-3 py-3 text-slate-700">
                              {variant.stock}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                  variant.status === "active"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : variant.status === "inactive"
                                      ? "bg-slate-100 text-slate-600"
                                      : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {variant.status === "active"
                                  ? "Aktif"
                                  : variant.status === "inactive"
                                    ? "Nonaktif"
                                    : "Habis"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-2">
                                {!isLegacyDisabled && (
                                  <button
                                    type="button"
                                    onClick={() => startEditVariant(variant)}
                                    disabled={isSaving}
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#0F3854] disabled:opacity-50"
                                  >
                                    <Pencil className="h-3.5 w-3.5" /> Edit
                                  </button>
                                )}
                                {!isLegacyDisabled &&
                                  variant.status === "active" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void deactivateVariant(variant)
                                      }
                                      disabled={isSaving}
                                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"
                                    >
                                      Nonaktifkan
                                    </button>
                                  )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Untuk menjaga keranjang dan riwayat pesanan, varian tidak dihapus permanen dari sini. Ubah status menjadi Nonaktif agar tidak dapat dibeli.
              </p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
