import { Heart, Star } from "lucide-react";

export type Product = {
  title: string;
  price: string;
  rating: string;
  category: string;
  tone: string;
  accent: string;
  badge?: string;
};

export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group min-w-0">
      <div
        className={`relative aspect-[0.88] overflow-hidden rounded-[3px] ${product.tone}`}
      >
        {product.badge && (
          <span className="absolute left-3 top-3 z-10 bg-[#292421] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">
            {product.badge}
          </span>
        )}
        <button
          aria-label={`Simpan ${product.title}`}
          className="absolute bottom-3 right-3 z-10 text-white transition-transform group-hover:scale-110"
        >
          <Heart className="h-5 w-5" />
        </button>
        <div
          className={`absolute inset-[13%] flex flex-col items-center justify-center text-center ${product.accent}`}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-70">
            KSHOOCKY SELECT
          </span>
          <strong className="mt-3 max-w-[80%] text-2xl font-extrabold leading-[0.95] sm:text-3xl">
            {product.title.split(" ").slice(0, 3).join(" ")}
          </strong>
          <span className="mt-4 border-t border-current/40 pt-2 text-[8px] uppercase tracking-[0.2em]">
            Official pre order
          </span>
        </div>
      </div>
      <h2 className="mt-3 line-clamp-2 text-sm font-medium leading-5 text-[#332d2a]">
        {product.title}
      </h2>
      <p className="mt-1 text-sm font-semibold text-[#b86645]">
        {product.price}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs text-[#8c817a]">
        <Star className="h-3 w-3 fill-[#d39a54] text-[#d39a54]" />{" "}
        {product.rating}
      </p>
    </article>
  );
}
