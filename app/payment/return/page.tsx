"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, LockKeyhole, AlertCircle } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReturnPageState =
  | { status: "checking" }
  | { status: "invalid_order" }
  | { status: "needs_login"; targetPath: string; sessionCheckFailed: boolean };

function buildSafeOrderReturnPath(orderId: string | null): string | null {
  if (!orderId || !uuidPattern.test(orderId)) {
    return null;
  }
  return `/user/orders/${encodeURIComponent(orderId)}?paymentReturn=1`;
}

export default function DokuPaymentReturnPage() {
  const router = useRouter();
  const [state, setState] = useState<ReturnPageState>({ status: "checking" });

  useEffect(() => {
    let isMounted = true;

    async function resolveReturnNavigation() {
      const searchParams = new URLSearchParams(window.location.search);
      const targetPath = buildSafeOrderReturnPath(searchParams.get("orderId"));

      if (!targetPath) {
        if (isMounted) {
          setState({ status: "invalid_order" });
        }
        return;
      }

      if (!isSupabaseConfigured) {
        if (isMounted) {
          setState({
            status: "needs_login",
            targetPath,
            sessionCheckFailed: true,
          });
        }
        return;
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!error && data.session) {
          router.replace(targetPath);
          return;
        }

        setState({
          status: "needs_login",
          targetPath,
          sessionCheckFailed: Boolean(error),
        });
      } catch {
        if (isMounted) {
          setState({
            status: "needs_login",
            targetPath,
            sessionCheckFailed: true,
          });
        }
      }
    }

    void resolveReturnNavigation();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const loginHref =
    state.status === "needs_login"
      ? `/login?next=${encodeURIComponent(state.targetPath)}`
      : "/login";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        {state.status === "checking" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-[#0F3854]">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-[#0F3854]">
              Memproses Pengembalian Pembayaran
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Mohon tunggu sebentar, kami sedang mengarahkan Anda ke halaman
              status pesanan.
            </p>
          </>
        )}

        {state.status === "needs_login" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-[#0F3854]">
              Pembayaran Sedang Diverifikasi
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Terima kasih telah menyelesaikan proses di halaman pembayaran DOKU.
              Sistem kami sedang memverifikasi status pembayaran Anda.
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-left text-xs text-slate-600 flex items-start gap-2.5">
              <LockKeyhole className="h-4 w-4 shrink-0 text-[#0F3854] mt-0.5" />
              <span>
                {state.sessionCheckFailed
                  ? "Sesi akun tidak dapat diverifikasi otomatis di browser ini. Silakan masuk untuk melihat detail dan status terbaru pesanan Anda."
                  : "Untuk menjaga keamanan data pesanan, silakan masuk ke akun Anda untuk melihat detail dan status terbaru pesanan."}
              </span>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={loginHref}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#0F3854] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#13476a]"
              >
                Masuk untuk Cek Status Pesanan
              </Link>
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Kembali ke Beranda
              </Link>
            </div>
          </>
        )}

        {state.status === "invalid_order" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-[#0F3854]">
              Referensi Pesanan Tidak Ditemukan
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Tautan pengembalian pembayaran tidak memiliki referensi pesanan
              yang valid. Silakan masuk ke akun Anda untuk memeriksa daftar
              pesanan.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#0F3854] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#13476a]"
              >
                Masuk ke Akun
              </Link>
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Kembali ke Beranda
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
