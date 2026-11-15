# 🏍️ DRAG BIKE

Game balap motor **drag race 402 meter (quarter mile)** yang bisa **mabar** — lawan bot AI, duel 2 pemain di satu perangkat, atau balapan online bareng teman lewat room.

Semua grafis digambar dengan canvas/CSS (tanpa aset eksternal), suara mesin dari WebAudio (tanpa file audio). Bisa dibuka langsung dari `index.html` tanpa build step, dan bisa dibungkus jadi **APK Android** lewat Capacitor + GitHub Actions.

## 🎮 Cara Main

1. Buka `index.html` di browser (atau jalankan server statis, lihat bawah).
2. Di menu utama pilih **BALAP** (lawan bot), **MABAR** (2 pemain / online), **GARASI** (upgrade motor), atau **CARA MAIN**.
3. Lampu menyala **3-2-1 lalu GO!** — tekan GAS tepat saat GO.
   - Gas sebelum GO = **FALSE START** → langsung kalah.
   - Reaction time (waktu reaksimu) tercatat di HUD.
4. Tahan GAS, perhatikan **RPM**: pindah gigi saat jarum di **zona hijau** (power band) supaya akselerasi maksimal.
   - Terlalu cepat pindah = ngempos, terlalu lambat = mentok limiter.
5. Tekan **NITRO** untuk boost — jumlahnya terbatas, pakai di momen yang tepat (gigi 3–4 atau menjelang finis).
6. Finis 402m duluan = menang, dapat **koin** buat upgrade motor di Garasi.

### 🤖 Lawan Bot

| Bot | Kesulitan | Top Speed | Hadiah Menang |
|---|---|---|---|
| Budi Santai | Pemula | 175 km/jam | 100 🪙 |
| Raka Kilat | Pro | 198 km/jam | 250 🪙 |
| Dedi Petir | Legenda | 218 km/jam | 500 🪙 |

Kalah pun tetap dapat 25 🪙 (semangat!).

## ⌨️ Kontrol

| Aksi | Pemain 1 | Pemain 2 | Balap Sendiri |
|---|---|---|---|
| Gas | `A` | `↑` (panah atas) | `Spasi` / `A` |
| Pindah gigi | `S` | `→` (panah kanan) | `Shift` / `S` |
| Nitro | `D` | `Enter` | `N` / `D` |

**📱 Kontrol sentuh:** tombol GAS / GIGI / NITRO besar di bawah layar. Tahan GAS, ketuk GIGI & NITRO. Layout responsif portrait + landscape.

## 🔧 Garasi (Build Motor)

Koin hasil balapan dipakai untuk upgrade (masing-masing 5 level). Koin & level tersimpan otomatis di `localStorage` browser.

| Upgrade | Efek per Level | Biaya Awal |
|---|---|---|
| 🔩 Mesin | +8 km/jam top speed, +8% akselerasi | 150 🪙 |
| 🔊 Knalpot | +3 km/jam top speed, +5% akselerasi | 120 🪙 |
| 🛞 Ban | +6% grip saat start, +2% akselerasi | 100 🪙 |
| 💨 Nitro | +0,5 detik durasi nitro | 100 🪙 |

Biaya naik tiap level (level berikutnya = biaya awal × level). Stat motor (top speed & waktu 0–100 km/jam) tampil di menu dan garasi.

## 👥 Mabar (Main Bareng)

### Lokal — 2 pemain, 1 perangkat
1. Menu → **MABAR** → tab **Lokal**.
2. Isi nama Pemain 1 & Pemain 2, tekan **MULAI BALAPAN 2P**.
3. Layar split jadi 2 lintasan. P1 pakai `A`/`S`/`D`, P2 pakai `↑`/`→`/`Enter`. Di HP pakai tombol sentuh kiri (P1) & kanan (P2).
4. Pemenang dapat 150 🪙.

### Online — room + WebSocket
Server multiplayer ada di `server.js` — Node.js **tanpa dependensi eksternal** (implementasi WebSocket minimal pakai modul bawaan `http` + `crypto`).

1. Jalankan server di komputer/VM yang bisa dijangkau semua pemain:
   ```bash
   node server.js
   # Server jalan di ws://localhost:8080
   # Port lain: PORT=9000 node server.js
   ```
   Cek server hidup: buka `http://localhost:8080/` di browser (atau `curl http://localhost:8080/rooms` untuk daftar room aktif).
