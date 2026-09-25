"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Home,
  LogOut,
  MapPin,
  Menu,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingBag,
  Truck,
  WalletCards,
  X,
} from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const workspaceLinks = [
  { label: "Overview", href: "/user", icon: Home },
  { label: "My Orders", href: "/user/orders", icon: ShoppingBag },
  { label: "My Shipments", href: "/user/shipments", icon: Truck },
  { label: "Catalog Orders", href: "/user/catalog", icon: BookOpen },
  { label: "Manifest Schedule", href: "/user/manifest", icon: MapPin },
];

const accountLinks = [
  { label: "Refund", href: "/user/refund", icon: RotateCcw },
  { label: "Billing", href: "/user/billing", icon: Receipt },
  { label: "My Wallet", href: "/user/wallet", icon: WalletCards },
  { label: "Address Book", href: "/user#address-book", icon: MapPin },
  { label: "Settings", href: "/user#settings", icon: Settings },
];

function SidebarContent({
  onNavigate,
  pathname,
  onLogout,
  isLoggingOut,
}: {
  onNavigate: () => void;
  pathname: string;
  onLogout: () => void;
  isLoggingOut: boolean;
}) {
  function isActive(href: string) {
    return href === "/user" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-6 py-6">
        <Link href="/" onClick={onNavigate} className="group block">
          <span className="text-xl font-extrabold tracking-[0.18em] text-white transition-colors group-hover:text-[#E5B869]">
            KSHOOCKY
          </span>
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
            Customer Workspace
          </span>
        </Link>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-4 py-7"
        aria-label="Dashboard navigation"
      >
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Workspace
        </p>
        <div className="mt-3 space-y-1">
          {workspaceLinks.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${isActive(href) ? "bg-[#3c8aba] text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </div>

        <p className="mt-9 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Account & Finance
        </p>
        <div className="mt-3 space-y-1">
          {accountLinks.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${isActive(href) ? "bg-[#3c8aba] text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="border-t border-white/10 px-4 py-5">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2f83b8] text-sm font-bold text-white">
            YC
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              Yonatan Chandra
            </p>
            <p className="text-xs text-slate-400">Customer</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="mt-5 flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-[17px] w-[17px]" strokeWidth={1.8} />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}

export default function UserDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      router.replace("/login");
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setIsSessionReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === "SIGNED_OUT" || !session) {
        router.replace("/login");
        return;
      }
      setIsSessionReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleLogout() {
    if (!isSupabaseConfigured) {
      router.replace("/login");
      return;
    }

    setIsLoggingOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  if (!isSessionReady) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] lg:flex">
      <aside className="hidden w-[260px] shrink-0 bg-[#0F3854] lg:fixed lg:inset-y-0 lg:left-0 lg:block">
        <SidebarContent
          onNavigate={() => undefined}
          pathname={pathname}
          onLogout={() => void handleLogout()}
          isLoggingOut={isLoggingOut}
        />
      </aside>
      {isSidebarOpen && (
        <button
          aria-label="Tutup navigasi"
          className="fixed inset-0 z-40 bg-[#071d2c]/60 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-[#0F3854] shadow-2xl transition-transform duration-300 lg:hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex justify-end px-4 pt-4">
          <button
            type="button"
            aria-label="Tutup navigasi"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="h-[calc(100%-52px)]">
          <SidebarContent
            onNavigate={() => setIsSidebarOpen(false)}
            pathname={pathname}
            onLogout={() => void handleLogout()}
            isLoggingOut={isLoggingOut}
          />
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-[260px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Buka navigasi"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-lg p-2 text-[#0F3854] hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-sm font-bold text-[#0F3854] sm:text-base">
                My Dashboard
              </p>
              <p className="hidden text-xs text-slate-500 sm:block">
                Welcome back, Yonatan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-[#E5B869] sm:flex">
              EN / ID <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <Link
              href="/catalog"
              className="hidden rounded-lg bg-[#0F3854] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#174e70] sm:block"
            >
              Katalog PO
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E5B869] text-xs font-extrabold text-[#0F3854]">
              YC
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
