# 🌐 DOKUMENTASI MASTER ARSITEKTUR & KODE SUMBER TOPS CORE V5 (EXHAUSTIVE TECHNICAL BREAKDOWN)

---

## I. Lapisan Konektivitas, Manajemen Sesi & Autentikasi (`supabase.js`, `api.js`, `session.js`)

### 1. Inisialisasi Klien Supabase (`supabase.js`)
* **Singleton Pattern & CDN Import:** Modul `supabase.js` menginisialisasi koneksi klien Supabase secara asinkron menggunakan pustaka ES Module resmi dari ESM.sh (`@supabase/supabase-js@2`). Variabel `SUPABASE_URL` dan `SUPABASE_ANON_KEY` dikonfigurasi dengan fallback lingkungan global.
* **Pengamanan Panggilan Edge Function (`callEdgeFunction`):** Fungsi ini membungkus pemanggilan Supabase Edge Functions dengan mekanisme *AbortController* berbatas waktu (*timeout*) selama 25 detik. Jika waktu habis, sistem menghentikan proses secara aman dan memberikan pesan kegagalan jaringan yang informatif.

### 2. Autentikasi & Keamanan Sesi Pengguna (`api.js`, `session.js`)
* **Verifikasi Login Siswa (`verifyStudentLogin`):** Fungsi ini memeriksa kecocokan ID institusi, program, batch, siswa, serta mencocokkan PIN dengan melakukan *hashing* berbasis SHA-256 menggunakan Web Crypto API (`crypto.subtle.digest`).
* **Pembersihan Penyimpanan Lama (*Legacy Storage Purge*):** Modul sesi secara otomatis mendeteksi dan menghapus entri *localStorage* atau *sessionStorage* yang mengandung sisa penamaan merek lama (*topenglish*) untuk menjaga kebersihan lingkungan penyimpanan peramban.
* **Manajemen Sesi Terisolasi:** Data sesi siswa (`topscore_session`) dan admin (`topscore_admin_session`) disimpan secara eksklusif di dalam `sessionStorage` (bukan *localStorage*) guna mencegah kebocoran kredensial saat peramban ditutup.

---

## II. Sistem Kurikulum, Eksekusi Asesmen & Waktu Peladen (`api.js`, `timer.js`)

### 1. Manajemen Kurikulum & Pengambilan Data (`api.js`)
* **Caching API Cerdas (`withCache` & `clearApiCache`):** Data referensi institusi, program, dan batch disimpan dalam tembolok (*cache map*) dengan TTL default 60 detik guna meminimalkan lonjakan kueri ke peladen.
* **Pemetaan Level Berstandar Ordinal (`toOrdinalLevel` & `toLevelLetter`):** Mengonversi angka level mentah menjadi format teks ordinal baku (1 menjadi *1st Level*, 2 menjadi *2nd Level*, dst.).
* **Pengambilan Asesmen Terstruktur:** Fungsi seperti `fetchAssessmentsForStudentClass` dan `fetchAssessmentsForStudentLevel` menyaring asesmen yang berstatus `PUBLISHED` dan selaras dengan tingkat level kelas.

### 2. Siklus Hidup Pelaksanaan Ujian (*Exam Runner*) (`api.js`, `timer.js`)
* **Inisialisasi & Pengambilan Sanksi Sesi (`startAssessment` / `startASSESSMENT`):** Memeriksa apakah ada *attempt* dengan status `IN_PROGRESS`. Jika belum ada, sistem membuat rekam baru di tabel `attempts` beserta snapshot butir soal di tabel `attempt_answers`.
* **Sanitasi Kunci Jawaban:** Kolom sensitif seperti `correct_answer_snapshot` dan `accepted_answers_snapshot` dihapus secara otomatis dari objek soal yang dikirim ke peramban siswa guna mencegah kecurangan (*client-side inspection*).
* **Hitung Mundur Berbasis Peladen (`timer.js`):** Modul `startCountdown` memonitor sisa waktu asesmen berdasarkan parameter `expected_end_at` dari peladen, serta memicu peringatan otomatis pada batas waktu 5 menit dan 2 menit sebelum waktu habis.

---

## III. Mesin Penilaian AI (TAEE), Evaluasi Teks & Modul Suara (`ai-evaluation-engine.js`, `grading.js`, `speech.js`)

### 1. TopsCore AI Evaluation Engine (TAEE) & Cost Guard (`ai-evaluation-engine.js`)
* **8 Modul AI Terintegrasi:** Mendukung *POINT_AND_SPEAK*, *STORYTELLING*, *CONVERSATIONAL*, *MULTIPLE_CHOICE*, *READ_ALOUD*, *TURN_BASED_ROLEPLAY*, *SPEAKING_MONOLOGUE*, dan *VOCAB_MASTERY*.
* **Validasi Transkrip Pra-terbang (`validateTranscript`):** Mencegah pengiriman data kosong, rekaman terlalu pendek (<10 karakter), atau ucapan yang didominasi oleh kata pengisi (*filler words* $\ge 60\%$) ke peladen AI.
* **Cost Guard Engine:** Membatasi durasi rekaman audio maksimal (`maxAudioDurationSeconds`) dan menerapkan masa jeda waktu (*cooldown*) antar-pengiriman jawaban guna mengontrol biaya penggunaan API AI.
* **Realtime Roleplay Channel:** Memanfaatkan kanal *broadcast* Supabase (`initRoleplayChannel`) untuk simulasi dialog interaktif berbasis giliran (*turn-based*).

