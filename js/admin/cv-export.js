/**
 * cv-export.js
 * 
 * Generates a 1-page A4 Executive CV and triggers the browser print dialog.
 */

export function triggerCVExport(student) {
  let container = document.getElementById("cv-print-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "cv-print-container";
    document.body.appendChild(container);
  }

  // Reverse chronological sort mock for demo
  const eduHistory = (student.education || []).sort((a, b) => b.year - a.year);
  
  const honorific = student.gender === "male" ? "Mr. " : student.gender === "female" ? "Miss " : "";
  const fullName = honorific + (student.name || "Unknown");
  const avatarUrl = student.photo_url ? student.photo_url + "?t=" + Date.now() : "assets/placeholder-3x4.svg";

  container.innerHTML = `
    <div style="display: flex; gap: 1rem; border-bottom: 2px solid #0f172a; padding-bottom: 0.5rem; margin-bottom: 1rem;">
      <div style="flex: 1;">
        <h1 style="font-size: 1.5rem; margin: 0; color: #0f172a;">${fullName}</h1>
        <p style="margin: 0.25rem 0 0 0;"><strong>DOB:</strong> ${student.birth_date || "N/A"}</p>
        <p style="margin: 0;"><strong>Status:</strong> ${student.is_active ? "Active" : "Inactive"}</p>
      </div>
      <div>
        <img src="${avatarUrl}" class="cv-photo-print" alt="Profile" />
      </div>
    </div>
    
    <div class="cv-section">
      <h3 style="font-size: 1.1rem; border-bottom: 1px solid #ccc; margin-bottom: 0.5rem;">Education Background</h3>
      ${eduHistory.length > 0 ? eduHistory.map(e => `
        <div class="cv-item">
          <strong>${e.year}</strong> - ${e.institution}
        </div>
      `).join("") : "<p>No education history provided.</p>"}
    </div>

    <div class="cv-section" style="margin-top: 1rem;">
      <h3 style="font-size: 1.1rem; border-bottom: 1px solid #ccc; margin-bottom: 0.5rem;">Skills & Competencies</h3>
      <p>${(student.skills || []).join(", ") || "No skills listed."}</p>
    </div>

    <div style="position: absolute; bottom: 0; left: 0; width: 100%; text-align: center; font-size: 7pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 0.25rem;">
      Powered by TopsCore &middot; 2026
    </div>
  `;

  // Trigger print
  window.print();
  
  // Clean up
  setTimeout(() => {
    container.innerHTML = "";
  }, 1000);
}

