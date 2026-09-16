# GUARDRAILS & CODING RULES

1. **NO BACKUP SUFFIXES**: DILARANG membuat file dengan suffix `_2.*`, `_3.*`, `_new.*`, atau file cadangan lainnya. Semua perubahan wajib dilakukan dengan *in-place editing*.
2. **HOISTING**: Selalu hoist variabel modul penting (seperti `_currentSection`, modal references) di baris teratas modul.
3. **SYNTAX VALIDATION**: Setiap selesai mengedit file JavaScript, wajib jalankan `node --check` pada file tersebut untuk memastikan tidak ada syntax error sebelum dianggap selesai.
