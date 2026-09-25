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
          {/* Live Badge */}
          <div className="hero-fade hero-delay-1 inline-flex items-center gap-2 bg-white/10 border border-white/15 text-white/80 text-xs font-semibold px-4 py-2 rounded-full mb-8 w-fit">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Melayani sejak 2024
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] mb-6">
            <span className="hero-title-line hero-delay-2 inline-block">
              Jastip &
            </span>
            <br />
            <span className="hero-title-line hero-delay-3 inline-block">
              Forwarding &
            </span>
            <br />
            <span className="hero-title-line hero-delay-4 inline-block text-[#E5B869]">
              Korea.
            </span>
          </h1>

          {/* Subheading */}
          <p className="hero-fade hero-delay-5 text-gray-400 text-lg leading-relaxed mb-10 max-w-md">
            Kshoocky adalah layanan Jastip &amp; Forwarding Korea terpercaya.
            Dari pembelian K-Pop, kosmetik, fashion, hingga pengiriman kargo ke
            pintu Anda — semuanya kami urus.
          </p>

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
