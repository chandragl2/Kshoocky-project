"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Save, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const genericError = "Terjadi kesalahan. Silakan coba lagi.";
const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#3c8aba] focus:ring-2 focus:ring-[#3c8aba]/15 disabled:bg-slate-100";

export default function UserProfilePage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    isSupabaseConfigured ? createClient() : null,
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
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

      setEmail(user.email ?? "");
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      setProfile(data);
      setFullName(data?.full_name ?? "");
      setPhoneNumber(data?.phone_number ?? "");
    } catch {
      setError(genericError);
    } finally {
      setIsLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = fullName.trim();
    const normalizedPhone = phoneNumber.trim();
    if (!normalizedName) {
      setError("Nama lengkap wajib diisi.");
      return;
    }
    if (!supabase) {
      setError(genericError);
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/login");
        return;
      }

      if (profile) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            full_name: normalizedName,
            phone_number: normalizedPhone,
          })
          .eq("id", user.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          full_name: normalizedName,
          phone_number: normalizedPhone,
          avatar_url: "",
        });
        if (insertError) throw insertError;
      }

      setNotice("Profil berhasil diperbarui.");
      await loadProfile();
    } catch {
      setError(genericError);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 lg:px-10">
      <header className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c48a24]">
          Account
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0F3854] sm:text-3xl">
          My Profile
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Informasi akun dan kontak yang digunakan untuk pesananmu.
        </p>
      </header>

      {(error || notice) && (
        <div
          role={error ? "alert" : "status"}
          className={`mb-5 rounded-lg border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
        >
          {error || notice}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Memuat profil
          </div>
        ) : (
          <form onSubmit={(event) => void saveProfile(event)}>
            <div className="mb-7 flex items-center gap-4 border-b border-slate-100 pb-6">
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt="Avatar profil"
                  width={72}
                  height={72}
                  unoptimized
                  className="h-[72px] w-[72px] rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#eaf3f8] text-[#2f83b8]">
                  <UserRound className="h-8 w-8" strokeWidth={1.6} />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-[#0F3854]">
                  Informasi Pribadi
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Email akun hanya dapat dibaca dan dikelola melalui Supabase
                  Auth.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-bold text-[#0F3854]">
                Nama Lengkap
                <input
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className={inputClassName}
                  placeholder="Nama lengkap"
                  disabled={isSaving}
                />
              </label>
              <label className="block text-sm font-bold text-[#0F3854]">
                Nomor WhatsApp
                <input
                  autoComplete="tel"
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  className={inputClassName}
                  placeholder="08xxxxxxxxxx"
                  disabled={isSaving}
                />
              </label>
              <label className="block text-sm font-bold text-[#0F3854] sm:col-span-2">
                Email
                <input
                  type="email"
                  value={email}
                  readOnly
                  className={inputClassName}
                  aria-readonly="true"
                />
              </label>
              <label className="block text-sm font-bold text-[#0F3854]">
                Role
                <input
                  value={profile?.role ?? "customer"}
                  readOnly
                  className={inputClassName}
                  aria-readonly="true"
                />
              </label>
            </div>

            <div className="mt-7 flex justify-end border-t border-slate-100 pt-5">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F3854] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#174e70] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
