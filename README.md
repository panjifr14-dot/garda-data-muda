# Garda Data Muda (prototipe fullstack)

Prototipe untuk esai ASF 2026: kader pemuda memverifikasi keluarga, mendampingi sanggah, merujuk ke layanan, dan melaporkan kinerja ke dasbor publik. **Ini prototipe konsep, bukan sistem produksi.** Garda tidak mengubah data atau menetapkan desil; penetapan tetap oleh BPS.

## Stack
Node.js 22.5+ (Express) · SQLite bawaan (`node:sqlite`) · HTML/JS statis tanpa build.

## Menjalankan
```bash
npm install
npm start            # http://localhost:3000
```
- `/` aplikasi lapangan (penugasan, verifikasi berpasangan, unggah, rujukan)
- `/dashboard.html` dasbor agregat dan keluhan anonim
- Docker: `docker build -t garda . && docker run -p 3000:3000 garda`

## API
| Metode | Rute | Fungsi |
|---|---|---|
| GET | `/api/tasks` | daftar penugasan |
| POST | `/api/visits` | simpan verifikasi (RW verifikator berbeda, ≥3 butir, ≥1 foto, koordinat) |
| POST | `/api/visits/:id/upload` | unggah ke operator desa |
| POST | `/api/referrals` | rujukan layanan |
| GET/POST | `/api/complaints` | keluhan anonim |
| GET | `/api/stats` | agregat tanpa identitas |
| POST | `/api/demo/reset` | reset data demo (non-produksi) |

## Batasan yang perlu ditutup sebelum dipakai nyata
Belum ada autentikasi dan peran (Garda, fasilitator, operator, BPS), unggah foto sungguhan, koordinat dari perangkat, log audit, pembatasan laju, enkripsi data, dan kepatuhan UU 27 Tahun 2022 tentang Pelindungan Data Pribadi. Data seed hanya demo.

## Lisensi
MIT
