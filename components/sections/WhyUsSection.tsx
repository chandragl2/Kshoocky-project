import {
  ShoppingBag,
  CreditCard,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";

interface WhyItem {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const WHY_ITEMS: WhyItem[] = [
  {
    icon: ShoppingBag,
    title: "One Stop Korea Shopping",
    desc: "Weverse, Ktown4u, YG SELECT, SMTOWN & berbagai website Korea lainnya bisa kamu order lewat Kshoocky.",
  },
  {
    icon: CreditCard,
    title: "Easy & Flexible Payment",
    desc: "Kshoocky bantu order dari Korea sampai barang dikirim ke Indonesia. Kamu cukup pilih barang & lakukan DP.",
  },
  {
    icon: PackageCheck,
    title: "Sit Back, We’ll Handle It",
    desc: "Nggak perlu pusing urusan pengiriman Korea–Indonesia. Tinggal tunggu paketmu sampai. ♡",
  },
];

export default function WhyUsSection() {
  return (
    <section
      className="w-full bg-[#FFF9F2] py-24 px-8 flex justify-center items-center flex-col"
      aria-label="Kenapa Kshoocky"
    >
      {/* Heading */}
      <div className="text-center mb-16">
        <span className="text-[#C92A4B] font-extrabold tracking-widest text-sm uppercase">
          KENAPA KSHOOCKY?
        </span>
        <h2 className="text-4xl lg:text-5xl font-extrabold text-[#1F1F2B] mt-4">
          Belanja Korea, Tanpa Ribet. ♡
        </h2>
      </div>

      {/* Why Cards */}
      <div className="max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        {WHY_ITEMS.map((item, index) => (
          <div
            key={item.title}
            className={`p-10 rounded-3xl text-center border shadow-sm hover:shadow-md transition-shadow ${index === 1 ? "bg-[#F4A6B8]/20 border-[#F4A6B8]/40" : "bg-[#FFF9F2] border-[#F4A6B8]/25"}`}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F4A6B8]/20 mb-6">
              <item.icon
                className="w-8 h-8 text-[#C92A4B]"
                strokeWidth={1.75}
              />
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
