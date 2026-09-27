"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type RecoveryStatus = "checking" | "valid" | "invalid";

export default function ResetPasswordPage() {
  const [recoveryStatus, setRecoveryStatus] =
    useState<RecoveryStatus>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let timeoutId: number | undefined;

    try {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          if (timeoutId !== undefined) window.clearTimeout(timeoutId);
          setRecoveryStatus("valid");
        }
      });

      timeoutId = window.setTimeout(() => {
        setRecoveryStatus((status) =>
          status === "checking" ? "invalid" : status,
        );
      }, 8000);

      return () => {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        data.subscription.unsubscribe();
      };
    } catch {
      setRecoveryStatus("invalid");
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError("");

    if (!newPassword) {
      setFormError("Password wajib diisi.");
      return;
    }

    if (newPassword.length < 8) {
      setFormError("Password minimal 8 karakter.");
      return;
    }

    if (!confirmPassword) {
      setFormError("Konfirmasi password wajib diisi.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("Password dan konfirmasi password tidak sama.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setFormError("Gagal memperbarui password. Silakan coba lagi.");
        return;
      }

      await supabase.auth.signOut();
      setIsSuccess(true);
    } catch {
      setFormError("Gagal memperbarui password. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-slate-200 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl px-8 py-10">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.png"
            alt="KSHOOCKY Logo"
            width={72}
            height={72}
            className="w-16 h-16 object-contain mb-3"
          />
          <h1 className="text-xl font-extrabold text-[#0B1320] tracking-tight">
            KSHOOCKY
          </h1>
          <p className="text-sm text-[#E5B869] font-semibold mt-0.5">
            Jastip &amp; Forwarding Korea
          </p>
        </div>

        {recoveryStatus === "checking" ? (
          <p className="text-sm text-gray-500" role="status" aria-live="polite">
            Memeriksa link reset password...
          </p>
        ) : recoveryStatus === "invalid" ? (
          <div role="alert">
            <h2 className="text-2xl font-extrabold text-[#0B1320]">
              Link tidak valid
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Link reset password tidak valid atau sudah kedaluwarsa.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#3C7B9E] hover:text-[#2f627d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3C7B9E]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali ke Login
            </Link>
          </div>
        ) : isSuccess ? (
          <div
            className="rounded-2xl border border-[#3C7B9E]/20 bg-[#3C7B9E]/5 p-5 text-sm leading-relaxed text-[#0B1320]"
            role="status"
            aria-live="polite"
          >
            <h2 className="text-xl font-extrabold">Password berhasil diperbarui.</h2>
            <p className="mt-2 text-gray-600">
              Silakan login menggunakan password baru Anda.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex font-bold text-[#3C7B9E] hover:text-[#2f627d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3C7B9E]"
            >
              Login Sekarang
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-[#0B1320]">
                Buat Password Baru
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Gunakan minimal 8 karakter untuk password baru Anda.
              </p>
            </div>

            <form
              className="flex flex-col gap-4"
              onSubmit={handleSubmit}
              noValidate
            >
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm font-semibold text-[#0B1320] mb-1.5"
                >
                  Password Baru
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    aria-required="true"
                    aria-invalid={Boolean(formError)}
                    aria-describedby={formError ? "password-error" : undefined}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Sembunyikan password" : "Tampilkan password"
                    }
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3C7B9E]"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-semibold text-[#0B1320] mb-1.5"
                >
                  Konfirmasi Password Baru
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    aria-required="true"
                    aria-invalid={Boolean(formError)}
                    aria-describedby={formError ? "password-error" : undefined}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                  />
                  <button
                    type="button"
                    aria-label={
                      showConfirmPassword
                        ? "Sembunyikan konfirmasi password"
                        : "Tampilkan konfirmasi password"
                    }
                    onClick={() =>
                      setShowConfirmPassword((visible) => !visible)
                    }
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3C7B9E]"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {formError && (
                <p
                  id="password-error"
                  className="text-sm leading-relaxed text-red-600"
                  role="alert"
                >
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#3C7B9E] hover:bg-[#2f627d] disabled:cursor-not-allowed disabled:opacity-70 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#3C7B9E]/20 mt-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1320]"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </form>
          </>
        )}
      </div>

      <div className="flex gap-6 mt-8 text-xs text-gray-400">
        <Link href="#kebijakan" className="hover:text-gray-600 transition-colors">
          Kebijakan Privasi
        </Link>
        <Link href="#syarat" className="hover:text-gray-600 transition-colors">
          Syarat &amp; Ketentuan
        </Link>
        <span>© 2026 KSHOOCKY</span>
      </div>
    </div>
  );
}