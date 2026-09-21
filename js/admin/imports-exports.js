import { adminFetchAll, adminInsert, adminUpdate, formatStudentName, cleanStudentName } from '../api.js?v=4.4.3';
import { parseExcelWorkbook, processStudentImportRows, processQuestionImportRows } from '../excel-parser.js?v=4.4.3';
import { showToast, showLoading, hideLoading } from '../app.js?v=4.4.3';
import { callEdgeFunction, getSupabase } from '../supabase.js?v=4.4.3';
import { downloadAITemplate, AI_MODULES } from './panel-c-builder.js';

const toLevelLetter = (level) => { return String.fromCharCode(64 + parseInt(level || 1)) || 'A'; };

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function getRowVal(row, possibleKeys) {
  if (!row || typeof row !== 'object') return '';
  const rowKeys = Object.keys(row);
  for (const k of possibleKeys) {
    const targetNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const rk of rowKeys) {
      if (rk.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm) {
        const v = row[rk];
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          return String(v).trim();
        }
      }
    }
  }
  return '';
}

function calculateAgeFromBirthDate(birthDateStr) {
  if (!birthDateStr) return '—';
  const birthDate = new Date(birthDateStr);
  if (isNaN(birthDate.getTime())) return '—';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? `${age} yrs` : '—';
}

    async function renderImportStudents(area) {
      showLoading('Loading institutions & programs…');
      let allProgs = [];
      let allCls = [];
      let allBatches = [];
      let allLevels = [];

      try {
        const results = await Promise.allSettled([
          adminFetchAll('institutions'),
          adminFetchAll('programs'),
          adminFetchAll('batches'),
          adminFetchAll('levels')
        ]);
        allProgs = (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) ? results[0].value : [];
        allCls = (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) ? results[1].value : [];
        allBatches = (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) ? results[2].value : [];
        allLevels = (results[3].status === 'fulfilled' && Array.isArray(results[3].value)) ? results[3].value : [];
      } catch (err) {
        console.warn('[renderImportStudents] Error during data fetch:', err);
        showToast('Notice: Could not load full relational data. Fallback mode active.', 'warning');
      } finally {
        hideLoading();
      }

      // In-memory institution name resolution for classes/programs
      const instMap = new Map(allProgs.map(i => [i?.id, i?.name || 'Program']));
      const safeClasses = allCls.map(c => ({
        ...c,
        institutions: c?.institutions || (c?.institution_id ? { name: instMap.get(c.institution_id) || 'Program' } : { name: 'Program' })
      }));

      const sortedPrograms = allProgs.filter(p => p && !p.deleted_at && p.is_active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const sortedClasses = safeClasses.filter(c => c && !c.deleted_at && c.is_active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const sortedBatches = allBatches.filter(b => b && !b.deleted_at && b.is_active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const sortedLevels = allLevels.filter(l => l && !l.deleted_at && l.is_active !== false).sort((a, b) => (a.level_number || 0) - (b.level_number || 0));

      area.innerHTML = `
        <div style="height: calc(100vh - 80px); display: flex; flex-direction: column; overflow: hidden; margin: -40px; padding: 40px;">
          <div class="section-header" style="flex-shrink: 0;">
            <div>
              <h2 class="section-title text-gradient" style="font-size:1.6rem;">Import Students (Excel / CSV)</h2>
              <p class="section-subtitle">Upload student data in bulk using an Excel spreadsheet (.xlsx / .xls) or CSV file. PINs will be automatically hashed (SHA-256) for security.</p>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-secondary btn-sm" id="btn-back-to-students">Back to Students</button>
              <button class="btn btn-primary btn-sm" id="btn-dl-student-template">📥 Download Student Template (.xlsx)</button>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-6 align-stretch" style="flex: 1; overflow: hidden;">
            
            <!-- IMPORT BOX (Left side / Top on mobile) -->
            <div class="glass-card p-6" style="flex: 1; min-width: 300px; max-width: calc(50% - 12px); height: 100%; overflow-y: auto; display: flex; flex-direction: column;">
              <div class="d-flex flex-column gap-4 mb-4">
                <div class="form-group w-100">
                  <label class="form-label">1. Target Institution (Default / Override)</label>
                  <select class="form-control" id="import-student-program">
                    <option value="">- Use Institution from Excel File -</option>
                    ${sortedPrograms.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
                  </select>
                  <span class="text-muted text-xs mt-1">Select to assign all students in the file to this Institution.</span>
                </div>

                <div class="form-group w-100">
                  <label class="form-label">2. Target Program (Default / Override)</label>
                  <select class="form-control" id="import-student-class">
                    <option value="">- Use Program from Excel File -</option>
                    ${sortedClasses.map(c => `<option value="${c.id}" data-prog="${c.institution_id}">[${escapeHtml(c.institutions?.name || 'Institution')}] ${escapeHtml(c.name)}</option>`).join('')}
                  </select>
                  <span class="text-muted text-xs mt-1">Select to assign all students in the file to this Program.</span>
                </div>

                <div class="form-group w-100">
                  <label class="form-label">3. Target Batch (Default / Override)</label>
                  <select class="form-control" id="import-student-batch" disabled>
                    <option value="">- Select Program First -</option>
                  </select>
                  <span class="text-muted text-xs mt-1">Select to assign all students in the file to this Batch.</span>
                </div>

                <div class="form-group w-100">
                  <label class="form-label">4. Target Level (Optional / Override)</label>
                  <select class="form-control" id="import-student-level">
                    <option value="">- Use Level from Excel File / None -</option>
                    ${sortedLevels.map(l => `<option value="${l.id}">Level ${toLevelLetter(l.level_number)} (${escapeHtml(l.name)})</option>`).join('')}
                  </select>
                  <span class="text-muted text-xs mt-1">Optional. Level is managed manually.</span>
                </div>

                <div class="form-group w-100">
                  <label class="form-label">5. Select Spreadsheet File (.xlsx / .xls / .csv)</label>
                  <input type="file" class="form-control" id="import-students-file" accept=".xlsx,.xls,.csv" />
                </div>
              </div>

              <!-- Format Guide Box -->
              <div class="p-4 rounded mt-auto" style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);">
                <div class="d-flex align-center justify-between flex-wrap gap-2 mb-2">
                  <span class="text-sm fw-700 text-gradient">STUDENT SPREADSHEET COLUMN FORMAT</span>
                  <span class="badge badge-info" style="font-size:0.75rem;">Supports English Columns</span>
                </div>
                <div class="text-xs text-muted d-flex flex-column gap-1">
                  <div>&bull; <b>Name:</b> Column <code>NAME</code>, <code>Student Name</code> (Required).</div>
                  <div>&bull; <b>Gender (Optional):</b> Column <code>GENDER</code>. <em>If left blank, students will select their own gender (Mr. / Miss) upon first login.</em></div>
                  <div>&bull; <b>Birth Date / Age:</b> Column <code>BIRTH_DATE</code> or <code>AGE</code> (Format: YYYY-MM-DD or age number).</div>
                  <div>&bull; <b>PIN:</b> Column <code>PIN</code> or <code>Password</code> (Defaults to <code>1234</code> if left blank).</div>
                  <div>&bull; <b>Institution &amp; Program &amp; Batch:</b> If left blank in the Excel file, the Target Institution, Program, and Batch selected above will be used.</div>
                </div>
              </div>
            </div>

            <!-- Preview Container (Right side / Bottom on mobile) -->
            <div id="import-students-preview-wrap" class="hidden" style="flex: 1; min-width: 300px; height: 100%;">
              <div class="glass-card p-6" style="display: flex; flex-direction: column; height: 100%;">
                <div class="d-flex align-center justify-between flex-wrap gap-4 mb-4 pb-3" style="border-bottom:1px solid var(--clr-border); flex-shrink: 0;">
                  <div>
                    <h3 class="fw-700 text-gradient" style="font-size:1.25rem;">Student Data Preview</h3>
                    <p class="text-sm text-muted" id="students-preview-summary">0 students read from file.</p>
                  </div>
                  <div class="d-flex align-center gap-3">
                    <button class="btn btn-secondary btn-sm" id="btn-cancel-students-import">Cancel</button>
                    <button class="btn btn-primary btn-sm" id="btn-confirm-students-import">✓ Confirm &amp; Save Students</button>
                  </div>
                </div>

                <!-- Stats Chips -->
                <div class="d-flex gap-3 flex-wrap mb-4" id="students-preview-stat-chips" style="flex-shrink: 0;">
                  <span class="badge badge-info" id="chip-total-students">Total: 0</span>
                  <span class="badge badge-success" id="chip-valid-students">Ready to Import: 0</span>
                  <span class="badge badge-warning" id="chip-warn-students">Merged with Existing: 0</span>
                </div>

                <div class="table-wrap table-compact mb-2" style="flex: 1; overflow-y: auto; overflow-x: auto; max-height: none;">
                  <table style="width: 100%; table-layout: fixed; min-width: 500px;">
                    <thead>
                      <tr>
                        <th class="text-center" style="width:5%;">#</th>
                        <th class="text-left" style="width:30%;">Student Name</th>
                        <th class="text-left" style="width:18%;">Institution</th>
                        <th class="text-left" style="width:18%;">Program</th>
                        <th class="text-left" style="width:15%;">Batch</th>
                        <th class="text-center" style="width:14%;">Status</th>
                      </tr>
                    </thead>
                    <tbody id="tbl-preview-students"></tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      `;

      // Back button
      document.getElementById('btn-back-to-students')?.addEventListener('click', () => loadSection('students'));

      // Download Student Template
      document.getElementById('btn-dl-student-template')?.addEventListener('click', () => {
        const sampleData = [
          {
            'NO': 1,
            'NAME': 'Alexander Wright',
            'INSTITUTION': sortedPrograms[0]?.name || 'CEC',
            'PROGRAM': sortedClasses[0]?.name || 'Camp',
            'BATCH': 'Batch 2026-A'
          },
          {
            'NO': 2,
            'NAME': 'Beatrix Potter',
            'INSTITUTION': sortedPrograms[0]?.name || 'CEC',
            'PROGRAM': sortedClasses[0]?.name || 'Camp',
            'BATCH': 'Batch 2026-A'
          },
          {
            'NO': 3,
            'NAME': 'Christopher Nolan',
            'INSTITUTION': sortedPrograms[0]?.name || 'CEC',
            'PROGRAM': sortedClasses[1]?.name || sortedClasses[0]?.name || 'Camp',
            'BATCH': 'Batch 2026-B'
          }
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Student Data');
        XLSX.writeFile(wb, 'Template_Student_Import.xlsx');
        showToast('Student template downloaded successfully.', 'success');
      });

      // Program -> Class -> Batch cascading filter in top dropdowns
      const progSelect = document.getElementById('import-student-program');
      const classSelect = document.getElementById('import-student-class');
      const batchSelect = document.getElementById('import-student-batch');

      const updateBatchDropdown = (selectedClassId) => {
        batchSelect.innerHTML = `<option value="">— Use Batch from Excel File —</option>`;
        if (!selectedClassId) {
          batchSelect.disabled = true;
          batchSelect.innerHTML = `<option value="">- Select Program First -</option>`;
          return;
        }
        batchSelect.disabled = false;
        const filteredBatches = sortedBatches.filter(b => b.program_id === selectedClassId && !b.deleted_at);
        filteredBatches.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = b.name;
          batchSelect.appendChild(opt);
        });
      };

      progSelect?.addEventListener('change', () => {
        const selectedProg = progSelect.value;
        let visibleClassCount = 0;
        let lastVisibleClass = null;

        Array.from(classSelect.options).forEach(opt => {
          if (!opt.value) return; // Keep default option
          const optProg = opt.getAttribute('data-prog');
          const isVisible = (!selectedProg || optProg === selectedProg);
          opt.style.display = isVisible ? '' : 'none';
          if (isVisible) {
            visibleClassCount++;
            lastVisibleClass = opt.value;
          }
        });
        if (selectedProg && classSelect.selectedOptions[0]?.style.display === 'none') {
          classSelect.value = '';
        }

        // Auto-Select Program if only 1 is available for this Program
        if (visibleClassCount === 1 && selectedProg) {
          classSelect.value = lastVisibleClass;
        }

        updateBatchDropdown(classSelect.value);
      });

      classSelect?.addEventListener('change', () => {
        updateBatchDropdown(classSelect.value);
      });

      // Streamlined UI: Auto-select Program if only 1 exists
      if (sortedPrograms.length === 1 && progSelect) {
        progSelect.value = sortedPrograms[0].id;
        progSelect.dispatchEvent(new Event('change'));
      }

      let parsedStudentsState = [];

      // File parser
      document.getElementById('import-students-file')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        showLoading('Reading spreadsheet file…');
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!jsonRows.length) {
              hideLoading();
              showToast('Spreadsheet file is empty.', 'warning');
              return;
            }

            // Fetch existing students to detect and merge duplicate names in the same class
            let existingStudents = [];
            try {
              existingStudents = await adminFetchAll('students');
            } catch (err) {
              console.warn('Could not fetch existing students for deduplication:', err);
            }
            const existingStudentsMap = new Map();
            (existingStudents || []).forEach(s => {
              if (s && !s.deleted_at) {
                const key = `${(s.name || '').toLowerCase().trim()}::${s.program_id}`;
                if (!existingStudentsMap.has(key)) {
                  existingStudentsMap.set(key, s);
                }
              }
            });

            const selectedProgId = document.getElementById('import-student-program').value;
            const selectedClassId = document.getElementById('import-student-class').value;
            const selectedBatchId = document.getElementById('import-student-batch')?.value;
            const selectedLevelId = document.getElementById('import-student-level')?.value;
            const selectedProg = sortedPrograms.find(p => p.id === selectedProgId);
            const selectedClass = sortedClasses.find(c => c.id === selectedClassId);
            const selectedBatch = sortedBatches.find(b => b.id === selectedBatchId);
            const selectedLevel = sortedLevels.find(l => l.id === selectedLevelId);

            // Map for deduplicating within the file batch itself
            const batchMap = new Map();
            let duplicateMergedInFileCount = 0;

            jsonRows.forEach((row, idx) => {
              const rawName = getRowVal(row, ['name', 'studentname', 'nama', 'namasiswa', 'fullname', 'pesertadidik']);
              if (!rawName) return; // Skip empty row
              const name = rawName.trim();

              // Gender mapping (optional: if omitted, student assigns it upon first entering console)
              const rawGender = getRowVal(row, ['gender', 'jeniskelamin', 'jk', 'sex', 'lp']).toLowerCase().trim();
              let gender = null;
              if (rawGender.startsWith('m') || rawGender.startsWith('l') || rawGender.includes('laki') || rawGender.includes('pria')) {
                gender = 'male';
              } else if (rawGender.startsWith('f') || rawGender.startsWith('p') || rawGender.startsWith('w') || rawGender.includes('perempuan') || rawGender.includes('wanita')) {
                gender = 'female';
              }

              // Birth Date / Age
              const rawBirth = getRowVal(row, ['birthdate', 'dob', 'tanggallahir', 'tgllahir', 'tgl', 'birth_date']);
              const rawAge = getRowVal(row, ['age', 'usia']);
              let birthDate = '';
              let ageDisplay = '—';

              if (rawBirth) {
                if (!isNaN(rawBirth) && Number(rawBirth) > 1000) {
                  const dateObj = new Date((Number(rawBirth) - 25569) * 86400 * 1000);
                  birthDate = dateObj.toISOString().split('T')[0];
                } else {
                  const parsedDate = new Date(rawBirth);
                  if (!isNaN(parsedDate.getTime())) {
                    birthDate = parsedDate.toISOString().split('T')[0];
                  }
                }
              }

              if (!birthDate && rawAge) {
                const ageNum = parseInt(rawAge, 10);
                if (!isNaN(ageNum) && ageNum > 0 && ageNum < 100) {
                  const year = new Date().getFullYear() - ageNum;
                  birthDate = `${year}-01-01`;
                }
              }

              if (birthDate) {
                ageDisplay = calculateAgeFromBirthDate(birthDate);
              }

              // PIN
              let pin = getRowVal(row, ['pin', 'password', 'pass', 'kodepin', 'pin_hash']);
              if (!pin) pin = '1234';

              // Program & Class
              const rowProgName = getRowVal(row, ['institute', 'institution', 'programname', 'namaprogram']);
              const rowClassName = getRowVal(row, ['program', 'class', 'classname', 'kelas', 'namakelas']);
              const rowBatchName = getRowVal(row, ['batch', 'batchname', 'namabatch', 'angkatan', 'gelombang']);
              let finalProgId = selectedProgId;
              let finalProgName = selectedProg?.name || '';
              if (!finalProgId && rowProgName) {
                const matchedP = sortedPrograms.find(p => p.name.toLowerCase().trim() === rowProgName.toLowerCase().trim());
                if (matchedP) {
                  finalProgId = matchedP.id;
                  finalProgName = matchedP.name;
                }
              }
              if (!finalProgId && sortedPrograms.length > 0) {
                finalProgId = sortedPrograms[0].id;
                finalProgName = sortedPrograms[0].name;
              }

              let finalClassId = selectedClassId;
              let finalClassName = selectedClass?.name || '';
              if (!finalClassId && rowClassName) {
                const matchedC = sortedClasses.find(c => c.name.toLowerCase().trim() === rowClassName.toLowerCase().trim() && (!finalProgId || c.institution_id === finalProgId));
                if (matchedC) {
                  finalClassId = matchedC.id;
                  finalClassName = matchedC.name;
                  if (!finalProgId && matchedC.institution_id) {
                    finalProgId = matchedC.institution_id;
                    finalProgName = matchedC.institutions?.name || '';
                  }
                }
              }
              if (!finalClassId) {
                const firstClassInProg = sortedClasses.find(c => c.institution_id === finalProgId) || sortedClasses[0];
                if (firstClassInProg) {
                  finalClassId = firstClassInProg.id;
                  finalClassName = firstClassInProg.name;
                }
              }

              let finalBatchId = selectedBatchId || null;
              let finalBatchName = selectedBatch?.name || '';
              // Batch auto-resolve: check existing batches, then schedule auto-create
              const resolvedBatchName = rowBatchName || finalBatchName;
              if (!finalBatchId && resolvedBatchName && finalClassId) {
                // Look in current sortedBatches (already loaded, may include previously auto-created ones)
                const matchedB = sortedBatches.find(b =>
                  b.program_id === finalClassId &&
                  b.name.toLowerCase().trim() === resolvedBatchName.toLowerCase().trim() &&
                  !b.deleted_at
                );
                if (matchedB) {
                  finalBatchId = matchedB.id;
                  finalBatchName = matchedB.name;
                } else if (resolvedBatchName) {
                  // Flag for auto-creation at save time
                  finalBatchId = null;
                  finalBatchName = resolvedBatchName.trim(); // Will be created on confirm
                }
              }

              const batchKey = `${name.toLowerCase()}::${finalClassId}`;

              if (batchMap.has(batchKey)) {
                // Intra-batch duplicate in file: merge into existing entry in batch
                duplicateMergedInFileCount++;
                const existingBatchItem = batchMap.get(batchKey);
                if (!existingBatchItem.birthDate && birthDate) {
                  existingBatchItem.birthDate = birthDate;
                  existingBatchItem.ageDisplay = ageDisplay;
                }
                if (!existingBatchItem.batchId && finalBatchId) {
                  existingBatchItem.batchId = finalBatchId;
                  existingBatchItem.batchName = finalBatchName;
                }
                if (existingBatchItem.pin === '1234' && pin !== '1234') {
                  existingBatchItem.pin = pin;
                }
                existingBatchItem.duplicateInFile = true;
                return;
              }

              // Check if student already in database
              const existingDbStudent = existingStudentsMap.get(batchKey);
              let status = 'valid';
              let statusMsg = '&#10024; New Student';
              let isExisting = false;
              let existingId = null;

              if (!finalClassId) {
                status = 'error';
                statusMsg = 'No Class Assigned';
              } else if (existingDbStudent) {
                status = 'merge';
                statusMsg = '🔄 Merge Existing';
                isExisting = true;
                existingId = existingDbStudent.id;
              }

              // Optional Level mapping
              const rowLevelName = getRowVal(row, ['level', 'levelname', 'namalevel', 'tingkat', 'lvl']);
              let finalLevelId = selectedLevelId || null;
              let finalLevelName = selectedLevel?.name || '';
              if (!finalLevelId && rowLevelName) {
                const matchedL = sortedLevels.find(l => l.name.toLowerCase().trim() === rowLevelName.toLowerCase().trim() || String(l.level_number) === rowLevelName.trim());
                if (matchedL) {
                  finalLevelId = matchedL.id;
                  finalLevelName = matchedL.name;
                }
              }

              const item = {
                no: idx + 1,
                name: formatStudentName(name, gender),
                gender,
                birthDate: birthDate || null,
                ageDisplay,
                pin,
                institutionId: finalProgId,
                institutionName: finalProgName || 'Program',
                programId: finalClassId,
                programName: finalClassName || 'Class',
                batchId: finalBatchId,
                batchName: finalBatchName || '—',
                levelId: finalLevelId,
                levelName: finalLevelName || '',
                status,
                statusMsg,
                isExisting,
                existingId,
                duplicateInFile: false
              };

              batchMap.set(batchKey, item);
            });

            parsedStudentsState = Array.from(batchMap.values()).map((item, index) => {
              item.no = index + 1;
              return item;
            });

            hideLoading();

            if (!parsedStudentsState.length) {
              showToast('No valid student data found in the spreadsheet.', 'warning');
              return;
            }

            renderPreviewTable(duplicateMergedInFileCount);
          } catch(err) {
            hideLoading();
            showToast('Failed to process file: ' + err.message, 'error');
          }
        };
        reader.readAsArrayBuffer(file);
      });

      function renderPreviewTable(dupInFile = 0) {
        const wrap = document.getElementById('import-students-preview-wrap');
        const tbody = document.getElementById('tbl-preview-students');
        if (!wrap || !tbody) return;

        wrap.classList.remove('hidden');
        tbody.innerHTML = '';

        let newCount = 0;
        let mergeCount = 0;

        const LIMIT = 50;
        parsedStudentsState.forEach((s, i) => {
          if (s.status === 'valid') newCount++;
          else if (s.status === 'merge') mergeCount++;

          if (i < LIMIT) {
            const tr = document.createElement('tr');
            let badgeHtml = '';
            if (s.status === 'valid') {
              badgeHtml = `<span class="badge badge-success">&#10024; New Student</span>`;
            } else if (s.status === 'merge') {
              badgeHtml = `<span class="badge badge-info">🔄 Merge / Update</span>`;
            } else {
              badgeHtml = `<span class="badge badge-danger">Error</span>`;
            }

            if (s.duplicateInFile) {
              badgeHtml += ` <span class="badge badge-warning ml-1" title="Dimerge dari baris kembar dalam spreadsheet">⚡ Dimerge dari File</span>`;
            }

            const genderBadge = s.gender === 'male'
              ? '<span class="badge badge-primary">👨 Male</span>'
              : s.gender === 'female'
              ? '<span class="badge badge-accent">👩 Female</span>'
              : '<span class="badge badge-neutral" style="font-size:0.7rem;" title="Student will select gender upon first login">&#9203; Unassigned</span>';

            tr.innerHTML = `
              <td class="text-center text-muted fw-700">${i + 1}</td>
              <td class="fw-600">${escapeHtml(s.name)}</td>
              <td class="text-muted text-sm">${escapeHtml(s.institutionName)}</td>
              <td class="fw-600 text-sm">${escapeHtml(s.programName)}</td>
              <td class="text-sm fw-600" style="color:var(--clr-accent-1);">${escapeHtml(s.batchName || '—')}</td>
              <td class="text-center">${badgeHtml}</td>
            `;
            tbody.appendChild(tr);
          } else if (i === LIMIT) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="6" class="text-center text-muted fw-600 py-3" style="font-size: 0.85rem;">... and ${parsedStudentsState.length - LIMIT} more rows.</td>`;
            tbody.appendChild(tr);
          }
        });

        document.getElementById('students-preview-summary').textContent = `${parsedStudentsState.length} students ready to be processed (${newCount} new records, ${mergeCount} existing records merged).`;
        document.getElementById('chip-total-students').textContent = `Total: ${parsedStudentsState.length}`;
        document.getElementById('chip-valid-students').textContent = `&#10024; Baru: ${newCount}`;
        document.getElementById('chip-warn-students').textContent = `🔄 Merge: ${mergeCount}`;

        const saveBtn = document.getElementById('btn-confirm-students-import');
        if (saveBtn) {
          saveBtn.textContent = `Save & Merge (${parsedStudentsState.length} Students)`;
        }
      }

      // Cancel button
      document.getElementById('btn-cancel-students-import')?.addEventListener('click', () => {
        document.getElementById('import-students-preview-wrap')?.classList.add('hidden');
        document.getElementById('import-students-file').value = '';
        parsedStudentsState = [];
      });

      // Confirm & Save
      document.getElementById('btn-confirm-students-import')?.addEventListener('click', async () => {
        const readyStudents = parsedStudentsState.filter(s => s.status !== 'error');
        if (!readyStudents.length) {
          showToast('No students are ready to be saved.', 'warning');
          return;
        }

        showLoading(`Processing ${readyStudents.length} students...`);
        try {
          const sb = await getSupabase();
          let insertedCount = 0;
          let updatedCount = 0;
          const batchCreateCache = {}; // "programId::batchName" -> batchId

          for (const s of readyStudents) {
            // 1. Auto-create batch if needed
            let resolvedBatchId = s.batchId || null;
            if (!resolvedBatchId && s.batchName && s.batchName !== '—' && s.programId) {
              const cacheKey = `${s.programId}::${s.batchName.toLowerCase().trim()}`;
              if (batchCreateCache[cacheKey]) {
                resolvedBatchId = batchCreateCache[cacheKey];
              } else {
                // Check DB first
                const { data: existingBatch } = await sb.from('batches')
                  .select('id').eq('program_id', s.programId)
                  .ilike('name', s.batchName.trim()).maybeSingle();
                if (existingBatch) {
                  resolvedBatchId = existingBatch.id;
                } else {
                  // Create new batch
                  const { data: newBatch } = await sb.from('batches').insert({
                    program_id: s.programId,
                    name: s.batchName.trim(),
                    is_active: true
                  }).select('id').single();
                  if (newBatch) resolvedBatchId = newBatch.id;
                }
                if (resolvedBatchId) batchCreateCache[cacheKey] = resolvedBatchId;
              }
            }

            // 2. Hash PIN
            const pinHash = await hashPin(s.pin || '1234');

            // 3. Clean name (no title — title shown only on student dashboard)
            const formattedName = cleanStudentName(s.name);

            if (s.isExisting && s.existingId) {
              // Update existing student
              await sb.from('students').update({
                institution_id: s.institutionId || null,
                program_id: s.programId || null,
                batch_id: resolvedBatchId,
                gender: s.gender || null,
                birth_date: s.birthDate || null,
                name: formattedName,
                pin_hash: pinHash,
                is_active: true,
                deleted_at: null,
                updated_at: new Date().toISOString()
              }).eq('id', s.existingId);
              updatedCount++;
            } else {
              // Insert new student
              await sb.from('students').insert({
                name: formattedName,
                institution_id: s.institutionId || null,
                program_id: s.programId || null,
                batch_id: resolvedBatchId,
                gender: s.gender || null,
                birth_date: s.birthDate || null,
                pin_hash: pinHash,
                is_active: true
              });
              insertedCount++;
            }
          }

          hideLoading();
          showToast(`Done! ${insertedCount} new students added, ${updatedCount} updated/merged!`, 'success');
          document.getElementById('import-students-preview-wrap').classList.add('hidden');
          document.getElementById('import-students-file').value = '';
          parsedStudentsState = [];

        } catch(err) {
          hideLoading();
          showToast('Import error: ' + err.message, 'error');
        }
      });
    }


    function renderImportQuestions(area) {
      area.innerHTML = `
        <div style="height: calc(100vh - 80px); display: flex; flex-direction: column; overflow: hidden; margin: -40px; padding: 40px;">
          <div class="section-header" style="flex-shrink: 0;">
            <div>
              <h2 class="section-title">Import Questions (Excel)</h2>
              <p class="section-subtitle">Select Assessment & Assessment Type first to view the correct Excel template format before uploading a file.</p>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-6 align-stretch" style="flex: 1; overflow: hidden;">
            
            <!-- IMPORT BOX (Left side / Top on mobile) -->
            <div class="glass-card p-6" style="flex: 1; min-width: 300px; max-width: calc(50% - 12px); height: 100%; overflow-y: auto; display: flex; flex-direction: column;">
              <div class="d-flex flex-column gap-4 mb-4">
                <div class="form-group w-100">
                  <label class="form-label">1. Select Target Assessment</label>
                  <select class="form-control" id="import-Assessment-select"><option value="">Loading assessments...</option></select>
                </div>
                <div class="form-group w-100">
                  <label class="form-label">2. Assessment Type (Answer Method)</label>
                  <select class="form-control" id="import-Assessment-type-select">
                    <option value="written">Written (Type)</option>
                    <option value="speech_to_text">Speech to Text (Suara)</option>
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="dropdown">Drop-down</option>
                  </select>
                </div>
                <div class="form-group w-100">
                  <label class="form-label">3. Select Excel File (.xlsx / .xls)</label>
                  <input type="file" class="form-control" id="import-questions-file" accept=".xlsx,.xls,.csv" />
                </div>
              </div>

              <!-- Required Columns Preview Box -->
              <div class="p-4 rounded mb-4" style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);">
                <div class="d-flex align-center justify-between flex-wrap gap-3 mb-2">
                  <span class="text-xs fw-700 text-gradient" id="format-title-badge">WRITTEN EXCEL FORMAT</span>
                  <button class="btn btn-primary btn-sm w-100 mt-2" id="download-template-btn">📥 Download Template</button>
                </div>
                <p class="text-xs text-muted mb-2" id="format-desc-label">First row header arrangement:</p>
                <div class="p-2 rounded text-xs mb-3" style="background:rgba(0,0,0,0.3);border:1px dashed var(--clr-border);font-family:monospace;overflow-x:auto;white-space:nowrap;" id="format-columns-code">
                  PROG | CLASS | LVL | WK | DAY | TYPE | NO | Q | A
                </div>
              </div>

              <!-- Quick Template Download Bar for All 4 Assessment Types -->
              <div class="p-4 rounded mt-auto" style="background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);">
                <div class="text-xs fw-700 text-muted uppercase mb-3">Other Templates:</div>
                <div class="d-flex flex-column gap-2">
                  <button class="btn btn-secondary btn-sm text-left" id="dl-tmpl-written">📄 Written (Type)</button>
                  <button class="btn btn-secondary btn-sm text-left" id="dl-tmpl-speech">🎙️ Speech to Text</button>
                  <button class="btn btn-secondary btn-sm text-left" id="dl-tmpl-mc">🔘 Multiple Choice</button>
                  <button class="btn btn-secondary btn-sm text-left" id="dl-tmpl-dropdown">&#9660; Drop-down</button>
                  <div class="text-xs fw-700 text-primary uppercase mt-3 mb-1">TopsCore AI assessments:</div>
                  <button class="btn btn-outline-primary btn-sm text-left dl-ai-tmpl" data-module="POINT_AND_SPEAK">⚡ Point & Speak!</button>
                  <button class="btn btn-outline-primary btn-sm text-left dl-ai-tmpl" data-module="STORYTELLING">⚡ Storytelling</button>
                  <button class="btn btn-outline-primary btn-sm text-left dl-ai-tmpl" data-module="CONVERSATIONAL">⚡ Conversational</button>
                  <button class="btn btn-outline-primary btn-sm text-left dl-ai-tmpl" data-module="READ_ALOUD">⚡ Read Aloud</button>
                  <button class="btn btn-outline-primary btn-sm text-left dl-ai-tmpl" data-module="TURN_BASED_ROLEPLAY">⚡ Turn-Based Roleplay</button>
                  <button class="btn btn-outline-primary btn-sm text-left dl-ai-tmpl" data-module="SPEAKING_MONOLOGUE">⚡ Speaking Performance</button>
                  <button class="btn btn-outline-primary btn-sm text-left dl-ai-tmpl" data-module="VOCAB_MASTERY">⚡ Vocab Mastery</button>
                </div>
              </div>
            </div>

            <!-- PREVIEW BOX (Right side / Bottom on mobile) -->
            <div id="import-preview-container" class="hidden" style="flex: 1; min-width: 300px; height: 100%;">
              <div class="glass-card p-6" style="display: flex; flex-direction: column; height: 100%;">
                <div class="d-flex align-center justify-between flex-wrap gap-4 mb-4" style="flex-shrink: 0;">
                  <div>
                    <h3 class="text-gradient m-0" id="preview-summary-title">Preview Parsing Results</h3>
                    <p class="text-muted text-sm mt-1">Review questions data before saving.</p>
                  </div>
                  <div>
                    <span class="badge badge-primary p-2" id="preview-assessment-type-badge" style="font-size:0.85rem;">Assessment Type: WRITTEN</span>
                  </div>
                </div>

                <div class="table-wrap table-compact mb-5" style="flex: 1; overflow-y: auto; overflow-x: auto; max-height: none;">
                  <table style="width: 100%; table-layout: fixed; min-width: 500px;">
                    <thead>
                      <tr>
                        <th style="width:10%;">NO</th>
                        <th style="width:60%;">QUESTION</th>
                        <th style="width:30%;">ANSWER</th>
                      </tr>
                    </thead>
                    <tbody id="tbl-import-preview"></tbody>
                  </table>
                </div>

                <div class="d-flex justify-between align-center flex-wrap gap-3" style="flex-shrink: 0;">
                  <span class="text-muted text-sm" id="preview-count-label">0 questions siap di-import.</span>
                  <div class="d-flex gap-2">
                    <button class="btn btn-secondary" id="cancel-import-btn">Cancel</button>
                    <button class="btn btn-primary" id="confirm-save-import-btn">💾 Save Questions</button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      `;

      let parsedQuestionsState = [];
      let fetchedAssessmentsList = [];

      const formatInfos = {
        written: {
          title: 'FORMAT KOLOM EXCEL WRITTEN (KETIK TULISAN)',
          desc: 'Students answer by typing the translation/word. Requires 11 standard columns:',
          columns: 'PROGRAM | CLASS | Class | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'MENCAPAI', ANSWER: 'ACHIEVE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'MENYELESAIKAN DENGAN SUKSES', ANSWER: 'ACCOMPLISH' },
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 3, QUESTION: 'MENGEMBANGKAN', ANSWER: 'DEVELOP' },
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 4, QUESTION: 'MENINGKATKAN', ANSWER: 'IMPROVE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 5, QUESTION: 'BERSPESIALISASI', ANSWER: 'SPECIALISE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 6, QUESTION: 'MEMENUHI KUALIFIKASI', ANSWER: 'QUALIFY' },
            { PROGRAM: 'CEC', CLASS: 'Camp', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 7, QUESTION: 'BERKONTRIBUSI', ANSWER: 'CONTRIBUTE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 8, QUESTION: 'MENUNJUKKAN', ANSWER: 'DEMONSTRATE' }
          ]
        },
        speech_to_text: {
          title: 'FORMAT KOLOM EXCEL SPEECH TO TEXT (SUARA US/UK)',
          desc: 'Students answer by speaking a sentence via microphone. Requires 11 standard columns:',
          columns: 'PROGRAM | CLASS | Class | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'MENCAPAI', ANSWER: 'ACHIEVE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'MENYELESAIKAN DENGAN SUKSES', ANSWER: 'ACCOMPLISH' },
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 3, QUESTION: 'MENGEMBANGKAN', ANSWER: 'DEVELOP' },
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 4, QUESTION: 'MENINGKATKAN', ANSWER: 'IMPROVE' }
          ]
        },
        multiple_choice: {
          title: 'FORMAT KOLOM EXCEL MULTIPLE CHOICE (PILIHAN GANDA)',
          desc: 'Students select one answer from multiple choices (A, B, C, D). Requires 4 separate option columns:',
          columns: 'PROGRAM | CLASS | Class | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER | OPTION A | OPTION B | OPTION C | OPTION D',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'She ___ to school every day.', ANSWER: 'walks', 'OPTION A': 'walks', 'OPTION B': 'walk', 'OPTION C': 'walking', 'OPTION D': 'walked' },
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'They ___ playing football now.', ANSWER: 'are', 'OPTION A': 'are', 'OPTION B': 'is', 'OPTION C': 'am', 'OPTION D': 'was' }
          ]
        },
        dropdown: {
          title: 'FORMAT KOLOM EXCEL DROP-DOWN (MENU TARIK)',
          desc: 'Students select an answer from a dropdown menu (Mendukung 2 s/d 10 opsi: OPTION A, B, C, D, E, F, G, H, I, J atau OPTION 1 s/d 10).',
          columns: 'PROGRAM | CLASS | Class | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER | OPTION A | OPTION B | ... | OPTION J (hingga 10 opsi)',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'Select the correct pronoun for a group including yourself.', ANSWER: 'We', 'OPTION A': 'They', 'OPTION B': 'We', 'OPTION C': 'He', 'OPTION D': 'You', 'OPTION E': 'It' },
            { PROGRAM: 'CEC', CLASS: 'Camp', Class: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'Choose past tense of go:', ANSWER: 'went', 'OPTION A': 'go', 'OPTION B': 'went', 'OPTION C': 'gone', 'OPTION D': 'going' }
          ]
        }
      };

      function updateFormatDisplay(typeKey) {
        const info = formatInfos[typeKey] || formatInfos.written;
        document.getElementById('format-title-badge').textContent = info.title;
        document.getElementById('format-desc-label').textContent = info.desc;
        document.getElementById('format-columns-code').textContent = info.columns;
        const previewBadge = document.getElementById('preview-assessment-type-badge');
        if (previewBadge) previewBadge.textContent = `Assessment Type: ${typeKey.replace('_',' ').toUpperCase()}`;

        if (parsedQuestionsState.length) {
          parsedQuestionsState.forEach(q => { q.answerType = typeKey; });
          renderPreviewTable();
        }
      }

      adminFetchAll('assessments').then(assessments => {
        fetchedAssessmentsList = Array.isArray(assessments) ? assessments : [];
        const sortedAssessments = [...fetchedAssessmentsList].sort((a, b) => {
          const nameA = `${a?.Assessment_type ? a.Assessment_type + ' - ' : ''}${a?.Assessment_title || ''}`;
          const nameB = `${b?.Assessment_type ? b.Assessment_type + ' - ' : ''}${b?.Assessment_title || ''}`;
          return nameA.localeCompare(nameB);
        });
        const sel = document.getElementById('import-Assessment-select');
        if (sel) {
          sel.innerHTML = '<option value="">— Select Target Assessment —</option>' +
            sortedAssessments.map(e => `<option value="${e.id}">${escapeHtml(formatAssessmentDisplayName(e))} (${formatAnswerType(e.answer_type)})</option>`).join('');
        }
      }).catch(err => {
        console.warn('Failed to load assessments for import questions:', err);
        const sel = document.getElementById('import-Assessment-select');
        if (sel) sel.innerHTML = '<option value="">(No assessments available or failed to load)</option>';
      });

      document.getElementById('import-Assessment-select').addEventListener('change', (e) => {
        const AssessmentId = e.target.value;
        const selectedAssessment = fetchedAssessmentsList.find(x => x.id === AssessmentId);
        if (selectedAssessment) {
          const atype = selectedAssessment.answer_type || 'written';
          document.getElementById('import-Assessment-type-select').value = atype;
          updateFormatDisplay(atype);
        }
      });

      document.getElementById('import-Assessment-type-select').addEventListener('change', (e) => {
        updateFormatDisplay(e.target.value);
      });

      // Download helper
      function downloadTemplateForType(typeKey) {
        const info = formatInfos[typeKey] || formatInfos.written;
        const ws = XLSX.utils.json_to_sheet(info.sample);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, `Template_${typeKey}_Assessment.xlsx`);
        showToast(`Template ${typeKey.replace('_',' ')} downloaded successfully.`, 'success');
      }

      // Download template for selected format
      document.getElementById('download-template-btn').addEventListener('click', () => {
        const currentType = document.getElementById('import-Assessment-type-select').value || 'written';
        downloadTemplateForType(currentType);
      });

      // Quick template download buttons
      document.getElementById('dl-tmpl-written')?.addEventListener('click', () => downloadTemplateForType('written'));
      document.getElementById('dl-tmpl-speech')?.addEventListener('click', () => downloadTemplateForType('speech_to_text'));
      document.getElementById('dl-tmpl-mc')?.addEventListener('click', () => downloadTemplateForType('multiple_choice'));
            document.getElementById('dl-tmpl-dropdown')?.addEventListener('click', () => downloadTemplateForType('dropdown'));
      
      document.querySelectorAll('.dl-ai-tmpl').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const modType = e.target.getAttribute('data-module');
          if (modType) downloadAITemplate(modType);
        });
      });

      document.getElementById('import-questions-file').addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        showLoading('Reading Excel file preview…');
        const reader = new FileReader();

        reader.onload = (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!jsonRows.length) {
              hideLoading();
              showToast('Excel file is empty.', 'warning');
              return;
            }

            // Check if this is an AI Assessment based on headers
            const headers = Object.keys(jsonRows[0] || {}).map(h => h.trim().toUpperCase().replace(/\s+/g, '_'));
            let detectedAIModule = null;
            for (const [modKey, modDef] of Object.entries(AI_MODULES)) {
              if (modDef.columns.every(col => headers.includes(col))) {
                detectedAIModule = modKey;
                break;
              }
            }

            if (detectedAIModule) {
              hideLoading();
              document.getElementById('preview-summary-title').innerHTML = `⚠️ This is an AI Assessment Module (<b>` + AI_MODULES[detectedAIModule].name + `</b>)`;
              document.getElementById('preview-count-label').innerHTML = `<span class="text-danger">AI Modules cannot be saved here. Please go to <b>Panel C (Class & Assessment Management) -> Import Payload</b> to upload this file.</span>`;
              
              // Render basic preview
              const tbody = document.getElementById('tbl-import-preview');
              if (tbody) {
                tbody.innerHTML = '';
                jsonRows.slice(0, 5).forEach(row => {
                  const tr = document.createElement('tr');
                  tr.innerHTML = `<td colspan="100%" class="text-sm text-muted">` + escapeHtml(JSON.stringify(row).substring(0, 100)) + `...</td>`;
                  tbody.appendChild(tr);
                });
              }
              
              // Hide save/cancel buttons since it can't be saved here
              const saveBtn = document.getElementById('confirm-save-import-btn');
              const cancelBtn = document.getElementById('cancel-import-btn');
              if (saveBtn) saveBtn.style.display = 'none';
              if (cancelBtn) cancelBtn.textContent = 'Close';

              document.getElementById('import-preview-container').classList.remove('hidden');
              showToast(`Please upload AI Modules in Panel C.`, 'warning');
              return;
            }

            // Restore buttons for standard imports
            const saveBtn = document.getElementById('confirm-save-import-btn');
            const cancelBtn = document.getElementById('cancel-import-btn');
            if (saveBtn) saveBtn.style.display = 'inline-block';
            if (cancelBtn) cancelBtn.textContent = 'Cancel';


            // Get target Assessment answer_type from selected Assessment
            const AssessmentId = document.getElementById('import-Assessment-select').value;
            const selectedAssessment = fetchedAssessmentsList.find(x => x.id === AssessmentId);
            let defaultAnswerType = selectedAssessment?.answer_type || 'written';

            parsedQuestionsState = [];
            jsonRows.forEach((rawRow, i) => {
              // Normalize row keys based on "includes"
              const row = {};
              let hasAnyValue = false;
              for (const [k, v] of Object.entries(rawRow)) {
                if (v !== undefined && String(v).trim() !== '') hasAnyValue = true;
                const key = String(k).toLowerCase().replace(/[\s\-_]+/g, '');
                if (key.includes('question') || key.includes('pertanyaan') || key.includes('prompt')) row.question_text = v;
                else if (key.includes('answer') || key.includes('key') || key.includes('jawaban') || key.includes('kunci')) row.correct_answer = v;
                else if (key.includes('topic') || key.includes('topik')) row.topic = v;
                else if (key.includes('type') || key.includes('tipe') || key.includes('word') || key.includes('category')) row.question_type = v;
                else if (key.includes('no') || key.includes('order')) row.no = v;
                else row[key] = v; // keep original mapping fallback
              }
              if (!hasAnyValue) return;

              const questionText = row.question_text || getRowVal(rawRow, ['question', 'questions', 'pertanyaan', 'indonesia', 'text', 'prompt']);
              const correctAnswer = row.correct_answer || getRowVal(rawRow, ['answer', 'jawaban', 'kunci', 'kuncijawaban', 'english', 'correctanswer', 'solution', 'key']);
              const rawNo = row.no || getRowVal(rawRow, ['no', 'nomor', 'number', 'order', 'urutan']);
              const qNo = parseInt(rawNo || (i + 1), 10);
              const classItem = getRowVal(rawRow, ['Class', 'matapelajaran', 'mapel', 'class']);
              const title = getRowVal(rawRow, ['title', 'Assessmenttitle', 'judul']);
              const week = getRowVal(rawRow, ['week', 'minggu']);
              const day = getRowVal(rawRow, ['day', 'hari']);
              const type = row.question_type || getRowVal(rawRow, ['type', 'wordtype', 'word_type', 'category', 'Assessmenttype', 'tipe', 'jenisquestions']);
              const topic = row.topic || getRowVal(rawRow, ['topic', 'topik', 'kategori']);

              // Extract options: Check separate OPTION A..J or OPTION 1..10 (2 to 10 options)
              let extractedOptions = [];
              const optionKeysLetter = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
              optionKeysLetter.forEach(ltr => {
                const val = getRowVal(rawRow, ['option ' + ltr.toLowerCase(), 'option' + ltr.toLowerCase(), 'opsi ' + ltr.toLowerCase(), 'opsi' + ltr.toLowerCase(), 'pilihan ' + ltr.toLowerCase(), 'pilihan' + ltr.toLowerCase(), ltr.toLowerCase()]);
                if (val !== undefined && String(val).trim() !== '') {
                  extractedOptions.push(String(val).trim());
                }
              });

              if (extractedOptions.length === 0) {
                for (let num = 1; num <= 10; num++) {
                  const val = getRowVal(rawRow, ['option ' + num, 'option' + num, 'opsi ' + num, 'opsi' + num, 'pilihan ' + num, 'pilihan' + num]);
                  if (val !== undefined && String(val).trim() !== '') {
                    extractedOptions.push(String(val).trim());
                  }
                }
              }

              let optionsJson = null;
              if (extractedOptions.length > 0) {
                optionsJson = extractedOptions;
              } else {
                const rawOptions = getRowVal(rawRow, ['options', 'opsi', 'pilihan', 'pilihanganda']);
                if (rawOptions) {
                  if (typeof rawOptions === 'string' && rawOptions.startsWith('[')) {
                    try { optionsJson = JSON.parse(rawOptions); } catch { optionsJson = rawOptions.split(',').map(s => s.trim()).filter(Boolean); }
                  } else if (typeof rawOptions === 'string') {
                    optionsJson = rawOptions.split(',').map(s => s.trim()).filter(Boolean);
                  }
                }
              }

              const program = getRowVal(rawRow, ['program', 'programname', 'namaprogram']) || selectedAssessment?.institutions?.name || 'CEC';
              const programName = getRowVal(rawRow, ['class', 'classname', 'kelas', 'namakelas']) || 'Camp';
              const level = getRowVal(rawRow, ['level', 'tingkat', 'levelnumber']) || selectedAssessment?.levels?.name || '3rd Step';

              // Validation Badge Logic
              let statusBadge = 'ready';
              if (!questionText || !correctAnswer) {
                statusBadge = 'invalid';
              } else if (!topic || !type) {
                statusBadge = 'warning';
              }

              parsedQuestionsState.push({
                order: isNaN(qNo) ? (i + 1) : qNo,
                questionText: String(questionText || '').trim(),
                correctAnswer: String(correctAnswer || '').trim(),
                answerType: defaultAnswerType,
                optionsJson: optionsJson,
                program, programName, classItem, level, title, week, day, type, topic, statusBadge
              });
            });

            hideLoading();
            if (!parsedQuestionsState.length) {
              showToast('No valid question rows found in Excel file.', 'warning');
              return;
            }

            renderPreviewTable();
            document.getElementById('import-preview-container').classList.remove('hidden');
          } catch(err) {
            hideLoading();
            showToast(`Error parsing file: ${err.message}`, 'error');
          }
        };

        reader.readAsArrayBuffer(file);
      });

      function renderPreviewTable() {
        const tbody = document.getElementById('tbl-import-preview');

        // Build simple <thead> focusing only on NO, QUESTION, ANSWER, STATUS
        const theadContainer = document.querySelector('#import-preview-container table thead');
        if (theadContainer) {
          theadContainer.innerHTML = `
            <tr>
              <th style="width:10%;" class="text-center">NO</th>
              <th style="width:40%;">QUESTION</th>
              <th style="width:30%;">ANSWER</th>
              <th style="width:20%;" class="text-center">STATUS</th>
            </tr>
          `;
        }

        const tableElem = document.querySelector('#import-preview-container table');
        if (tableElem) {
          tableElem.style.minWidth = '600px';
          tableElem.style.width = '100%';
        }

        tbody.innerHTML = '';

        const LIMIT = 50;
        parsedQuestionsState.forEach((item, idx) => {
          if (idx < LIMIT) {
            let badgeHtml = '';
            if (item.statusBadge === 'invalid') {
              badgeHtml = '<span class="badge bg-danger">Invalid (Missing Text/Ans)</span>';
            } else if (item.statusBadge === 'warning') {
              badgeHtml = '<span class="badge bg-warning text-dark">Warning (No Topic/Type)</span>';
            } else {
              badgeHtml = '<span class="badge bg-success">Ready</span>';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td class="text-muted fw-700 text-center" style="font-size:0.8rem;">${item.order}</td>
              <td class="fw-600" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.8rem; max-width:200px;" title="${escapeHtml(item.questionText)}">${escapeHtml(item.questionText || '(Empty)')}</td>
              <td class="fw-700" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.8rem; max-width:100px; color:${item.correctAnswer ? 'var(--bs-success)' : 'var(--bs-danger)'};" title="${escapeHtml(item.correctAnswer)}">${escapeHtml(item.correctAnswer || '(Empty)')}</td>
              <td class="text-center">${badgeHtml}</td>
            `;
            tbody.appendChild(tr);
          } else if (idx === LIMIT) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="4" class="text-center text-muted fw-600 py-3" style="font-size: 0.85rem;">... and ${parsedQuestionsState.length - LIMIT} more rows.</td>`;
            tbody.appendChild(tr);
          }
        });

        document.getElementById('preview-count-label').textContent = `${parsedQuestionsState.length} questions mapped from Excel.`;
      }

      // Batch apply global answer type
      document.getElementById('apply-global-answer-type')?.addEventListener('click', () => {
        const val = document.getElementById('global-answer-type-select').value;
        parsedQuestionsState.forEach(q => { q.answerType = val; });
        renderPreviewTable();
        showToast(`Set all questions answer type to ${val.replace('_',' ')}`, 'info');
      });

      document.getElementById('cancel-import-btn')?.addEventListener('click', () => {
        document.getElementById('import-preview-container').classList.add('hidden');
        document.getElementById('import-questions-file').value = '';
        parsedQuestionsState = [];
      });

      document.getElementById('confirm-save-import-btn')?.addEventListener('click', async () => {
        const AssessmentId = document.getElementById('import-Assessment-select').value;
        if (!AssessmentId) { showToast('Please select a target Assessment before saving.', 'warning'); return; }
        if (!parsedQuestionsState.length) { showToast('No questions to save.', 'warning'); return; }

        showLoading('Saving & merging questions to database via Server...');
        try {
          // Filter out invalid rows (missing question text or answer) before sending
          const validQuestions = parsedQuestionsState.filter(q =>
            q.questionText && String(q.questionText).trim() !== '' &&
            q.correctAnswer && String(q.correctAnswer).trim() !== ''
          );

          if (!validQuestions.length) {
            hideLoading();
            showToast('No valid questions to save — all rows are missing question text or answer.', 'warning');
            return;
          }

          // Resolve duplicate 'order' numbers within the uploaded batch (common copy-paste error)
          // Use a Set to track used orders; reassign colliding orders sequentially.
          const usedOrders = new Set();
          const questionsPayload = validQuestions.map(q => {
            let safeOrder = q.order != null ? Number(q.order) : 1;
            if (isNaN(safeOrder) || safeOrder < 1) safeOrder = 1;
            while (usedOrders.has(safeOrder)) safeOrder++;
            usedOrders.add(safeOrder);

            return {
              order:         safeOrder,
              questionText:  q.questionText,
              correctAnswer: q.correctAnswer,
              answerType:    q.answerType,
              optionsJson:   q.optionsJson,
              metadata: {
                classItem: q.classItem,
                Class:   q.classItem,
                title:     q.title,
                week:      q.week,
                day:       q.day,
                type:      q.type
              }
            };
          });

          // callEdgeFunction throws on error — no need to check response.error
          const response = await callEdgeFunction('import-questions', { questions: questionsPayload, AssessmentId });
          hideLoading();

          const insertedCount = response?.insertedCount ?? 0;
          const updatedCount  = response?.updatedCount  ?? 0;
          const totalSaved = insertedCount + updatedCount;
          showToast(
            `Successfully saved ${totalSaved} questions (${insertedCount} new, ${updatedCount} updated)!`,
            'success'
          );

          // Warn if some rows failed on the server side
          if (response?.warnings && response.warnings.length > 0) {
            setTimeout(() => {
              showToast(`⚠️ ${response.warnings.length} question(s) failed to save. Check console for details.`, 'warning');
              console.warn('[import-questions] Server warnings:', response.warnings);
            }, 1500);
          }

          // Reset view but stay on the import page
          document.getElementById('import-preview-container').classList.add('hidden');
          document.getElementById('import-questions-file').value = '';
          parsedQuestionsState = [];
        } catch(err) {
          hideLoading();
          showToast(`Save error: ${err.message}`, 'error');
        }
      });
    }


    async function renderExportQuestions(area) {
      showLoading('Loading assessments for export…');
      let assessments = [];
      try {
        assessments = await adminFetchAll('assessments');
      } catch (err) {
        console.warn('Export assessments fetch warning:', err);
      } finally {
        hideLoading();
      }
      area.innerHTML = `
        <div class="section-header"><div><h2 class="section-title">Export Questions (Excel)</h2></div></div>
        <div class="glass-card p-8" style="max-width:640px;">
          <p class="text-muted mb-4">Export questions from an Assessment into an Excel workbook formatted with standard columns:</p>
          <div class="mb-5 p-3 rounded" style="background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);font-size:0.75rem;font-family:monospace;">
            PROGRAM | CLASS | Class | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER
          </div>
          <div class="form-group"><label class="form-label">Select Assessment to Export</label>
            <select class="form-control" id="export-assessment-select">
              <option value="">— Select Assessment —</option>
              ${[...assessments].sort((a, b) => {
                const labelA = `${a.Assessment_type ? a.Assessment_type + ' - ' : ''}${a.Assessment_title}`;
                const labelB = `${b.Assessment_type ? b.Assessment_type + ' - ' : ''}${b.Assessment_title}`;
                return labelA.localeCompare(labelB);
              }).map(e => `<option value="${e.id}">${e.Assessment_type ? e.Assessment_type + ' - ' : ''}${e.Assessment_title}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary mt-2" id="export-questions-btn">📤 Download Excel (.xlsx)</button>
        </div>
      `;

      document.getElementById('export-questions-btn').addEventListener('click', async () => {
        const AssessmentId = document.getElementById('export-assessment-select').value;
        if (!AssessmentId) { showToast('Please select an Assessment to export.', 'warning'); return; }

        const selectedAssessment = assessments.find(e => e.id === AssessmentId);
        showLoading('Preparing Excel export…');

        try {
          const sb = await getSupabase();
          let questions = [];
          const [directQRes, AssessmentClasses] = await Promise.all([
            sb.from('questions').select('*').eq('Assessment_id', AssessmentId).is('deleted_at', null),
            sb.from('Assessment_programs').select('programs(name)').eq('Assessment_id', AssessmentId)
          ]);
          questions = directQRes?.data || [];
          if (!questions.length) {
            try {
              const { data: sections } = await sb.from('Assessment_sections').select('id').eq('Assessment_id', AssessmentId);
              const sectionIds = (sections || []).map(s => s.id);
              if (sectionIds.length > 0) {
                const { data: secQ } = await sb.from('questions').select('*').in('section_id', sectionIds).is('deleted_at', null);
                if (secQ && secQ.length > 0) questions = secQ;
              }
            } catch (_) {}
          }

          const sortedQuestions = questions.sort((a,b) => (a.question_order || 0) - (b.question_order || 0));
          const programName = AssessmentClasses?.data?.[0]?.programs?.name || 'Camp';

          const excelData = sortedQuestions.map((q, idx) => ({
            'PROGRAM': selectedAssessment?.institutions?.name || 'CEC',
            'CLASS': programName,
            'Class': q.metadata?.classItem || q.metadata?.Class || selectedAssessment?.classes?.name || 'Vocab',
            'LEVEL': selectedAssessment?.levels?.name || '3rd Step',
            'TITLE': q.metadata?.title || selectedAssessment?.Assessment_title || 'Practice 1',
            'WEEK': q.metadata?.week || '1',
            'DAY': q.metadata?.day || '1',
            'TYPE': q.metadata?.type || selectedAssessment?.Assessment_type || '1 - VERB',
            'NO': q.question_order || (idx + 1),
            'QUESTION': q.question_text || '',
            'ANSWER': q.correct_answer || ''
          }));

          if (!excelData.length) {
            hideLoading();
            showToast('No questions found for this Assessment.', 'warning');
            return;
          }

          const worksheet = XLSX.utils.json_to_sheet(excelData, {
            header: ['PROGRAM', 'CLASS', 'Class', 'LEVEL', 'TITLE', 'WEEK', 'DAY', 'TYPE', 'NO', 'QUESTION', 'ANSWER']
          });

          // Set column widths
          worksheet['!cols'] = [
            { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 6 }, { wch: 35 }, { wch: 25 }
          ];

          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

          const fileName = `${(selectedAssessment?.Assessment_title || 'Assessment').replace(/\s+/g, '_')}_Questions.xlsx`;
          XLSX.writeFile(workbook, fileName);

          hideLoading();
          showToast(`Exported ${excelData.length} questions to ${fileName}`, 'success');
        } catch(err) {
          hideLoading();
          showToast(`Export error: ${err.message}`, 'error');
        }
      });
    }


export { renderImportStudents, renderImportQuestions, renderExportQuestions };