### 2. Mesin Penilaian Autoritatif & Toleransi Ejaan (`grading.js`)
* **Algoritma Damerau-Levenshtein:** Menghitung jarak edit string untuk mengidentifikasi kesalahan ketik minor (*minor spelling error*) dengan toleransi skor parsial (0.5).
* **Toleransi Tanda Hubung (`stripHyphens`):** Memastikan variasi penulisan seperti *check-in* dan *checkin* tetap dinilai benar tanpa dianggap sebagai kesalahan eja.
* **Pemisah Jawaban Alternatif (`parseCorrectAnswers`):** Mendukung berbagai simbol pembatas (`/`, `;`, dan `|`) sebagai kondisi logika "OR" untuk kunci jawaban benar.

### 3. Modul Pengenalan Suara Berbasis Peramban (`speech.js`)
* **Uji Kapabilitas Mikrofon (`testMicrophoneCapability`):** Melakukan pemeriksaan konteks aman (HTTPS), ketersediaan API `getUserMedia`, pengecekan izin browser, hingga pengujian *stream* perangkat keras mikrofon yang langsung dibersihkan (*track stop*) sesudahnya.
* **Sesi Rekaman Suara:** Mengelola transkripsi ucapan sementara (*interim*) dan final, serta mengintegrasikan pembatas waktu otomatis sesuai aturan *Cost Guard*.

---

## IV. Konsol Administrasi, Pemeliharaan Database & Vocab Vault (`api.js`)

### 1. Operasi CRUD Admin & Pemeliharaan Lanjutan (`api.js`)
* **Manajemen Penghapusan Lunak (*Soft Delete & Restore*):** Menyediakan fungsi `adminSoftDelete`, `adminFetchDeleted`, dan `adminRestore` untuk mengelola entitas yang dihapus tanpa merusak integritas riwayat relasi.
* **Mesin Deteksi Duplikat Siswa & Soal:** Fungsi `detectDuplicateStudents` dan `detectDuplicateQuestions` mendeteksi anomali data ganda, dilengkapi fungsi penggabungan (*merge*) serta penomoran ulang urutan soal secara otomatis (`resequenceAssessmentQuestions`).
* **Mesin Kalibrasi Nilai:** `previewRecalibrateAssessment` dan `applyRecalibrateAssessment` menghitung ulang status skor terbaik (`is_best_score`) bagi setiap siswa pada asesmen tertentu.

### 2. Vocabulary Vault & Assessment Builder (`api.js`)
* **Manajemen Gudang Kosakata:** Mengelola pengayaan kata, topik, jenis kata (*word types*), serta pengecekan duplikasi impor data secara massal (`checkVaultDuplicates`, `importVaultWords`).
* **Vocab Mastery Stratified Sampler:** Fungsi `createVocabMasteryAssessment` mengumpulkan kata-kata dari Vault, melakukan pengambilan sampel acak terstratifikasi berdasarkan kuota, serta merakit pilihan distraktor berbasis kesamaan jenis kata (*part of speech*).
* **Otomasi Naik Level (`checkAndTriggerLevelUp`):** Memeriksa pencapaian nilai ujian penentu tingkat ($\ge 60\%$), memperbarui level aktif siswa di tabel `students`, serta mempersiapkan data perayaan naik level di penyimpanan sesi.

---

## V. Utilitas Antarmuka, Parser Excel & Manajemen Sesi (`app.js`, `excel-parser.js`, `session.js`)

### 1. Sistem Antarmuka & Utilitas Global (`app.js`)
* **Sistem Notifikasi Toast:** Menampilkan umpan balik visual instan (sukses, galat, peringatan, info) dengan animasi keluar yang mulus.
* **Loading Overlay & Bilah Progres:** Menyediakan fungsi penutup layar muat data lengkap dengan pembaruan persentase progres secara dinamis.
* **Penanganan Galat Global:** Menangkap kegagalan *Promise* yang tidak ditangani (*unhandledrejection*) secara global untuk mencegah layar membeku (*freeze*).

### 2. Parser & Normalisasi Berkas Excel (`excel-parser.js`)
* **Pencocokan Header Standar (`HEADER_ALIASES`):** Mampu mengenali berbagai variasi nama kolom dari berkas unggahan pengguna (seperti `nama`, `student_name`, `fullname`, `kelas`, `classname`) dan menormalisasikannya ke dalam kunci kanonik.
* **Validasi Impor Siswa & Soal:** Membersihkan data tanggal lahir, mendeteksi jenis kelamin, memvalidasi format pilihan ganda (opsi A-D), serta mengurai kunci jawaban majemuk secara akurat.
