"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Check,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database";

type Address = Database["public"]["Tables"]["addresses"]["Row"];
type AddressForm = Pick<
  Database["public"]["Tables"]["addresses"]["Insert"],
  | "label"
  | "recipient_name"
  | "phone_number"
  | "address_line"
  | "city"
  | "province"
  | "postal_code"
> & { is_default: boolean };

const genericError = "Terjadi kesalahan. Silakan coba lagi.";
const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#3c8aba] focus:ring-2 focus:ring-[#3c8aba]/15 disabled:bg-slate-100";

function emptyForm(): AddressForm {
  return {
    label: "Rumah",
    recipient_name: "",
    phone_number: "",
    address_line: "",
    city: "",
    province: "",
    postal_code: "",
    is_default: false,
  };
}

function normalizeForm(form: AddressForm): AddressForm {
  return {
    label: form.label.trim(),
    recipient_name: form.recipient_name.trim(),
    phone_number: form.phone_number.trim(),
    address_line: form.address_line.trim(),
    city: form.city.trim(),
    province: form.province.trim(),
    postal_code: form.postal_code.trim(),
    is_default: form.is_default,
  };
}

function isFormComplete(form: AddressForm) {
  return Boolean(
    form.label &&
    form.recipient_name &&
    form.phone_number &&
    form.address_line &&
    form.city &&
    form.province &&
    form.postal_code,
  );
}

