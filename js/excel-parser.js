// TOP ENGLISH CLASS — Centralized Excel Parser & Normalizer
// Phases 5, 6, 7

/**
 * Standard Header Aliases dictionary
 */
const HEADER_ALIASES = {
  program: ['program', 'program_name', 'programname', 'nama_program', 'namaprogram'],
  class: ['class', 'class_name', 'classname', 'kelas', 'nama_kelas', 'namakelas'],
  batch: ['batch', 'batch_name', 'batchname', 'angkatan', 'gelombang', 'nama_batch'],
  level: ['level', 'level_name', 'levelname', 'lvl', 'tingkat'],
  subject: ['subject', 'subject_name', 'subjectname', 'mapel', 'matapelajaran', 'mata_pelajaran'],
  name: ['name', 'student_name', 'studentname', 'nama', 'namasiswa', 'nama_siswa', 'fullname', 'pesertadidik', 'peserta_didik'],
  gender: ['gender', 'jeniskelamin', 'jenis_kelamin', 'jk', 'sex', 'lp'],
  birth_date: ['birth_date', 'birthdate', 'dob', 'tanggallahir', 'tanggal_lahir', 'tgllahir', 'tgl'],
  age: ['age', 'usia', 'umur'],
  pin: ['pin', 'password', 'pass', 'kodesandi'],
  title: ['title', 'exam_title', 'examtitle', 'judul', 'nama_ujian'],
  week: ['week', 'minggu', 'wk'],
  day: ['day', 'hari'],
  type: ['type', 'tipe', 'word_type', 'wordtype', 'part_of_speech', 'partofspeech'],
  no: ['no', 'nomor', 'num', 'order', 'urutan'],
  question: ['question', 'soal', 'pertanyaan', 'q'],
  answer: ['answer', 'jawaban', 'kunci', 'kunci_jawaban', 'kuncijawaban', 'a'],
  option_a: ['option_a', 'optiona', 'pilihan_a', 'pilihana', 'opsi_a', 'a'],
  option_b: ['option_b', 'optionb', 'pilihan_b', 'pilihanb', 'opsi_b', 'b'],
  option_c: ['option_c', 'optionc', 'pilihan_c', 'pilihanc', 'opsi_c', 'c'],
  option_d: ['option_d', 'optiond', 'pilihan_d', 'pilihand', 'opsi_d', 'd'],
};

/**
 * Clean & normalize a raw header string
 */
export function normalizeHeaderKey(rawHeader) {
  return String(rawHeader ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.]+/g, '_')
    .replace(/[^\w]/g, '');
}

/**
 * Find canonical header name from raw header
 */
export function matchCanonicalHeader(rawHeader) {
  const norm = normalizeHeaderKey(rawHeader);
  if (!norm) return null;

  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (canonical === norm || aliases.includes(norm)) {
      return canonical;
    }
  }
  return norm; // return normalized key if not explicitly aliased
}

/**
 * Parse an Excel file ArrayBuffer into standardized normalized rows
 * @param {ArrayBuffer|Uint8Array} fileData
 * @returns {{ rows: Array<Object>, rawHeaders: Array<string>, canonicalMap: Object, rowCount: number }}
 */
