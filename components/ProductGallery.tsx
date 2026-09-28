"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { PointerEvent, useEffect, useRef, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ProductGalleryProps = {
  productId: string;
  productTitle: string;
  fallbackImageUrl: string | null;
};

export default function ProductGallery({
  productId,
  productTitle,
  fallbackImageUrl,
}: ProductGalleryProps) {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const pointerStartX = useRef<number | null>(null);
  const activeUrl = imageUrls[activeIndex];
  const visibleUrl = activeUrl
    ? failedUrls.has(activeUrl)
      ? fallbackImageUrl && !failedUrls.has(fallbackImageUrl)
        ? fallbackImageUrl
        : null
      : activeUrl
    : null;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setActiveIndex(0);
    setFailedUrls(new Set());

    async function loadImages() {
      if (!isSupabaseConfigured) {
        if (isMounted) {
          setImageUrls(fallbackImageUrl ? [fallbackImageUrl] : []);
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await createClient()
          .from("product_images")
          .select("image_url, is_primary, sort_order")
          .eq("product_id", productId)
          .order("sort_order", { ascending: true });
        if (error) throw error;

        const orderedRows = data ?? [];
        const primaryImage = orderedRows.find((image) => image.is_primary);
        const orderedUrls = [
          ...(primaryImage ? [primaryImage.image_url] : []),
          ...orderedRows
            .filter((image) => image !== primaryImage)
            .map((image) => image.image_url),
        ];
        const uniqueUrls = Array.from(new Set(orderedUrls));

        if (isMounted) {
          setImageUrls(
            uniqueUrls.length > 0
              ? uniqueUrls
              : fallbackImageUrl
                ? [fallbackImageUrl]
                : [],
          );
        }
      } catch {
        if (isMounted) {
          setImageUrls(fallbackImageUrl ? [fallbackImageUrl] : []);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadImages();
    return () => {
      isMounted = false;
    };
  }, [fallbackImageUrl, productId]);

  function showPrevious() {
    setActiveIndex(
      (index) => (index - 1 + imageUrls.length) % imageUrls.length,
    );
  }

  function showNext() {
    setActiveIndex((index) => (index + 1) % imageUrls.length);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerStartX.current = event.clientX;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (pointerStartX.current === null || imageUrls.length < 2) return;
    const distance = event.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (distance > 45) showPrevious();
    if (distance < -45) showNext();
  }

  return (
    <section
      role="region"
      aria-label={`Galeri foto ${productTitle}`}
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" && imageUrls.length > 1) {
          event.preventDefault();
          showPrevious();
        }
        if (event.key === "ArrowRight" && imageUrls.length > 1) {
          event.preventDefault();
          showNext();
        }
      }}
      className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-[#0F3854] focus-visible:ring-offset-2"
    >
      <div
        className="relative aspect-square touch-pan-y overflow-hidden bg-[#f1f1ef] sm:aspect-[4/3]"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStartX.current = null;
        }}
      >
        {visibleUrl ? (
          <Image
            key={visibleUrl}
            src={visibleUrl}
            alt={`${productTitle}, foto ${activeIndex + 1}`}
            fill
            unoptimized
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="object-contain p-3 sm:p-5"
            onError={() =>
              setFailedUrls((urls) => new Set(urls).add(visibleUrl))
            }
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm font-semibold text-[#8290a0]">
            {isLoading ? "Memuat foto produk..." : "Foto produk belum tersedia"}
          </div>
        )}

        {imageUrls.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto sebelumnya"
              onClick={showPrevious}
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#172036] shadow-md transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3854]"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Foto berikutnya"
              onClick={showNext}
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#172036] shadow-md transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3854]"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {imageUrls.length > 1 && (
        <>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p
              aria-live="polite"
              className="text-xs font-semibold text-[#526174]"
            >
              Foto {activeIndex + 1} dari {imageUrls.length}
            </p>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {imageUrls.map((url, index) => (
                <span
                  key={`${url}-${index}`}
                  className={`h-1.5 w-1.5 rounded-full ${index === activeIndex ? "bg-[#0F3854]" : "bg-[#cbd2d8]"}`}
                />
              ))}
            </div>
          </div>
          <div
            aria-label="Pilih foto produk"
            className="mt-3 flex gap-2 overflow-x-auto pb-1"
          >
            {imageUrls.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                aria-label={`Tampilkan foto ${index + 1} dari ${imageUrls.length}`}
                aria-pressed={activeIndex === index}
                onClick={() => setActiveIndex(index)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden border-2 bg-[#f1f1ef] sm:h-[72px] sm:w-[72px] ${activeIndex === index ? "border-[#0F3854]" : "border-transparent"}`}
              >
                {!failedUrls.has(url) ? (
                  <Image
                    src={url}
                    alt=""
                    fill
                    unoptimized
                    sizes="72px"
                    className="object-contain p-1"
                    onError={() =>
                      setFailedUrls((urls) => new Set(urls).add(url))
                    }
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] text-[#8290a0]">
                    Foto
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
