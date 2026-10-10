"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { PointerEvent, useEffect, useRef, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database";
import TestimonialCard from "./TestimonialCard";

type FeaturedEvent = Database["public"]["Tables"]["featured_events"]["Row"];

function isPublicEvent(event: FeaturedEvent, now: number) {
  return (
    event.is_active &&
    (!event.starts_at || new Date(event.starts_at).getTime() <= now) &&
    (!event.ends_at || new Date(event.ends_at).getTime() >= now)
  );
}

function getCtaHref(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return { href: trimmed, external: false };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return { href: url.toString(), external: true };
    }
  } catch {
    return null;
  }
  return null;
}

function FeaturedEventMedia({ event }: { event: FeaturedEvent }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const useImage = event.media_type === "image" || videoFailed;
  const imageUrl =
    event.media_type === "image" ? event.media_url : event.thumbnail_url;

  useEffect(() => {
    const video = videoRef.current;
    if (event.media_type !== "video" || videoFailed || !video) return;
    void video.play().catch(() => undefined);
    return () => video.pause();
  }, [event.media_type, event.media_url, videoFailed]);

  if (useImage) {
    if (!imageUrl) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-[#FFF9F2] px-6 text-center text-sm font-semibold text-[#1F1F2B]/70">
          Preview video tidak tersedia.
        </div>
      );
    }

    return (
      <Image
        src={imageUrl}
        alt={event.title}
        fill
        unoptimized
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-contain"
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={event.media_url}
      poster={event.thumbnail_url ?? undefined}
      autoPlay
      muted
      playsInline
      loop
      onError={() => setVideoFailed(true)}
      className="absolute inset-0 h-full w-full bg-[#0B1320] object-contain"
    />
  );
}

