// TOPS CORE — Centralized Excel Parser & Normalizer
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
  topic: ['topic', 'topik', 'topic_name', 'nama_topik', 'tema', 'theme', 'kategori', 'category'],
  word_type: ['word_type', 'wordtype', 'part_of_speech', 'pos', 'type', 'tipe', 'jenis_kata', 'tipe_kata', 'tipekata', 'jenis', 'kategori_kata', 'pos_tag'],
  week: ['week', 'minggu', 'wk'],
  day: ['day', 'hari'],
  type: ['type', 'tipe', 'word_type', 'wordtype', 'part_of_speech', 'partofspeech'],
  no: ['no', 'nomor', 'num', 'order', 'urutan'],
  question: ['question', 'soal', 'pertanyaan', 'q', 'prompt', 'indonesia', 'kalimat', 'text'],
  answer: ['answer', 'jawaban', 'kunci', 'kunci_jawaban', 'kuncijawaban', 'a', 'accepted_answers', 'english', 'solution', 'jawaban_benar', 'terjemahan'],
  options: ['options', 'pilihan', 'opsi', 'choices', 'pilihan_jawaban', 'pilihanjawaban', 'list_pilihan', 'opsi_jawaban'],
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
    if (options.length === 0 && row.options) {
      const rawOpt = String(row.options).trim();
      if (rawOpt.startsWith('[') && rawOpt.endsWith(']')) {
        try {
          const parsed = JSON.parse(rawOpt);
          if (Array.isArray(parsed)) options.push(...parsed.map(s => String(s).trim()).filter(Boolean));
        } catch (_) {}
      }
      if (options.length === 0) {
        if (/[;/|]/.test(rawOpt)) {
          options.push(...rawOpt.split(/[;/|]/).map(s => s.trim()).filter(Boolean));
        } else if (rawOpt.includes(',')) {
          options.push(...rawOpt.split(',').map(s => s.trim()).filter(Boolean));
        } else if (rawOpt) {
          options.push(rawOpt);
        }
      }
    }

    result.push({
      rowIndex: rowNum,
      order: Number(row.no) || (idx + 1),
      question_text: questionText,
      correct_answer: rawAnswer, // Preserves multiple delimiters: / ; and | all work as OR separators
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

function calcLevenshtein(a, b) {
  const la = a.length, lb = b.length;
  const dp = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[la][lb];
}

/**
 * Process Excel rows for Centralized Question Bank V1 (Topic | Word Type | Question | Answer)
 */
export function processCentralBankQuestionImport(normalizedRows, { existingQuestions = [], validWordTypes = [] } = {}) {
  const processed = [];
  const errors = [];
  const validWordTypeNames = validWordTypes.map(w => typeof w === 'string' ? w : w.name);

  normalizedRows.forEach((row, idx) => {
    const rowNum = row._rawRowIndex || (idx + 2);
    const questionText = String(row.question || '').trim();
    const rawAnswer = String(row.answer || '').trim();
    const topicName = String(row.topic || row.tema || 'General').trim();
    const rawWordType = String(row.word_type || row.type || '').trim();

    if (!questionText) {
      errors.push({ row: rowNum, error: 'Missing Question prompt.' });
      return;
    }
    if (!rawAnswer) {
      errors.push({ row: rowNum, error: 'Missing Answer.' });
      return;
    }

    // Word Type validation & fuzzy suggestion
    let wordType = rawWordType;
    let wordTypeWarning = null;
    if (rawWordType) {
      const exactMatch = validWordTypeNames.find(v => v.toLowerCase() === rawWordType.toLowerCase());
      if (exactMatch) {
        wordType = exactMatch;
      } else {
        let closest = null;
        let minDistance = 3;
        for (const v of validWordTypeNames) {
          const d = calcLevenshtein(rawWordType.toLowerCase(), v.toLowerCase());
          if (d < minDistance) {
            minDistance = d;
            closest = v;
          }
        }
        if (closest) {
          wordTypeWarning = `Unrecognized "${rawWordType}". Auto-suggested: "${closest}"`;
          wordType = closest;
        } else {
          wordTypeWarning = `Custom type "${rawWordType}" will be registered.`;
        }
      }
    }

    const acceptedAnswers = rawAnswer.split(/[;/|]/).map(s => s.trim()).filter(Boolean);

    // Deduplication against existing central bank questions
    let duplicateStatus = 'NEW';
    let duplicateOfId = null;
    let existingQuestionText = null;
    let existingAnswers = [];
    let answerKeyChanged = false;
    let similarityPct = 0;

    const normQ = questionText.toLowerCase().replace(/[^\w\s]/g, '').trim();

    // Check duplicate within existing Question Bank
    for (const eq of existingQuestions) {
      const eqNorm = String(eq.question_text || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (normQ === eqNorm) {
        duplicateStatus = 'EXACT_DUPLICATE';
        duplicateOfId = eq.id;
        existingQuestionText = eq.question_text;
        existingAnswers = Array.isArray(eq.accepted_answers) && eq.accepted_answers.length > 0
          ? eq.accepted_answers
          : (eq.correct_answer ? [eq.correct_answer] : []);

        // Compare answer keys
        const normExisting = existingAnswers.map(a => String(a).toLowerCase().trim()).sort().join('|');
        const normNew = acceptedAnswers.map(a => String(a).toLowerCase().trim()).sort().join('|');
        if (normExisting !== normNew) {
          answerKeyChanged = true;
        }
        break;
      }

      const dist = calcLevenshtein(normQ, eqNorm);
      const maxLen = Math.max(normQ.length, eqNorm.length);
      if (maxLen > 0) {
        const ratio = (maxLen - dist) / maxLen;
        if (ratio >= 0.85) {
          duplicateStatus = 'POSSIBLE_DUPLICATE';
          duplicateOfId = eq.id;
          existingQuestionText = eq.question_text;
          existingAnswers = Array.isArray(eq.accepted_answers) && eq.accepted_answers.length > 0
            ? eq.accepted_answers
            : (eq.correct_answer ? [eq.correct_answer] : []);
          similarityPct = Math.round(ratio * 100);
          break;
        }
      }
    }

    // Check duplicate within the current batch/sheet itself
    const priorMatch = processed.find(p => p.question_text.toLowerCase().replace(/[^\w\s]/g, '').trim() === normQ);
    let inSheetDuplicate = false;
    if (priorMatch) {
      inSheetDuplicate = true;
    }

    processed.push({
      rowIndex: rowNum,
      topicName,
      wordType,
      wordTypeWarning,
      question_text: questionText,
      accepted_answers: acceptedAnswers,
      duplicateStatus,
      duplicateOfId,
      existingQuestionText,
      existingAnswers,
      answerKeyChanged,
      similarityPct,
      inSheetDuplicate,
      actionChoice: duplicateStatus === 'POSSIBLE_DUPLICATE' ? 'CREATE_NEW' : (duplicateStatus === 'EXACT_DUPLICATE' ? 'USE_EXISTING' : 'CREATE_NEW'),
      status: 'ready'
    });
  });

  return {
    rows: processed,
    errors,
    summary: {
      total: normalizedRows.length,
      ready: processed.length,
      newQuestions: processed.filter(r => r.duplicateStatus === 'NEW' && !r.inSheetDuplicate).length,
      existingQuestions: processed.filter(r => r.duplicateStatus === 'EXACT_DUPLICATE').length,
      answerChanges: processed.filter(r => r.answerKeyChanged).length,
      possibleDuplicates: processed.filter(r => r.duplicateStatus === 'POSSIBLE_DUPLICATE').length,
      invalidWordTypes: processed.filter(r => r.wordTypeWarning).length,
      sheetDuplicates: processed.filter(r => r.inSheetDuplicate).length,
      errorsCount: errors.length
    }
  };
}