export default function UserAddressesPage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    isSupabaseConfigured ? createClient() : null,
  );
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyAddressId, setBusyAddressId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [formError, setFormError] = useState("");

  const loadAddresses = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    setError("");
    if (!supabase) {
      setError(genericError);
      setIsLoading(false);
      return;
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error: queryError } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setAddresses(data ?? []);
    } catch {
      setLoadFailed(true);
      setNotice("");
      setError(genericError);
    } finally {
      setIsLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  async function currentUserId() {
    if (!supabase) return null;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      router.replace("/login");
      return null;
    }
    return user.id;
  }

  function startAddAddress() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError("");
    setIsFormOpen(true);
  }

  function startEditAddress(address: Address) {
    setEditingId(address.id);
    setForm({
      label: address.label,
      recipient_name: address.recipient_name,
      phone_number: address.phone_number,
      address_line: address.address_line,
      city: address.city,
      province: address.province,
      postal_code: address.postal_code,
      is_default: address.is_default,
    });
    setFormError("");
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingId(null);
    setFormError("");
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = normalizeForm(form);
    if (!isFormComplete(values)) {
      setFormError("Lengkapi semua kolom dengan benar.");
      return;
    }
    if (!supabase) {
      setFormError(genericError);
      return;
    }

    setIsSaving(true);
    setFormError("");
    setError("");
    setNotice("");
    try {
      const userId = await currentUserId();
      if (!userId) return;

      if (!editingId) {
        const { data: currentAddresses, error: listError } = await supabase
          .from("addresses")
          .select("id, is_default")
          .eq("user_id", userId);
        if (listError) throw listError;

        const shouldBeDefault = values.is_default || !currentAddresses?.length;
        const { data: createdAddress, error: insertError } = await supabase
          .from("addresses")
          .insert({ ...values, user_id: userId, is_default: shouldBeDefault })
          .select("id")
          .single();
        if (insertError) throw insertError;

        if (shouldBeDefault && currentAddresses?.length) {
          const { error: clearError } = await supabase
            .from("addresses")
            .update({ is_default: false })
            .eq("user_id", userId)
            .neq("id", createdAddress.id)
            .eq("is_default", true);
          if (clearError) {
            await supabase
              .from("addresses")
              .delete()
              .eq("id", createdAddress.id)
              .eq("user_id", userId);
            throw clearError;
          }
        }

        setNotice("Alamat berhasil ditambahkan.");
      } else {
        const { data: selectedAddress, error: selectedError } = await supabase
          .from("addresses")
          .select("id, is_default")
          .eq("id", editingId)
          .eq("user_id", userId)
          .maybeSingle();
        if (selectedError) throw selectedError;
        if (!selectedAddress) throw new Error("Address not found");

        const { data: ownedAddresses, error: listError } = await supabase
          .from("addresses")
          .select("id, is_default")
          .eq("user_id", userId);
        if (listError) throw listError;
        const otherAddresses = (ownedAddresses ?? []).filter(
          (address) => address.id !== selectedAddress.id,
        );
        let fallbackId: string | null = null;

        if (selectedAddress.is_default && !values.is_default) {
          fallbackId = otherAddresses[0]?.id ?? null;
          if (!fallbackId) {
            setFormError(
              "Alamat utama terakhir harus tetap menjadi alamat utama.",
            );
            return;
          }
          const { error: fallbackError } = await supabase
            .from("addresses")
            .update({ is_default: true })
            .eq("id", fallbackId)
            .eq("user_id", userId);
          if (fallbackError) throw fallbackError;
        }

        const { error: updateError } = await supabase
          .from("addresses")
          .update({ ...values })
          .eq("id", selectedAddress.id)
          .eq("user_id", userId);
        if (updateError) {
          if (fallbackId) {
            await supabase
              .from("addresses")
              .update({ is_default: false })
              .eq("id", fallbackId)
              .eq("user_id", userId);
          }
          throw updateError;
        }

        if (values.is_default) {
          const { error: clearError } = await supabase
            .from("addresses")
            .update({ is_default: false })
            .eq("user_id", userId)
            .neq("id", selectedAddress.id)
            .eq("is_default", true);
          if (clearError) {
            if (!selectedAddress.is_default) {
              await supabase
                .from("addresses")
                .update({ is_default: false })
                .eq("id", selectedAddress.id)
                .eq("user_id", userId);
            }
            throw clearError;
          }
        }

        setNotice("Alamat berhasil diperbarui.");
      }

      setIsFormOpen(false);
      setEditingId(null);
      await loadAddresses();
    } catch {
      await loadAddresses();
      setFormError(genericError);
    } finally {
      setIsSaving(false);
    }
  }

  async function makeDefaultAddress(addressId: string) {
    if (!supabase) {
      setError(genericError);
      return;
    }
    setBusyAddressId(addressId);
    setError("");
    setNotice("");
    try {
      const userId = await currentUserId();
      if (!userId) return;
      const { data: selectedAddress, error: selectedError } = await supabase
        .from("addresses")
        .select("id, is_default")
        .eq("id", addressId)
        .eq("user_id", userId)
        .maybeSingle();
      if (selectedError) throw selectedError;
      if (!selectedAddress) throw new Error("Address not found");

      const { error: selectError } = await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", addressId)
        .eq("user_id", userId);
      if (selectError) throw selectError;

      const { error: clearError } = await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", userId)
        .neq("id", addressId)
        .eq("is_default", true);
      if (clearError) {
        if (!selectedAddress.is_default) {
          await supabase
            .from("addresses")
            .update({ is_default: false })
            .eq("id", addressId)
            .eq("user_id", userId);
        }
        throw clearError;
      }

      setNotice("Alamat utama berhasil diubah.");
      await loadAddresses();
    } catch {
      await loadAddresses();
      setNotice("");
      setError(genericError);
    } finally {
      setBusyAddressId(null);
    }
  }

  async function deleteAddress(addressId: string) {
    if (!window.confirm("Hapus alamat ini?")) return;
    if (!supabase) {
      setError(genericError);
      return;
    }
    setBusyAddressId(addressId);
    setError("");
    setNotice("");
    try {
      const userId = await currentUserId();
      if (!userId) return;
      const { data: selectedAddress, error: selectedError } = await supabase
        .from("addresses")
        .select("id, is_default")
        .eq("id", addressId)
        .eq("user_id", userId)
        .maybeSingle();
      if (selectedError) throw selectedError;
      if (!selectedAddress) throw new Error("Address not found");

      let replacementId: string | null = null;
      let promotedReplacement = false;
      if (selectedAddress.is_default) {
        const { data: replacement, error: replacementError } = await supabase
          .from("addresses")
          .select("id, is_default")
          .eq("user_id", userId)
          .neq("id", addressId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (replacementError) throw replacementError;

        if (replacement) {
          replacementId = replacement.id;
          if (!replacement.is_default) {
            const { error: promoteError } = await supabase
              .from("addresses")
              .update({ is_default: true })
              .eq("id", replacement.id)
              .eq("user_id", userId);
            if (promoteError) throw promoteError;
            promotedReplacement = true;
          }
        }
      }

      const { data: deletedAddress, error: deleteError } = await supabase
        .from("addresses")
        .delete()
        .eq("id", addressId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      if (deleteError || !deletedAddress) {
        if (replacementId && promotedReplacement) {
          await supabase
            .from("addresses")
            .update({ is_default: false })
            .eq("id", replacementId)
            .eq("user_id", userId);
        }
        throw deleteError ?? new Error("Address not found");
      }

      setNotice("Alamat berhasil dihapus.");
      await loadAddresses();
    } catch {
      await loadAddresses();
      setNotice("");
      setError(genericError);
    } finally {
      setBusyAddressId(null);
    }
  }

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 lg:px-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c48a24]">
            Account
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0F3854] sm:text-3xl">
            Address Book
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Simpan alamat pengiriman untuk pesananmu.
          </p>
        </div>
        {!isFormOpen && (
          <button
            type="button"
            onClick={startAddAddress}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F3854] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#174e70]"
          >
            <Plus className="h-4 w-4" /> Tambah Alamat
          </button>
        )}
      </header>

      {(error || notice) && (
        <div
          role={error ? "alert" : "status"}
          className={`mb-5 rounded-lg border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
        >
          {error || notice}
        </div>
      )}

      {isFormOpen && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#0F3854]">
                {editingId ? "Edit Alamat" : "Tambah Alamat"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Semua informasi alamat wajib diisi.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              disabled={isSaving}
              aria-label="Tutup formulir"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-[#0F3854] disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {formError && (
            <p role="alert" className="mb-4 text-sm font-semibold text-red-700">
              {formError}
            </p>
          )}

          <form onSubmit={(event) => void saveAddress(event)}>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-bold text-[#0F3854]">
                Label
                <input
                  required
                  value={form.label}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="Rumah, Kos, atau Kantor"
                  disabled={isSaving}
                />
              </label>
              <label className="block text-sm font-bold text-[#0F3854]">
                Nama Penerima
                <input
                  autoComplete="name"
                  required
                  value={form.recipient_name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      recipient_name: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="Nama penerima"
                  disabled={isSaving}
                />
              </label>
              <label className="block text-sm font-bold text-[#0F3854]">
                Nomor WhatsApp
                <input
                  autoComplete="tel"
                  type="tel"
                  required
                  value={form.phone_number}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone_number: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="08xxxxxxxxxx"
                  disabled={isSaving}
                />
              </label>
              <label className="block text-sm font-bold text-[#0F3854] sm:col-span-2">
                Alamat Lengkap
                <textarea
                  autoComplete="street-address"
                  required
                  rows={3}
                  value={form.address_line}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      address_line: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="Nama jalan, nomor, RT/RW, dan detail lainnya"
                  disabled={isSaving}
                />
              </label>
              <label className="block text-sm font-bold text-[#0F3854]">
                Kota
                <input
                  autoComplete="address-level2"
                  required
                  value={form.city}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="Kota"
                  disabled={isSaving}
                />
              </label>
              <label className="block text-sm font-bold text-[#0F3854]">
                Provinsi
                <input
                  autoComplete="address-level1"
                  required
                  value={form.province}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      province: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="Provinsi"
                  disabled={isSaving}
                />
              </label>
              <label className="block text-sm font-bold text-[#0F3854]">
                Kode Pos
                <input
                  autoComplete="postal-code"
                  required
                  value={form.postal_code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      postal_code: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="Kode pos"
                  disabled={isSaving}
                />
              </label>
              <label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-700 sm:mb-0.5">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_default: event.target.checked,
                    }))
                  }
                  disabled={
                    isSaving ||
                    (Boolean(editingId) &&
                      addresses.length === 1 &&
                      addresses[0]?.id === editingId &&
                      addresses[0]?.is_default)
                  }
                  className="h-4 w-4 accent-[#0F3854]"
                />
                Jadikan Alamat Utama
              </label>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving}
                className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F3854] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#174e70] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {isSaving ? "Menyimpan..." : "Simpan Alamat"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section aria-label="Daftar alamat" className="space-y-4">
        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Memuat alamat
          </div>
        ) : loadFailed ? null : addresses.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-center">
            <MapPin className="h-9 w-9 text-slate-300" strokeWidth={1.6} />
            <h2 className="mt-3 text-base font-extrabold text-[#0F3854]">
              Tidak ada alamat tersimpan
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Tambahkan alamat untuk memudahkan pengiriman pesanan.
            </p>
          </div>
        ) : (
          addresses.map((address) => (
            <article
              key={address.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-extrabold text-[#0F3854]">
                      {address.label}
                    </h2>
                    {address.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#fff5d8] px-2 py-1 text-[11px] font-bold text-[#9c6a10]">
                        <Star className="h-3 w-3 fill-current" /> Alamat Utama
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-700">
                    {address.recipient_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {address.phone_number}
                  </p>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {address.address_line}
                    <br />
                    {address.city}, {address.province} {address.postal_code}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 sm:justify-end sm:border-0 sm:pt-0">
                  {!address.is_default && (
                    <button
                      type="button"
                      onClick={() => void makeDefaultAddress(address.id)}
                      disabled={busyAddressId !== null || isSaving}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#e6d7b3] px-3 py-2 text-xs font-bold text-[#8a641e] transition hover:bg-[#fff9eb] disabled:opacity-50"
                    >
                      {busyAddressId === address.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Star className="h-3.5 w-3.5" />
                      )}
                      Jadikan Alamat Utama
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startEditAddress(address)}
                    disabled={busyAddressId !== null || isSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#0F3854] transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteAddress(address.id)}
                    disabled={busyAddressId !== null || isSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {busyAddressId === address.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Hapus
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
