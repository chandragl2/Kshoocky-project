import Link from "next/link";
import Image from "next/image";
import { Search, ShoppingBag, UserRound } from "lucide-react";

export default function Navbar() {
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
              href="/catalog"
              className="hover:text-[#2563eb] transition-colors"
            >
              Preorder
            </Link>
            <Link
              href="#lacak"
              className="hover:text-[#2563eb] transition-colors"
            >
              Lacak
            </Link>
            <Link
              href="#faq"
              className="hover:text-[#2563eb] transition-colors"
            >
              FAQ
            </Link>
            <Link
              href="#footer"
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
              className="bg-[#b86645] hover:bg-[#2563eb] text-white font-semibold py-2.5 px-5 rounded-full text-[13px] transition-colors shadow-sm"
            >
              Daftar
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