export default function HeroSection() {
  const [events, setEvents] = useState<FeaturedEvent[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const pointerStartX = useRef<number | null>(null);
  const slideCount = events.length + 1;
  const activeEvent = activeSlide > 0 ? events[activeSlide - 1] : null;

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      if (!isSupabaseConfigured) return;
      try {
        const { data, error } = await createClient()
          .from("featured_events")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });
        if (error) throw error;

        const now = Date.now();
        const visibleEvents = (data ?? []).filter((event) =>
          isPublicEvent(event, now),
        );
        if (isMounted) setEvents(visibleEvents);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[Featured Events] Homepage query failed.", error);
        }
        if (isMounted) setEvents([]);
      }
    }

    void loadEvents();
    return () => {
      isMounted = false;
    };
  }, []);

  function showSlide(index: number) {
    setActiveSlide((index + slideCount) % slideCount);
  }

  function showPrevious() {
    showSlide(activeSlide - 1);
  }

  function showNext() {
    showSlide(activeSlide + 1);
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    pointerStartX.current = event.clientX;
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (pointerStartX.current === null || slideCount < 2) return;
    const distance = event.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (distance > 45) showPrevious();
    if (distance < -45) showNext();
  }

  return (
    <section
      className={`relative flex min-h-[calc(100vh-76px)] w-full flex-col items-center justify-center overflow-hidden px-8 ${activeEvent ? "bg-[#FBF5EA] text-[#1F1F2B]" : "bg-[#FFF9F2] text-[#1F1F2B]"}`}
      aria-label="Hero"
    >
      <div
        className={`pointer-events-none absolute left-1/4 top-0 h-96 w-96 rounded-full blur-3xl ${activeEvent ? "bg-[#F4A6B8]/15" : "bg-[#F4A6B8]/25"}`}
      />
      <div
        className={`pointer-events-none absolute bottom-0 right-1/4 h-64 w-64 rounded-full blur-3xl ${activeEvent ? "bg-[#E5B869]/5" : "bg-[#FFD166]/20"}`}
      />

      <div
        role="region"
        aria-label="Homepage carousel"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" && slideCount > 1) {
            event.preventDefault();
            showPrevious();
          }
          if (event.key === "ArrowRight" && slideCount > 1) {
            event.preventDefault();
            showNext();
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStartX.current = null;
        }}
        className="relative z-10 w-full max-w-7xl touch-pan-y py-20 outline-none focus-visible:ring-2 focus-visible:ring-[#0F3854] focus-visible:ring-offset-4"
      >
        {activeEvent ? (
          <div
            key={activeEvent.id}
            aria-live="polite"
            className="flex w-full flex-col items-center gap-16 lg:flex-row"
          >
            <div className="flex flex-col lg:w-1/2">
              <div className="hero-fade hero-delay-1 mb-6 inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.28em] text-[#C92A4B]">
                <span className="h-px w-10 bg-[#F4A6B8]" />
                FEATURED EVENT
              </div>
              <h1 className="hero-title-line hero-delay-2 mb-6 text-4xl font-extrabold leading-[1.05] text-[#1F1F2B] sm:text-5xl lg:text-6xl">
                {activeEvent.title}
              </h1>
              {activeEvent.description && (
                <p className="hero-fade hero-delay-4 mb-10 max-w-lg whitespace-pre-line text-lg leading-relaxed text-[#1F1F2B]/75 sm:text-xl">
                  {activeEvent.description}
                </p>
              )}
              {activeEvent.cta_text &&
                activeEvent.cta_url &&
                (() => {
                  const cta = getCtaHref(activeEvent.cta_url);
                  if (!cta) return null;
                  const className =
                    "inline-flex w-fit items-center gap-2 rounded-xl bg-[#C92A4B] px-8 py-4 font-bold text-white shadow-lg shadow-[#C92A4B]/20 transition-all hover:bg-[#A92340]";
                  return cta.external ? (
                    <a
                      href={cta.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={className}
                    >
                      {activeEvent.cta_text}{" "}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <Link href={cta.href} className={className}>
                      {activeEvent.cta_text}
                    </Link>
                  );
                })()}
            </div>

            <div className="w-full lg:w-1/2">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[#F4A6B8]/30 bg-[#FFF9F2] shadow-xl shadow-[#C92A4B]/10">
                <FeaturedEventMedia event={activeEvent} />
              </div>
            </div>
          </div>
        ) : (
          <div
            aria-live="polite"
            className="flex w-full flex-col items-center gap-16 lg:flex-row"
          >
            <div className="flex flex-col lg:w-1/2">
              <div className="hero-fade hero-delay-1 mb-6 inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.28em] text-[#C92A4B]">
                <span className="h-px w-10 bg-[#F4A6B8]" />
                ABOUT KSHOOCKY
              </div>

              <h1 className="mb-6 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
                <span className="hero-title-line hero-delay-2 inline-block text-[#1F1F2B]">
                  Annyeong, Chingudeul!
                </span>
              </h1>

              <div className="hero-fade hero-delay-4 mb-10 max-w-lg text-lg leading-relaxed text-[#1F1F2B] sm:text-xl">
                <p>
                  Berdiri sejak akhir 2020, Kshoocky hadir buat bantu kamu
                  &quot;meluk bias&quot; lewat merch impian tanpa bikin dompet
                  nangis! Nggak cuma buat ARMY, sekarang kita siap bantu jastip
                  merch all fandom, war tiket konser, sampai jastip skincare
                  &amp; fashion dengan harga super affordable &amp; 100%
                  trusted!
                </p>
                <p className="mt-6 text-xl font-bold leading-snug text-[#C92A4B] sm:text-2xl">
                  Stop pusing, Kshoocky siap amankan semua wishlist-mu!
                </p>
              </div>

              <div className="hero-fade hero-delay-6 flex flex-wrap gap-4">
                <Link
                  href="/register"
                  className="flex items-center gap-2 rounded-xl bg-[#C92A4B] px-8 py-4 font-bold text-white shadow-lg shadow-[#C92A4B]/25 transition-all hover:bg-[#A92340]"
                >
                  Daftar Sekarang — Gratis! →
                </Link>
              </div>
            </div>

            <div className="relative flex w-full justify-center lg:w-1/2">
              <TestimonialCard />
            </div>
          </div>
        )}

        {events.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={showPrevious}
              aria-label="Slide sebelumnya"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1F1F2B]/10 bg-[#FFF9F2] text-[#1F1F2B] shadow-sm transition hover:bg-[#F4A6B8]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C92A4B]"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2" aria-label="Pilih slide">
              {Array.from({ length: slideCount }).map((_, index) => (
                <button
                  key={index === 0 ? "about" : events[index - 1].id}
                  type="button"
                  onClick={() => showSlide(index)}
                  aria-label={
                    index === 0
                      ? "Slide About Kshoocky dan testimonial"
                      : `Slide ${events[index - 1].title}`
                  }
                  aria-current={activeSlide === index ? "true" : undefined}
                  className={`h-2.5 rounded-full transition-all ${activeSlide === index ? "w-7 bg-[#C92A4B]" : "w-2.5 bg-[#1F1F2B]/20 hover:bg-[#1F1F2B]/40"}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={showNext}
              aria-label="Slide berikutnya"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1F1F2B]/10 bg-[#FFF9F2] text-[#1F1F2B] shadow-sm transition hover:bg-[#F4A6B8]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C92A4B]"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
