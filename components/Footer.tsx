import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-[#FFF9F2] text-[#1F1F2B] py-12 px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-1">
          <Image
            src="/logo.png"
            alt="KSHOOCKY Logo"
            width={140}
            height={40}
            className="h-10 w-auto object-contain mb-4"
          />
          <p className="text-[#1F1F2B]/70 text-sm mb-4">
            Jastip & Forwarding Korea Terpercaya untuk K-POP & Lifestyle.
          </p>
          <div className="flex gap-4">
            {/* Social Icons Placeholder */}
            <div className="w-8 h-8 rounded-full bg-[#F4A6B8]/20 text-[#C92A4B] flex items-center justify-center">
              IG
            </div>
            <div className="w-8 h-8 rounded-full bg-[#F4A6B8]/20 text-[#C92A4B] flex items-center justify-center">
              TW
            </div>
            <div className="w-8 h-8 rounded-full bg-[#F4A6B8]/20 text-[#C92A4B] flex items-center justify-center">
              TT
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-[#C92A4B] font-bold mb-4">Layanan</h3>
          <ul className="space-y-2 text-sm text-[#1F1F2B]/70">
            <li>
              <Link
                href="#jastip"
                className="hover:text-[#C92A4B] transition-colors"
              >
                Jastip Korea
              </Link>
            </li>
            <li>
              <Link
                href="#warehouse"
                className="hover:text-[#C92A4B] transition-colors"
              >
                Gudang/Warehouse Seoul
              </Link>
            </li>
            <li>
              <Link
                href="#forwarding"
                className="hover:text-[#C92A4B] transition-colors"
              >
                Forwarding Korea - ID
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-[#C92A4B] font-bold mb-4">Bantuan & Dukungan</h3>
          <ul className="space-y-2 text-sm text-[#1F1F2B]/70">
            <li>
              <Link
                href="#cara-kerja"
                className="hover:text-[#C92A4B] transition-colors"
              >
                Cara Kerja
              </Link>
            </li>
            <li>
              <Link
                href="#syarat"
                className="hover:text-[#C92A4B] transition-colors"
              >
                Syarat & Ketentuan
              </Link>
            </li>
            <li>
              <Link
                href="#faq"
                className="hover:text-[#C92A4B] transition-colors"
              >
                FAQ & Tanya Jawab
              </Link>
            </li>
            <li>
              <Link
                href="#kebijakan"
                className="hover:text-[#C92A4B] transition-colors"
              >
                Kebijakan Privasi
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-[#C92A4B] font-bold mb-4">Hubungi Kami</h3>
          <ul className="space-y-2 text-sm text-[#1F1F2B]/70">
            <li className="flex items-start gap-2">
              <span className="text-[#C92A4B]">📍</span>
              <span>Seoul, Korea Selatan & Bandung, Indonesia</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#F4A6B8]">✉️</span>
              <span>hello@kshoocky.id</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#C92A4B]">📱</span>
              <span>+62 812 3456 7890</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-[#1F1F2B]/10 flex flex-col md:flex-row justify-between items-center text-sm text-[#1F1F2B]/60">
        <p>© 2026 KSHOOCKY. All rights reserved.</p>
        <div className="flex gap-4 mt-4 md:mt-0">
          <Link
            href="#syarat"
            className="hover:text-[#C92A4B] transition-colors"
          >
            Syarat Kebijakan
          </Link>
          <Link
            href="#privasi"
            className="hover:text-[#C92A4B] transition-colors"
          >
            Kebijakan Privasi
          </Link>
        </div>
      </div>
    </footer>
  );
}
