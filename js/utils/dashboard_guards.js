/**
 * dashboard_guards.js
 * 
 * Implements Hard Gate Onboarding and Interactive Unsaved Changes Guard.
 */

export function setupUnsavedChangesGuard(saveCallback, discardCallback) {
  let isDirty = false;

  const setDirty = (val) => {
    isDirty = val;
  };

  const getDirty = () => isDirty;

  const triggerGuardModal = () => {
    return new Promise((resolve) => {
      let modal = document.getElementById("unsaved-guard-modal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "unsaved-guard-modal";
        modal.className = "modal-overlay hidden";
        modal.innerHTML = `
          <div class="modal-box" style="max-width: 400px; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">&#x26A0;&#xFE0F;</div>
            <h3 style="margin-top: 0;">Unsaved Profile Changes</h3>
            <p class="text-muted text-sm" style="margin-bottom: 1.5rem;">
              You have unsaved profile changes. Do you want to save them before leaving?
            </p>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <button class="btn btn-primary" id="guard-save-btn">Save & Leave</button>
              <button class="btn btn-danger" id="guard-discard-btn">Discard & Leave</button>
              <button class="btn btn-ghost" id="guard-cancel-btn">Cancel / Continue Editing</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      const closeAndResolve = (action) => {
        modal.classList.add("hidden");
        resolve(action);
      };

      document.getElementById("guard-save-btn").onclick = () => closeAndResolve("save");
      document.getElementById("guard-discard-btn").onclick = () => {
        isDirty = false;
        closeAndResolve("discard");
      };
      document.getElementById("guard-cancel-btn").onclick = () => closeAndResolve("cancel");

      modal.classList.remove("hidden");
    });
  };

  return { setDirty, getDirty, triggerGuardModal };
}

export function enforceHardGate(student, showOnboardingModal) {
  // If photo_status is incomplete, or missing DOB/Gender, show hard gate
  if (!student.birth_date || !student.gender || student.photo_status === "incomplete") {
    // Show hard gate modal (cannot be dismissed until saved)
    if (typeof showOnboardingModal === "function") {
      showOnboardingModal(student);
    }
    return true; // Indicates gate is active
  }
  return false;
}

