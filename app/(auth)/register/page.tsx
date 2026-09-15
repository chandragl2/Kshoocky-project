"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  Instagram,
  Twitter,
  MapPin,
} from "lucide-react";

export default function RegisterPage() {
  const [selectedCountry, setSelectedCountry] = useState("");

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
        <form className="flex flex-col gap-4">
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
                type="password"
                placeholder="Masukkan kata sandi"
                autoComplete="new-password"
                className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
              />
              <button
                type="button"
                aria-label="Tampilkan kata sandi"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
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
                type="password"
                placeholder="Ulangi kata sandi"
                autoComplete="new-password"
                className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
              />
              <button
                type="button"
                aria-label="Tampilkan konfirmasi kata sandi"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sosial Media (Opsional) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="instagram"
                className="block text-sm font-semibold text-[#0B1320] mb-1.5"
              >
                Instagram{" "}
                <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <div className="relative">
                <Instagram className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="instagram"
                  type="text"
                  placeholder="user_name"
                  className="w-full pl-10 pr-3 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="twitter"
                className="block text-sm font-semibold text-[#0B1320] mb-1.5"
              >
                X / Twitter{" "}
                <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <div className="relative">
                <Twitter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="twitter"
                  type="text"
                  placeholder="user_name"
                  className="w-full pl-10 pr-3 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Catatan sosial */}
          <p className="text-xs text-gray-400 -mt-2">
            * Setidaknya satu dari Instagram atau X/Twitter wajib diisi untuk
            validasi.
          </p>

          {/* Alamat Pengiriman */}
          <div className="border-t border-gray-100 pt-5 mt-1">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-[#E5B869]" />
              <h3 className="text-sm font-bold text-[#0B1320]">
                Alamat Pengiriman
              </h3>
            </div>

            <label
              htmlFor="country"
              className="block text-sm font-semibold text-[#0B1320] mb-1.5"
            >
              Negara <span className="text-red-500">*</span>
            </label>
            <select
              id="country"
              value={selectedCountry}
              onChange={(event) => setSelectedCountry(event.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-[#0B1320] focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
              required
            >
              <option value="">— Pilih Negara —</option>
              <option value="Indonesia">Indonesia</option>
              <option value="Korea Selatan">Korea Selatan</option>
            </select>

            {selectedCountry && (
              <div className="flex flex-col gap-4 mt-4">
                <div>
                  <label
                    htmlFor="address"
                    className="block text-sm font-semibold text-[#0B1320] mb-1.5"
                  >
                    Alamat (Jalan &amp; Nomor){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="address"
                    type="text"
                    placeholder="Contoh: Jl. Merdeka No. 10"
                    autoComplete="street-address"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="province"
                    className="block text-sm font-semibold text-[#0B1320] mb-1.5"
                  >
                    Provinsi <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="province"
                    defaultValue=""
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                    required
                  >
                    <option value="">— Pilih Provinsi —</option>
                    <option value="Jawa Barat">Jawa Barat</option>
                    <option value="DKI Jakarta">DKI Jakarta</option>
                    <option value="Jawa Tengah">Jawa Tengah</option>
                    <option value="Jawa Timur">Jawa Timur</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="city"
                    className="block text-sm font-semibold text-[#0B1320] mb-1.5"
                  >
                    Kota / Kabupaten <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="city"
                    type="text"
                    placeholder="Contoh: Jakarta Selatan"
                    autoComplete="address-level2"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="district"
                    className="block text-sm font-semibold text-[#0B1320] mb-1.5"
                  >
                    Kecamatan <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="district"
                    type="text"
                    placeholder="Contoh: Kebayoran Baru"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="subdistrict"
                    className="block text-sm font-semibold text-[#0B1320] mb-1.5"
                  >
                    Kelurahan <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="subdistrict"
                    type="text"
                    placeholder="Contoh: Senayan"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="postal-code"
                    className="block text-sm font-semibold text-[#0B1320] mb-1.5"
                  >
                    Kode Pos <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="postal-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="Contoh: 10110"
                    autoComplete="postal-code"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-[#0B1320] placeholder-gray-400 focus:outline-none focus:border-[#3C7B9E] focus:bg-white transition"
                    required
                  />
                </div>

                <label className="flex items-start gap-2.5 rounded-xl border border-[#F3D98B] bg-[#FFFBEA] px-3 py-3 text-xs text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 rounded accent-[#3C7B9E] flex-shrink-0"
                    required
                  />
                  <span>
                    Saya menyatakan alamat di atas benar. Saya memahami bahwa
                    data alamat akan digunakan untuk keperluan pengiriman dan
                    verifikasi identitas.
                  </span>
                </label>
              </div>
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
