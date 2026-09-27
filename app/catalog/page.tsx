"use client";

import { useEffect, useMemo, useState } from "react";
import { PackageOpen, Search } from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ProductCard, { Product } from "@/components/ProductCard";
import { useProducts } from "@/hooks/useProducts";

function CatalogLanding() {
  const { products, isLoading, loadError } = useProducts("active");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua kategori");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const filteredProducts = useMemo(() => {
    const minimum = Number(minPrice.replace(/\D/g, "")) || 0;
    const maximum = Number(maxPrice.replace(/\D/g, "")) || Infinity;

    return products.filter((product) => {
      const price = product.price;
      return (
        (category === "Semua kategori" || product.category === category) &&
        product.title.toLowerCase().includes(query.toLowerCase()) &&
        price >= minimum &&
        price <= maximum
      );
    });
  }, [category, maxPrice, minPrice, products, query]);
  const categories = Array.from(
    new Set(products.map((product) => product.category).filter(Boolean)),
  );

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
                {categories.map((item) => (
                  <button
                    key={item}
                    onClick={() => setCategory(item ?? "Semua kategori")}
                    className={`mt-1 w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ${category === item ? "bg-[#E5B869] text-[#172036]" : "text-[#526174] hover:bg-[#fff7e5]"}`}
                  >
                    {item}
                  </button>
                ))}
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
                  <span className="font-extrabold text-[#172036]">
                    {filteredProducts.length}
                  </span>{" "}
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

              {isLoading ? (
                <p className="mt-5 rounded-xl border border-[#e8e5e1] bg-white p-10 text-center text-sm text-slate-500">
                  Sementara memuat produk...
                </p>
              ) : loadError ? (
                <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-10 text-center text-sm text-red-700">
                  Produk gagal dimuat. Silakan coba lagi.
                </p>
              ) : filteredProducts.length > 0 ? (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="mt-5 flex min-h-[390px] flex-col items-center justify-center rounded-2xl border border-[#e8e5e1] bg-white px-6 text-center shadow-[0_6px_20px_rgba(15,56,84,0.04)]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f2f7fa] text-[#0F3854]">
                    <PackageOpen className="h-9 w-9" strokeWidth={1.7} />
                  </div>
                  <h2 className="mt-5 text-xl font-extrabold text-[#172036]">
                    {products.length === 0
                      ? "Belum ada produk tersedia."
                      : "Produk tidak ditemukan"}
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[#8290a0]">
                    {products.length === 0
                      ? "Produk akan tampil di sini setelah tersedia."
                      : "Coba ubah kata kunci atau rentang harga yang kamu pilih."}
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

export default CatalogLanding;
