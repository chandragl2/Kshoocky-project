import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
// ─── Font ────────────────────────────────────────────────────────────────────
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
});

// ─── SEO Metadata ─────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "KSHOOCKY — Jastip & Forwarding Korea Terpercaya",
  description:
    "Layanan Jastip & Forwarding Korea terpercaya untuk K-POP, kosmetik, fashion, dan pengiriman kargo door-to-door ke seluruh Indonesia.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  keywords: [
    "jastip korea",
    "forwarding korea",
    "k-pop",
    "kshoocky",
    "pengiriman korea indonesia",
  ],
  openGraph: {
    title: "KSHOOCKY — Jastip & Forwarding Korea Terpercaya",
    description: "Belanja Korea kini lebih mudah bersama KSHOOCKY.",
    locale: "id_ID",
    type: "website",
  },
};

// ─── Root Layout ───────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="scroll-smooth">
      <body
        className={`${plusJakartaSans.className} min-h-screen flex flex-col bg-white`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
