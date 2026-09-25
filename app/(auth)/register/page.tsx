"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { User, Mail, Phone, Lock, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => event.preventDefault()}
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
                placeholder="Nama Lengkap"
                autoComplete="name"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
              />
            </div>
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
                placeholder="nama@email.com"
                autoComplete="email"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
              />
            </div>
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
                placeholder="Contoh: 08123456789"
                autoComplete="tel"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
              />
            </div>
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
                placeholder="Masukkan kata sandi"
                autoComplete="new-password"
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
            <p className="mt-1.5 text-xs text-gray-400">
              Minimal 8 karakter
              {password.length >= 8 && (
                <span className="ml-2 font-semibold text-[#3C7B9E]">✓</span>
              )}
            </p>
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
                placeholder="Ulangi kata sandi"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
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
          </div>

          {/* Terms Checkbox */}
          <label className="flex items-start gap-2.5 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              id="terms"
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

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-[#3C7B9E] hover:bg-[#2f627d] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#3C7B9E]/20 mt-2"
          >
            Daftar Sekarang 🚀
          </button>
        </form>

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
