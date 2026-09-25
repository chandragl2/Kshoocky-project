import { Disc3, Lightbulb, Shirt, Ticket, type LucideIcon } from 'lucide-react';

interface Service {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const SERVICES: Service[] = [
  {
    icon: Disc3,
    title: 'K-Pop Album',
    desc: 'Amankan album favorit lengkap dengan POB & benefit seru dari kshoocky! Counting ke chart resmi Korea, 100% original.',
  },
  {
    icon: Lightbulb,
    title: 'Official Merch',
    desc: 'Dari lightstick, photocard, dan collab brand idol bisa kita bantu war!',
  },
  {
    icon: Shirt,
    title: 'Fashion & Cosmetics',
    desc: 'Jastip outfit hits, skincare, hingga makeup populer langsung dari Korea.',
  },
  {
    icon: Ticket,
    title: 'Ticketing Service',
    desc: 'Anti pusing war tiket! kshoocky siap bantuin kamu',
  },
];

export default function ServicesSection() {
  return (
    <section
      id="layanan"
      className="w-full bg-[#F9F9F9] py-24 px-8 flex justify-center items-center flex-col"
      aria-label="Layanan Kami"
    >
      {/* Heading */}
      <div className="text-center mb-16 max-w-3xl">
        <span className="text-[#E5B869] font-extrabold tracking-widest text-sm uppercase">
          OUR SERVICES
        </span>
        <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0B1320] mt-4">
          All-in-One K-Jastip for You!
        </h2>
        <p className="text-lg text-gray-600 mt-6 leading-relaxed">
          Semua kebutuhan belanja dan pengiriman dari Korea, kami bantu dalam satu
          layanan yang praktis, aman, dan transparan.
        </p>
      </div>

      {/* Service Cards */}
      <div className="max-w-7xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        {SERVICES.map((item) => (
          <div
            key={item.title}
            className="flex h-full min-h-[280px] flex-col rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md lg:p-10"
          >
            <div
              className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E5B869]/60 bg-[#F9F6E7] text-[#0B1320]"
              aria-hidden="true"
            >
              <item.icon className="h-7 w-7" strokeWidth={1.7} />
            </div>
            <h3 className="mb-3 text-xl font-bold text-[#0B1320] lg:text-2xl">{item.title}</h3>
            <p className="text-base leading-relaxed text-gray-500">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
