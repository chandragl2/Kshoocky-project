import Link from "next/link";
import { ArrowRight, Box, Truck } from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function TrackingPage() {
  return (
    <div className="min-h-screen bg-[#fbf7e7] text-[#172036]">
      <Navbar />

      <main>
        <section className="relative isolate overflow-hidden bg-[#121a2d] px-5 py-16 text-white sm:py-24 lg:py-28">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(63,123,158,0.18),transparent_48%)]" />
          <div className="mx-auto max-w-[760px] text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white/75">
              <Truck className="h-4 w-4 text-[#65a8ce]" />
              Status pesanan dan pengiriman
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Pelacakan <span className="text-[#E5B869]">Pesanan</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#b8c0d0] sm:text-base">
              Masuk untuk melihat status pesanan, nomor resi, dan riwayat
              pengiriman yang tersedia pada detail pesanan Anda.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#3c8aba] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#4b9bc9]"
            >
              Masuk untuk melihat pesanan
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="px-5 py-20 sm:py-24 lg:py-28">
          <div className="mx-auto flex max-w-[500px] flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#f2ecd7]">
              <Box className="h-10 w-10 text-[#3c8aba]" strokeWidth={1.8} />
            </div>
            <h2 className="mt-8 text-xl font-extrabold text-[#25334d]">
              Riwayat pengiriman
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#66758b]">
              Informasi diperbarui oleh admin berdasarkan data pengiriman yang
              tersedia. Pelacakan otomatis kurir belum tersedia.
            </p>
            <Link
              href="/user/orders"
              className="mt-6 text-sm font-bold text-[#3c8aba] hover:text-[#0F3854]"
            >
              Lihat daftar pesanan
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