export function parseExcelWorkbook(fileData) {
  if (typeof XLSX === 'undefined') {
    throw new Error('SheetJS library (XLSX) is not loaded.');
  }

  const workbook = XLSX.read(fileData, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel workbook contains no sheets.');

  const worksheet = workbook.Sheets[sheetName];
  const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

  if (!rawJson || rawJson.length === 0) {
    return { rows: [], rawHeaders: [], canonicalMap: {}, rowCount: 0 };
  }

  // Detect raw headers from the first few rows
  const rawHeadersSet = new Set();
  rawJson.forEach(row => {
    Object.keys(row).forEach(k => rawHeadersSet.add(k));
  });
  const rawHeaders = Array.from(rawHeadersSet);

  // Build canonical map: rawHeader -> canonical
  const canonicalMap = {};
  rawHeaders.forEach(rh => {
    canonicalMap[rh] = matchCanonicalHeader(rh);
  });

  // Transform each row into a clean dictionary with canonical keys
  const normalizedRows = [];
  rawJson.forEach((row, rowIndex) => {
    // Check if entire row is empty
    const values = Object.values(row).map(v => String(v).trim());
    if (values.every(v => v === '')) return; // skip completely empty row

    const normRow = { _rawRowIndex: rowIndex + 2 }; // Excel 1-based + header
    for (const [rawKey, rawVal] of Object.entries(row)) {
      const canonicalKey = canonicalMap[rawKey] || normalizeHeaderKey(rawKey);
      normRow[canonicalKey] = typeof rawVal === 'string' ? rawVal.trim() : rawVal;
    }
    normalizedRows.push(normRow);
  });

  return {
    rows: normalizedRows,
    rawHeaders,
    canonicalMap,
    rowCount: normalizedRows.length
  };
}

/**
 * Validate and format Student rows from normalized rows (Phase 6)
 */
export function processStudentImportRows(normalizedRows, defaultContext = {}) {
  const result = [];
  const errors = [];

  normalizedRows.forEach((row, idx) => {
    const rowNum = row._rawRowIndex || (idx + 2);
    const name = String(row.name || '').trim();

    if (!name) {
      errors.push({ row: rowNum, error: 'Missing student Name.' });
      return;
    }

    // Gender detection
    const rawGender = String(row.gender || '').toLowerCase().trim();
    let gender = null;
    if (rawGender.startsWith('m') || rawGender.startsWith('l') || rawGender.includes('pria') || rawGender.includes('laki')) {
      gender = 'male';
    } else if (rawGender.startsWith('f') || rawGender.startsWith('p') || rawGender.startsWith('w') || rawGender.includes('perempuan') || rawGender.includes('wanita')) {
      gender = 'female';
    }

    // Birth Date & Age
    let birthDate = null;
    const rawBirth = row.birth_date;
    if (rawBirth) {
      if (!isNaN(rawBirth) && Number(rawBirth) > 1000) {
        const dateObj = new Date((Number(rawBirth) - 25569) * 86400 * 1000);
        birthDate = dateObj.toISOString().split('T')[0];
      } else {
        const parsed = new Date(rawBirth);
        if (!isNaN(parsed.getTime())) birthDate = parsed.toISOString().split('T')[0];
      }
    }

    // Academic hierarchy: Program, Class, Batch (Level is optional & managed manually)
    const programName = String(row.program || defaultContext.programName || '').trim();
    const className = String(row.class || defaultContext.className || '').trim();
    const batchName = String(row.batch || defaultContext.batchName || '').trim();
    const pin = String(row.pin || '1234').trim();

    result.push({
      rowIndex: rowNum,
      name,
      gender,
      birth_date: birthDate,
      pin,
      programName,
      className,
      batchName,
      levelName: String(row.level || '').trim() || null, // Optional Level
      status: 'ready'
    });
  });

  return { students: result, errors };
}

/**
 * Validate and format Question rows from normalized rows (Phase 7)
 */
export function processQuestionImportRows(normalizedRows, defaultContext = {}) {
  const result = [];
  const errors = [];

  normalizedRows.forEach((row, idx) => {
    const rowNum = row._rawRowIndex || (idx + 2);
    const questionText = String(row.question || '').trim();
    const rawAnswer = String(row.answer || '').trim();

    if (!questionText) {
      errors.push({ row: rowNum, error: 'Missing Question text.' });
      return;
    }
    if (!rawAnswer) {
      errors.push({ row: rowNum, error: 'Missing Answer.' });
      return;
    }

    // Extract word type metadata (Phase 7 requirement: TYPE e.g. "1 - VERB", "ADJECTIVE")
    const wordType = String(row.type || defaultContext.wordType || '').trim();

    // Extract options for multiple choice or dropdown
    const options = [];
    ['option_a', 'option_b', 'option_c', 'option_d'].forEach((optKey, oIdx) => {
      if (row[optKey] !== undefined && String(row[optKey]).trim() !== '') {
        options.push(String(row[optKey]).trim());
      }
    });

    result.push({
      rowIndex: rowNum,
      order: Number(row.no) || (idx + 1),
      question_text: questionText,
      correct_answer: rawAnswer, // Preserves multiple delimiters like ; and |
      options_json: options.length > 0 ? options : null,
      metadata: wordType ? { type: wordType } : null,
      programName: String(row.program || defaultContext.programName || '').trim(),
      className: String(row.class || defaultContext.className || '').trim(),
      levelName: String(row.level || defaultContext.levelName || '').trim(),
      title: String(row.title || defaultContext.title || '').trim(),
      week: String(row.week || '').trim(),
      day: String(row.day || '').trim(),
      status: 'ready'
    });
  });

  return { questions: result, errors };
}
