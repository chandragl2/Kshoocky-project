import Link from "next/link";

export default function CtaSection() {
  return (
    <section
      className="w-full bg-[#F9F6E7] py-24 px-8 flex justify-center items-center flex-col text-center"
      aria-label="Call to Action"
    >
      <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0B1320] mb-6">
        Siap Belanja Produk Korea?
      </h2>
      <p className="text-gray-500 text-lg mb-10 max-w-lg leading-relaxed">
        Tinggal klik, checkout, dan terima di Indonesia — belanja jadi lebih
        mudah bersama KSHOOCKY.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/preorder"
          className="bg-[#E5B869] hover:bg-[#d4a858] text-[#0B1320] font-bold py-4 px-10 rounded-full transition-colors shadow-md"
        >
          Mulai Belanja Sekarang →
        </Link>
        <Link
          href="/register"
          className="bg-[#0B1320] hover:bg-[#162032] text-white font-bold py-4 px-10 rounded-full transition-colors"
        >
          Daftar Gratis
        </Link>
      </div>
    </section>
  );
}
