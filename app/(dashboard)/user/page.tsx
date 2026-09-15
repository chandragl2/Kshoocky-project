import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Info,
  Package,
  Plane,
  Truck,
} from "lucide-react";

const summaryCards = [
  {
    title: "Proxy Orders",
    description: "Total barang dibeli",
    value: "0",
    icon: Package,
    iconClass: "bg-[#eef5fb] text-[#2f83b8]",
    statuses: ["0 Waiting", "0 Arrived"],
  },
  {
    title: "Forwarding",
    description: "Barang diproses ke gudang",
    value: "0",
    icon: Plane,
    iconClass: "bg-[#f1efff] text-[#6556d9]",
    statuses: ["0 Expected", "0 Arrived"],
  },
  {
    title: "Shipments",
    description: "Paket dalam perjalanan",
    value: "0",
    icon: Truck,
    iconClass: "bg-[#edf9f5] text-[#3e9d8b]",
    statuses: ["Active"],
  },
  {
    title: "Unpaid Bills",
    description: "Tagihan pelunasan & ongkir",
    value: "0",
    icon: Bell,
    iconClass: "bg-[#fff5d8] text-[#c48a24]",
    statuses: [],
  },
];

export default function UserDashboardPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
      <section className="mb-7 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c48a24]">
            Customer workspace
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0F3854] sm:text-3xl">
            Ringkasan aktivitasmu
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Pantau pesanan, forwarding, dan pengirimanmu di satu tempat.
          </p>
        </div>
        <Link
          href="/user/orders"
          className="hidden items-center gap-1 text-sm font-bold text-[#2f83b8] hover:text-[#0F3854] sm:flex"
        >
          Lihat semua pesanan <ArrowUpRight className="h-4 w-4" />
        </Link>
      </section>

      <section
        className="mb-8 rounded-2xl border border-[#c9def5] bg-[#eff6ff] p-5 shadow-sm sm:p-6"
        aria-labelledby="announcement-title"
      >
        <div className="flex gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#4285dc] shadow-sm">
            <Info className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="announcement-title"
              className="text-sm font-extrabold uppercase tracking-wide text-[#315db0]"
            >
              Perubahan nomor telepon WH KR
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Nomor telepon Korea (WH KR) terbaru yang perlu digunakan saat
              checkout dan mengirim barang:
            </p>
            <a
              href="tel:01056348887"
              className="mt-2 inline-block text-sm font-extrabold text-[#315db0] underline underline-offset-2"
            >
              010-5634-8887
            </a>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Pastikan nomor ini sudah sesuai agar proses penerimaan barang di
              warehouse berjalan lancar. Terima kasih atas perhatian dan kerja
              samanya.
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[#0F3854]">
              KSHOOCKY Warehouse
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="summary-title">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="summary-title"
            className="text-lg font-extrabold text-[#0F3854]"
          >
            Status pesanan
          </h2>
          <CheckCircle2 className="h-5 w-5 text-[#3e9d8b]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(
            ({
              title,
              description,
              value,
              icon: Icon,
              iconClass,
              statuses,
            }) => (
              <article
                key={title}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-[0.13em] text-slate-500">
                      {title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">{description}</p>
                  </div>
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-7 text-3xl font-extrabold text-[#0F3854]">
                  {value}
                </p>
                <div className="mt-4 flex min-h-5 flex-wrap gap-2">
                  {statuses.map((status) => (
                    <span
                      key={status}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500"
                    >
                      {status}
                    </span>
                  ))}
                </div>
              </article>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
