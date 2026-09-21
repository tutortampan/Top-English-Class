// js/admin/dossier_export.js

export function exportStudentDossier(studentData, educationList, skillsList, assessmentList) {
  const printWindow = window.open('', '_blank');
  
  const eduHtml = educationList.map(e => \`• [\${e.period}] \${e.institution} — \${e.details}\`).join('<br>');
  const skillHtml = skillsList.map(s => \`• \${s}\`).join('<br>');
  const assessmentHtml = assessmentList.map(a => \`• [\${a.date}] \${a.title} — Score: \${a.score}% (Grade: \${a.grade}) [\${a.status}]\`).join('<br>');

  const htmlContent = \`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Student Dossier - \${studentData.name}</title>
      <style>
        body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.5; color: #000; padding: 20px; max-width: 800px; margin: auto; }
        h1, h2, h3, h4 { color: #000; margin-bottom: 0.5rem; }
        h1 { font-size: 1.5rem; text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header p { margin: 2px 0; font-size: 0.9rem; }
        .section { margin-top: 20px; }
        .section-title { font-size: 1.1rem; font-weight: bold; background: #eee; padding: 5px; border-left: 4px solid #000; }
        .grid { display: grid; grid-template-columns: 1fr 150px; gap: 20px; }
        .info-label { font-weight: bold; width: 150px; display: inline-block; }
        .photo-box { width: 120px; height: 160px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; background: #f9f9f9; color: #999; text-align: center; }
        .photo-box img { width: 100%; height: 100%; object-fit: cover; }
        hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
        .footer { text-align: center; font-size: 0.8rem; color: #666; margin-top: 40px; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body onload="window.print()">
      <div class="header">
        <h2>TOPS CORE</h2>
        <h4>ACADEMIC ADMINISTRATION BOARD</h4>
        <p>Jl. Pendidikan Akademik No. 45, Mataram | Email: support@topscore.edu</p>
        <hr>
        <p style="font-weight:bold;">DOCUMENT Class: INDIVIDUAL STUDENT DOSSIER PROFILE &nbsp;|&nbsp; STATUS: OFFICIAL & VERIFIED</p>
      </div>

      <div class="grid">
        <div>
          <div class="section">
            <div class="section-title">I. Main Identity</div>
            <p><span class="info-label">Full Name:</span> \${studentData.name}</p>
            <p><span class="info-label">Date of Birth:</span> \${studentData.birth_date || '—'}</p>
            <p><span class="info-label">Gender:</span> \${studentData.gender || '—'}</p>
          </div>
          <div class="section">
            <div class="section-title">II. Academic & Class Information</div>
            <p><span class="info-label">Institution:</span> \${studentData.institution_name || '—'}</p>
            <p><span class="info-label">Program:</span> \${studentData.program_name || '—'}</p>
            <p><span class="info-label">Batch:</span> \${studentData.batch_name || '—'}</p>
            <p><span class="info-label">Status:</span> \${studentData.is_active ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
        <div>
          <div class="photo-box">
            \${studentData.photo_url ? \`<img src="\${studentData.photo_url}" alt="Student Photo">\` : '3:4 Photo'}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">III. Education Background (Reverse Chronological)</div>
        <p>\${eduHtml || 'No education records found.'}</p>
      </div>

      <div class="section">
        <div class="section-title">IV. Skills & Competencies</div>
        <p>\${skillHtml || 'No skills recorded.'}</p>
      </div>

      <div class="section">
        <div class="section-title">V. Assessment History (Reverse Chronological)</div>
        <p>\${assessmentHtml || 'No assessment history found.'}</p>
      </div>

      <div class="footer">
        Powered by TopsCore · 2026
      </div>
    </body>
    </html>
  \`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
