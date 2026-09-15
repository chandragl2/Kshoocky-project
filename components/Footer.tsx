import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-[#0B1320] text-white py-12 px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-1">
          <Image
            src="/logo.png"
            alt="KSHOOCKY Logo"
            width={140}
            height={40}
            className="h-10 w-auto object-contain mb-4 filter brightness-0 invert"
          />
          <p className="text-gray-300 text-sm mb-4">
            Jastip & Forwarding Korea Terpercaya untuk K-POP & Lifestyle.
          </p>
          <div className="flex gap-4">
            {/* Social Icons Placeholder */}
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              IG
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              TW
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              TT
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-[#E5B869] font-bold mb-4">Layanan</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>
              <Link
                href="#jastip"
                className="hover:text-white transition-colors"
              >
                Jastip Korea
              </Link>
            </li>
            <li>
              <Link
                href="#warehouse"
                className="hover:text-white transition-colors"
              >
                Gudang/Warehouse Seoul
              </Link>
            </li>
            <li>
              <Link
                href="#forwarding"
                className="hover:text-white transition-colors"
              >
                Forwarding Korea - ID
              </Link>
            </li>
            <li>
              <Link
                href="/tracking"
                className="hover:text-white transition-colors"
              >
                Tracking Paket
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-[#E5B869] font-bold mb-4">Bantuan & Dukungan</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>
              <Link
                href="#cara-kerja"
                className="hover:text-white transition-colors"
              >
                Cara Kerja
              </Link>
            </li>
            <li>
              <Link
                href="#syarat"
                className="hover:text-white transition-colors"
              >
                Syarat & Ketentuan
              </Link>
            </li>
            <li>
              <Link href="#faq" className="hover:text-white transition-colors">
                FAQ & Tanya Jawab
              </Link>
            </li>
            <li>
              <Link
                href="#kebijakan"
                className="hover:text-white transition-colors"
              >
                Kebijakan Privasi
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-[#E5B869] font-bold mb-4">Hubungi Kami</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-[#E5B869]">📍</span>
              <span>Seoul, Korea Selatan & Bandung, Indonesia</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#E5B869]">✉️</span>
              <span>hello@kshoocky.id</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#E5B869]">📱</span>
              <span>+62 812 3456 7890</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
        <p>© 2026 KSHOOCKY. All rights reserved.</p>
        <div className="flex gap-4 mt-4 md:mt-0">
          <Link href="#syarat" className="hover:text-white transition-colors">
            Syarat Kebijakan
          </Link>
          <Link href="#privasi" className="hover:text-white transition-colors">
            Kebijakan Privasi
          </Link>
        </div>
      </div>
    </footer>
  );
}
