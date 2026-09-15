"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  PackageOpen,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ProductCard, { Product } from "@/components/ProductCard";

const PRODUCTS: Product[] = [
  {
    title: "Daily Comma Woody Garden Eau de Parfum",
    price: "Rp 349.000",
    rating: "4.91",
    category: "Parfum",
    image: "/Product/parfum.png",
    tone: "bg-[#f1f1ef]",
    accent: "text-[#706c69]",
    badge: "Pre order",
  },
  {
    title: "Daily Comma Signal Berry Eau de Parfum",
    price: "Rp 349.000",
    rating: "4.88",
    category: "Parfum",
    image: "/Product/parfum 2.png",
    tone: "bg-[#f5e8e6]",
    accent: "text-white",
    badge: "Pre order",
  },
  {
    title: "Daily Comma Musk Muhwaga Eau de Parfum",
    price: "Rp 349.000",
    rating: "5",
    category: "Parfum",
    image: "/Product/parfum 3.png",
    tone: "bg-[#eef1ef]",
    accent: "text-[#77716d]",
    badge: "Pre order",
  },
  {
    title: "Daily Comma Cotton White Eau de Parfum",
    price: "Rp 349.000",
    rating: "4.96",
    category: "Parfum",
    image: "/Product/parfum 4.png",
    tone: "bg-[#f5f4ef]",
    accent: "text-[#4f6658]",
    badge: "Pre order",
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

function PreorderPage() {
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
          <div className="relative flex min-h-[215px] items-end overflow-hidden bg-[#0F3854] px-6 py-7 sm:min-h-[285px] sm:px-10 lg:px-14">
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
              <Check checked={category === "Parfum"}>
                <button
                  onClick={() =>
                    setCategory(category === "Parfum" ? "Semua" : "Parfum")
                  }
                >
                  Parfum
                </button>
              </Check>
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

function CatalogLanding() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua kategori");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const filteredProducts = useMemo(() => {
    const minimum = Number(minPrice.replace(/\D/g, "")) || 0;
    const maximum = Number(maxPrice.replace(/\D/g, "")) || Infinity;

    return PRODUCTS.filter((product) => {
      const price = Number(product.price.replace(/\D/g, ""));
      return (
        (category === "Semua kategori" || product.category === category) &&
        product.title.toLowerCase().includes(query.toLowerCase()) &&
        price >= minimum &&
        price <= maximum
      );
    });
  }, [category, maxPrice, minPrice, query]);

  function resetFilters() {
    setQuery("");
    setCategory("Semua kategori");
    setMinPrice("");
    setMaxPrice("");
  }

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-80px)] bg-[#f5f6f7] px-4 py-5 text-[#172036] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-5 rounded-2xl border border-[#e8e5e1] bg-white p-4 shadow-[0_6px_20px_rgba(15,56,84,0.04)] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b86645]">
                  KSHOOCKY shop
                </p>
                <h1 className="mt-1 text-2xl font-extrabold text-[#0F3854] sm:text-3xl">
                  Katalog Produk
                </h1>
              </div>
              <label className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-[#dfe3e8] bg-[#fbfcfd] px-4 transition-colors focus-within:border-[#0F3854] focus-within:ring-2 focus-within:ring-[#0F3854]/10 lg:max-w-[430px]">
                <Search className="h-5 w-5 shrink-0 text-[#8290a0]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari produk katalog"
                  className="w-full bg-transparent text-sm text-[#172036] outline-none placeholder:text-[#9aa5b1]"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <section className="rounded-2xl border border-[#e8e5e1] bg-white p-4 shadow-[0_6px_20px_rgba(15,56,84,0.04)]">
                <h2 className="text-sm font-extrabold text-[#172036]">
                  Kategori
                </h2>
                <button
                  onClick={() => setCategory("Semua kategori")}
                  className={`mt-4 w-full rounded-lg px-3 py-2.5 text-left text-sm font-bold transition-colors ${category === "Semua kategori" ? "bg-[#E5B869] text-[#172036]" : "text-[#526174] hover:bg-[#fff7e5]"}`}
                >
                  Semua kategori
                </button>
                <button
                  onClick={() => setCategory("Parfum")}
                  className={`mt-1 w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ${category === "Parfum" ? "bg-[#E5B869] text-[#172036]" : "text-[#526174] hover:bg-[#fff7e5]"}`}
                >
                  Parfum
                </button>
              </section>

              <section className="rounded-2xl border border-[#e8e5e1] bg-white p-4 shadow-[0_6px_20px_rgba(15,56,84,0.04)]">
                <h2 className="text-sm font-extrabold text-[#172036]">
                  Rentang Harga
                </h2>
                <div className="mt-4 space-y-2">
                  <input
                    value={minPrice}
                    onChange={(event) => setMinPrice(event.target.value)}
                    placeholder="Min (Rp)"
                    inputMode="numeric"
                    className="h-10 w-full rounded-lg border border-[#dfe3e8] px-3 text-sm outline-none placeholder:text-[#9aa5b1] focus:border-[#0F3854]"
                  />
                  <input
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                    placeholder="Maks (Rp)"
                    inputMode="numeric"
                    className="h-10 w-full rounded-lg border border-[#dfe3e8] px-3 text-sm outline-none placeholder:text-[#9aa5b1] focus:border-[#0F3854]"
                  />
                </div>
                <button
                  onClick={resetFilters}
                  className="mt-3 w-full text-center text-xs font-semibold text-[#0F3854] hover:text-[#b86645]"
                >
                  Reset filter
                </button>
              </section>
            </aside>

            <section className="min-w-0">
              <div className="flex min-h-14 items-center justify-between rounded-2xl border border-[#e8e5e1] bg-white px-4 shadow-[0_6px_20px_rgba(15,56,84,0.04)] sm:px-5">
                <p className="text-sm text-[#526174]">
                  <span className="font-extrabold text-[#172036]">{filteredProducts.length}</span>{" "}
                  produk
                </p>
                <label className="flex items-center gap-2 text-sm text-[#526174]">
                  <span className="hidden sm:inline">Urutkan</span>
                  <select className="rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 font-semibold text-[#172036] outline-none">
                    <option>Terbaru</option>
                    <option>Nama A-Z</option>
                  </select>
                </label>
              </div>

              {filteredProducts.length > 0 ? (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.title} product={product} />
                  ))}
                </div>
              ) : (
                <div className="mt-5 flex min-h-[390px] flex-col items-center justify-center rounded-2xl border border-[#e8e5e1] bg-white px-6 text-center shadow-[0_6px_20px_rgba(15,56,84,0.04)]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f2f7fa] text-[#0F3854]">
                    <PackageOpen className="h-9 w-9" strokeWidth={1.7} />
                  </div>
                  <h2 className="mt-5 text-xl font-extrabold text-[#172036]">
                    Produk tidak ditemukan
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[#8290a0]">
                    Coba ubah kata kunci atau rentang harga yang kamu pilih.
                  </p>
                  <button
                    onClick={resetFilters}
                    className="mt-6 rounded-lg bg-[#0F3854] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#174d70]"
                  >
                    Reset filter
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export { PreorderPage };
export default CatalogLanding;
