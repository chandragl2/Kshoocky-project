"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "mitafibrianty",
    initials: "MF",
    avatarClass: "bg-[#2f3a2f] text-white",
    text: "Akhirnya yang ditunggu-tunggu datang juga, bagus selalu bagus. Sayang-sayangku akhirnya mendarat dengan sempurna. Jastiper terbaik memang KSHOOCKY ini. Kaka KSHOOCKY-nya selalu ramah dan informatif, dan fast respon pokoknya.",
  },
  {
    name: "atanariel",
    initials: "A",
    avatarClass: "bg-[#d8b7e8] text-[#553b64]",
    text: "Langganan group order album disini. Selalu satisfied. Packing aman, bubble wrap tebal & pengiriman Bandung - Jakarta cepet. Ga ada complain & bakal ikutan group order lg. Thanks kak 💜",
  },
  {
    name: "anggunndya._",
    initials: "A",
    avatarClass: "bg-[#f1d7bd] text-[#6b4a3a]",
    text: "Paketnya sampai dengan selamat, cepet banget pula. KSHOOCKY emang seniat itu dari packing-nya yang super duper aman, tebel bubble wrap-nya oke banget, dan album-nya aman no damage 💗",
  },
  {
    name: "azril131117",
    initials: "A",
    avatarClass: "bg-[#c9d7df] text-[#304754]",
    text: "Selalu puas tiap jajan ke dia, pokoknya the best lah. Olshop ini harus semakin sukses. KSHOOCKY-nya baik, ramah, amanah dan freebies-nya cakep-cakep. Terimakasih!",
  },
];

const RATING = 5;

export default function TestimonialCard() {
  const [activeIndex, setActiveIndex] = useState(0);
  const testimonial = TESTIMONIALS[activeIndex];

  function showPrevious() {
    setActiveIndex(
      (currentIndex) =>
        (currentIndex - 1 + TESTIMONIALS.length) % TESTIMONIALS.length,
    );
  }

  function showNext() {
    setActiveIndex((currentIndex) => (currentIndex + 1) % TESTIMONIALS.length);
  }

  return (
    <div className="hero-card-reveal relative w-full max-w-[40rem] rounded-2xl border border-white/10 bg-[#162032]/95 p-5 shadow-2xl shadow-black/25 sm:p-7">
      <div
        className="absolute -right-1 -top-7 select-none text-5xl drop-shadow-lg sm:-right-2 sm:-top-9 sm:text-6xl"
        aria-hidden="true"
      >
        🐱
      </div>

      <div className="pr-10 sm:pr-12">
        <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Apa Kata Mereka?
        </h2>
        <p className="mt-2 text-sm text-gray-400 sm:text-base">
          Testimoni dari pelanggan setia KSHOOCKY
        </p>
      </div>

      <div className="mt-6 min-h-[8.25rem] rounded-xl border border-white/5 bg-[#1e2d42] p-4 transition-all duration-300 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ring-2 ring-white/10 sm:h-14 sm:w-14 ${testimonial.avatarClass}`}
            aria-label={`${testimonial.name} avatar`}
          >
            {testimonial.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="font-bold text-white sm:text-lg">
                {testimonial.name}
              </p>
              <div
                className="flex gap-0.5 text-[#E5B869]"
                aria-label={`${RATING} dari 5 bintang`}
              >
                {Array.from({ length: RATING }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" />
                ))}
              </div>
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-300 sm:text-base">
              “{testimonial.text}”
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex gap-2" aria-label="Pilih testimoni">
          {TESTIMONIALS.map((item, index) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Tampilkan testimoni ${item.name}`}
              aria-current={activeIndex === index ? "true" : undefined}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                activeIndex === index
                  ? "w-6 bg-[#3C7B9E]"
                  : "w-2.5 bg-white/25 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={showPrevious}
            aria-label="Testimoni sebelumnya"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/15"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={showNext}
            aria-label="Testimoni berikutnya"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/15"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
