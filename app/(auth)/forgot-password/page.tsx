"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [sentEmail, setSentEmail] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError("");
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setFormError("Email wajib diisi.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setFormError("Format email tidak valid.");
      return;
    }

    setIsSubmitting(true);
    let timeoutId: number | undefined;

    try {
      const request = createClient().auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("RESET_EMAIL_TIMEOUT")),
          10000,
        );
      });
      const { error } = await Promise.race([request, timeout]);

      if (error) {
        setFormError(
          "Gagal mengirim link reset password. Silakan coba lagi.",
        );
        return;
      }

      setSentEmail(normalizedEmail);
    } catch {
      setFormError("Gagal mengirim link reset password. Silakan coba lagi.");
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
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

        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-[#0B1320]">
            Lupa Password?
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Masukkan email akun Anda untuk menerima link reset password.
          </p>
        </div>

        {sentEmail ? (
          <div
            className="rounded-2xl border border-[#3C7B9E]/20 bg-[#3C7B9E]/5 p-5 text-sm leading-relaxed text-[#0B1320]"
            role="status"
            aria-live="polite"
          >
            <p>
              Link reset password sudah dikirim ke email kamu. Silakan cek
              inbox dan folder spam.
            </p>
            <p className="mt-2 font-semibold">{sentEmail}</p>
            <Link
              href="/login"
              className="mt-4 inline-flex font-bold text-[#3C7B9E] hover:text-[#2f627d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3C7B9E]"
            >
              Kembali ke Login
            </Link>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-[#0B1320] mb-1.5"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  autoComplete="email"
                  aria-required="true"
                  aria-invalid={Boolean(formError)}
                  aria-describedby={formError ? "email-error" : undefined}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                />
              </div>
            </div>

            {formError && (
              <p
                id="email-error"
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
              {isSubmitting ? "Mengirim..." : "Kirim Link Reset Password"}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#3C7B9E] hover:text-[#2f627d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3C7B9E]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke Login
        </Link>
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