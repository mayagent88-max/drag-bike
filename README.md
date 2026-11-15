# 🏍️ DRAG BIKE 3D

Game balap motor **3D beneran (Three.js / WebGL)** — drag race 402 meter (quarter mile) yang bisa **mabar**: lawan bot AI, duel 2 pemain di satu perangkat (split-screen), atau balapan online bareng teman lewat room.

Semua model 3D dibangun dari primitif Three.js (kotak, silinder, torus, bola) — **tanpa download model/tekstur**. Three.js r160 di-vendor secara lokal di `vendor/three.module.min.js`, jadi game jalan **offline penuh** (tanpa CDN) di browser maupun APK. Suara mesin dari WebAudio (tanpa file audio). Bisa dibungkus jadi **APK Android** lewat Capacitor + GitHub Actions.

## 🎮 Cara Main

1. Jalankan server statis (lihat bawah — file `index.html` harus disajikan via HTTP karena game memakai ES module), lalu buka di browser.
2. Di menu utama pilih **BALAP** (lawan bot), **MABAR** (2 pemain / online), **GARASI** (upgrade motor), atau **CARA MAIN**. Di menu, motormu dipamerkan berputar di sirkuit 3D.
3. Lampu gantry 3D menyala **3-2-1 lalu GO!** (hijau) — tekan GAS tepat saat GO.
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

## 📷 Kamera 3D

Kamera chase-cam mengikuti dari belakang motormu (ada getaran halus saat RPM tinggi + wheelie sedikit saat launch). Tekan **`C`** atau tombol **📷 Kamera** untuk ganti ke kamera samping. Di mabar lokal, layar terbagi dua — atas Pemain 1, bawah Pemain 2 — masing-masing dengan kamera sendiri.

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

Biaya naik tiap level (level berikutnya = biaya awal × level). Stat motor (top speed & waktu 0–100 km/jam) tampil di menu dan garasi. **Upgrade juga mengubah tampilan motor 3D**: knalpot makin besar (emas di level 4–5), ban makin tebal, mesin makin besar, dan botol nitro muncul di samping motor.

## 👥 Mabar (Main Bareng)

### Lokal — 2 pemain, 1 perangkat
1. Menu → **MABAR** → tab **Lokal**.
2. Isi nama Pemain 1 & Pemain 2, tekan **MULAI BALAPAN 2P**.
3. Layar split jadi 2 (atas P1, bawah P2), masing-masing kamera chase-cam sendiri. P1 pakai `A`/`S`/`D`, P2 pakai `↑`/`→`/`Enter`. Di HP pakai tombol sentuh kiri (P1) & kanan (P2).
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

Game memakai ES module + import map, jadi **harus disajikan via HTTP** (buka `index.html` langsung via `file://` tidak akan jalan karena aturan CORS module):

```bash
# Opsi A: server statis (paling gampang)
python3 -m http.server 8000
# lalu buka http://localhost:8000/

# Opsi B: server Node (untuk mabar online sekaligus)
node server.js
# server WebSocket jalan di ws://localhost:8080, tapi TIDAK menyajikan file game.
# Sajikan index.html via Opsi A, lalu isi alamat server ws://localhost:8080 di tab Online.
```

Cek cepat kode tidak error:
```bash
npm run check   # node --check untuk js/*.mjs + server.js
```

## 📁 Struktur File

```
drag-bike/
├── index.html                  # Halaman utama game (menu, balapan, garasi, mabar)
├── style.css                   # Semua tampilan (responsif, tombol sentuh besar)
├── js/
│   ├── physics.mjs             # Fisika + data murni (bisa diuji di Node, tanpa DOM)
│   ├── audio.mjs               # Suara mesin WebAudio
│   ├── bike.mjs                # Model motor 3D + pool asap ban
│   ├── track.mjs               # Sirkuit 3D: aspal, gantry, tribun, pohon, gedung
│   └── main.mjs                # Logika game: balapan, bot, mabar, HUD, garasi
├── vendor/
│   └── three.module.min.js     # Three.js r160 (lokal, offline, tanpa CDN)
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
git commit -m "Drag Bike v2.0 3D — Three.js, mabar lokal & online, APK-ready"
git branch -M main
git remote add origin https://github.com/<username>/drag-bike.git
git push -u origin main
```

Setelah push, APK otomatis di-build oleh GitHub Actions (lihat Cara 1 di atas).

## ⚠️ Catatan

- Game ini 100% orisinal, tanpa aset unduhan, tanpa iklan, tanpa akun, tanpa spend (Rp0). Satu-satunya library eksternal adalah Three.js r160 yang di-vendor lokal di repo (MIT license) — game tetap jalan offline.
- Performa: 1 directional light + 1 hemisphere, tanpa shadow map, geometri low-poly, pixelRatio dibatasi 1.5 — target 60fps di HP mid-range.
- Koin & upgrade tersimpan di `localStorage` per browser/perangkat — ganti browser = mulai dari nol.
- Mabar online butuh server `server.js` yang sedang jalan dan bisa dijangkau semua pemain.
- Suara mesin butuh interaksi dulu (klik/tekan tombol) — itu aturan browser, bukan bug.

Selamat balapan! 🏁💨
