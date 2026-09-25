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
      className="w-full bg-[#F9F6E7] py-24 px-8 flex justify-center items-center flex-col"
      aria-label="Cara Belanja"
    >
      {/* Heading */}
      <div className="text-center mb-16">
        <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0B1320]">
          Cara Belanja di KSHOOCKY
        </h2>
      </div>

      {/* Step Cards */}
      <div className="max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        {STEPS.map((item) => (
          <div
            key={item.step}
            className="bg-white p-8 pt-10 rounded-3xl text-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#E5B869]/60 bg-[#F9F6E7] text-[#0F3854] shadow-[0_6px_16px_rgba(15,56,84,0.08)]">
              <item.icon className="h-7 w-7" strokeWidth={1.6} />
            </div>
            <div className="text-xs font-extrabold text-gray-400 tracking-widest mb-2">
              {item.step}
            </div>
            <h3 className="text-xl lg:text-2xl font-bold text-[#0B1320] mb-3">
              {item.title}
            </h3>
            <p className="text-base text-gray-500 leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
