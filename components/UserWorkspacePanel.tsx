import {
  Archive,
  ArrowDownToLine,
  Box,
  FileText,
  Plus,
  Search,
  Truck,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type PanelVariant =
  | "orders"
  | "shipments"
  | "billing"
  | "refund"
  | "wallet"
  | "catalog"
  | "manifest";

const panelCopy: Record<PanelVariant, { title: string; subtitle: string }> = {
  orders: {
    title: "My Orders",
    subtitle: "Kelola pesanan proxy dan forwarding kamu.",
  },
  shipments: {
    title: "My Shipments",
    subtitle: "Pantau paket yang sedang dikirim ke Indonesia.",
  },
  billing: {
    title: "Invoices",
    subtitle: "Lihat invoice proxy dan biaya pengiriman.",
  },
  refund: {
    title: "Balance & Withdrawal",
    subtitle: "Kelola dana dari pembatalan atau kelebihan pembayaran.",
  },
  wallet: { title: "My Wallet", subtitle: "Kelola saldo KSHOOCKY kamu." },
  catalog: {
    title: "Catalog Orders",
    subtitle: "Pesan produk pilihan dari katalog KSHOOCKY.",
  },
  manifest: {
    title: "Manifest Schedule",
    subtitle: "Lihat jadwal keberangkatan dan kedatangan paket.",
  },
};

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[285px] flex-col items-center justify-center border-t border-slate-100 px-5 text-center">
      <Icon className="h-11 w-11 text-slate-300" strokeWidth={1.5} />
      <h3 className="mt-4 text-base font-extrabold text-slate-700">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function Tabs({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <button
          key={item}
          className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${index === 0 ? "border-[#3c8aba] bg-[#3c8aba] text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-[#3c8aba] hover:text-[#3c8aba]"}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export default function UserWorkspacePanel({
  variant,
}: {
  variant: PanelVariant;
}) {
  const copy = panelCopy[variant];

  if (variant === "refund") {
    return (
      <PageFrame title={copy.title} subtitle={copy.subtitle}>
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl bg-[#3c8aba] p-6 text-white shadow-lg shadow-[#3c8aba]/20">
            <p className="text-xs font-bold uppercase tracking-wider text-white/75">
              Active balance (IDR)
            </p>
            <p className="mt-2 text-4xl font-extrabold">Rp 0</p>
            <button className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#3c8aba]">
              Withdraw funds
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[#172036]">
                Your bank accounts
              </h2>
              <button className="flex items-center gap-1 text-sm font-bold text-[#3c8aba]">
                <Plus className="h-4 w-4" /> Add account
              </button>
            </div>
            <p className="mt-10 text-center text-sm text-slate-500">
              No bank accounts yet. Please add one to withdraw funds.
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
          <h2 className="p-5 text-lg font-extrabold text-[#172036]">
            Withdrawal history
          </h2>
          <EmptyState
            icon={ArrowDownToLine}
            title="No withdrawal history"
            description="Riwayat penarikan dana akan muncul di sini."
          />
        </div>
      </PageFrame>
    );
  }

  if (variant === "wallet") {
    return (
      <PageFrame
        title={copy.title}
        subtitle={copy.subtitle}
        action="Top Up Balance"
      >
        <div className="max-w-[360px] rounded-2xl bg-gradient-to-br from-[#3c8aba] to-[#3269d5] p-7 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-white/75">
            Wallet balance IDR
          </p>
          <p className="mt-3 text-4xl font-extrabold">Rp 0</p>
          <span className="mt-5 inline-block rounded-md bg-white/20 px-3 py-1 text-xs font-bold">
            Active
          </span>
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
          <h2 className="p-5 text-lg font-extrabold text-[#172036]">
            Mutation history (IDR)
          </h2>
          <EmptyState
            icon={WalletCards}
            title="No mutation history"
            description="Aktivitas saldo kamu akan muncul di sini."
          />
        </div>
      </PageFrame>
    );
  }

  if (variant === "billing") {
    return (
      <PageFrame title={copy.title} subtitle={copy.subtitle}>
        <Tabs items={["Proxy Invoices (0)", "Shipping Invoices (0)"]} />
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="hidden grid-cols-5 gap-4 border-b border-slate-100 px-5 py-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 sm:grid">
            <span>Invoice number</span>
            <span>Status</span>
            <span>Type</span>
            <span>Total amount</span>
            <span>Date</span>
          </div>
          <EmptyState
            icon={FileText}
            title="No data"
            description="Belum ada invoice untuk ditampilkan."
          />
        </div>
      </PageFrame>
    );
  }

  const isShipment = variant === "shipments";
  const isManifest = variant === "manifest";
  const isCatalog = variant === "catalog";
  return (
    <PageFrame title={copy.title} subtitle={copy.subtitle}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          items={
            isShipment
              ? ["Active (0)", "Delivered (0)"]
              : isManifest
                ? ["Upcoming (0)", "Completed (0)"]
                : isCatalog
                  ? ["All Catalog Orders (0)", "Pending (0)"]
                  : ["Proxy Online (0)", "Proxy Offline (0)", "Forwarding (0)"]
          }
        />
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          <input
            className="w-full bg-transparent outline-none placeholder:text-slate-400"
            placeholder={
              isShipment
                ? "Search tracking..."
                : isManifest
                  ? "Search manifest..."
                  : "Search order..."
            }
          />
        </label>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <EmptyState
          icon={
            isShipment
              ? Truck
              : isManifest
                ? FileText
                : isCatalog
                  ? Box
                  : Archive
          }
          title={
            isShipment
              ? "No shipments yet"
              : isManifest
                ? "No manifest schedule"
                : isCatalog
                  ? "No catalog orders yet"
                  : "No orders yet"
          }
          description={
            isShipment
              ? "Paket aktif kamu akan muncul di sini."
              : isManifest
                ? "Jadwal manifest akan muncul saat tersedia."
                : isCatalog
                  ? "Pesanan dari katalog akan muncul di sini."
                  : "Pesanan kamu akan muncul di sini."
          }
        />
      </div>
    </PageFrame>
  );
}

function PageFrame({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 lg:px-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#172036] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {action && (
          <button className="rounded-xl bg-[#3c8aba] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#327ba8]">
            {action}
          </button>
        )}
      </header>
      {children}
    </div>
  );
}
