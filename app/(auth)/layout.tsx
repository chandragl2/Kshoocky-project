// Layout khusus untuk halaman autentikasi (login & register).
// Tidak menyertakan Navbar agar tampilan lebih fokus dan clean.
export const metadata = {
  title: "Daftar — KSHOOCKY",
  description:
    "Buat akun KSHOOCKY baru dan mulai belanja produk Korea dengan mudah.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
