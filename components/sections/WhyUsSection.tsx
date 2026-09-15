import { ShieldCheck, CreditCard, Bell, type LucideIcon } from 'lucide-react';

interface WhyItem {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const WHY_ITEMS: WhyItem[] = [
  {
    icon: ShieldCheck,
    title: 'Rahasia & Aman',
    desc: 'Data pelanggan dijaga kerahasiaannya dan dilindungi asuransi pengiriman.',
  },
  {
    icon: CreditCard,
    title: 'Pembayaran Fleksibel',
    desc: 'Tersedia opsi DP dan cicilan 3 hari sesuai kemampuan Anda.',
  },
  {
    icon: Bell,
    title: 'Status Paket Real-Time',
    desc: 'Notifikasi resi yang transparan dari Korea hingga pintu rumahmu.',
  },
];

export default function WhyUsSection() {
  return (
    <section
      className="w-full bg-[#F9F6E7] py-24 px-8 flex justify-center items-center flex-col"
      aria-label="Kenapa Kshoocky"
    >
      {/* Heading */}
      <div className="text-center mb-16">
        <span className="text-[#0B1320]/50 font-extrabold tracking-widest text-sm uppercase">
          KENAPA KSHOOCKY?
        </span>
        <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0B1320] mt-4">
          Kenapa Belanja Korea Harus Ribet?
        </h2>
      </div>

      {/* Why Cards */}
      <div className="max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        {WHY_ITEMS.map((item) => (
          <div
            key={item.title}
            className="bg-white p-10 rounded-3xl text-center border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F9F6E7] mb-6">
              <item.icon className="w-8 h-8 text-[#0B1320]" strokeWidth={1.75} />
            </div>
            <h3 className="text-xl lg:text-2xl font-bold text-[#0B1320] mb-3">{item.title}</h3>
            <p className="text-base text-gray-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
