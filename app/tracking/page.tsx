"use client";

import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  HelpCircle,
  LockKeyhole,
  Mail,
  Search,
  Truck,
} from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

const CAPTCHA_ANSWER = "10";

export default function TrackingPage() {
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitted(false);

    if (!email.trim()) {
      setMessage("Masukkan email yang terdaftar terlebih dahulu.");
      return;
    }

    if (captcha !== CAPTCHA_ANSWER) {
      setMessage("Jawaban captcha belum tepat. Coba lagi.");
      return;
    }

    setMessage("");
    setIsSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-[#fbf7e7] text-[#172036]">
      <Navbar />

      <main>
        <section className="relative isolate overflow-hidden bg-[#121a2d] px-5 py-16 text-white sm:py-24 lg:py-28">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(63,123,158,0.18),transparent_48%)]" />
          <div className="absolute -right-24 top-8 -z-10 h-64 w-64 rounded-full border-[24px] border-[#3c7b9e]/15" />
          <div className="mx-auto max-w-[760px] text-center">
            <div className="hero-fade hero-delay-1 mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white/75">
              <Truck className="h-4 w-4 text-[#65a8ce]" />
              Lacak status pesanan
            </div>
            <h1 className="hero-title-line hero-delay-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Pelacakan <span className="text-[#E5B869]">Pesanan</span>
            </h1>
            <p className="hero-fade hero-delay-3 mx-auto mt-4 max-w-xl text-sm leading-6 text-[#b8c0d0] sm:text-base">
              Masukkan email terdaftar untuk melihat status dan riwayat pesanan
              Anda.
            </p>

            <form
              onSubmit={handleSubmit}
              className="hero-card-reveal mx-auto mt-8 max-w-[500px] text-left"
            >
              <label htmlFor="tracking-email" className="sr-only">
                Email terdaftar
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3.5 focus-within:border-[#65a8ce] focus-within:ring-2 focus-within:ring-[#65a8ce]/20">
                <Mail className="h-5 w-5 shrink-0 text-[#8dbbd5]" />
                <input
                  id="tracking-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="example@email.com"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#8b95a9]"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-[#d0d5df]">
                <span className="inline-flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4 text-[#e5b869]" />7 + 3 = ?
                </span>
                <label htmlFor="captcha" className="sr-only">
                  Jawaban captcha
                </label>
                <input
                  id="captcha"
                  inputMode="numeric"
                  value={captcha}
                  onChange={(event) => setCaptcha(event.target.value)}
                  placeholder="?"
                  className="h-10 w-16 rounded-lg border border-white/15 bg-white/10 px-3 text-center text-sm text-white outline-none placeholder:text-[#8b95a9] focus:border-[#65a8ce]"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#3c8aba] px-5 text-sm font-bold text-white transition-colors hover:bg-[#4b9bc9]"
                >
                  <Search className="h-4 w-4" />
                  Cari
                </button>
              </div>

              {message && (
                <p className="mt-4 text-center text-sm text-[#f2b7a8]">
                  {message}
                </p>
              )}
              {isSubmitted && (
                <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-[#a9d5a9]">
                  <CheckCircle2 className="h-4 w-4" />
                  Pencarian untuk {email} siap diproses.
                </p>
              )}
            </form>
          </div>
        </section>

        <section className="px-5 py-20 sm:py-24 lg:py-28">
          <div className="mx-auto flex max-w-[500px] flex-col items-center text-center">
            <div className="hero-fade hero-delay-2 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#f2ecd7]">
              <Box className="h-10 w-10 text-[#3c8aba]" strokeWidth={1.8} />
            </div>
            <h2 className="hero-fade hero-delay-3 mt-8 text-xl font-extrabold text-[#25334d]">
              Lacak Pesanan Anda
            </h2>
            <p className="hero-fade hero-delay-4 mt-3 max-w-sm text-sm leading-6 text-[#66758b]">
              Masukkan email terdaftar di atas untuk melihat semua pesanan dan
              riwayat statusnya.
            </p>
            <div className="hero-fade hero-delay-5 mt-10 flex items-center gap-2 text-xs font-semibold text-[#8490a0]">
              <HelpCircle className="h-4 w-4" />
              Butuh bantuan? Hubungi tim KSHOOCKY
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
