"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
type Variant = Database["public"]["Tables"]["product_variants"]["Row"];
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
    return "Pilih nilai untuk semua opsi wajib.";
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [values, setValues] = useState<OptionValue[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupRequired, setGroupRequired] = useState(true);
  const [groupOrder, setGroupOrder] = useState("0");
  const [valueGroupId, setValueGroupId] = useState("");
  const [valueName, setValueName] = useState("");
  const [valueOrder, setValueOrder] = useState("0");

  const [editingVariantId, setEditingVariantId] = useState("");
  const [variantForm, setVariantForm] = useState(emptyVariantForm);
  const [variantOptions, setVariantOptions] = useState<Record<string, string>>({});

  const selectedProduct = products.find((product) => product.id === productId) ?? null;
  const editVariant = variants.find((variant) => variant.id === editingVariantId) ?? null;
  const legacyVariant = variants.find(
    (variant) =>
      variant.sku === `LEGACY-${productId.replaceAll("-", "")}`,
  );
  const configurableVariants = useMemo(
    () => variants.filter((variant) => !variant.sku.startsWith("LEGACY-") || groups.length === 0),
    [groups.length, variants],
  );

  const loadProducts = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase belum dikonfigurasi.");
      setIsLoadingProducts(false);
      return;
    }
    setIsLoadingProducts(true);
    try {
      const { data, error: queryError } = await createClient()
        .from("products")
        .select("id, title, slug, price, stock, status, is_catalog")
        .eq("is_catalog", true)
        .order("title", { ascending: true });
      if (queryError) throw queryError;
      const loaded = data ?? [];
      setProducts(loaded);
      setProductId((current) =>
        loaded.some((product) => product.id === current)
          ? current
          : loaded[0]?.id ?? "",
      );
    } catch {
      setError("Daftar produk gagal dimuat.");
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  const loadProductConfig = useCallback(async () => {
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
    } catch {
      setError("Konfigurasi varian gagal dimuat. Pastikan migration varian sudah diterapkan di lingkungan pengujian.");
    } finally {
      setIsLoadingConfig(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    void loadProductConfig();
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
    if (!productId || isSaving || !variantForm.sku.trim() || !variantForm.label.trim()) return;
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
      const { error: rpcError } = editingVariantId
        ? await client.rpc("admin_update_product_variant_with_options", {
            p_variant_id: editingVariantId,
            p_sku: variantForm.sku.trim(),
            p_label: variantForm.label.trim(),
            p_price: price,
            p_stock: stock,
            p_status: variantForm.status,
            p_image_url: variantForm.imageUrl.trim() || null,
            p_option_value_ids: optionValueIds,
          })
        : await client.rpc("admin_create_product_variant_with_options", {
            p_product_id: productId,
            p_sku: variantForm.sku.trim(),
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

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-7 text-slate-700 sm:px-6 lg:px-10">
      <Link
        href="/admin"
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
            Kelola Varian Produk
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Atur opsi seperti versi album, warna, ukuran, atau POB. Harga dan stok checkout diambil dari varian yang dipilih.
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
        {legacyVariant && groups.length > 0 && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Varian legacy "{legacyVariant.sku}" sudah dinonaktifkan karena produk memiliki grup opsi. Konfigurasikan kombinasi varian di bawah.
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
              <h2 className="text-base font-extrabold text-[#0F3854]">1. Grup Opsi</h2>
              <p className="mt-1 text-sm text-slate-500">Contoh: Versi Album, Warna, Ukuran, POB.</p>
              <form onSubmit={(event) => void createOptionGroup(event)} className="mt-4 space-y-3">
                <label className="block text-sm font-semibold">
                  Nama grup
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      {values.filter((value) => value.option_group_id === group.id).map((value) => (
                        <span key={value.id} className="rounded-md bg-[#f3f8fb] px-2.5 py-1.5 text-xs font-semibold text-[#0F3854]">{value.value}</span>
                      ))}
                      {!values.some((value) => value.option_group_id === group.id) && (
                        <span className="text-xs text-amber-700">Belum ada nilai opsi.</span>
                      )}
                    </div>
                  </article>
                ))}
                {groups.length === 0 && (
                  <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    Belum ada grup opsi. Produk menggunakan varian default tunggal.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-extrabold text-[#0F3854]">2. Nilai Opsi</h2>
              {groups.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Buat grup opsi terlebih dahulu.</p>
              ) : (
                <form onSubmit={(event) => void createOptionValue(event)} className="mt-4 space-y-3">
                  <label className="block text-sm font-semibold">
                    Grup
                    <select value={valueGroupId} onChange={(event) => setValueGroupId(event.target.value)} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2">
                      {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                    <label className="block text-sm font-semibold">
                      Nilai
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
                  <p className="mt-1 text-sm text-slate-500">Setiap kombinasi yang dijual memiliki SKU, harga, dan stok.</p>
                </div>
                <button type="button" onClick={startCreateVariant} disabled={isSaving || (groups.length === 0 && variants.some((variant) => variant.status === "active" && !variant.sku.startsWith("LEGACY-")))} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#0F3854] disabled:opacity-40">
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
                    SKU unik
                    <input value={variantForm.sku} onChange={(event) => setVariantForm((current) => ({ ...current, sku: event.target.value }))} maxLength={100} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="KSH-ALBUM-A-POB" />
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
              <div className="mt-4 space-y-3">
                {variants.map((variant) => {
                  const isLegacyDisabled = groups.length > 0 && variant.sku.startsWith("LEGACY-");
                  return (
                    <article key={variant.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-extrabold text-[#0F3854]">{variant.label}</p>
                          <p className="mt-1 text-xs text-slate-500">SKU: {variant.sku}</p>
                          <p className="mt-1 text-sm font-bold text-[#b86645]">{formatCurrency(variant.price)}</p>
                          <p className="mt-1 text-xs text-slate-500">Stok: {variant.stock} · Status: {variant.status}</p>
                          {variantOptionsLabel(variant.id) && (
                            <p className="mt-2 text-xs font-semibold text-slate-600">{variantOptionsLabel(variant.id)}</p>
                          )}
                          {isLegacyDisabled && (
                            <p className="mt-2 text-xs font-semibold text-amber-700">Varian legacy dinonaktifkan karena opsi produk sudah dikonfigurasi.</p>
                          )}
                        </div>
                        {!isLegacyDisabled && (
                          <button type="button" onClick={() => startEditVariant(variant)} disabled={isSaving} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#0F3854] disabled:opacity-50">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
                {variants.length === 0 && (
                  <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">Belum ada varian pada produk ini.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
