# SAVIXARA Website — V1 Frontend

Ini adalah fondasi frontend awal SAVIXARA berdasarkan blueprint yang sudah disepakati.

## Stack
- React
- Vite
- CSS custom dengan design tokens
- Lucide icons

## Menjalankan
```bash
npm install
npm run dev
```

## Build produksi
```bash
npm run build
```

## Prinsip
- Warna tersentralisasi di `src/styles.css` sehingga theme dapat diganti.
- Game/layanan/promosi menggunakan data array sekarang; nantinya dipindahkan ke API/database.
- Gambar game/banner dapat diganti tanpa mengubah komponen UI.
- Backend, payment gateway, provider H2H, auth, admin panel, dan database belum diaktifkan pada V1 ini.

## Tahap berikutnya
1. Sambungkan database.
2. Buat Admin Panel + Media Library.
3. Buat API katalog/produk.
4. Integrasikan provider H2H dalam sandbox.
5. Integrasikan payment gateway sandbox.
6. Tambahkan checkout, order state machine, webhook, dan cek transaksi.
