# SYSTEM RESCUE & WORKSPACE REFACTOR TASK LIST

## Phase 1: Database Audit & Historical Data Restoration
- [x] 1.1: Run Supabase diagnostic query to find orphaned `students`, `batches`, `attempts`, and `assessments` (focus on August / Kelompok Camp 131).
- [x] 1.2: Re-link orphaned batches to correct `program_id` and `current_level_id`.
- [x] 1.3: Re-parent orphaned historical assessments to correct `class_id` and `level_id`.

## Phase 2: Schema Hygiene & Decommissioning
- [x] 2.1: Edit `js/admin/crud-modals.js`: Remove `class_id` from `levels` fields.
- [x] 2.2: Edit `js/admin/crud-modals.js`: Remove duplicate/typo `Classes` array.
- [x] 2.3: Edit `admin.html`: Remove `data-sub="assessments"` and `data-sub="levels"` nav items.
- [x] 2.4: Edit `js/admin/app.js`: Reroute `#assessments` and `#levels` to `#classes`.
- [x] 2.5: Edit `js/admin/app.js`: Remove loading of legacy `assessment-builder.js` and `panel-c-builder.js`.

## Phase 3: Student Pipeline Security & API Hardening
- [x] 3.1: Edit `js/api.js`: Update `fetchStudentLevel` to use dual-check logic (students.level_id OR batches.current_level_id).
- [x] 3.2: Edit `js/api.js`: Remove `.eq('class_id', classId)` from `fetchLevels`.
- [x] 3.3: Edit `js/api.js`: Update `fetchAssessmentsForStudentClass` to query strictly by `class_id` and `status = 'PUBLISHED'`.
- [x] 3.4: Edit `js/api.js`: Update `checkAndTriggerLevelUp` to support `VOCAB_EXAM` alongside `EXAM`.
- [x] 3.5: Edit `dashboard.html`: Update `renderClasses` logic to use `cLvlNum === 0 || isCurrentLevel`.

## Phase 4: Dual-Axis Workspace & Assessment Builders
- [x] 4.1: Edit `js/admin/classes-management.js`: Rewrite init logic to use independent `Promise.all` queries (`classesData`, `levelsData`, `vaultStats`, `assessmentsData`).
- [x] 4.2: Edit `js/admin/classes-management.js`: Construct Y-Axis (Left Rail: Classes), X-Axis (Top Tabs: Levels), and Canvas Body. Remove inline styles.
- [x] 4.3: Edit `js/admin/classes-management.js`: Build `[ ✍️🎙️ + Vocab Test ]` modal logic anchored to active Class/Level (Topic selector fetching target_level and level 0).
- [x] 4.4: Edit `js/admin/classes-management.js`: Build `[ 🔽 + Idiom & Proverb Test ]` modal logic with automated 10-option distractor sampler storing into `options_snapshot`.
