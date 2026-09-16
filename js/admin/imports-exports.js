import { adminFetchAll, adminInsert, adminUpdate } from '../api.js?v=3.1.0';
import { parseExcelWorkbook, processStudentImportRows, processQuestionImportRows } from '../excel-parser.js?v=3.1.0';
import { showToast, showLoading, hideLoading } from '../app.js?v=3.1.0';

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

    async function renderImportStudents(area) {
      showLoading('Loading institutions & programs…');
      const [allProgs, allCls, allBatches, allLevels] = await Promise.all([
        adminFetchAll('institutions'),
        adminFetchAll('programs', '*, institutions(name)'),
        adminFetchAll('batches'),
        adminFetchAll('levels')
      ]);
      hideLoading();

      const sortedPrograms = allProgs.filter(p => !p.deleted_at && p.is_active).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const sortedClasses = allCls.filter(c => !c.deleted_at && c.is_active).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const sortedBatches = allBatches.filter(b => !b.deleted_at && b.is_active).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const sortedLevels = allLevels.filter(l => !l.deleted_at && l.is_active).sort((a, b) => (a.level_number || 0) - (b.level_number || 0));

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
                  <label class="form-label">1. Target Program (Default / Override)</label>
                  <select class="form-control" id="import-student-program">
                    <option value="">- Use Program from Excel File -</option>
                    ${sortedPrograms.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
                  </select>
                  <span class="text-muted text-xs mt-1">Select to assign all students in the file to this Program.</span>
                </div>

                <div class="form-group w-100">
                  <label class="form-label">2. Target Class (Default / Override)</label>
                  <select class="form-control" id="import-student-class">
                    <option value="">- Use Class from Excel File -</option>
                    ${sortedClasses.map(c => `<option value="${c.id}" data-prog="${c.institution_id}">[${escapeHtml(c.institutions?.name || 'Program')}] ${escapeHtml(c.name)}</option>`).join('')}
                  </select>
                  <span class="text-muted text-xs mt-1">Select to assign all students in the file to this Class.</span>
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
                  <div>• <b>Name:</b> Column <code>NAME</code>, <code>Student Name</code> (Required).</div>
                  <div>• <b>Gender (Optional):</b> Column <code>GENDER</code>. <em>If left blank, students will select their own gender (Mr. / Miss) upon first login.</em></div>
                  <div>• <b>Birth Date / Age:</b> Column <code>BIRTH_DATE</code> or <code>AGE</code> (Format: YYYY-MM-DD or age number).</div>
                  <div>• <b>PIN:</b> Column <code>PIN</code> or <code>Password</code> (Defaults to <code>1234</code> if left blank).</div>
                  <div>• <b>Program &amp; Class &amp; Batch:</b> If left blank in the Excel file, the Target Program, Class, and Batch selected above will be used.</div>
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
                  <table style="width: 100%; table-layout: fixed; min-width: 700px;">
                    <thead>
                      <tr>
                        <th class="text-center" style="width:5%;">#</th>
                        <th class="text-left" style="width:25%;">Student Name</th>
                        <th class="text-center" style="width:8%;">Gender</th>
                        <th class="text-center" style="width:12%;">Birth Date/Age</th>
                        <th class="text-left" style="width:12%;">Program</th>
                        <th class="text-left" style="width:12%;">Class</th>
                        <th class="text-left" style="width:10%;">Batch</th>
                        <th class="text-center" style="width:8%;">PIN</th>
                        <th class="text-center" style="width:8%;">Status</th>
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
            'GENDER': 'male',
            'BIRTH_DATE': '2010-05-14',
            'PIN': '1234',
            'PROGRAM': sortedPrograms[0]?.name || 'General English Program',
            'CLASS': sortedClasses[0]?.name || 'Class A',
            'BATCH': 'Batch 2026-A'
          },
          {
            'NO': 2,
            'NAME': 'Beatrix Potter',
            'GENDER': 'female',
            'BIRTH_DATE': '2011-09-22',
            'PIN': '1234',
            'PROGRAM': sortedPrograms[0]?.name || 'General English Program',
            'CLASS': sortedClasses[0]?.name || 'Class A',
            'BATCH': 'Batch 2026-A'
          },
          {
            'NO': 3,
            'NAME': 'Christopher Nolan',
            'GENDER': '', // Optional: leave blank if students will choose their own gender upon first login
            'BIRTH_DATE': '2010-11-03',
            'PIN': '5678',
            'PROGRAM': sortedPrograms[0]?.name || 'General English Program',
            'CLASS': sortedClasses[1]?.name || sortedClasses[0]?.name || 'Class B',
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
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!jsonRows.length) {
              hideLoading();
              showToast('Spreadsheet file is empty.', 'warning');
              return;
            }

            // Fetch existing students to detect and merge duplicate names in the same class
            const existingStudents = await adminFetchAll('students');
            const existingStudentsMap = new Map();
            existingStudents.forEach(s => {
              if (s.deleted_at) return;
              const key = `${(s.name || '').toLowerCase().trim()}::${s.program_id}`;
              if (!existingStudentsMap.has(key)) {
                existingStudentsMap.set(key, s);
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
              const rowProgName = getRowVal(row, ['program', 'programname', 'namaprogram']);
              const rowClassName = getRowVal(row, ['class', 'classname', 'kelas', 'namakelas']);
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
              let statusMsg = '✨ New Student';
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
              badgeHtml = `<span class="badge badge-success">✨ New Student</span>`;
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
              : '<span class="badge badge-neutral" style="font-size:0.7rem;" title="Student will select gender upon first login">⏳ Unassigned</span>';

            tr.innerHTML = `
              <td class="text-center text-muted fw-700">${i + 1}</td>
              <td class="fw-600">${escapeHtml(s.name)}</td>
              <td class="text-center">${genderBadge}</td>
              <td class="text-center text-muted text-sm">${escapeHtml(s.birthDate || '—')} <span class="badge badge-info ml-1" style="font-size:0.7rem;">${escapeHtml(s.ageDisplay)}</span></td>
              <td class="text-muted text-sm">${escapeHtml(s.institutionName)}</td>
              <td class="fw-600 text-sm">${escapeHtml(s.programName)}</td>
              <td class="text-sm fw-600" style="color:var(--clr-accent-1);">${escapeHtml(s.batchName || '—')}</td>
              <td class="text-center text-sm" style="font-family:monospace;letter-spacing:2px;">•••• <span class="text-muted text-xs" title="PIN: ${escapeHtml(s.pin)}">(${escapeHtml(s.pin)})</span></td>
              <td class="text-center">${badgeHtml}</td>
            `;
            tbody.appendChild(tr);
          } else if (i === LIMIT) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="9" class="text-center text-muted fw-600 py-3" style="font-size: 0.85rem;">... and ${parsedStudentsState.length - LIMIT} more rows.</td>`;
            tbody.appendChild(tr);
          }
        });

        document.getElementById('students-preview-summary').textContent = `${parsedStudentsState.length} students ready to be processed (${newCount} new records, ${mergeCount} existing records merged).`;
        document.getElementById('chip-total-students').textContent = `Total: ${parsedStudentsState.length}`;
        document.getElementById('chip-valid-students').textContent = `✨ Baru: ${newCount}`;
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

              showLoading(`Processing ${readyStudents.length} students (saving new & merging existing)…`);
        try {
          let insertedCount = 0;
          let mergedCount = 0;

          // ── Auto-create missing batches first (before saving students) ──
          // Collect unique (programId, batchName) pairs that don't have a batchId yet
          const batchesToCreate = new Map(); // key: programId::batchName -> { programId, batchName }
          for (const s of readyStudents) {
            if (!s.batchId && s.batchName && s.batchName !== '—' && s.programId) {
              const key = `${s.programId}::${s.batchName.toLowerCase().trim()}`;
              if (!batchesToCreate.has(key)) {
                batchesToCreate.set(key, { programId: s.programId, batchName: s.batchName.trim() });
              }
            }
          }

          // Create missing batches and build a lookup map
          const newBatchMap = new Map(); // key: programId::batchName -> id
          for (const [key, { programId, batchName }] of batchesToCreate.entries()) {
            try {
              const newBatch = await adminInsert('batches', {
                program_id: programId,
                name: batchName,
                is_active: true
              });
              newBatchMap.set(key, newBatch.id);
              // Also push into sortedBatches so it's available for subsequent rows
              sortedBatches.push({ id: newBatch.id, program_id: programId, name: batchName, is_active: true });
              showToast(`Batch "${batchName}" auto-created.`, 'info');
            } catch(batchErr) {
              console.warn(`Could not auto-create batch "${batchName}":`, batchErr.message);
            }
          }

          // Resolve batch IDs for students that needed auto-creation
          for (const s of readyStudents) {
            if (!s.batchId && s.batchName && s.batchName !== '—' && s.programId) {
              const key = `${s.programId}::${s.batchName.toLowerCase().trim()}`;
              if (newBatchMap.has(key)) s.batchId = newBatchMap.get(key);
            }
          }

          // ── Safe student write helper: retries without extended columns if DB schema is old ──
          let _dbHasBatchId = true;  // Assume yes, will be set to false on first schema error
          let _dbHasBirthDate = true;
          let _dbHasProgramId = true;
          let _dbHasLevelId = true;

          async function safeStudentInsert(payload) {
            // Remove null/undefined batch_id if DB doesn't have the column
            const p = { ...payload };
            if (!_dbHasBatchId) delete p.batch_id;
            if (!_dbHasBirthDate) delete p.birth_date;
            if (!_dbHasProgramId) delete p.institution_id;
            
            try {
              return await adminInsert('students', p);
            } catch (e) {
              if (e.message && e.message.toLowerCase().includes('batch_id')) {
                _dbHasBatchId = false;
                showToast('⚠️ Column batch_id missing in DB — saving without batch. Run the SQL patch to fix this.', 'warning');
                delete p.batch_id;
                return await adminInsert('students', p);
              }
              if (e.message && e.message.toLowerCase().includes('birth_date')) {
                _dbHasBirthDate = false;
                delete p.birth_date;
                return await adminInsert('students', p);
              }
              if (e.message && e.message.toLowerCase().includes('institution_id')) {
                _dbHasProgramId = false;
                delete p.institution_id;
                return await adminInsert('students', p);
              }
              throw e;
            }
          }

          async function safeStudentUpdate(id, payload) {
            const p = { ...payload };
            if (!_dbHasBatchId) delete p.batch_id;
            if (!_dbHasBirthDate) delete p.birth_date;
            if (!_dbHasProgramId) delete p.institution_id;
            
            try {
              return await adminUpdate('students', id, p);
            } catch (e) {
              if (e.message && e.message.toLowerCase().includes('batch_id')) {
                _dbHasBatchId = false;
                showToast('⚠️ Column batch_id missing in DB — saving without batch. Run the SQL patch to fix this.', 'warning');
                delete p.batch_id;
                return await adminUpdate('students', id, p);
              }
              if (e.message && e.message.toLowerCase().includes('birth_date')) {
                _dbHasBirthDate = false;
                delete p.birth_date;
                return await adminUpdate('students', id, p);
              }
              if (e.message && e.message.toLowerCase().includes('institution_id')) {
                _dbHasProgramId = false;
                delete p.institution_id;
                return await adminUpdate('students', id, p);
              }
              throw e;
            }
          }

          for (const s of readyStudents) {
            if (s.isExisting && s.existingId) {
              const payload = {
                institution_id: s.institutionId,
                program_id: s.programId,
                batch_id: s.batchId || null,
                birth_date: s.birthDate,
                is_active: true,
                deleted_at: null,
                updated_at: new Date().toISOString()
              };
              if (s.gender) {
                payload.gender = s.gender;
                payload.name = formatStudentName(s.name, s.gender);
              } else {
                payload.name = s.name;
              }
              if (s.pin && s.pin !== '1234') {
                payload.pin_hash = await hashPin(s.pin);
              }
              await safeStudentUpdate(s.existingId, payload);
              mergedCount++;
            } else {
              const hashed = await hashPin(s.pin || '1234');
              const payload = {
                name: formatStudentName(s.name, s.gender),
                institution_id: s.institutionId,
                program_id: s.programId,
                batch_id: s.batchId || null,
                gender: s.gender || null,
                birth_date: s.birthDate,
                pin_hash: hashed,
                is_active: true
              };
              await safeStudentInsert(payload);
              insertedCount++;
            }
          }

          hideLoading();
          const batchWarning = !_dbHasBatchId ? ' (batch_id column missing — run SQL patch to enable full batch support)' : '';
          showToast(`Done! ${insertedCount} new students added, ${mergedCount} updated/merged!${batchWarning}`, 'success');
          
          // Stay on page and reset preview box
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
              <p class="section-subtitle">Select Exam & Exam Type first to view the correct Excel template format before uploading a file.</p>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-6 align-stretch" style="flex: 1; overflow: hidden;">
            
            <!-- IMPORT BOX (Left side / Top on mobile) -->
            <div class="glass-card p-6" style="flex: 1; min-width: 300px; max-width: calc(50% - 12px); height: 100%; overflow-y: auto; display: flex; flex-direction: column;">
              <div class="d-flex flex-column gap-4 mb-4">
                <div class="form-group w-100">
                  <label class="form-label">1. Select Target Exam</label>
                  <select class="form-control" id="import-exam-select"><option value="">Loading examsâ€¦</option></select>
                </div>
                <div class="form-group w-100">
                  <label class="form-label">2. Exam Type (Answer Method)</label>
                  <select class="form-control" id="import-exam-type-select">
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

              <!-- Quick Template Download Bar for All 4 Exam Types -->
              <div class="p-4 rounded mt-auto" style="background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);">
                <div class="text-xs fw-700 text-muted uppercase mb-3">Other Templates:</div>
                <div class="d-flex flex-column gap-2">
                  <button class="btn btn-secondary btn-sm text-left" id="dl-tmpl-written">📄 Written (Type)</button>
                  <button class="btn btn-secondary btn-sm text-left" id="dl-tmpl-speech">🎙️ Speech to Text</button>
                  <button class="btn btn-secondary btn-sm text-left" id="dl-tmpl-mc">🔘 Multiple Choice</button>
                  <button class="btn btn-secondary btn-sm text-left" id="dl-tmpl-dropdown">▼ Drop-down</button>
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
                    <span class="badge badge-primary p-2" id="preview-exam-type-badge" style="font-size:0.85rem;">Exam Type: WRITTEN</span>
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
      let fetchedExamsList = [];

      const formatInfos = {
        written: {
          title: 'FORMAT KOLOM EXCEL WRITTEN (KETIK TULISAN)',
          desc: 'Students answer by typing the translation/word. Requires 11 standard columns:',
          columns: 'PROGRAM | CLASS | SUBJECT | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'MENCAPAI', ANSWER: 'ACHIEVE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'MENYELESAIKAN DENGAN SUKSES', ANSWER: 'ACCOMPLISH' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 3, QUESTION: 'MENGEMBANGKAN', ANSWER: 'DEVELOP' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 4, QUESTION: 'MENINGKATKAN', ANSWER: 'IMPROVE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 5, QUESTION: 'BERSPESIALISASI', ANSWER: 'SPECIALISE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 6, QUESTION: 'MEMENUHI KUALIFIKASI', ANSWER: 'QUALIFY' },
            { PROGRAM: 'CEC', CLASS: 'Camp', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 7, QUESTION: 'BERKONTRIBUSI', ANSWER: 'CONTRIBUTE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 8, QUESTION: 'MENUNJUKKAN', ANSWER: 'DEMONSTRATE' }
          ]
        },
        speech_to_text: {
          title: 'FORMAT KOLOM EXCEL SPEECH TO TEXT (SUARA US/UK)',
          desc: 'Students answer by speaking a sentence via microphone. Requires 11 standard columns:',
          columns: 'PROGRAM | CLASS | SUBJECT | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'MENCAPAI', ANSWER: 'ACHIEVE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'MENYELESAIKAN DENGAN SUKSES', ANSWER: 'ACCOMPLISH' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 3, QUESTION: 'MENGEMBANGKAN', ANSWER: 'DEVELOP' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 4, QUESTION: 'MENINGKATKAN', ANSWER: 'IMPROVE' }
          ]
        },
        multiple_choice: {
          title: 'FORMAT KOLOM EXCEL MULTIPLE CHOICE (PILIHAN GANDA)',
          desc: 'Students select one answer from multiple choices (A, B, C, D). Requires 4 separate option columns:',
          columns: 'PROGRAM | CLASS | SUBJECT | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER | OPTION A | OPTION B | OPTION C | OPTION D',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'She ___ to school every day.', ANSWER: 'walks', 'OPTION A': 'walks', 'OPTION B': 'walk', 'OPTION C': 'walking', 'OPTION D': 'walked' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'They ___ playing football now.', ANSWER: 'are', 'OPTION A': 'are', 'OPTION B': 'is', 'OPTION C': 'am', 'OPTION D': 'was' }
          ]
        },
        dropdown: {
          title: 'FORMAT KOLOM EXCEL DROP-DOWN (MENU TARIK)',
          desc: 'Students select an answer from a dropdown menu (Mendukung 2 s/d 10 opsi: OPTION A, B, C, D, E, F, G, H, I, J atau OPTION 1 s/d 10).',
          columns: 'PROGRAM | CLASS | SUBJECT | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER | OPTION A | OPTION B | ... | OPTION J (hingga 10 opsi)',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'Select the correct pronoun for a group including yourself.', ANSWER: 'We', 'OPTION A': 'They', 'OPTION B': 'We', 'OPTION C': 'He', 'OPTION D': 'You', 'OPTION E': 'It' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'Choose past tense of go:', ANSWER: 'went', 'OPTION A': 'go', 'OPTION B': 'went', 'OPTION C': 'gone', 'OPTION D': 'going' }
          ]
        }
      };

      function updateFormatDisplay(typeKey) {
        const info = formatInfos[typeKey] || formatInfos.written;
        document.getElementById('format-title-badge').textContent = info.title;
        document.getElementById('format-desc-label').textContent = info.desc;
        document.getElementById('format-columns-code').textContent = info.columns;
        const previewBadge = document.getElementById('preview-exam-type-badge');
        if (previewBadge) previewBadge.textContent = `Exam Type: ${typeKey.replace('_',' ').toUpperCase()}`;

        if (parsedQuestionsState.length) {
          parsedQuestionsState.forEach(q => { q.answerType = typeKey; });
          renderPreviewTable();
        }
      }

      adminFetchAll('exams').then(exams => {
        fetchedExamsList = exams;
        const sortedExams = [...exams].sort((a, b) => {
          const nameA = `${a.exam_type ? a.exam_type + ' - ' : ''}${a.exam_title}`;
          const nameB = `${b.exam_type ? b.exam_type + ' - ' : ''}${b.exam_title}`;
          return nameA.localeCompare(nameB);
        });
        const sel = document.getElementById('import-exam-select');
        sel.innerHTML = '<option value="">— Select Target Exam —</option>' +
          sortedExams.map(e => `<option value="${e.id}">${escapeHtml(formatExamDisplayName(e))} (${formatAnswerType(e.answer_type)})</option>`).join('');
      });

      document.getElementById('import-exam-select').addEventListener('change', (e) => {
        const examId = e.target.value;
        const selectedExam = fetchedExamsList.find(x => x.id === examId);
        if (selectedExam) {
          const atype = selectedExam.answer_type || 'written';
          document.getElementById('import-exam-type-select').value = atype;
          updateFormatDisplay(atype);
        }
      });

      document.getElementById('import-exam-type-select').addEventListener('change', (e) => {
        updateFormatDisplay(e.target.value);
      });

      // Download helper
      function downloadTemplateForType(typeKey) {
        const info = formatInfos[typeKey] || formatInfos.written;
        const ws = XLSX.utils.json_to_sheet(info.sample);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, `Template_${typeKey}_Exam.xlsx`);
        showToast(`Template ${typeKey.replace('_',' ')} downloaded successfully.`, 'success');
      }

      // Download template for selected format
      document.getElementById('download-template-btn').addEventListener('click', () => {
        const currentType = document.getElementById('import-exam-type-select').value || 'written';
        downloadTemplateForType(currentType);
      });

      // Quick template download buttons
      document.getElementById('dl-tmpl-written')?.addEventListener('click', () => downloadTemplateForType('written'));
      document.getElementById('dl-tmpl-speech')?.addEventListener('click', () => downloadTemplateForType('speech_to_text'));
      document.getElementById('dl-tmpl-mc')?.addEventListener('click', () => downloadTemplateForType('multiple_choice'));
      document.getElementById('dl-tmpl-dropdown')?.addEventListener('click', () => downloadTemplateForType('dropdown'));

      document.getElementById('import-questions-file').addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        showLoading('Reading Excel file preview…');
        const reader = new FileReader();

        reader.onload = (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!jsonRows.length) {
              hideLoading();
              showToast('Excel file is empty.', 'warning');
              return;
            }

            // Get target exam answer_type from selected Exam
            const examId = document.getElementById('import-exam-select').value;
            const selectedExam = fetchedExamsList.find(x => x.id === examId);
            let defaultAnswerType = selectedExam?.answer_type || 'written';

            parsedQuestionsState = [];
            jsonRows.forEach((row, i) => {
              const questionText = getRowVal(row, ['question', 'questions', 'pertanyaan', 'indonesia', 'text', 'prompt']);
              const correctAnswer = getRowVal(row, ['answer', 'jawaban', 'kunci', 'kuncijawaban', 'english', 'correctanswer', 'solution']);
              const rawNo = getRowVal(row, ['no', 'nomor', 'number', 'order', 'urutan']);
              const qNo = parseInt(rawNo || (i + 1), 10);
              const subject = getRowVal(row, ['subject', 'matapelajaran', 'mapel']);
              const title = getRowVal(row, ['title', 'examtitle', 'judul']);
              const week = getRowVal(row, ['week', 'minggu']);
              const day = getRowVal(row, ['day', 'hari']);
              const type = getRowVal(row, ['type', 'examtype', 'tipe', 'jenisquestions']);

              if (!questionText || !correctAnswer) return;

              // Extract options: Check separate OPTION A..J or OPTION 1..10 (2 to 10 options)
              let extractedOptions = [];
              const optionKeysLetter = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
              optionKeysLetter.forEach(ltr => {
                const val = getRowVal(row, ['option ' + ltr.toLowerCase(), 'option' + ltr.toLowerCase(), 'opsi ' + ltr.toLowerCase(), 'opsi' + ltr.toLowerCase(), 'pilihan ' + ltr.toLowerCase(), 'pilihan' + ltr.toLowerCase(), ltr.toLowerCase()]);
                if (val !== undefined && String(val).trim() !== '') {
                  extractedOptions.push(String(val).trim());
                }
              });

              if (extractedOptions.length === 0) {
                for (let num = 1; num <= 10; num++) {
                  const val = getRowVal(row, ['option ' + num, 'option' + num, 'opsi ' + num, 'opsi' + num, 'pilihan ' + num, 'pilihan' + num]);
                  if (val !== undefined && String(val).trim() !== '') {
                    extractedOptions.push(String(val).trim());
                  }
                }
              }

              let optionsJson = null;
              if (extractedOptions.length > 0) {
                optionsJson = extractedOptions;
              } else {
                const rawOptions = getRowVal(row, ['options', 'opsi', 'pilihan', 'pilihanganda']);
                if (rawOptions) {
                  if (typeof rawOptions === 'string' && rawOptions.startsWith('[')) {
                    try { optionsJson = JSON.parse(rawOptions); } catch { optionsJson = rawOptions.split(',').map(s => s.trim()).filter(Boolean); }
                  } else if (typeof rawOptions === 'string') {
                    optionsJson = rawOptions.split(',').map(s => s.trim()).filter(Boolean);
                  }
                }
              }

              const program = getRowVal(row, ['program', 'programname', 'namaprogram']) || selectedExam?.institutions?.name || 'CEC';
              const programName = getRowVal(row, ['class', 'classname', 'kelas', 'namakelas']) || 'Camp';
              const level = getRowVal(row, ['level', 'tingkat', 'levelnumber']) || selectedExam?.levels?.name || '3rd Step';

              parsedQuestionsState.push({
                order: isNaN(qNo) ? (i + 1) : qNo,
                questionText: String(questionText).trim(),
                correctAnswer: String(correctAnswer).trim(),
                answerType: defaultAnswerType,
                optionsJson: optionsJson,
                program, programName, subject, level, title, week, day, type
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

        // Build simple <thead> focusing only on NO, QUESTION, ANSWER
        const theadContainer = document.querySelector('#import-preview-container table thead');
        if (theadContainer) {
          theadContainer.innerHTML = `
            <tr>
              <th style="width:10%;" class="text-center">NO</th>
              <th style="width:60%;">QUESTION</th>
              <th style="width:30%;">ANSWER</th>
            </tr>
          `;
        }

        const tableElem = document.querySelector('#import-preview-container table');
        if (tableElem) {
          tableElem.style.minWidth = '500px';
          tableElem.style.width = '100%';
        }

        tbody.innerHTML = '';

        const LIMIT = 50;
        parsedQuestionsState.forEach((item, idx) => {
          if (idx < LIMIT) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td class="text-muted fw-700 text-center" style="font-size:0.8rem;">${item.order}</td>
              <td class="fw-600" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.8rem; max-width:200px;" title="${escapeHtml(item.questionText)}">${escapeHtml(item.questionText)}</td>
              <td class="text-success fw-700" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.8rem; max-width:100px;" title="${escapeHtml(item.correctAnswer)}">${escapeHtml(item.correctAnswer)}</td>
            `;
            tbody.appendChild(tr);
          } else if (idx === LIMIT) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="3" class="text-center text-muted fw-600 py-3" style="font-size: 0.85rem;">... and ${parsedQuestionsState.length - LIMIT} more rows.</td>`;
            tbody.appendChild(tr);
          }
        });

        document.getElementById('preview-count-label').textContent = `${parsedQuestionsState.length} questions siap di-import.`;
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
        const examId = document.getElementById('import-exam-select').value;
        if (!examId) { showToast('Please select a target exam before saving.', 'warning'); return; }
        if (!parsedQuestionsState.length) { showToast('No questions to save.', 'warning'); return; }

        showLoading('Menyimpan & merge questions ke database…');
        try {
          const sb = await getSupabase();
          let defaultSectionId = null;
          try {
            const { data: secs } = await sb.from('exam_sections').select('id').eq('exam_id', examId).order('section_order').limit(1);
            if (secs && secs.length > 0) defaultSectionId = secs[0].id;
          } catch (_) {}

          const existingQuestions = await adminFetchAll('questions', '*', { exam_id: examId });
          const orderMap = new Map();
          const textMap = new Map();
          existingQuestions.forEach(q => {
            if (q.question_order != null) orderMap.set(Number(q.question_order), q);
            if (q.question_text) textMap.set(q.question_text.toLowerCase().trim(), q);
          });

          let insertedCount = 0;
          let mergedCount = 0;

          // Resolve duplicate 'order' numbers within the uploaded batch (common copy-paste error)
          const batchMap = new Map();
          const batchUsedOrders = new Set();
          
          parsedQuestionsState.forEach(q => {
            let safeOrder = q.order != null ? Number(q.order) : 1;
            // If this order number is already used by another question in this upload, auto-increment it
            while (batchUsedOrders.has(safeOrder)) {
              safeOrder++;
            }
            batchUsedOrders.add(safeOrder);
            q.order = safeOrder; // Update the order to the safe, unique order
            
            // Now safely use order as the batch key without risk of overwriting
            const key = `order::${q.order}`;
            batchMap.set(key, q);
          });

          for (const q of batchMap.values()) {
            const payload = {
              exam_id: examId,
              question_order: q.order,
              question_text: q.questionText,
              correct_answer: q.correctAnswer,
              answer_type: q.answerType,
              options_json: q.optionsJson,
              metadata: { subject: q.subject, title: q.title, week: q.week, day: q.day, type: q.type },
              updated_at: new Date().toISOString()
            };
            if (defaultSectionId) payload.section_id = defaultSectionId;

            const existing = (q.order != null ? orderMap.get(Number(q.order)) : null) || textMap.get(q.questionText.toLowerCase().trim());
            if (existing) {
              await adminUpdate('questions', existing.id, payload);
              mergedCount++;
            } else {
              await adminInsert('questions', payload);
              insertedCount++;
            }
          }

          hideLoading();
          showToast(`Successfully saved ${insertedCount + mergedCount} questions (${insertedCount} new, ${mergedCount} merged/updated)!`, 'success');
          
          // Reset view but stay on the page as requested
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
      const exams = await adminFetchAll('exams', '*, institutions(name), subjects(name), levels(name)');
      area.innerHTML = `
        <div class="section-header"><div><h2 class="section-title">Export Questions (Excel)</h2></div></div>
        <div class="glass-card p-8" style="max-width:640px;">
          <p class="text-muted mb-4">Export questions from an exam into an Excel workbook formatted with standard columns:</p>
          <div class="mb-5 p-3 rounded" style="background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);font-size:0.75rem;font-family:monospace;">
            PROGRAM | CLASS | SUBJECT | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER
          </div>
          <div class="form-group"><label class="form-label">Select Exam to Export</label>
            <select class="form-control" id="export-exam-select">
              <option value="">— Select Exam —</option>
              ${[...exams].sort((a, b) => {
                const labelA = `${a.exam_type ? a.exam_type + ' - ' : ''}${a.exam_title}`;
                const labelB = `${b.exam_type ? b.exam_type + ' - ' : ''}${b.exam_title}`;
                return labelA.localeCompare(labelB);
              }).map(e => `<option value="${e.id}">${e.exam_type ? e.exam_type + ' - ' : ''}${e.exam_title}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary mt-2" id="export-questions-btn">📤 Download Excel (.xlsx)</button>
        </div>
      `;

      document.getElementById('export-questions-btn').addEventListener('click', async () => {
        const examId = document.getElementById('export-exam-select').value;
        if (!examId) { showToast('Please select an exam to export.', 'warning'); return; }

        const selectedExam = exams.find(e => e.id === examId);
        showLoading('Preparing Excel export…');

        try {
          const sb = await getSupabase();
          let questions = [];
          const [directQRes, examClasses] = await Promise.all([
            sb.from('questions').select('*').eq('exam_id', examId).is('deleted_at', null),
            sb.from('exam_programs').select('programs(name)').eq('exam_id', examId)
          ]);
          questions = directQRes?.data || [];
          if (!questions.length) {
            try {
              const { data: sections } = await sb.from('exam_sections').select('id').eq('exam_id', examId);
              const sectionIds = (sections || []).map(s => s.id);
              if (sectionIds.length > 0) {
                const { data: secQ } = await sb.from('questions').select('*').in('section_id', sectionIds).is('deleted_at', null);
                if (secQ && secQ.length > 0) questions = secQ;
              }
            } catch (_) {}
          }

          const sortedQuestions = questions.sort((a,b) => (a.question_order || 0) - (b.question_order || 0));
          const programName = examClasses?.data?.[0]?.programs?.name || 'Camp';

          const excelData = sortedQuestions.map((q, idx) => ({
            'PROGRAM': selectedExam?.institutions?.name || 'CEC',
            'CLASS': programName,
            'SUBJECT': q.metadata?.subject || selectedExam?.subjects?.name || 'Vocab',
            'LEVEL': selectedExam?.levels?.name || '3rd Step',
            'TITLE': q.metadata?.title || selectedExam?.exam_title || 'Practice 1',
            'WEEK': q.metadata?.week || '1',
            'DAY': q.metadata?.day || '1',
            'TYPE': q.metadata?.type || selectedExam?.exam_type || '1 - VERB',
            'NO': q.question_order || (idx + 1),
            'QUESTION': q.question_text || '',
            'ANSWER': q.correct_answer || ''
          }));

          if (!excelData.length) {
            hideLoading();
            showToast('No questions found for this exam.', 'warning');
            return;
          }

          const worksheet = XLSX.utils.json_to_sheet(excelData, {
            header: ['PROGRAM', 'CLASS', 'SUBJECT', 'LEVEL', 'TITLE', 'WEEK', 'DAY', 'TYPE', 'NO', 'QUESTION', 'ANSWER']
          });

          // Set column widths
          worksheet['!cols'] = [
            { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 6 }, { wch: 35 }, { wch: 25 }
          ];

          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

          const fileName = `${(selectedExam?.exam_title || 'Exam').replace(/\s+/g, '_')}_Questions.xlsx`;
          XLSX.writeFile(workbook, fileName);

          hideLoading();
          showToast(`Exported ${excelData.length} questions to ${fileName}`, 'success');
        } catch(err) {
          hideLoading();
          showToast(`Export error: ${err.message}`, 'error');
        }
      });
    }

    // ── CRUD Modal ──
    const crudModal = document.getElementById('crud-modal');
    const crudForm  = document.getElementById('crud-form');
    let _editId = null;

    const formFields = {
      institutions: [
        { id: 'name', label: 'Institution Name', type: 'text', required: true },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      subjects: [
        { id: 'name', label: 'Subject Name', type: 'text', required: true },
        { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      levels: [
        { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true, uiOnly: true },
        { id: 'program_id', label: 'Class', type: 'select', source: 'programs', required: false, dependsOn: 'institution_id' },
        { id: 'subject_id', label: 'Subject', type: 'select', source: 'subjects', required: true, dependsOn: 'institution_id' },
        { id: 'level_number', label: 'Level Number', type: 'number', required: true, placeholder: 'e.g. 1' },
        { id: 'name', label: 'Level Name', type: 'text', required: true, placeholder: 'e.g. Level 1 - Beginner' },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      programs: [
        { id: 'name', label: 'Program Name', type: 'text', required: true },
        { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      batches: [
        { id: 'institution_id', label: 'Program (filter only)', type: 'select', source: 'institutions', required: false, uiOnly: true },
        { id: 'program_id', label: 'Class', type: 'select', source: 'programs', required: true, dependsOn: 'institution_id' },
        { id: 'name', label: 'Batch Name', type: 'text', required: true, placeholder: 'e.g. Batch 2026-A' },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      students: [
        { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true },
        { id: 'program_id', label: 'Class', type: 'select', source: 'programs', required: true, dependsOn: 'institution_id' },
        { id: 'batch_id', label: 'Batch', type: 'select', source: 'batches', required: false, dependsOn: 'program_id' },
        
        { id: 'name', label: 'Full Name', type: 'text', required: true },
        { id: 'gender', label: 'Gender', type: 'select', options: [
          { value: '', label: '— Unassigned (Student will choose) —' },
          { value: 'male', label: 'Male (Mr.)' },
          { value: 'female', label: 'Female (Miss)' }
        ]},
        { id: 'birth_date', label: 'Birth Date', type: 'date' },
        { id: 'pin_hash', label: 'PIN (4 digits)', type: 'password', placeholder: '****' },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      exams: [
        { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true },
        { id: 'program_id', label: 'Class (Optional / Assigned)', type: 'select', source: 'programs', required: false, dependsOn: 'institution_id' },
        { id: 'subject_id', label: 'Subject', type: 'select', source: 'subjects', required: false, dependsOn: 'institution_id' },
        { id: 'exam_type', label: 'Exam Type', type: 'select', options: ['Daily', 'Weekly', 'Monthly', 'Final'], required: true, defaultValue: 'Daily' },
        
        { id: 'exam_order', label: 'Order (1, 2, 3...)', type: 'select', options: ['1','2','3','4','5','6','7','8','9','10'], required: true, defaultValue: '1' },
        { id: 'exam_title', label: 'Exam Title (Auto-Generated)', type: 'text', required: true, placeholder: 'Auto-generated as: [Program] [Class] [Subject] [Type] [Level] [Order]' },
        { id: 'prerequisite_exam_id', label: 'Prerequisite Exam (Optional)', type: 'select', source: 'exams', required: false },
        { id: 'minimum_required_score', label: 'Passing Score % (Default: 60%)', type: 'number', required: true, defaultValue: 60 },
        { id: 'prerequisite_min_score', label: 'Prerequisite Min % (Default: 60%)', type: 'number', required: false, defaultValue: 60 },
        { id: 'time_limit_minutes', label: 'Global Time Limit (minutes)', type: 'number', required: true, defaultValue: 60 },
        { id: 'exam_status', label: 'Exam Status', type: 'select', options: ['published','draft','unpublished','archived'], required: true },
        { id: 'question_order', label: 'Question Order', type: 'select', options: [{ value: 'sequential', label: 'Sequential' }, { value: 'random', label: 'Random' }], required: true },
        { id: 'retake_allowed', label: 'Retake Allowed', type: 'checkbox' },
        { id: 'max_attempts', label: 'Max Attempts (blank = unlimited)', type: 'number' },
      ],
      questions: [
        { id: 'question_text', label: 'Question Text', type: 'textarea', required: true },
        { id: 'question_order', label: 'Order', type: 'number', required: true },
        { id: 'exam_id', label: 'Examination', type: 'select', source: 'exams', required: true },
        { id: 'answer_type', label: 'Answer Type', type: 'select', options: [
          {value:'multiple_choice',label:'Multiple Choice'},
          {value:'dropdown',label:'Dropdown'},
          {value:'speech_to_text',label:'Speaking Test'},
          {value:'written',label:'Written Test'}
        ], required: true },
        { id: 'correct_answer', label: 'Correct Answer', type: 'text', required: true, placeholder: 'e.g. run / jog / sprint  (use / ; or | to separate multiple accepted answers)' },
        { id: 'options_json', label: 'Options (separated by / ; or JSON array)', type: 'textarea', placeholder: 'e.g. Option A / Option B / Option C  (use / or ; to separate choices)' },
        { id: 'metadata', label: 'Metadata / Word Type', type: 'text', placeholder: 'e.g. 1 - VERB' },
      ],
    };


export { renderImportStudents, renderImportQuestions, renderExportQuestions };
