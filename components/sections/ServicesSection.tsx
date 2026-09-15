const SERVICES = [
  {
    icon: '🛍️',
    title: 'Jastip Korea',
    desc: 'Titip beli semua kebutuhanmu dari Korea tanpa batasan pembelanjaan.',
  },
  {
    icon: '🏢',
    title: 'Warehouse Korea',
    desc: 'Gudang transit beralamat di Korea siap menampung barang pesananmu.',
  },
  {
    icon: '✈️',
    title: 'Forwarding Korea - ID',
    desc: 'Pengiriman internasional via kargo EMS atau jalur udara yang cepat.',
  },
  {
    icon: '🔍',
    title: 'Tracking Paket',
    desc: 'Lacak perjalanan barangmu secara real-time dan transparan.',
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
          Layanan KSHOOCKY
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
            className="bg-white p-8 lg:p-10 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="text-5xl mb-6" aria-hidden="true">{item.icon}</div>
            <h3 className="text-xl lg:text-2xl font-bold text-[#0B1320] mb-3">{item.title}</h3>
            <p className="text-base text-gray-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
