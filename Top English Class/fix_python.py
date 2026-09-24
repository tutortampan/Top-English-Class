import os
import re

# 1. crud-modals.js
f = r'js\admin\crud-modals.js'
with open(f, 'r', encoding='utf-8') as file:
    content = file.read()

# Replace the module level DOM refs block
old_dom_refs = """// -- Module-level state & DOM references (assigned lazily on first use) --
let crudModal   = null;
let crudForm    = null;
let _currentSection = null;
let _editId     = null;
let openDuplicateStudentsModal = null;
let openDuplicateQuestionsModal = null;"""

new_dom_refs = """// -- Module-level state & DOM references --
let crudModal = null;
let crudForm = null;
let crudModalTitle = null;
let crudSaveBtn = null;
let _currentSection = null;
let _editId = null;
let openDuplicateStudentsModal = null;
let openDuplicateQuestionsModal = null;"""
content = content.replace(old_dom_refs, new_dom_refs)

# Replace _ensureDomRefs function
old_ensure = """function _ensureDomRefs() {
  if (!crudModal) crudModal = document.getElementById('crud-modal');
  if (!crudForm)  crudForm  = document.getElementById('crud-form');
}"""
new_ensure = """export function _ensureDomRefs() {
  if (!crudModal) crudModal = document.getElementById('crud-modal');
  if (!crudForm) crudForm = document.getElementById('crud-form');
  if (!crudModalTitle) crudModalTitle = document.getElementById('crud-modal-title');
  if (!crudSaveBtn) crudSaveBtn = document.getElementById('crud-save-btn');
}"""
content = content.replace(old_ensure, new_ensure)

# Remove the import sectionTitles if present
content = re.sub(r"import\s*\{\s*sectionTitles\s*\}\s*from\s*'\./app\.js(\?v=[\d.]+)?';\s*", "", content)

# Inject SECTION_TITLES fallback
section_fallback = """const SECTION_TITLES = typeof sectionTitles !== 'undefined' ? sectionTitles : {
  institutions: 'Institution', programs: 'Program', batches: 'Batch',
  students: 'Student', classes: 'Class Blueprint', class_instances: 'Class Instance',
  topics: 'Topic', questions: 'Question', exams: 'Challenge',
  results: 'Result', profile: 'Profile'
};
"""
content = section_fallback + content
content = content.replace("sectionTitles[section]", "SECTION_TITLES[section]")

with open(f, 'w', encoding='utf-8') as file:
    file.write(content)

# 2. api.js
f2 = r'js\api.js'
with open(f2, 'r', encoding='utf-8') as file:
    content2 = file.read()

# Replace complex joins with flat select('*')
content2 = content2.replace(".select('*, programs(name, institution_id, institutions(name))')", ".select('*')")
content2 = content2.replace(".select('*, classes(name)')", ".select('*')")
content2 = content2.replace(".select('*, classes(name), levels(name, level_number), institutions(name)')", ".select('*')")
content2 = content2.replace(".select('*, students(name, gender, batch_id, batches(name), program_id, programs(name, institution_id, institutions(name))), challenge_instances(challenge_definitions(title, challenge_type)), challenge_attempt_answers(id, evaluation_result, score)')", ".select('*')")
content2 = content2.replace(".select('*, class_instances(classes(name))')", ".select('*')")

# Add try/catch for 404 fallbacks
content2 = re.sub(r"(if\s*\(\s*table\s*===\s*'user_professionals'\s*\)\s*\{)(.*?)(const\s*\{\s*data\s*,\s*error\s*\})", r"\1 try { \2 \3", content2, flags=re.DOTALL)
content2 = re.sub(r"(if\s*\(\s*table\s*===\s*'topics'\s*\)\s*\{)(.*?)(const\s*\{\s*data\s*,\s*error\s*\})", r"\1 try { \2 \3", content2, flags=re.DOTALL)
content2 = re.sub(r"(if\s*\(\s*table\s*===\s*'question_types'\s*\)\s*\{)(.*?)(const\s*\{\s*data\s*,\s*error\s*\})", r"\1 try { \2 \3", content2, flags=re.DOTALL)

with open(f2, 'w', encoding='utf-8') as file:
    file.write(content2)

print("Done")
