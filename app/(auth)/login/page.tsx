"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!email.trim()) {
      setFormError("Email wajib diisi.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFormError("Email tidak valid.");
      return;
    }

    if (!password) {
      setFormError("Kata sandi wajib diisi.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const normalizedMessage = error.message.toLowerCase();

        if (
          error.code === "email_not_confirmed" ||
          normalizedMessage.includes("email not confirmed") ||
          normalizedMessage.includes("email belum dikonfirmasi")
        ) {
          setFormError(
            "Email Anda belum dikonfirmasi. Silakan cek inbox email Anda terlebih dahulu.",
          );
        } else {
          setFormError("Email atau kata sandi salah.");
        }
        return;
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        setFormError("Sesi login tidak ditemukan. Silakan coba lagi.");
        return;
      }

      router.push("/user");
    } catch {
      setFormError("Terjadi kesalahan saat masuk. Silakan coba lagi.");
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
            Selamat Datang 👋
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Masuk ke akun Anda untuk melanjutkan.
          </p>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
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
                placeholder="nama@email.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-[#0B1320]"
              >
                Kata Sandi
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[#3C7B9E] hover:text-[#2f627d] font-medium transition-colors"
              >
                Lupa kata sandi?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Masukkan kata sandi"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
          </div>

          {/* Remember Me */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              id="remember"
              className="w-4 h-4 rounded accent-[#3C7B9E]"
            />
            Ingat saya di perangkat ini
          </label>

          {formError && (
            <p className="text-sm leading-relaxed text-red-600" role="alert">
              {formError}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#3C7B9E] hover:bg-[#2f627d] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#3C7B9E]/20 mt-2"
          >
            {isSubmitting ? "Memproses..." : "Masuk ke Akun →"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">atau</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Register Link */}
        <p className="text-center text-sm text-gray-500">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="text-[#3C7B9E] hover:text-[#2f627d] font-bold transition-colors"
          >
            Daftar Sekarang
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
