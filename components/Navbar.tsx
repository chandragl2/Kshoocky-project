"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  return (
    <nav className="bg-[#fffdfb] border-b border-[#eee9e4] sticky top-0 z-50">
      <div className="max-w-[1320px] mx-auto flex items-center justify-between px-5 lg:px-8 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="KSHOOCKY Logo"
              width={140}
              height={40}
              className="h-12 w-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* Nav Items & Actions */}
        <div className="hidden lg:flex items-center gap-10">
          <div className="flex items-center gap-8 text-[13px] font-semibold uppercase tracking-wide text-[#332d2a]">
            <Link href="/" className="hover:text-[#2563eb] transition-colors">
              Beranda
            </Link>
            <Link
              href="/preorder"
              className="hover:text-[#2563eb] transition-colors"
            >
              Pre Order
            </Link>
            <Link
              href="/tracking"
              className="hover:text-[#2563eb] transition-colors"
            >
              Pelacakan
            </Link>
            <Link
              href="/catalog"
              className="hover:text-[#2563eb] transition-colors"
            >
              Katalog
            </Link>
            <Link
              href="/about"
              className="hover:text-[#2563eb] transition-colors"
            >
              Tentang Kami
            </Link>
          </div>

          <div className="h-6 w-px bg-gray-300"></div>

          <div className="flex items-center gap-5 text-[#332d2a]">
            <button
              aria-label="Cari produk"
              className="hover:text-[#2563eb] transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              aria-label="Keranjang belanja"
              className="hover:text-[#2563eb] transition-colors"
            >
              <ShoppingBag className="h-5 w-5" />
            </button>
            <button
              aria-label="Akun saya"
              className="hover:text-[#2563eb] transition-colors"
            >
              <UserRound className="h-5 w-5" />
            </button>
            <Link
              href="/login"
              className="text-[13px] font-semibold text-[#332d2a] hover:text-[#2563eb] transition-colors"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="bg-[#0F3854] hover:bg-[#2563eb] text-white font-semibold py-2.5 px-5 rounded-full text-[13px] transition-colors shadow-sm"
            >
              Daftar Sekarang <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <button
          type="button"
          aria-label={isMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="text-[#334155] lg:hidden"
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-t border-[#eee9e4] bg-[#fffdfb] px-5 pb-5 pt-3 shadow-lg lg:hidden">
          <div className="flex flex-col gap-1 text-sm font-semibold text-[#332d2a]">
            <Link href="/" onClick={closeMenu} className="rounded-lg px-3 py-3 hover:bg-[#f5eee5]">
              Beranda
            </Link>
            <Link href="/preorder" onClick={closeMenu} className="rounded-lg px-3 py-3 hover:bg-[#f5eee5]">
              Pre Order
            </Link>
            <Link href="/tracking" onClick={closeMenu} className="rounded-lg px-3 py-3 hover:bg-[#f5eee5]">
              Pelacakan
            </Link>
            <Link href="/catalog" onClick={closeMenu} className="rounded-lg px-3 py-3 hover:bg-[#f5eee5]">
              Katalog
            </Link>
            <Link href="/about" onClick={closeMenu} className="rounded-lg px-3 py-3 hover:bg-[#f5eee5]">
              Tentang Kami
            </Link>
          </div>
          <div className="mt-3 flex gap-3 border-t border-[#eee9e4] pt-4">
            <Link href="/login" onClick={closeMenu} className="flex-1 rounded-xl border border-[#dfe3e8] px-4 py-3 text-center text-sm font-bold text-[#332d2a]">
              Masuk
            </Link>
            <Link href="/register" onClick={closeMenu} className="flex-1 rounded-xl bg-[#0F3854] px-4 py-3 text-center text-sm font-bold text-white">
              Daftar Sekarang
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
