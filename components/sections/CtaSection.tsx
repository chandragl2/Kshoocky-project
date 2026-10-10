import Link from "next/link";

export default function CtaSection() {
  return (
    <section
      className="w-full bg-[#FBF5EA] py-24 px-8 flex justify-center items-center flex-col text-center"
      aria-label="Call to Action"
    >
      <h2 className="text-4xl lg:text-5xl font-extrabold text-[#1F1F2B] mb-6">
        Siap Belanja Produk Korea?
      </h2>
      <p className="text-[#1F1F2B]/70 text-lg mb-10 max-w-lg leading-relaxed">
        Tinggal klik, checkout, dan terima di Indonesia — belanja jadi lebih
        mudah bersama KSHOOCKY.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/preorder"
          className="bg-[#C92A4B] hover:bg-[#A92340] text-white font-bold py-4 px-10 rounded-full transition-colors shadow-md shadow-[#C92A4B]/20"
        >
          Mulai Belanja Sekarang →
        </Link>
        <Link
          href="/register"
          className="bg-[#FFF9F2] border border-[#C92A4B]/35 hover:bg-[#F4A6B8]/20 text-[#C92A4B] font-bold py-4 px-10 rounded-full transition-colors"
        >
          Daftar Gratis
        </Link>
      </div>
    </section>
  );
}
