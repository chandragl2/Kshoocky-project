"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ProductCard, { Product } from "@/components/ProductCard";

const PRODUCTS: Product[] = [
  {
    title: "[Pre Order] JIN 'ECHO' Album",
    price: "Rp 134,000",
    rating: "4.91",
    category: "BTS",
    tone: "bg-[#e8e8e6]",
    accent: "text-[#706c69]",
    badge: "Pre order",
  },
  {
    title: "[Pre Order] BTS Permission To Dance On Stage - Live",
    price: "Rp 294,000",
    rating: "4.88",
    category: "BTS",
    tone: "bg-[#f5c5aa]",
    accent: "text-white",
    badge: "Pre order",
  },
  {
    title: "Pre Order (PO): BTS Arirang Album 2026",
    price: "Rp 163,000",
    rating: "5",
    category: "BTS",
    tone: "bg-[#f4f1ed]",
    accent: "text-[#77716d]",
    badge: "Pre order",
  },
  {
    title: "[Pre Order] TOMORROW X TOGETHER - The Star Chapter",
    price: "Rp 265,000",
    rating: "4.96",
    category: "TOMORROW X TOGETHER",
    tone: "bg-[#dfe8e2]",
    accent: "text-[#4f6658]",
    badge: "Pre order",
  },
  {
    title: "[Pre Order] ENHYPEN - DESIRE : UNLEASH",
    price: "Rp 278,000",
    rating: "4.90",
    category: "ENHYPEN",
    tone: "bg-[#d8d9e3]",
    accent: "text-[#414352]",
    badge: "Pre order",
  },
  {
    title: "[Pre Order] KPOP Lightstick & Official Goods",
    price: "Rp 550,000",
    rating: "4.87",
    category: "OTHERS",
    tone: "bg-[#eadcc8]",
    accent: "text-[#795e48]",
  },
];

function FilterSection({
  title,
  children,
  open = true,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  const [expanded, setExpanded] = useState(open);
  return (
    <section className="border-b border-[#eee9e4] px-4 py-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-[#332d2a]"
      >
        {title}
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      {expanded && <div className="mt-4 space-y-3">{children}</div>}
    </section>
  );
}

function Check({
  children,
  checked = false,
}: {
  children: React.ReactNode;
  checked?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 text-[13px] ${checked ? "text-[#b86645]" : "text-[#584e48]"}`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-[3px] border ${checked ? "border-[#b86645] bg-[#b86645] text-white" : "border-[#d9b3a0]"}`}
      >
        {checked && "✓"}
      </span>
      {children}
    </label>
  );
}

export default function Page() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const filteredProducts = useMemo(
    () =>
      PRODUCTS.filter(
        (product) =>
          (category === "Semua" || product.category === category) &&
          product.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [category, query],
  );

  return (
    <>
      <Navbar />
      <main className="bg-[#fffdfb] text-[#332d2a]">
        <section className="mx-auto max-w-[1320px] px-5 pt-5 lg:px-8 lg:pt-7">
          <div className="relative flex min-h-[215px] items-end overflow-hidden bg-[#d8753b] px-6 py-7 sm:min-h-[285px] sm:px-10 lg:px-14">
            <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full border-[26px] border-[#f1b15d]/90 opacity-90" />
            <div className="absolute right-[22%] top-10 h-28 w-28 rounded-full bg-[#8bc5d4] opacity-90" />
            <div className="relative max-w-xl text-white">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-white/80">
                Kshoocky official shop
              </p>
              <h1 className="text-4xl font-extrabold leading-none sm:text-6xl">
                Pre Order
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/85">
                Amankan album dan merchandise favoritmu sebelum kehabisan.
              </p>
            </div>
          </div>
        </section>
        <div className="mx-auto flex max-w-[1320px] gap-5 px-5 pb-16 pt-4 lg:px-8">
          <aside className="hidden w-[235px] shrink-0 rounded-[3px] border border-[#e5ded8] bg-white lg:block">
            <div className="border-b border-[#eee9e4] p-3">
              <label className="flex items-center gap-2 rounded-[3px] border border-[#e5ded8] px-3 py-2.5">
                <Search className="h-4 w-4 text-[#7f756f]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari produk"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#a49a93]"
                />
              </label>
            </div>
            <FilterSection title="Kategori">
              <Check checked={category === "BTS"}>
                <button
                  onClick={() =>
                    setCategory(category === "BTS" ? "Semua" : "BTS")
                  }
                >
                  BTS
                </button>
              </Check>
              <Check checked={category === "TOMORROW X TOGETHER"}>
                <button
                  onClick={() =>
                    setCategory(
                      category === "TOMORROW X TOGETHER"
                        ? "Semua"
                        : "TOMORROW X TOGETHER",
                    )
                  }
                >
                  TOMORROW X TOGETHER
                </button>
              </Check>
              <Check checked={category === "ENHYPEN"}>
                <button
                  onClick={() =>
                    setCategory(category === "ENHYPEN" ? "Semua" : "ENHYPEN")
                  }
                >
                  ENHYPEN
                </button>
              </Check>
              <Check>OTHERS</Check>
              <Check checked={category === "Semua"}>Semua Pre Order</Check>
            </FilterSection>
            <FilterSection title="Tipe Produk">
              <Check>Semua Produk</Check>
              <Check>Produk Unggulan</Check>
            </FilterSection>
            <FilterSection title="Ketersediaan">
              <Check checked>Semua</Check>
              <Check>Ada Stok</Check>
            </FilterSection>
            <FilterSection title="Harga">
              <Check>Di bawah Rp 550,000</Check>
              <Check>Rp 550,000 - Rp 1,100,000</Check>
              <Check>Di atas Rp 1,100,000</Check>
            </FilterSection>
          </aside>
          <section className="min-w-0 flex-1">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#9b8e86]">
                  Koleksi pilihan
                </p>
                <h2 className="mt-1 text-2xl font-extrabold text-[#332d2a]">
                  Pre Order{" "}
                  <span className="font-sans text-sm font-normal text-[#9b8e86]">
                    ({filteredProducts.length} produk)
                  </span>
                </h2>
              </div>
              <button className="flex items-center gap-2 border border-[#e5ded8] bg-white px-3 py-2 text-xs font-medium text-[#584e48] lg:hidden">
                <SlidersHorizontal className="h-4 w-4" /> Filter
              </button>
              <label className="hidden items-center gap-2 border border-[#e5ded8] bg-white px-3 py-2 text-xs text-[#584e48] sm:flex">
                Urutkan:{" "}
                <select className="bg-transparent font-semibold outline-none">
                  <option>Unggulan</option>
                  <option>Terbaru</option>
                  <option>Harga terendah</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:gap-x-5">
              {filteredProducts.map((product) => (
                <ProductCard key={product.title} product={product} />
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <div className="py-20 text-center text-sm text-[#8c817a]">
                Produk tidak ditemukan.
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
