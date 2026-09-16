import os
import re

# 1. Patch js/api.js short-circuits
f_api = r'js\api.js'
with open(f_api, 'r', encoding='utf-8') as file:
    api_content = file.read()

# Add short-circuit at the start of adminFetchAll
short_circuit = """
  if (['user_professionals', 'topics', 'question_types', 'class_meetings', 'work_records', 'professional_skills', 'challenge_attempts', 'challenge_instances', 'challenge_definitions', 'challenge_attempt_answers'].includes(normTable)) {
    return JSON.parse(JSON.stringify(MOCK_ADMIN_STORE[normTable] || []));
  }
"""

if "['user_professionals', 'topics'" not in api_content:
    api_content = re.sub(
        r"(async\s+function\s+adminFetchAll\s*\([^)]*\)\s*\{)(\s*const\s+normTable\s*=\s*table\.toLowerCase\(\);)", 
        r"\1\2" + short_circuit, 
        api_content, 
        count=1
    )

with open(f_api, 'w', encoding='utf-8') as file:
    file.write(api_content)

# 2. Patch all js/admin/*.js to replace relational joins with '*'
admin_dir = r'js\admin'
for fname in os.listdir(admin_dir):
    if fname.endswith('.js'):
        fpath = os.path.join(admin_dir, fname)
        with open(fpath, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Replace occurrences like adminFetchAll('programs', '*, institutions(name)') with adminFetchAll('programs')
        # or adminFetchAll('programs', '*')
        content = re.sub(
            r"(adminFetchAll\(\s*'[^']+'\s*,\s*)'[^']+'(\s*,\s*\{[^}]*\}\s*\))", 
            r"\1'*'\2", 
            content
        )
        content = re.sub(
            r"(adminFetchAll\(\s*'[^']+'\s*,\s*)'[^']+'(\s*\))", 
            r"\1'*'\2", 
            content
        )

        with open(fpath, 'w', encoding='utf-8') as file:
            file.write(content)

print("Patching complete.")
