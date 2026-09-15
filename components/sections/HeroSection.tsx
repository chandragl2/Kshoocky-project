import Link from 'next/link';
import { Search } from 'lucide-react';

const STATS = [
  { label: 'Total Pesanan', value: '5,820+', color: 'text-white' },
  { label: 'Pelanggan', value: '1,240+', color: 'text-[#E5B869]' },
  { label: 'Terkirim', value: '4,100+', color: 'text-[#3C7B9E]' },
  { label: 'K-Pop Item', value: '2,450+', color: 'text-[#E5B869]' },
];

function DashboardCard() {
  return (
    <div className="w-full max-w-md bg-[#162032] rounded-2xl p-6 border border-white/10 shadow-2xl">
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="bg-[#E5B869] text-[#0B1320] font-extrabold text-xs px-2 py-1.5 rounded-lg">
          KS
        </div>
        <div>
          <p className="font-bold text-white text-sm">KSHOOCKY Dashboard</p>
          <p className="text-xs text-gray-400">Statistik Langsung</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-[#1e2d42] rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
            <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Status Bar */}
      <div className="bg-[#1e2d42] rounded-xl px-4 py-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400" />
        <p className="text-sm text-gray-300 font-medium">Sistem Normal</p>
      </div>
    </div>
  );
}

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
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 text-white/80 text-xs font-semibold px-4 py-2 rounded-full mb-8 w-fit">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Melayani sejak 2024
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] mb-6">
            Jastip &<br />
            Forwarding &<br />
            <span className="text-[#E5B869]">Korea.</span>
          </h1>

          {/* Subheading */}
          <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-md">
            Kshoocky adalah layanan Jastip &amp; Forwarding Korea terpercaya. Dari
            pembelian K-Pop, kosmetik, fashion, hingga pengiriman kargo ke pintu
            Anda — semuanya kami urus.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4">
            <Link
              href="/register"
              className="bg-[#3C7B9E] hover:bg-[#2f627d] text-white font-bold py-4 px-8 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-[#3C7B9E]/30"
            >
              Daftar Sekarang — Gratis! →
            </Link>
            <Link
              href="#tracking"
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-4 px-8 rounded-xl transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Lacak Pesanan
            </Link>
          </div>
        </div>

        {/* Right: Dashboard Card */}
        <div className="lg:w-1/2 w-full flex justify-center relative">
          {/* Floating Mascot */}
          <div className="absolute -top-8 right-8 text-6xl select-none animate-bounce z-10" aria-hidden="true">
            🐱
          </div>
          <DashboardCard />
        </div>
      </div>
    </section>
  );
}
