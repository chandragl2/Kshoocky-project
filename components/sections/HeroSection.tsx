import Link from "next/link";
import { Search } from "lucide-react";
import TestimonialCard from "./TestimonialCard";

export default function HeroSection() {
  return (
    <section
      className="w-full bg-[#0B1320] text-white px-8 flex justify-center items-center min-h-[calc(100vh-76px)] relative overflow-hidden"
      aria-label="Hero"
    >
      {/* Background Glow Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#3C7B9E]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#E5B869]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl w-full flex flex-col lg:flex-row items-center gap-16 py-20">
        {/* Left: Text Content */}
        <div className="lg:w-1/2 flex flex-col">
          {/* Brand Eyebrow */}
          <div className="hero-fade hero-delay-1 mb-6 inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.28em] text-[#E5B869]">
            <span className="h-px w-10 bg-[#E5B869]" />
            ABOUT KSHOOCKY
          </div>

          {/* Headline */}
          <h1 className="mb-6 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
            <span className="hero-title-line hero-delay-2 inline-block text-white">
              Annyeong, Chingudeul!
            </span>
          </h1>

          {/* Subheading */}
          <div className="hero-fade hero-delay-4 mb-10 max-w-lg text-lg leading-relaxed text-gray-400 sm:text-xl">
            <p>
              Berdiri sejak akhir 2020, Kshoocky hadir buat bantu kamu
              &quot;meluk bias&quot; lewat merch impian tanpa bikin dompet
              nangis! Nggak cuma buat ARMY, sekarang kita siap bantu jastip
              merch all fandom, war tiket konser, sampai jastip skincare &amp;
              fashion dengan harga super affordable &amp; 100% trusted!
            </p>
            <p className="mt-6 text-xl font-bold leading-snug text-[#E5B869] sm:text-2xl">
              Stop pusing, Kshoocky siap amankan semua wishlist-mu!
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="hero-fade hero-delay-6 flex flex-wrap gap-4">
            <Link
              href="/register"
              className="bg-[#3C7B9E] hover:bg-[#2f627d] text-white font-bold py-4 px-8 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-[#3C7B9E]/30"
            >
              Daftar Sekarang — Gratis! →
            </Link>
            <Link
              href="/tracking"
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-4 px-8 rounded-xl transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Lacak Pesanan
            </Link>
          </div>
        </div>

        {/* Right: Testimonial Card */}
        <div className="lg:w-1/2 w-full flex justify-center relative">
          <TestimonialCard />
        </div>
      </div>
    </section>
  );
}
