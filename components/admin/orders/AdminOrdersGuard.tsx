"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function AdminOrdersGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [access, setAccess] = useState<
    "loading" | "allowed" | "denied" | "error"
  >("loading");

  useEffect(() => {
    let isMounted = true;
    if (!isSupabaseConfigured) {
      setAccess("error");
      return;
    }

    const supabase = createClient();
    const checkAdmin = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!isMounted) return;
      if (profileError) {
        setAccess("error");
        return;
      }
      if (profile?.role !== "admin") {
        setAccess("denied");
        router.replace("/user");
        return;
      }
      setAccess("allowed");
    };

    void checkAdmin().catch(() => {
      if (isMounted) setAccess("error");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.replace("/login");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (access === "loading") {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Memeriksa akses admin...
      </div>
    );
  }

  if (access !== "allowed") {
    return (
      <div
        role="alert"
        className="mx-auto my-8 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700"
      >
        {access === "denied"
          ? "Halaman ini hanya dapat diakses oleh admin."
          : "Akses admin gagal diverifikasi. Silakan coba lagi."}
      </div>
    );
  }

  return children;
}
