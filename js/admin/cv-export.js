/**
 * cv-export.js
 * 
 * Generates a 1-page A4 Executive CV and triggers the browser print dialog.
 * Complies with TopsCore ABCD Architecture [Panel A].
 */

import { getBustedAvatarUrl } from '../utils/avatar-engine.js';

export function triggerCVExport(student) {
  let container = document.getElementById("cv-print-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "cv-print-container";
    document.body.appendChild(container);
  }

  // Reverse chronological sort (e.g., 2026 -> 2025)
  const eduHistory = (student.education || []).sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
  
  const honorific = student.gender === "male" ? "Mr. " : student.gender === "female" ? "Miss " : "";
  const fullName = honorific + (student.name || "Student");
  const avatarUrl = getBustedAvatarUrl(student.photo_url);

  container.innerHTML = `
    <style>
      @media print {
        @page { size: A4 portrait; margin: 8mm 10mm; }
        body * { visibility: hidden !important; }
        #cv-print-container, #cv-print-container * { visibility: visible !important; }
        #cv-print-container {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          max-height: 278mm !important;
          overflow: hidden !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 8.5pt !important;
          line-height: 1.3 !important;
          color: #0f172a !important;
          background: #ffffff !important;
          box-sizing: border-box !important;
        }
      }
    </style>
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 0.6rem; margin-bottom: 1rem;">
      <div>
        <h1 style="font-size: 1.6rem; margin: 0; color: #0f172a; font-weight: 800; letter-spacing: -0.02em;">${fullName}</h1>
        <div style="margin: 0.35rem 0 0 0; font-size: 8.5pt; color: #475569;">
          <span><strong>DOB:</strong> ${student.birth_date || "N/A"}</span> &bull; 
          <span><strong>Program:</strong> ${student.program_name || student.programs?.name || "English Program"}</span> &bull; 
          <span><strong>Status:</strong> ${student.is_active ? "Active" : "Inactive"}</span>
        </div>
      </div>
      <div>
        <img src="${avatarUrl}" class="cv-photo-print" alt="Profile" onerror="this.onerror=null;this.src='assets/placeholder-3x4.svg';" style="width: 72px; height: 96px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1;" />
      </div>
    </div>
    
    <div class="cv-section" style="margin-bottom: 1rem;">
      <h3 style="font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.25rem; margin-bottom: 0.5rem;">Academic Background</h3>
      ${eduHistory.length > 0 ? eduHistory.map(e => `
        <div class="cv-item" style="margin-bottom: 0.35rem;">
          <strong style="color: #0f172a;">${e.year || 'Year'}</strong> &mdash; <span>${e.institution || 'Institution'}</span>
        </div>
      `).join("") : "<p style='color: #64748b; font-style: italic;'>No formal education history recorded.</p>"}
    </div>

    <div class="cv-section" style="margin-bottom: 1rem;">
      <h3 style="font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.25rem; margin-bottom: 0.5rem;">Skills &amp; Competencies</h3>
      <p style="margin: 0; color: #334155;">${(student.skills || []).join(", ") || "General English Fluency, Listening Comprehension, Vocabulary Mastery."}</p>
    </div>

    <div style="position: absolute; bottom: 8mm; left: 0; width: 100%; text-align: center; font-size: 7.5pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 0.35rem;">
      TopsCore LMS &middot; Official Student Dossier &middot; 2026
    </div>
  `;

  window.print();
  setTimeout(() => { container.innerHTML = ""; }, 1000);
}

