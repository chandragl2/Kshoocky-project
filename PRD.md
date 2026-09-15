# Product Requirement Document (PRD)
**Project Name:** kshoocky Web Application  
**Document Version:** 1.0 (MVP)  
**Platform:** Web Application (Responsive Desktop & Mobile)  
**Target Release:** Q4 2026  

---

## 1. Executive Summary
**kshoocky** adalah platform aplikasi web untuk layanan *Jasa Titip* (Jastip) dan logistik (forwarding) khusus produk K-Pop dan K-Lifestyle dari Korea Selatan ke Indonesia. Berbasis di Bandung, platform ini bertujuan mengotomatisasi pencatatan pesanan, memberikan transparansi pelacakan (tracking) barang kepada pelanggan, serta menghadirkan sistem katalog Pre-Order (PO) yang terpusat.

## 2. Objectives & Success Metrics
### 2.1. Objectives
* Menggantikan pelacakan manual (via chat) dengan sistem *Order Tracking* mandiri yang *real-time*.
* Menyediakan katalog produk *Pre-Order* yang informatif (menampilkan kuota, harga, dan *deadline*).
* Menyederhanakan alur kerja operasional Admin dalam memperbarui status pengiriman (*freight* & domestik).

### 2.2. Success Metrics
* Pengurangan volume *chat* pelanggan mengenai pertanyaan "barang sampai mana" hingga 80%.
* *Loading speed* halaman utama di bawah 2.5 detik.
* Stabilitas sistem dalam menangani pencarian resi secara serentak (mencegah *spam* menggunakan validasi *captcha*).

---

## 3. Target Audience
1. **End-User (Pelanggan):** Penggemar K-Pop, kolektor *merchandise*, dan pembeli produk Korea di Indonesia. Membutuhkan antarmuka pengguna yang bersih, responsif di HP, dan mudah dipahami.
2. **Administrator:** Tim operasional kshoocky yang bertugas memverifikasi pesanan, mengelola katalog PO, dan memperbarui histori logistik secara rutin.

---

## 4. Scope of Work (MVP - Minimum Viable Product)
### ✅ In Scope (MVP)
* Halaman utama dengan fitur pencarian resi (*Guest Tracking*).
* Visualisasi *timeline* status pengiriman paket.
* Katalog produk *Pre-Order* dan *Ready Stock*.
* Dasbor manajemen Admin (CRUD data pesanan dan update histori).
* Sistem Autentikasi dasar (Admin & User).

### ❌ Out of Scope (Tahap Selanjutnya)
* Integrasi *Payment Gateway* otomatis (Midtrans/Xendit).
* *Auto-generate* label pengiriman ekspedisi lokal (JNE/J&T) berformat PDF.
* Notifikasi pelacakan via WhatsApp API/Email otomatis.

---

## 5. Functional Requirements (FR)

### 5.1. User/Customer Module
| ID | Fitur | Deskripsi & Acceptance Criteria |
| :--- | :--- | :--- |
| **FR-U1** | **Pencarian Resi** | Pengguna dapat memasukkan ID Pesanan (misal: `OKR-2026-001`) atau Email untuk melacak paket. |
| **FR-U2** | **Keamanan Captcha** | Form pencarian resi dilengkapi validasi matematika sederhana (misal: `8 + 9 = ?`). Sistem menolak pencarian jika jawaban salah. |
| **FR-U3** | **Timeline UI** | Menampilkan detail barang dan daftar histori perjalanan paket secara kronologis vertikal (titik lokasi dan waktu). |
| **FR-U4** | **Katalog PO** | Menampilkan daftar produk dengan harga, status slot, dan *countdown deadline* PO. |
| **FR-U5** | **User Auth** | Pengguna dapat melakukan registrasi dan *login* menggunakan sistem autentikasi Supabase. |
| **FR-U6** | **User Dashboard** | Pengguna yang *login* dapat melihat tabel riwayat pesanan (PO & Resi) milik mereka sendiri. |

### 5.2. Admin Dashboard Module
| ID | Fitur | Deskripsi & Acceptance Criteria |
| :--- | :--- | :--- |
| **FR-A1** | **Admin Auth** | Halaman dasbor dilindungi proteksi rute (*Route Guard*) khusus pengguna dengan *role* 'admin'. |
| **FR-A2** | **Order Management** | Admin dapat menambah (*Create*), mengedit (*Update*), atau menghapus (*Delete*) data pesanan secara manual. |
| **FR-A3** | **Timeline Update** | Admin dapat menyisipkan log perjalanan baru ke dalam resi tertentu, yang otomatis mengubah `current_status` pesanan. |
| **FR-A4** | **Catalog Management** | Admin dapat mengelola produk (Unggah gambar, atur harga, edit deskripsi, dan buka/tutup kuota). |

---

## 6. Non-Functional Requirements (NFR)
1. **Design & UI/UX:** 
   * Menggunakan tema *Soft Modern K-Pop Aesthetic*.
   * Warna utama: Navy Blue (`#0F3854`) dan Warm Gold (`#E5B869`).
   * *Mobile-First Design* (responsif sempurna di ukuran layar ponsel).
2. **Performance:** *Server-Side Rendering (SSR)* menggunakan Next.js untuk mempercepat *Initial Page Load* dan SEO.
3. **Security:** Implementasi *Row Level Security (RLS)* di database PostgreSQL untuk memastikan data pesanan hanya bisa diakses oleh admin atau pemilik pesanan terkait.

---

## 7. Technology Stack
* **Frontend:** Next.js (App Router), React.js
* **Styling:** Tailwind CSS (dengan kustomisasi konfigurasi *theme*)
* **Backend & Database:** Supabase (BaaS, PostgreSQL, Auth API)
* **Deployment & CI/CD:** Vercel, GitHub

---

## 8. Database Architecture Schema

**1. Tabel `profiles`**
* `id` (UUID, berelasi dengan `auth.users`)
* `full_name`, `phone`, `address`, `role` (user/admin)

**2. Tabel `orders`**
* `id` (UUID, Primary Key)
* `user_id` (UUID, Foreign Key ke `profiles`, *nullable*)
* `order_number` (String, Unique)
* `item_name`, `origin_country`, `current_status`

**3. Tabel `order_histories`**
* `id` (UUID, Primary Key)
* `order_id` (UUID, Foreign Key ke `orders`)
* `status_title`, `location`, `notes`, `created_at` (Timestamp)

**4. Tabel `products`**
* `id` (UUID, Primary Key)
* `title`, `price`, `po_deadline` (Date), `status` (Open/Closed)

---

## 9. Delivery Phases (Roadmap)
* **Phase 1 (Setup & DB):** Konfigurasi Next.js, Tailwind, dan skema tabel Supabase.
* **Phase 2 (Tracking Module):** Implementasi halaman publik, *form search*, *captcha*, dan UI *Timeline*.
* **Phase 3 (Admin Panel):** Pembuatan antarmuka manajemen Admin (CRUD Orders & Histori).
* **Phase 4 (Catalog & Auth):** Implementasi fitur katalog Pre-Order dan sistem registrasi/login pelanggan.
* **Phase 5 (Launch):** UAT (*User Acceptance Testing*), *bug fixing*, dan *deployment* ke Vercel.