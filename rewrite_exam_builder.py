import re
import sys

try:
    with open('js/admin/exam-builder.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Imports
    content = re.sub(
        r"import \{[\s\S]*?\} from '\.\./api\.js';",
        "import {\n  fetchClasses,\n  fetchTopics,\n  fetchCentralQuestions,\n  fetchChallengeDefinitions,\n  createChallengeDefinition,\n  updateChallengeDefinition,\n  publishChallengeDefinition,\n  createChallengeInstance,\n  fetchBatches,\n  fetchClassInstances,\n  createTopic,\n  adminFetchAll,\n  clearAdminCache\n} from '../api.js';",
        content
    )

    # 2. Tab 1 UI
    content = content.replace('id="wiz-subject"', 'id="wiz-class"')
    content = content.replace(
        '                <div class="form-group mb-3">\n'
        '                  <label class="form-label">Prerequisite Assessment (Optional)</label>\n'
        '                  <select class="form-control" id="wiz-prereq">\n'
        '                    <option value="">None (Available immediately)</option>\n'
        '                  </select>\n'
        '                </div>', '')
    content = content.replace(
        '                <div class="form-group mb-3">\n'
        '                  <label class="form-label">Availability Start (Optional)</label>\n'
        '                  <input type="datetime-local" class="form-control" id="wiz-start" />\n'
        '                </div>\n\n'
        '                <div class="form-group mb-3">\n'
        '                  <label class="form-label">Availability End (Optional)</label>\n'
        '                  <input type="datetime-local" class="form-control" id="wiz-end" />\n'
        '                </div>', '')

    # 3. Tab 3 UI
    content = content.replace(
        '              <div class="form-group mb-3">\n'
        '                <label class="form-label">Assignment Strategy</label>\n'
        '                <select class="form-control" id="wiz-assign-strategy" style="max-width:360px;">\n'
        '                  <option value="NONE">Assign Later (Draft or Open to Subject)</option>\n'
        '                  <option value="BATCH" selected>Assign to Specific Batch</option>\n'
        '                  <option value="STUDENT">Assign to Individual Student</option>\n'
        '                </select>\n'
        '              </div>',
        '              <div class="form-group mb-3">\n'
        '                <label class="form-label">Assignment Strategy</label>\n'
        '                <select class="form-control" id="wiz-assign-strategy" style="max-width:360px;">\n'
        '                  <option value="NONE">Assign Later (Draft or Open to Class)</option>\n'
        '                  <option value="BATCH" selected>Assign to Specific Batch (Class Instance)</option>\n'
        '                </select>\n'
        '              </div>\n'
        '              <div class="form-group mb-3">\n'
        '                  <label class="form-label">Availability Start (Optional)</label>\n'
        '                  <input type="datetime-local" class="form-control" id="wiz-start" style="max-width:360px;" />\n'
        '              </div>\n'
        '              <div class="form-group mb-3">\n'
        '                  <label class="form-label">Availability End (Optional)</label>\n'
        '                  <input type="datetime-local" class="form-control" id="wiz-end" style="max-width:360px;" />\n'
        '              </div>'
    )
    content = content.replace(
        '              <div class="form-group mb-3 hidden" id="wiz-assign-student-group">\n'
        '                <label class="form-label">Target Student *</label>\n'
        '                <select class="form-control" id="wiz-assign-student-select" style="max-width:360px;">\n'
        '                  <!-- Students populated here -->\n'
        '                </select>\n'
        '              </div>', '')

    # 4. Data loading
    content = content.replace('fetchGlobalSubjects()', 'fetchClasses()')
    content = content.replace('fetchAssessments()', 'fetchChallengeDefinitions()')
    content = content.replace(
        '      fetchBatches(),\n'
        "      adminFetchAll('students')\n"
        '    ]);',
        '      fetchBatches(),\n'
        "      adminFetchAll('students'),\n"
        '      fetchClassInstances()\n'
        '    ]);'
    )
    content = content.replace('let allStudents = [];', 'let allStudents = [];\n  let allClassInstances = [];')
    content = content.replace('allStudents = stds.filter(s => !s.deleted_at);', 'allStudents = stds.filter(s => !s.deleted_at);\n    allClassInstances = arguments[0][6];')

    # 5. Fix UI mapping
    content = content.replace("const subSel = document.getElementById('wiz-subject');", "const subSel = document.getElementById('wiz-class');")
    content = content.replace('a.subject_id === currentSubjectId', 'a.class_id === currentSubjectId')
    content = content.replace('a.subject_id === currentClassId', 'a.class_id === currentClassId')
    content = content.replace('assessment_topics', 'challenge_definition_topics')
    content = content.replace('assessment_id', 'challenge_definition_id')
    content = content.replace('assessment_type', 'challenge_type')

    # 6. Persistence
    persistence_logic = '''      const title = document.getElementById('wiz-title').value.trim();
      const typeVal = builderDiv.querySelector('input[name="wiz-type"]:checked').value;
      const classId = subSel.value;
      const duration = Number(document.getElementById('wiz-duration').value) || 60;
      const order = document.getElementById('wiz-order').value;
      const startVal = document.getElementById('wiz-start').value;
      const endVal = document.getElementById('wiz-end').value;
      const strategy = assignStrategySel.value;
      const batchId = batchSel.value;

      showLoading(targetStatus === 'PUBLISHED' ? 'Publishing & Freezing Snapshot...' : 'Saving Assessment Draft...');
      try {
        let asmId = createdAssessmentId;
        if (!asmId) {
          const newAsm = await createChallengeDefinition({
            class_id: classId,
            challenge_type: typeVal,
            title,
            working_duration_minutes: duration,
            question_order: order
          }, Array.from(selectedTopicIds));
          asmId = newAsm.id;
          createdAssessmentId = asmId;
        } else {
          await updateChallengeDefinition(asmId, {
            title,
            challenge_type: typeVal,
            working_duration_minutes: duration,
            question_order: order,
            status: targetStatus === 'PUBLISHED' ? 'DRAFT' : targetStatus // Will be set to READY on publish
          }, Array.from(selectedTopicIds));
        }

        // Inline Assignment if selected
        if (strategy === 'BATCH' && batchId) {
          // Find class instance
          const ci = allClassInstances.find(c => c.batch_id === batchId && c.class_id === classId);
          if (ci) {
            await createChallengeInstance({
              class_instance_id: ci.id,
              challenge_definition_id: asmId,
              title_override: title,
              availability_start: startVal ? new Date(startVal).toISOString() : null,
              availability_end: endVal ? new Date(endVal).toISOString() : null,
              working_duration_minutes: duration
            });
          } else {
            console.warn('Could not find Class Instance for batch_id ' + batchId + ' and class_id ' + classId);
          }
        }

        if (targetStatus === 'PUBLISHED') {
          const res = await publishChallengeDefinition(asmId);
          showToast(`Assessment published with ${res._frozenCount || 0} frozen questions!`, 'success');
        } else {
          showToast(isEdit ? 'Assessment updated successfully.' : 'Assessment saved as draft.', 'success');
        }'''

    content = re.sub(
        r"const title = document\.getElementById\('wiz-title'\)\.value\.trim\(\);[\s\S]*?showToast\(isEdit \? 'Assessment updated successfully\.' : 'Assessment saved as draft\.', 'success'\);\n\s*\}",
        persistence_logic,
        content
    )

    # 7. Additional tweaks
    content = content.replace('editAssessment.subject_id', 'editAssessment.class_id')
    content = content.replace('editAssessment.assessment_type', 'editAssessment.challenge_type')
    content = content.replace('editAssessment.prerequisite_assessment_id', 'editAssessment.dummy_prereq')
    content = content.replace('editAssessment.prerequisite_exam_id', 'editAssessment.dummy_prereq2')
    content = content.replace('assessment_questions', 'challenge_definition_questions')

    # Replace classId logic around lines 192 (document.getElementById('rev-subject').textContent = subSel.options[subSel.selectedIndex]?.text || '';)
    content = content.replace("document.getElementById('rev-subject').textContent", "document.getElementById('rev-class').textContent")
    content = content.replace('<span id="rev-subject"', '<span id="rev-class"')

    with open('js/admin/exam-builder-fixed.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