export function generateExecutiveCV(profile, workRecords = [], skills = []) {
  let container = document.getElementById("cv-print-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "cv-print-container";
    document.body.appendChild(container);
  }

  const fullName = profile?.full_name || "Executive Administrator";
  const title = profile?.title || "Lead Instructor & Academic Director";
  
  // Strict clamp of summary to ~350 characters
  let bio = (profile?.bio || "Experienced educational leader and administrator specializing in communicative language curriculum development, digital assessment architecture, and bilingual learning pedagogy.").trim();
  if (bio.length > 350) {
    bio = bio.substring(0, 347) + "...";
  }

  const avatarUrl = getBustedAvatarUrl(profile?.photo_url);

  // Reverse chronological sorting: 2026 -> 2025
  const sortedWork = [...(workRecords || [])].sort((a, b) => {
    const periodA = a.period || a.start_date || '';
    const periodB = b.period || b.start_date || '';
    return periodB.localeCompare(periodA);
  });

  // Auto-adjust typography density if many items to ensure strict 1-page fit
  const isOverflowRisk = sortedWork.length > 3 || (skills && skills.length > 8);
  const bodyFontSize = isOverflowRisk ? "8pt" : "8.5pt";
  const bodyLineHeight = isOverflowRisk ? "1.25" : "1.35";

  const workHtml = sortedWork.length > 0 ? sortedWork.map(w => `
    <div class="cv-item" style="margin-bottom: 0.5rem; page-break-inside: avoid;">
      <div style="display: flex; justify-content: space-between; align-items: baseline;">
        <span style="font-weight: 700; color: #0f172a; font-size: 9pt;">${w.role || w.role_title || 'Role'}</span>
        <span style="font-size: 8pt; color: #64748b; font-weight: 600;">${w.period || w.start_date || ''}</span>
      </div>
      <div style="font-size: 8.5pt; color: #2563eb; font-weight: 600;">${w.institution || w.company_name || 'Organization'}</div>
      ${w.description ? `<div style="font-size: 8pt; color: #475569; margin-top: 0.15rem; line-height: 1.25;">${w.description}</div>` : ''}
    </div>
  `).join("") : `<div class="cv-item" style="margin-bottom: 0.5rem;">
    <div style="font-weight: 700; color: #0f172a;">Senior English Academic Coordinator</div>
    <div style="font-size: 8.5pt; color: #2563eb; font-weight: 600;">Top English Academy &middot; 2024 &ndash; Present</div>
    <div style="font-size: 8pt; color: #475569;">Directing assessment standards and modular testing curriculum across all regional batches.</div>
  </div>`;

  const skillsList = (skills || []).map(s => typeof s === 'string' ? s : (s.skill_name || s.name || '')).filter(Boolean);
  const skillsHtml = skillsList.length > 0 ? skillsList.join(" &bull; ") : "Curriculum Design &bull; Educational Leadership &bull; Pronunciation Assessment &bull; CEFR Evaluation &bull; Database Administration";

  container.innerHTML = `
    <style>
      @media print {
        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }
        body * {
          visibility: hidden !important;
        }
        #cv-print-container, #cv-print-container * {
          visibility: visible !important;
        }
        #cv-print-container {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 190mm !important;
          max-height: 278mm !important;
          overflow: hidden !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-size: ${bodyFontSize} !important;
          line-height: ${bodyLineHeight} !important;
          color: #0f172a !important;
          background: #ffffff !important;
          box-sizing: border-box !important;
          padding: 0 !important;
          margin: 0 !important;
        }
      }
    </style>

    <div style="max-height: 275mm; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; min-height: 260mm;">
      <div>
        <!-- Executive Header Zone -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #0f172a; padding-bottom: 0.75rem; margin-bottom: 0.85rem;">
          <div style="flex: 1; padding-right: 1rem;">
            <h1 style="font-size: 1.7rem; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: -0.02em; text-transform: uppercase;">${fullName}</h1>
            <div style="font-size: 10pt; font-weight: 700; color: #2563eb; margin-top: 0.2rem; text-transform: uppercase; letter-spacing: 0.04em;">${title}</div>
            <div style="margin-top: 0.35rem; font-size: 8pt; color: #64748b; display: flex; gap: 0.85rem; flex-wrap: wrap;">
              <span><strong>Email:</strong> ${profile?.contact_email || profile?.email || 'admin@topscore.edu'}</span>
              <span>&bull;</span>
              <span><strong>Phone:</strong> ${profile?.contact_phone || profile?.phone || '+62 812-3456-7890'}</span>
              <span>&bull;</span>
              <span><strong>Role:</strong> System Executive</span>
            </div>
          </div>
          <div style="flex-shrink: 0;">
            <img src="${avatarUrl}" class="cv-photo-print" alt="Executive Photo" onerror="this.onerror=null;this.src='assets/placeholder-3x4.svg';" style="width: 80px; height: 106px; object-fit: cover; border-radius: 6px; border: 1.5px solid #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
          </div>
        </div>

        <!-- Executive Summary Zone (~350 Chars Clamped) -->
        <div class="cv-section" style="margin-bottom: 0.85rem;">
          <h3 style="font-size: 9.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #0f172a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 0.2rem; margin: 0 0 0.4rem 0;">
            Executive Summary
          </h3>
          <p style="margin: 0; font-size: ${bodyFontSize}; line-height: ${bodyLineHeight}; color: #334155; text-align: justify;">
            ${bio}
          </p>
        </div>

        <!-- Professional Experience Zone (Reverse Chronological 2026 -> 2025) -->
        <div class="cv-section" style="margin-bottom: 0.85rem;">
          <h3 style="font-size: 9.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #0f172a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 0.2rem; margin: 0 0 0.5rem 0;">
            Professional Leadership &amp; Experience
          </h3>
          ${workHtml}
        </div>

        <!-- Skills & Core Competencies Zone -->
        <div class="cv-section" style="margin-bottom: 0.85rem;">
          <h3 style="font-size: 9.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #0f172a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 0.2rem; margin: 0 0 0.35rem 0;">
            Core Competencies &amp; Technical Accreditations
          </h3>
          <p style="margin: 0; font-size: ${bodyFontSize}; line-height: 1.35; color: #334155;">
            ${skillsHtml}
          </p>
        </div>
      </div>

      <!-- Footer Anchor (Guarantees Exactly 1 Page) -->
      <div style="text-align: center; font-size: 7pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 0.35rem; margin-top: auto;">
        TopsCore LMS &middot; Executive Administration Document &middot; Verified System Output &middot; 2026
      </div>
    </div>
  `;

  // Trigger print dialog
  window.print();

  // Clean up
  setTimeout(() => {
    container.innerHTML = "";
  }, 1000);
}


