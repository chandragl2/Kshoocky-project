import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Headphones,
  MapPin,
  Sparkles,
  Star,
  Ticket,
  Users,
} from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

const VALUES = [
  {
    icon: Heart,
    title: "Dibuat untuk fans",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere, nisl a facilisis suscipit, erat justo consequat nunc.",
  },
  {
    icon: Ticket,
    title: "Pengalaman tanpa drama",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur luctus, purus sed tincidunt commodo, justo arcu gravida.",
  },
  {
    icon: Sparkles,
    title: "Detail yang berarti",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices.",
  },
];

const MILESTONES = [
  {
    year: "01",
    label: "Seoul sourcing",
    text: "Menemukan rilisan dan lifestyle item pilihan.",
  },
  {
    year: "02",
    label: "Fan first service",
    text: "Menghubungkan Korea dengan kolektor Indonesia.",
  },
  {
    year: "03",
    label: "Stage berikutnya",
    text: "Membuat setiap paket terasa seperti comeback day.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="overflow-hidden bg-[#fffaf5] text-[#172036]">
        <section className="relative isolate min-h-[620px] overflow-hidden bg-[#0B1320] text-white">
          <Image
            src="/sampul.jpg"
            alt="Tirai panggung merah KSHOOCKY"
            fill
            priority
            className="object-cover object-center opacity-45"
          />
          <div className="absolute inset-0 bg-[#0B1320]/65" />
          <div className="absolute left-[8%] top-20 h-3 w-3 rounded-full bg-[#E5B869] shadow-[0_0_24px_8px_rgba(229,184,105,0.45)]" />
          <div className="absolute right-[14%] top-32 h-2 w-2 rounded-full bg-white shadow-[0_0_18px_6px_rgba(255,255,255,0.4)]" />
          <div className="relative mx-auto flex min-h-[620px] max-w-[1320px] items-end px-5 pb-16 pt-24 lg:px-8 lg:pb-24">
            <div className="max-w-3xl">
              <div className="hero-fade hero-delay-1 mb-7 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-[#E5B869]">
                <span className="h-px w-10 bg-[#E5B869]" />
                ABOUT KSHOOCKY
              </div>
              <h1 className="max-w-4xl text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-7xl lg:text-8xl">
                <span className="hero-title-line hero-delay-2 inline-block text-[#E5B869]">
                  ABOUT KSHOOCKY
                </span>
              </h1>
              <p className="hero-fade hero-delay-4 mt-7 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
                <span className="mb-3 block text-lg font-bold text-white sm:text-xl">
                  Annyeong, Chingudeul!
                </span>
                Berdiri sejak akhir 2020, Kshoocky hadir dari sesama fans yang
                paham banget rasanya pengen "meluk bias" lewat merchandise tanpa
                bikin dompet nangis! 😭
              </p>
              <div className="hero-fade hero-delay-5 mt-9 flex flex-wrap gap-3">
                <Link
                  href="/preorder"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#E5B869] px-5 py-3 text-sm font-bold text-[#0B1320] transition-colors hover:bg-[#f1cf8d]"
                >
                  Jelajahi koleksi <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#cerita"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/20"
                >
                  Kenali kami
                </a>
              </div>
            </div>
            <div className="hero-fade hero-delay-6 absolute bottom-8 right-8 hidden items-center gap-3 text-xs font-bold uppercase tracking-[0.25em] text-white/55 lg:flex">
              <Headphones className="h-4 w-4 text-[#E5B869]" />
              Stage 01 / KSHOOCKY
            </div>
          </div>
        </section>

        <section
          id="cerita"
          className="mx-auto max-w-[1320px] px-5 py-20 lg:px-8 lg:py-28"
        >
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-24">
            <div className="hero-fade hero-delay-1">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#b86645]">
                Behind the stage
              </p>
              <h2 className="mt-4 text-4xl font-extrabold leading-tight text-[#0F3854] sm:text-5xl">
                Lebih dari sekadar titip beli.
              </h2>
              <div className="mt-8 flex items-center gap-3 text-sm font-bold text-[#0F3854]">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E5B869]">
                  <MapPin className="h-5 w-5" />
                </span>
                Seoul <span className="text-[#b86645]">✦</span> Bandung
              </div>
            </div>
            <div className="hero-card-reveal space-y-5 text-sm leading-7 text-[#66758b] sm:text-base">
              <p>
                Dulu khusus buat ARMY, sekarang Kshoocky makin level up! Kita
                siap bantu kalian copping merch K-Pop all fandom, war tiket
                konser, sampai jastip skincare &amp; fashion hits dengan harga
                super affordable dan pastinya 100% trusted.
              </p>
              <p className="font-semibold text-[#0F3854]">
                Stop pusing! Kshoocky siap amankan semua wishlist kamu!
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-[#eadfd3] bg-[#f5eee5]">
          <div className="mx-auto grid max-w-[1320px] grid-cols-1 px-5 sm:grid-cols-3 lg:px-8">
            {MILESTONES.map((milestone, index) => (
              <div
                key={milestone.year}
                className={`hero-fade hero-delay-${index + 2} relative px-0 py-8 sm:px-7 sm:py-12 ${index < MILESTONES.length - 1 ? "border-b border-[#eadfd3] sm:border-b-0 sm:border-r" : ""}`}
              >
                <p className="text-4xl font-extrabold text-[#E5B869]">
                  {milestone.year}
                </p>
                <h3 className="mt-3 font-extrabold text-[#0F3854]">
                  {milestone.label}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#66758b]">
                  {milestone.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-5 py-20 lg:px-8 lg:py-28">
          <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#b86645]">
                Our fan guide
              </p>
              <h2 className="mt-4 text-4xl font-extrabold text-[#0F3854] sm:text-5xl">
                Nilai yang kami bawa.
              </h2>
            </div>
            <div
              className="flex gap-1 text-[#E5B869]"
              aria-label="Lima bintang"
            >
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="h-5 w-5 fill-current" />
              ))}
            </div>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {VALUES.map(({ icon: Icon, title, text }, index) => (
              <article
                key={title}
                className={`hero-card-reveal hero-delay-${index + 2} border border-[#eadfd3] bg-white p-6 shadow-[0_12px_30px_rgba(15,56,84,0.05)]`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0F3854] text-[#E5B869]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold tracking-[0.2em] text-[#b86645]">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-8 text-lg font-extrabold text-[#0F3854]">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#66758b]">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#0F3854] px-5 py-16 text-center text-white lg:px-8 lg:py-20">
          <Users className="hero-fade hero-delay-1 mx-auto h-8 w-8 text-[#E5B869]" />
          <h2 className="hero-title-line hero-delay-2 mx-auto mt-5 max-w-2xl text-3xl font-extrabold sm:text-4xl">
            Siap ikut perjalanan berikutnya?
          </h2>
          <p className="hero-fade hero-delay-3 mx-auto mt-4 max-w-xl text-sm leading-6 text-white/70">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mari mulai
            dari satu produk favoritmu.
          </p>
          <Link
            href="/preorder"
            className="hero-fade hero-delay-4 mt-7 inline-flex items-center gap-2 rounded-xl bg-[#E5B869] px-6 py-3 text-sm font-bold text-[#0B1320] hover:bg-[#f1cf8d]"
          >
            Lihat Pre Order <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
