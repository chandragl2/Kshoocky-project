"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { User, Mail, Phone, Lock, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const emailPattern =
  /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?\.)+[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/i;
const disposableEmailDomains = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "dispostable.com",
  "getnada.com",
  "grr.la",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.net",
  "maildrop.cc",
  "mailinator.com",
  "sharklasers.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmail.com",
  "throwaway.email",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.fr",
]);

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    whatsapp?: string;
    password?: string;
    confirmPassword?: string;
    termsAccepted?: string;
  }>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});
    setSuccessMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    const nextFieldErrors: typeof fieldErrors = {};
    if (!fullName.trim()) {
      nextFieldErrors.fullName = "Nama lengkap wajib diisi.";
    }
    if (!normalizedEmail) {
      nextFieldErrors.email = "Email wajib diisi.";
    } else if (!emailPattern.test(normalizedEmail)) {
      nextFieldErrors.email = "Masukkan alamat email yang valid.";
    } else {
      const emailDomain = normalizedEmail.split("@")[1];
      if (
        Array.from(disposableEmailDomains).some(
          (domain) =>
            emailDomain === domain || emailDomain.endsWith(`.${domain}`),
        )
      ) {
        nextFieldErrors.email =
          "Email ini menggunakan domain sementara dan tidak dapat digunakan.";
      }
    }
    if (!whatsapp.trim()) {
      nextFieldErrors.whatsapp = "Nomor WhatsApp wajib diisi.";
    }
    if (!password.trim()) {
      nextFieldErrors.password =
        "Password wajib diisi dan tidak boleh hanya spasi.";
    } else if (password.length < 8) {
      nextFieldErrors.password = "Password minimal 8 karakter.";
    } else if (password.toLowerCase() === normalizedEmail) {
      nextFieldErrors.password = "Password tidak boleh sama dengan email.";
    }
    if (!confirmPassword) {
      nextFieldErrors.confirmPassword = "Konfirmasi password wajib diisi.";
    } else if (password !== confirmPassword) {
      nextFieldErrors.confirmPassword =
        "Password dan konfirmasi password tidak sama.";
    }
    if (!termsAccepted) {
      nextFieldErrors.termsAccepted = "Silakan setujui syarat dan ketentuan.";
    }

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setFormError("Periksa kembali data yang kamu masukkan.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const signUpResult = supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("SIGN_UP_TIMEOUT")), 10000);
      });
      const { data, error } = await Promise.race([signUpResult, timeout]);

      if (error) {
        const normalizedMessage = error.message.toLowerCase();

        if (
          normalizedMessage.includes("already registered") ||
          normalizedMessage.includes("already exists")
        ) {
          const message =
            "Email sudah terdaftar. Silakan login atau gunakan email lain.";
          setFieldErrors({
            email: message,
          });
          setFormError(message);
        } else if (normalizedMessage.includes("invalid email")) {
          const message = "Masukkan alamat email yang valid.";
          setFieldErrors({ email: message });
          setFormError(message);
        } else if (
          error.status === 429 ||
          normalizedMessage.includes("rate limit") ||
          normalizedMessage.includes("rate_limit") ||
          normalizedMessage.includes("too many") ||
          normalizedMessage.includes("security purposes") ||
          normalizedMessage.includes("429")
        ) {
          setFormError("Terlalu banyak percobaan. Silakan coba lagi nanti.");
        } else {
          setFormError(
            "Pendaftaran gagal. Silakan periksa data dan coba lagi.",
          );
        }
        return;
      }

      if (data.session) {
        router.push("/login");
        return;
      }

      setSuccessMessage(
        "Akun berhasil dibuat. Silakan cek email Anda untuk mengonfirmasi akun sebelum masuk.",
      );
    } catch (error) {
      if (error instanceof Error && error.message === "SIGN_UP_TIMEOUT") {
        setFormError(
          "Koneksi ke layanan pendaftaran terlalu lama. Periksa koneksi Anda lalu coba lagi.",
        );
      } else {
        setFormError("Pendaftaran gagal. Silakan periksa data dan coba lagi.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-slate-200 flex flex-col items-center justify-center px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl px-8 py-10">
        {/* Logo & Brand */}
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

        {/* Heading */}
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-[#0B1320]">
            Daftar Akun Baru 🎉
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Lengkapi data Anda untuk bergabung.
          </p>
        </div>

        {/* Form */}
        {successMessage ? (
          <div
            className="rounded-2xl border border-[#3C7B9E]/20 bg-[#3C7B9E]/5 p-5 text-sm leading-relaxed text-[#0B1320]"
            role="status"
          >
            <p>{successMessage}</p>
            <Link
              href="/login"
              className="mt-4 inline-flex font-bold text-[#3C7B9E] hover:text-[#2f627d]"
            >
              Masuk ke Akun
            </Link>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            {/* Nama Lengkap */}
            <div>
              <label
                htmlFor="fullname"
                className="block text-sm font-semibold text-[#0B1320] mb-1.5"
              >
                Nama Lengkap
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="fullname"
                  type="text"
                  required
                  placeholder="Nama Lengkap"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  aria-describedby={
                    fieldErrors.fullName ? "fullname-error" : undefined
                  }
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                />
              </div>
              {fieldErrors.fullName && (
                <p
                  id="fullname-error"
                  className="mt-1.5 text-xs text-red-600"
                  role="alert"
                >
                  {fieldErrors.fullName}
                </p>
              )}
            </div>

            {/* Email */}
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
                  required
                  placeholder="nama@email.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email ? "email-error" : undefined
                  }
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                />
              </div>
              {fieldErrors.email && (
                <p
                  id="email-error"
                  className="mt-1.5 text-xs text-red-600"
                  role="alert"
                >
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Nomor WhatsApp */}
            <div>
              <label
                htmlFor="whatsapp"
                className="block text-sm font-semibold text-[#0B1320] mb-1.5"
              >
                Nomor WhatsApp
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="whatsapp"
                  type="tel"
                  required
                  placeholder="Contoh: 08123456789"
                  autoComplete="tel"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.whatsapp)}
                  aria-describedby={
                    fieldErrors.whatsapp ? "whatsapp-error" : undefined
                  }
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                />
              </div>
              {fieldErrors.whatsapp && (
                <p
                  id="whatsapp-error"
                  className="mt-1.5 text-xs text-red-600"
                  role="alert"
                >
                  {fieldErrors.whatsapp}
                </p>
              )}
            </div>

            {/* Kata Sandi */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-[#0B1320] mb-1.5"
              >
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="Masukkan kata sandi"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password ? "password-error" : undefined
                  }
                  className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                />
                <button
                  type="button"
                  aria-label={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi"
                  }
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                Minimal 8 karakter
                {password.length >= 8 && (
                  <span className="ml-2 font-semibold text-[#3C7B9E]">✓</span>
                )}
              </p>
              {fieldErrors.password && (
                <p
                  id="password-error"
                  className="mt-1.5 text-xs text-red-600"
                  role="alert"
                >
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Konfirmasi Kata Sandi */}
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-semibold text-[#0B1320] mb-1.5"
              >
                Konfirmasi Kata Sandi
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Ulangi kata sandi"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  aria-describedby={
                    fieldErrors.confirmPassword
                      ? "confirm-password-error"
                      : undefined
                  }
                  className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                />
                <button
                  type="button"
                  aria-label={
                    showConfirmPassword
                      ? "Sembunyikan konfirmasi kata sandi"
                      : "Tampilkan konfirmasi kata sandi"
                  }
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {confirmPassword && confirmPassword === password && (
                <p className="mt-1.5 text-xs font-semibold text-[#3C7B9E]">
                  ✓ Kata sandi cocok
                </p>
              )}
              {fieldErrors.confirmPassword && (
                <p
                  id="confirm-password-error"
                  className="mt-1.5 text-xs text-red-600"
                  role="alert"
                >
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Terms Checkbox */}
            <label className="flex items-start gap-2.5 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                id="terms"
                required
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                aria-invalid={Boolean(fieldErrors.termsAccepted)}
                aria-describedby={
                  fieldErrors.termsAccepted ? "terms-error" : undefined
                }
                className="w-4 h-4 mt-0.5 rounded accent-[#3C7B9E] flex-shrink-0"
              />
              <span>
                Saya menyetujui{" "}
                <Link
                  href="#syarat"
                  className="text-[#3C7B9E] font-semibold hover:underline"
                >
                  Syarat &amp; Ketentuan
                </Link>{" "}
                dan{" "}
                <Link
                  href="#kebijakan"
                  className="text-[#3C7B9E] font-semibold hover:underline"
                >
                  Kebijakan Privasi
                </Link>{" "}
                KSHOOCKY.
              </span>
            </label>
            {fieldErrors.termsAccepted && (
              <p id="terms-error" className="text-xs text-red-600" role="alert">
                {fieldErrors.termsAccepted}
              </p>
            )}

            {formError && (
              <div
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-relaxed text-red-700"
                role="alert"
                aria-live="assertive"
              >
                {formError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#3C7B9E] hover:bg-[#2f627d] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#3C7B9E]/20 mt-2"
            >
              {isSubmitting ? "Mendaftarkan..." : "Daftar Sekarang 🚀"}
            </button>
          </form>
        )}

        {/* Login Link */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="text-[#3C7B9E] hover:text-[#2f627d] font-bold transition-colors"
          >
            Masuk ke Akun
          </Link>
        </p>
      </div>

      {/* Footer Links */}
      <div className="flex gap-6 mt-8 text-xs text-gray-400">
        <Link
          href="#kebijakan"
          className="hover:text-gray-600 transition-colors"
        >
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