2. Semua pemain buka game (`index.html`), menu → **MABAR** → tab **Online**.
3. Isi nama + alamat server WebSocket (default `ws://localhost:8080`; kalau server di komputer lain, ganti `localhost` dengan IP/hostname komputer itu, mis. `ws://192.168.1.5:8080`).
4. **Host:** isi kode room (mis. `DRAG123`), tekan **BUAT ROOM**, bagikan kodenya.
   **Teman:** isi kode room yang sama, tekan **GABUNG ROOM**.
5. Kalau semua sudah masuk (2–4 pemain), host tekan **MULAI BALAPAN**. Countdown jalan serentak, posisi tiap pemain disiarkan live, pemenang ditentukan server. Pemenang dapat 300 🪙.

> Catatan: kalau main dari internet (bukan WiFi yang sama), server harus bisa diakses publik — mis. jalankan di VM dengan port 8080 terbuka, atau pakai tunnel. Game tidak butuh akun apa pun.

## 📦 Build APK Android

Ada 2 cara — tanpa perlu install Android SDK di komputermu:

### Cara 1 — Otomatis via GitHub Actions (paling gampang)
1. Push repo ini ke GitHub (lihat bawah).
2. Workflow `.github/workflows/build-apk.yml` jalan otomatis setiap push ke `main`/`master`.
3. Buka tab **Actions** → klik run yang sukses → unduh artifact **`drag-bike-debug-apk`** → install file `app-debug.apk` di HP Android (izinkan "install dari sumber tidak dikenal").

### Cara 2 — Android Studio (lokal)
```bash
npm install
npx cap add android   # sekali saja
npx cap sync
npx cap open android  # buka di Android Studio, lalu Run / Build APK
```

Konfigurasi Capacitor ada di `capacitor.config.json` (`appId: com.mayagent88.dragbike`, `appName: "Drag Bike"`, `webDir: "."` — game langsung dibungkus tanpa build step web).

## 🚀 Menjalankan Game di Lokal

Tanpa build — cukup salah satu:

```bash
# Opsi A: buka langsung
# Klik dua kali index.html di file manager

# Opsi B: server statis (disarankan, supaya localStorage & audio stabil)
python3 -m http.server 8000
# lalu buka http://localhost:8000/

# Opsi C: server Node (untuk mabar online sekaligus)
node server.js
# game: http://localhost:8080/ TIDAK menyajikan file game — server ini khusus WebSocket.
# Sajikan index.html via Opsi B, lalu isi alamat server ws://localhost:8080 di tab Online.
```

Cek cepat kode tidak error:
```bash
npm run check   # node --check game.js && node --check server.js
```

## 📁 Struktur File

```
drag-bike/
├── index.html                  # Halaman utama game (menu, balapan, garasi, mabar)
├── style.css                   # Semua tampilan (responsif, tombol sentuh besar)
├── game.js                     # Logika game: fisika, AI bot, render canvas, online
├── server.js                   # Server multiplayer WebSocket (Node, tanpa dependensi)
├── package.json                # Script start/check + devDeps Capacitor
├── capacitor.config.json       # Config APK (appId com.mayagent88.dragbike)
├── .github/workflows/
│   └── build-apk.yml           # GitHub Actions: build APK debug otomatis
└── README.md                   # File ini
```

## 🔄 Push ke GitHub

```bash
cd drag-bike
git init
git add .
git commit -m "Drag Bike v1.0 — balap motor 402m, mabar lokal & online, APK-ready"
git branch -M main
git remote add origin https://github.com/<username>/drag-bike.git
git push -u origin main
```

Setelah push, APK otomatis di-build oleh GitHub Actions (lihat Cara 1 di atas).

## ⚠️ Catatan

- Game ini 100% orisinal, tanpa aset unduhan, tanpa iklan, tanpa akun, tanpa spend (Rp0).
- Koin & upgrade tersimpan di `localStorage` per browser/perangkat — ganti browser = mulai dari nol.
- Mabar online butuh server `server.js` yang sedang jalan dan bisa dijangkau semua pemain.
- Suara mesin butuh interaksi dulu (klik/tekan tombol) — itu aturan browser, bukan bug.

Selamat balapan! 🏁💨
