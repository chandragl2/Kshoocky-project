import {
  Search,
  Heart,
  CreditCard,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";

interface Step {
  step: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}

const STEPS: Step[] = [
  {
    step: "01",
    icon: Search,
    title: "Stalking Katalog",
    desc: "Cari produk impianmu yang lagi open PO di website.",
  },
  {
    step: "02",
    icon: Heart,
    title: "Pick Your Wishlist",
    desc: "Klik merch favoritmu dan tentukan varian yang kamu inginkan.",
  },
  {
    step: "03",
    icon: CreditCard,
    title: "Checkout & Bayar",
    desc: "Lakukan pembayaran DP/Pelunasan dengan praktis lewat sistem.",
  },
  {
    step: "04",
    icon: PackageCheck,
    title: "Sit Back & Relax!",
    desc: "Tinggal duduk santai tunggu Admin WhatsApp kamu buat info pelunasan & pengiriman.",
  },
];

export default function HowToBuySection() {
  return (
    <section
      id="cara-belanja"
      className="w-full bg-[#FBF5EA] py-24 px-8 flex justify-center items-center flex-col"
      aria-label="Cara Belanja"
    >
      {/* Heading */}
      <div className="text-center mb-16">
        <h2 className="text-4xl lg:text-5xl font-extrabold text-[#1F1F2B]">
          Cara Belanja di KSHOOCKY
        </h2>
      </div>

      {/* Step Cards */}
      <div className="max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        {STEPS.map((item) => (
          <div
            key={item.step}
            className="bg-[#FFF9F2] p-8 pt-10 rounded-3xl text-center shadow-sm border border-[#F4A6B8]/30 hover:shadow-md transition-shadow"
          >
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#F4A6B8]/60 bg-[#F4A6B8]/20 text-[#C92A4B] shadow-[0_6px_16px_rgba(201,42,75,0.08)]">
              <item.icon className="h-7 w-7" strokeWidth={1.6} />
            </div>
            <div className="text-xs font-extrabold text-[#C92A4B] tracking-widest mb-2">
              {item.step}
            </div>
            <h3 className="text-xl lg:text-2xl font-bold text-[#1F1F2B] mb-3">
              {item.title}
            </h3>
            <p className="text-base text-[#1F1F2B]/70 leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
