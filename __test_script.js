
    import { fetchStudentClasses, fetchStudentProgress, fetchAssessmentsForStudentClass, fetchStudentAttemptsForAssessment, fetchAllStudentAttempts, updateStudentPin, uploadStudentPhoto, updateStudentGender, updateStudentBirthday, updateStudentEducation, formatStudentName, fetchAssignments, fetchAssessments } from './js/api.js?v=4.6.2';
    import { requireStudentSession, clearStudentSession, updateStudentSessionGender } from './js/session.js?v=4.6.2';
    import { showToast, showLoading, hideLoading, getGrade, withTimeout } from './js/app.js?v=4.6.2';
    import { testMicrophoneCapability } from './js/speech.js?v=4.6.2';


    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    window.escapeHtml = escapeHtml;
    const session = requireStudentSession();
    if (!session) throw new Error('Not authenticated');

    // Populate header & Welcome Banner
    document.getElementById('header-student-name').textContent = session.student_name;
    document.getElementById('welcome-name').textContent = session.student_name;
    document.getElementById('welcome-meta').textContent = `${session.institution_name} › ${session.program_name}${session.batch_name ? ' › ' + session.batch_name : ''}`;

    // Compute first initial for banner avatar placeholder
    const cleanStudentName = (session.student_name || 'Student').replace(/^(mr\.?|miss\.?|mrs\.?|ms\.?)\s+/i, '').trim();
    const firstInitial = cleanStudentName.charAt(0).toUpperCase() || 'S';
    const bannerInitialEl = document.getElementById('banner-avatar-initial');
    if (bannerInitialEl) bannerInitialEl.textContent = firstInitial;

    window.isProfileDirty = false;
    document.getElementById('logout-btn').addEventListener('click', () => {
      if (window.isProfileDirty) {
        if (!confirm('You have unsaved changes in your profile. Are you sure you want to logout?')) {
          return;
        }
      }
      clearStudentSession();
      window.location.href = 'index.html';
    });

    // ── Global Profile Photo Synchronization ──
    function applyPhotoEverywhere(url) {
      if (!url) return;
      const photoImg = document.getElementById('prof-photo-img');
      const avatarIcon = document.getElementById('avatar-icon');
      const headerAvatarImg = document.getElementById('header-avatar-img');
      const headerAvatarIcon = document.getElementById('header-avatar-icon');
      const bannerImg = document.getElementById('banner-avatar-img');
      const bannerInitial = document.getElementById('banner-avatar-initial');
      if (photoImg) { photoImg.src = url; photoImg.classList.remove('hidden'); }
      if (avatarIcon) avatarIcon.classList.add('hidden');
      if (headerAvatarImg) { headerAvatarImg.src = url; headerAvatarImg.classList.remove('hidden'); }
      if (headerAvatarIcon) headerAvatarIcon.classList.add('hidden');
      if (bannerImg) { bannerImg.src = url; bannerImg.classList.remove('hidden'); }
      if (bannerInitial) bannerInitial.classList.add('hidden');
    }

    // Banner avatar click opens profile modal
    document.getElementById('banner-avatar-container')?.addEventListener('click', () => {
      applyStudentGenderUI(session.gender);
      document.getElementById('profile-modal')?.classList.remove('hidden');
    });

    // ── Microphone Capability Detection & Header Indicator ──
    async function updateHeaderMicStatus(res) {
      const icon = document.getElementById('header-mic-icon');
      const text = document.getElementById('header-mic-text');
      const btn = document.getElementById('header-mic-btn');
      const ovMic = document.getElementById('overview-mic-status');
      if (res && res.ok) {
        if (icon) icon.textContent = '✅';
        if (text) text.textContent = 'Mic Ready';
        if (btn) {
          btn.style.borderColor = 'rgba(16, 185, 129, 0.5)';
          btn.style.background = 'rgba(16, 185, 129, 0.12)';
          btn.title = 'Microphone verified and ready for speaking tests.';
        }
        if (ovMic) {
          ovMic.textContent = 'Ready ✅';
          ovMic.style.color = '#10b981';
        }
      } else {
        if (icon) icon.textContent = '⚠️ ';
        if (text) text.textContent = 'Mic Check';
        if (btn) {
          btn.style.borderColor = 'rgba(245, 158, 11, 0.5)';
          btn.style.background = 'rgba(245, 158, 11, 0.12)';
          btn.title = res?.message || 'Click to test microphone capability';
        }
        if (ovMic) {
          ovMic.textContent = 'Check ⚠️ ';
          ovMic.style.color = '#f59e0b';
        }
      }
    }

    document.getElementById('header-mic-btn')?.addEventListener('click', async () => {
      showLoading('Testing microphone capability…');
      try {
        const res = await testMicrophoneCapability();
        hideLoading();
        await updateHeaderMicStatus(res);
        if (res.ok) {
          showToast('✅ Microphone is working properly! Ready for speaking tests.', 'success');
        } else {
          showToast(`⚠️  ${res.message}`, 'warning', 6000);
        }
      } catch (err) {
        hideLoading();
        showToast('Microphone test error: ' + err.message, 'error');
      }
    });

    // ── Gender & Title Synchronization ──
    function applyStudentGenderUI(g) {
      const cleanName = (session.student_name || '').replace(/^(mr\.?|miss\.?|mrs\.?|ms\.?)\s+/i, '').trim();
      const formattedName = formatStudentName(cleanName, g);
      session.student_name = formattedName;
      session.gender = g || null;
      updateStudentSessionGender(session.gender, formattedName);

      document.getElementById('header-student-name').textContent = formattedName;
      document.getElementById('welcome-name').textContent = formattedName;
      const profName = document.getElementById('prof-student-name');
      if (profName) profName.textContent = formattedName;

      const badge = document.getElementById('prof-gender-badge');
      if (badge) {
        if (g === 'male') {
          badge.className = 'badge badge-primary';
          badge.textContent = '👨 Male (Mr.)';
        } else if (g === 'female') {
          badge.className = 'badge badge-accent';
          badge.textContent = '👩 Female (Miss)';
        } else {
          badge.className = 'badge badge-neutral';
          badge.textContent = '⏳ Unassigned';
        }
      }

      const btnMale = document.getElementById('btn-prof-male');
      const btnFemale = document.getElementById('btn-prof-female');
      if (btnMale && btnFemale) {
        btnMale.classList.toggle('btn-primary', g === 'male');
        btnMale.classList.toggle('btn-secondary', g !== 'male');
        btnFemale.classList.toggle('btn-primary', g === 'female');
        btnFemale.classList.toggle('btn-secondary', g !== 'female');
      }
    }

    async function checkAndPromptGender() {
      let currentGender = session.gender;
      if (!currentGender) {
        try {
          const sb = await (await import('./js/supabase.js')).getSupabase();
          const { data: st } = await sb.from('students').select('gender, name').eq('id', session.student_id).single();
          if (st?.gender) {
            currentGender = st.gender;
          }
        } catch (err) {
          console.warn('Could not verify gender from DB:', err);
        }
      }

      if (currentGender) {
        applyStudentGenderUI(currentGender);
        return;
      }

      // Gender is unassigned — trigger First-Entry Gender Setup Modal
      hideLoading();
      const modal = document.getElementById('gender-setup-modal');
      const optMale = document.getElementById('opt-gender-male');
      const optFemale = document.getElementById('opt-gender-female');
      const confirmBtn = document.getElementById('btn-confirm-gender');
      let selectedGender = null;

      modal.classList.remove('hidden');

      return new Promise((resolve) => {
        let isResolved = false;
        const doResolve = () => {
          if (!isResolved) {
            isResolved = true;
            modal.classList.add('hidden');
            resolve();
          }
        };

        // Hard Gate: No skip allowed. Gender/Honorific is mandatory.
        optMale.onclick = () => {
          selectedGender = 'male';
          optMale.style.borderColor = 'var(--clr-primary)';
          optMale.style.background = 'rgba(99, 102, 241, 0.15)';
          optMale.style.boxShadow = '0 0 0 2px var(--clr-primary)';
          optFemale.style.borderColor = 'var(--clr-border)';
          optFemale.style.background = 'rgba(255, 255, 255, 0.03)';
          optFemale.style.boxShadow = 'none';
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm as Male (Mr.) ✓';
        };

        optFemale.onclick = () => {
          selectedGender = 'female';
          optFemale.style.borderColor = 'var(--clr-accent-1)';
          optFemale.style.background = 'rgba(236, 72, 153, 0.15)';
          optFemale.style.boxShadow = '0 0 0 2px var(--clr-accent-1)';
          optMale.style.borderColor = 'var(--clr-border)';
          optMale.style.background = 'rgba(255, 255, 255, 0.03)';
          optMale.style.boxShadow = 'none';
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm as Female (Miss) ✓';
        };

        confirmBtn.onclick = async () => {
          if (!selectedGender) return;
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Saving…';
          try {
            await updateStudentGender(session.student_id, selectedGender);
            applyStudentGenderUI(selectedGender);
            showToast(`Welcome, ${session.student_name}! Your title has been personalized.`, 'success');
          } catch (err) {
            console.warn('Failed to save gender:', err);
            showToast('Continuing to dashboard: ' + err.message, 'warning');
          } finally {
            doResolve();
          }
        };
      });
    }

    // ── First-Entry Photo & Microphone Onboarding (Phase 12) ──
    let webcamStream = null;
    let onboardPhotoData = null;

    async function startOnboardWebcam() {
      const video = document.getElementById('webcam-stream');
      const overlay = document.getElementById('camera-loading-overlay');
      const confirmBtn = document.getElementById('btn-confirm-photo-setup');
      if (!video) return;

      if (overlay) overlay.classList.remove('hidden');
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' }
          });
          video.srcObject = webcamStream;
          video.classList.remove('hidden');
          if (overlay) overlay.classList.add('hidden');
          if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = '✓ Save Photo & Enter Dashboard';
          }
        } else {
          throw new Error('Webcam not supported.');
        }
      } catch (err) {
        console.warn('Webcam initialization notice:', err.message);
        if (overlay) {
          overlay.innerHTML = `<span style="text-align:center;padding:10px;">📷 Camera preview unavailable.<br><span class="text-xs text-muted">Please use "Upload Image File" below or click Skip.</span></span>`;
        }
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Continue to Dashboard ←’';
        }
      }
    }

    function stopOnboardWebcam() {
      if (webcamStream) {
        try {
          webcamStream.getTracks().forEach(t => t.stop());
        } catch {}
        webcamStream = null;
      }
    }

    async function checkMicrophoneOnEntry() {
      const titleEl = document.getElementById('mic-status-title');
      const descEl = document.getElementById('mic-status-desc');
      const iconEl = document.getElementById('mic-status-icon');
      const cardEl = document.getElementById('mic-status-card');

      try {
        const res = await testMicrophoneCapability();
        updateHeaderMicStatus(res);
        if (res.ok) {
          if (titleEl) titleEl.textContent = 'Microphone Ready (Active)';
          if (descEl) descEl.textContent = 'Device tested and verified for speaking tests.';
          if (iconEl) iconEl.textContent = '✅';
          if (cardEl) {
            cardEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            cardEl.style.background = 'rgba(16, 185, 129, 0.08)';
          }
        } else {
          if (titleEl) titleEl.textContent = res.state === 'permission_denied' ? 'Microphone Permission Needed' : 'Microphone Check';
          if (descEl) descEl.textContent = res.message;
          if (iconEl) iconEl.textContent = '⚠️ ';
          if (cardEl) {
            cardEl.style.borderColor = 'rgba(245, 158, 11, 0.4)';
            cardEl.style.background = 'rgba(245, 158, 11, 0.08)';
          }
        }
        return res;
      } catch (err) {
        console.warn('Microphone entry test error:', err);
      }
    }

    document.getElementById('btn-retry-mic')?.addEventListener('click', checkMicrophoneOnEntry);

    // Snapshot button
    document.getElementById('btn-snap-photo')?.addEventListener('click', () => {
      const video = document.getElementById('webcam-stream');
      const canvas = document.getElementById('webcam-canvas');
      const img = document.getElementById('webcam-snapshot');
      if (!video || !canvas || !img) return;

      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext('2d');
      // Mirror to match user perspective
      ctx.translate(320, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, 320, 320);

      onboardPhotoData = canvas.toDataURL('image/jpeg', 0.85);
      img.src = onboardPhotoData;
      img.classList.remove('hidden');
      video.classList.add('hidden');

      document.getElementById('btn-snap-photo').classList.add('hidden');
      document.getElementById('btn-retake-photo').classList.remove('hidden');
      document.getElementById('btn-confirm-photo-setup').disabled = false;
      stopOnboardWebcam();
    });

    // Retake button
    document.getElementById('btn-retake-photo')?.addEventListener('click', async () => {
      onboardPhotoData = null;
      const img = document.getElementById('webcam-snapshot');
      if (img) img.classList.add('hidden');
      document.getElementById('btn-retake-photo').classList.add('hidden');
      document.getElementById('btn-snap-photo').classList.remove('hidden');
      document.getElementById('btn-confirm-photo-setup').disabled = true;
      await startOnboardWebcam();
    });

    // File upload fallback
    document.getElementById('onboard-photo-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) {
        showToast('Image file is too large (max 3MB).', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        onboardPhotoData = evt.target.result;
        const img = document.getElementById('webcam-snapshot');
        img.src = onboardPhotoData;
        img.classList.remove('hidden');
        document.getElementById('webcam-stream').classList.add('hidden');
        const overlay = document.getElementById('camera-loading-overlay');
        if (overlay) overlay.classList.add('hidden');
        document.getElementById('btn-snap-photo').classList.add('hidden');
        document.getElementById('btn-retake-photo').classList.remove('hidden');
        document.getElementById('btn-confirm-photo-setup').disabled = false;
        stopOnboardWebcam();
      };
      reader.readAsDataURL(file);
    });

    // Save and enter dashboard
    document.getElementById('btn-confirm-photo-setup')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-confirm-photo-setup');
      btn.disabled = true;
      btn.textContent = 'Entering dashboard…';
      
      try {
        // If student did not manually click "Capture Photo", auto-capture from active webcam stream!
        if (!onboardPhotoData) {
          const video = document.getElementById('webcam-stream');
          const canvas = document.getElementById('webcam-canvas');
          if (video && canvas && webcamStream) {
            try {
              canvas.width = 320;
              canvas.height = 320;
              const ctx = canvas.getContext('2d');
              ctx.translate(320, 0);
              ctx.scale(-1, 1);
              ctx.drawImage(video, 0, 0, 320, 320);
              onboardPhotoData = canvas.toDataURL('image/jpeg', 0.85);
            } catch (snapErr) {
              console.warn('Auto-snapshot capture failed:', snapErr);
            }
          }
        }

        if (onboardPhotoData) {
          btn.textContent = 'Saving photo…';
          try {
            await uploadStudentPhoto(session.student_id, onboardPhotoData);
            applyPhotoEverywhere(onboardPhotoData);
            showToast('Profile photo registered successfully! Welcome to your dashboard.', 'success');
          } catch (uploadErr) {
            console.warn('Photo upload warning:', uploadErr);
            applyPhotoEverywhere(onboardPhotoData);
            showToast('Photo captured! Continuing to dashboard.', 'info');
          }
        }
      } catch (err) {
        console.warn('Photo setup flow error:', err);
      } finally {
        stopOnboardWebcam();
        document.getElementById('photo-setup-modal').classList.add('hidden');
      }
    });

    // Skip photo setup fallback
    document.getElementById('btn-skip-photo-setup')?.addEventListener('click', () => {
      stopOnboardWebcam();
      document.getElementById('photo-setup-modal').classList.add('hidden');
    });

    async function checkAndPromptPhoto() {
      let photoUrl = null;
      try {
        const sb = await (await import('./js/supabase.js')).getSupabase();
        const { data: st } = await sb.from('students').select('photo_url, photo_status').eq('id', session.student_id).single();
        if (st && st.photo_url) {
          photoUrl = st.photo_url;
        }
      } catch (err) {
        console.warn('Could not check photo status from DB:', err);
      }

      if (photoUrl) {
        applyPhotoEverywhere(photoUrl);
        // Test mic upfront on entry so browser permission is established before Assessments
        checkMicrophoneOnEntry();
        return;
      }

      // No photo registered! Show Photo & Mic Setup Modal
      hideLoading();
      const modal = document.getElementById('photo-setup-modal');
      modal.classList.remove('hidden');
      await startOnboardWebcam();
      await checkMicrophoneOnEntry();

      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (modal.classList.contains('hidden')) {
            clearInterval(interval);
            resolve();
          }
        }, 300);
      });
    }

    async function checkAndPromptBirthday() {
      let hasBirthday = false;
      try {
        const sb = await (await import('./js/supabase.js')).getSupabase();
        const { data: st } = await sb.from('students').select('birth_date').eq('id', session.student_id).single();
        if (st && st.birth_date) {
          hasBirthday = true;
        }
      } catch (err) {
        console.warn('Could not check birthday status from DB:', err);
      }

      if (hasBirthday) return;

      hideLoading();
      const modal = document.getElementById('birthday-setup-modal');
      modal.classList.remove('hidden');

      return new Promise((resolve) => {
        let isResolved = false;
        const doResolve = () => {
          if (!isResolved) {
            isResolved = true;
            modal.classList.add('hidden');
            resolve();
          }
        };

        // Hard Gate: Birthday is mandatory before dashboard access
        document.getElementById('btn-confirm-birthday-setup')?.addEventListener('click', async () => {
          const bdInput = document.getElementById('onboard-birth-date');
          const bd = bdInput?.value;
          if (!bd) {
            showToast('Date of Birth is mandatory. Please enter your birth date to continue.', 'warning');
            return;
          }

          const btn = document.getElementById('btn-confirm-birthday-setup');
          btn.disabled = true;
          btn.textContent = 'Saving...';
          
          try {
            await updateStudentBirthday(session.student_id, bd);
            showToast('Birthday registered successfully!', 'success');
            doResolve();
          } catch (err) {
            console.warn('Error saving birthday:', err);
            showToast('Could not save birthday: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Save & Continue';
          }
        });
      });
    }

    async function checkAndPromptEducation() {
      let hasEducation = false;
      try {
        const sb = await (await import('./js/supabase.js')).getSupabase();
        const { data: st } = await sb.from('students').select('education').eq('id', session.student_id).single();
        if (st && st.education) {
          if (Array.isArray(st.education) && st.education.length > 0) {
            hasEducation = true;
          } else if (typeof st.education === 'string' && st.education.trim().length > 0) {
            hasEducation = true;
          }
          if (hasEducation && !session.education) {
             session.education = st.education;
             const { setStudentSession } = await import('./js/session.js?v=4.6.2');
             setStudentSession(session);
          }
        }
      } catch (err) {
        console.warn('Could not check education status from DB:', err);
      }

      if (hasEducation) return;

      hideLoading();
      const modal = document.getElementById('education-setup-modal');
      modal.classList.remove('hidden');

      return new Promise((resolve) => {
        let isResolved = false;
        const doResolve = () => {
          if (!isResolved) {
            isResolved = true;
            modal.classList.add('hidden');
            resolve();
          }
        };

        // Hard Gate: Strictly max 2 latest entries: Institution & Year only
        document.getElementById('btn-confirm-education-setup')?.addEventListener('click', async () => {
          const inst1 = document.getElementById('onboard-edu-inst-1')?.value.trim();
          const year1 = document.getElementById('onboard-edu-year-1')?.value.trim();
          if (!inst1 || !year1) {
            showToast('Please provide your latest academic institution and year.', 'warning');
            return;
          }

          const eduList = [
            { institution: inst1, year: parseInt(year1, 10) || year1 }
          ];

          const inst2 = document.getElementById('onboard-edu-inst-2')?.value.trim();
          const year2 = document.getElementById('onboard-edu-year-2')?.value.trim();
          if (inst2 && year2) {
            eduList.push({ institution: inst2, year: parseInt(year2, 10) || year2 });
          }

          const btn = document.getElementById('btn-confirm-education-setup');
          btn.disabled = true;
          btn.textContent = 'Verifying & Saving...';
          
          try {
            await updateStudentEducation(session.student_id, eduList);
            session.education = eduList;
            const { setStudentSession } = await import('./js/session.js?v=4.6.2');
            setStudentSession(session);
            showToast('Academic background verified!', 'success');
            doResolve();
          } catch (err) {
            console.warn('Error saving education level:', err);
            showToast('Could not save education: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = '✓ Save Academic Background & Continue';
          }
        });
      });
    }

    // ── Load Classes & Dashboard ──
    async function loadDashboard() {
      try {
        hideLoading();
        await checkAndPromptGender();
        await checkAndPromptPhoto();
        await checkAndPromptBirthday();
        await checkAndPromptEducation();

        showLoading('Loading your dashboard…');

        // Fetch legacy data + V1 assignments concurrently
        const [Classes, progress, attempts, assignmentsRaw, assessmentsRaw] = await withTimeout(
          Promise.all([
            fetchStudentClasses(session.program_id, session.institution_id),
            fetchStudentProgress(session.student_id),
            fetchAllStudentAttempts(session.student_id),
            // V1: fetch assignments for this student's batch + individual
            fetchAssignments({ batch_id: session.batch_id, student_id: session.student_id }).catch(() => []),
            fetchAssessments({ program_id: session.program_id, batch_id: session.batch_id }).catch(() => [])
          ]),
          20000,
          'Fetching dashboard data'
        );

        hideLoading();
        renderClasses(Classes, progress);

        // V1: assessments are directly assigned to program or batch, so no need to cross-check with instances
        const v1Assessments = assessmentsRaw || [];
        if (v1Assessments.length > 0) {
          await renderAssignedAssessments(v1Assessments, attempts);
        }

        await computeOverallStats(attempts, v1Assessments);
        setupProfileModal(attempts);
      } catch(e) {
        hideLoading();
        showToast('Failed to load dashboard: ' + e.message, 'error');
      }
    }

    function renderClasses(rawClasses, progress) {
      const subjCountEl = document.getElementById('overview-Classes-count');
      if (subjCountEl) subjCountEl.textContent = rawClasses.length;

      const grid = document.getElementById('Classes-grid');
      if (!rawClasses.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-state__icon">📚</div>
          <h3>No Classes assigned</h3>
          <p>Your class doesn't have any Classes assigned yet. Please contact your teacher.</p>
        </div>`;
        return;
      }

      // Strict alphabetical sorting (A to Z)
      const Classes = [...rawClasses].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const ClassIcons = ['&#128218;', '&#9999;&#65039;', '&#128483;&#65039;', '&#127911;', '&#128200;', '&#127757;', '&#128214;', '&#128172;'];
      grid.innerHTML = '';

      Classes.forEach((subj, idx) => {
        const subjProgress = progress.filter(p => p.Class_id === subj.id);
        const isCompleted = subjProgress.some(p => p.is_completed);
        const pct = isCompleted ? 100 : 0;

        const card = document.createElement('div');
        card.className = 'Class-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Class: ${subj.name}`);
        card.innerHTML = `
          <div class="Class-icon">${ClassIcons[idx % ClassIcons.length]}</div>
          <div class="Class-name">${subj.name}</div>
          <div class="text-sm text-muted mb-3">${isCompleted ? "Completed" : "In Progress"}</div>
          <div class="score-bar-wrap">
            <div class="score-bar" style="width:${pct}%"></div>
          </div>
          
        `;

        card.addEventListener('click', () => openClassModal(subj, progress));
        card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openClassModal(subj, progress); });
        grid.appendChild(card);

        // Render level dots
        
      });
    }

    // ── openClassModal: Opens the Level Modal for a Class ──
    // Called when a student clicks a Class card on the dashboard.
    async function openClassModal(subj, progress) {
      const modal       = document.getElementById('level-modal');
      const titleEl     = document.getElementById('level-modal-title');
      const ClassEl   = document.getElementById('level-modal-Class');
      const container   = document.getElementById('levels-container');
      if (!modal || !container) return;

      // Open modal immediately with a loading state
      titleEl.textContent  = subj.name || 'Class';
      ClassEl.textContent = '';
      container.innerHTML  = `<div style="padding:2rem;text-align:center;color:var(--clr-text-3);">
        <div class="spinner" style="margin:0 auto 1rem;"></div>
        <p>Loading Assessments…</p></div>`;
      modal.classList.remove('hidden');

      try {
        const Assessments = await fetchAssessmentsForStudentClass(
          session.program_id, subj.id, session.institution_id
        );

        if (!Assessments || Assessments.length === 0) {
          container.innerHTML = `<div style="padding:2.5rem 1.5rem;text-align:center;color:var(--clr-text-3);">
            <div style="font-size:2.5rem;margin-bottom:0.75rem;">📈­</div>
            <p style="font-size:0.9rem;">No published Assessments for this Class yet.</p></div>`;
          return;
        }

        // Group Assessments by level (level_id or level name)
        const levelMap = new Map();
        for (const Assessment of Assessments) {
          const lvlId   = Assessment.level_id || '_default';
          const lvlName = Assessment.levels?.name || Assessment.level_name || (lvlId === '_default' ? 'General' : `Level ${lvlId}`);
          const lvlOrder = Assessment.levels?.level_number ?? Assessment.level_order ?? 99;
          if (!levelMap.has(lvlId)) levelMap.set(lvlId, { name: lvlName, order: lvlOrder, Assessments: [] });
          levelMap.get(lvlId).Assessments.push(Assessment);
        }

        // Sort levels by order
        const sortedLevels = [...levelMap.values()].sort((a, b) => a.order - b.order);

        // Build attempts quick-lookup for this student
        const attemptsRaw = await fetchAllStudentAttempts(session.student_id).catch(() => []);
        const bestByAssessment = {};
        const inProgByAssessment = {};
        for (const att of attemptsRaw) {
          const eid = att.assessment_id || att.Assessment_id;
          if (!eid) continue;
          const pct = parseFloat(att.percentage || 0);
          const st  = (att.status || '').toLowerCase();
          if (st === 'in_progress') { inProgByAssessment[eid] = att; continue; }
          if (!bestByAssessment[eid] || (att.is_best_score) || pct > parseFloat(bestByAssessment[eid].percentage || 0)) {
            if (!bestByAssessment[eid]?.is_best_score) bestByAssessment[eid] = att;
          }
        }

        // Render
        let html = '';
        for (const lvl of sortedLevels) {
          html += `<div style="margin-bottom:1.5rem;">
            <div style="font-size:0.75rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;
                        color:var(--clr-text-3);padding:0.4rem 0;border-bottom:1px solid var(--clr-border);
                        margin-bottom:0.75rem;">${lvl.name}</div>`;
          for (const Assessment of lvl.Assessments) {
            const best      = bestByAssessment[Assessment.id];
            const inProg    = inProgByAssessment[Assessment.id];
            const bestPct   = best ? parseFloat(best.percentage || 0) : null;
            const passed    = bestPct !== null && bestPct >= (Assessment.pass_threshold || 60);
            const grade     = bestPct !== null ? getGrade(bestPct) : null;
            const gradeColors = { S:'#f59e0b',A:'#10b981',B:'#3b82f6',C:'#f59e0b',D:'#ea580c',E:'#ef4444',F:'#94a3b8' };
            const gradeColor  = grade ? (gradeColors[grade] || '#94a3b8') : null;

            let statusBadge = '';
            let actionBtn   = '';
            if (inProg) {
              statusBadge = `<span style="background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.35);
                              padding:2px 8px;border-radius:4px;font-size:0.68rem;font-weight:700;text-transform:uppercase;">&#9203; In Progress</span>`;
              actionBtn   = `<button onclick="location.href='assessment.html?attempt_id=${inProg.id}'"
                              style="background:var(--clr-accent-1);color:#fff;border:none;padding:6px 14px;border-radius:6px;
                              font-size:0.78rem;font-weight:700;cursor:pointer;">Resume ←’</button>`;
            } else if (best) {
              const badgeBg = passed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)';
              const badgeClr= passed ? '#10b981' : '#f87171';
              statusBadge = `<span style="background:${badgeBg};color:${badgeClr};border:1px solid ${badgeClr}33;
                              padding:2px 8px;border-radius:4px;font-size:0.68rem;font-weight:700;text-transform:uppercase;">
                              ${passed ? '&#10003; Passed' : '&#10007; Failed'} ${bestPct.toFixed(0)}%</span>`;
              actionBtn   = `<button onclick="location.href='result.html?attempt_id=${best.id}'"
                              style="background:rgba(255,255,255,0.06);color:var(--clr-text-2);border:1px solid var(--clr-border);
                              padding:6px 14px;border-radius:6px;font-size:0.78rem;font-weight:700;cursor:pointer;">View Result</button>`;
            } else {
              statusBadge = `<span style="background:rgba(99,102,241,0.12);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);
                              padding:2px 8px;border-radius:4px;font-size:0.68rem;font-weight:700;text-transform:uppercase;">Not Started</span>`;
              actionBtn   = `<button onclick="location.href='assessment.html?Assessment_id=${Assessment.id}'"
                              style="background:var(--clr-accent-1);color:#fff;border:none;padding:6px 14px;border-radius:6px;
                              font-size:0.78rem;font-weight:700;cursor:pointer;">Start Assessment ←’</button>`;
            }

            const gradeChip = grade ? `<span style="background:${gradeColor}22;color:${gradeColor};border:1px solid ${gradeColor}44;
              padding:2px 7px;border-radius:4px;font-size:0.72rem;font-weight:800;">${grade}</span>` : '';

            html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;
                      padding:0.7rem 0.9rem;border-radius:8px;margin-bottom:0.4rem;
                      background:rgba(255,255,255,0.025);border:1px solid var(--clr-border);
                      transition:background 0.15s;" 
                      onmouseover="this.style.background='rgba(255,255,255,0.05)'" 
                      onmouseout="this.style.background='rgba(255,255,255,0.025)'">
              <div style="flex:1;min-width:0;">
                <div style="font-size:0.85rem;font-weight:600;color:var(--clr-text-1);white-space:nowrap;
                            overflow:hidden;text-overflow:ellipsis;">${Assessment.name || Assessment.title || 'Assessment'}</div>
                <div style="font-size:0.72rem;color:var(--clr-text-3);margin-top:2px;">${formatAnswerType(Assessment.answer_type)} · ${Assessment.time_limit_minutes || 0} min</div>
              </div>
              <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0;">
                ${gradeChip}
                ${statusBadge}
                ${actionBtn}
              </div>
            </div>`;
          }
          html += `</div>`;
        }
        container.innerHTML = html;

      } catch(err) {
        container.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--clr-text-3);">
          <div style="font-size:1.5rem;margin-bottom:0.5rem;">⚠️</div>
          <p style="font-size:0.85rem;">Could not load Assessments: ${err.message}</p></div>`;
      }
    }

    function formatAnswerType(atype) {
      if (!atype) return 'Written Test';
      if (atype === 'speech_to_text') return 'Speaking Test';
      if (atype === 'written') return 'Written Test';
      if (atype === 'multiple_choice') return 'Multiple Choice';
      if (atype === 'dropdown') return 'Dropdown';
      return atype.replace('_', ' ');
    }



    // --- V1: Render Assigned Assessments Section ---
    // (Existing assessments logic)
    // --- Render Completed Assessments Section (Bottom of Dashboard) ---
    // --- Profile Modal & History ---
    // --- Level Modal close ---
    // --- Gamification: Show Level Up Popup ---
    async function renderAssignedAssessments(assessments, allAttempts) {
      // Find or create the assigned-assessments section
      let section = document.getElementById('v1-assessments-section');
      if (!section) {
        // Insert before the completed-Assessments area
        const completedSection = document.getElementById('completed-Assessments-container')?.closest('section') ||
          document.getElementById('completed-Assessments-container')?.parentElement;
        section = document.createElement('section');
        section.id = 'v1-assessments-section';
        section.style.cssText = 'margin: 0 0 2rem 0;';
        if (completedSection) {
          completedSection.parentElement.insertBefore(section, completedSection);
        } else {
          document.querySelector('.dashboard-content, main, .main-content')?.appendChild(section);
        }
      }

      // Build attempts map: assessment_id -> best attempt
      const bestByAssessment = {};
      const inProgressByAssessment = {};
      allAttempts.forEach(att => {
        const aid = att.assessment_id || att.Assessment_id;
        if (!aid) return;
        const pct = parseFloat(att.percentage || 0);
        if (att.status === 'IN_PROGRESS') {
          inProgressByAssessment[aid] = att;
        }
        // Prefer is_best_score flag; fallback to highest pct
        if (att.is_best_score) {
          bestByAssessment[aid] = att;
        } else if (!bestByAssessment[aid] || pct > parseFloat(bestByAssessment[aid].percentage || 0)) {
          if (!bestByAssessment[aid]?.is_best_score) bestByAssessment[aid] = att;
        }
      });

      const gradeColors = { S: '#f59e0b', A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#ea580c', E: '#ef4444', F: '#94a3b8' };

      let cards = '';
      for (const asm of assessments) {
        const bestAtt = bestByAssessment[asm.id];
        const inProgAtt = inProgressByAssessment[asm.id];
        const bestPct = bestAtt ? parseFloat(bestAtt.percentage || 0) : null;
        const grade = bestPct !== null ? getGrade(bestPct) : null;
        const passed = bestPct !== null && bestPct >= (asm.pass_threshold || 60);

        // Check dynamic prerequisites (0 to N parents + min score thresholds + aggregate average)
        let prereqMet = true;
        let prereqTitle = '';

        if (asm.prerequisites && typeof asm.prerequisites === 'object') {
          const parents = Array.isArray(asm.prerequisites.parents) ? asm.prerequisites.parents : [];
          let totalScore = 0;
          let count = 0;
          for (const parent of parents) {
            const pid = parent.assessment_id;
            const minScore = parent.min_score || 60;
            const parentBest = bestByAssessment[pid];
            const parentPct = parentBest ? parseFloat(parentBest.percentage || 0) : null;
            if (parentPct === null || parentPct < minScore) {
              prereqMet = false;
              const pObj = assessments.find(a => a.id === pid);
              prereqTitle = (pObj ? (pObj.title || pObj.name) : 'Prerequisite') + ` (Required: ≥${minScore}%)`;
              break;
            }
            totalScore += parentPct;
            count++;
          }
          if (prereqMet && asm.prerequisites.aggregate_avg_threshold && count > 0) {
            const avg = totalScore / count;
            if (avg < asm.prerequisites.aggregate_avg_threshold) {
              prereqMet = false;
              prereqTitle = `Aggregate Avg Required: ${asm.prerequisites.aggregate_avg_threshold}% (Current: ${Math.round(avg)}%)`;
            }
          }
        } else if (asm.prerequisite_assessment_id || asm.prerequisite_Assessment_id) {
          const pid = asm.prerequisite_assessment_id || asm.prerequisite_Assessment_id;
          const prereqBest = bestByAssessment[pid];
          const prereqPct = prereqBest ? parseFloat(prereqBest.percentage || 0) : null;
          prereqMet = prereqPct !== null && prereqPct >= (asm.prerequisite_min_score || 60);
          
          const pObj = assessments.find(a => a.id === pid);
          prereqTitle = pObj ? (pObj.title || pObj.name || 'Prerequisite') : 'Prerequisite Assessment';
        }

        // Availability window
        const now = new Date();
        const availStart = asm.availability_start ? new Date(asm.availability_start) : null;
        const availEnd = asm.availability_end ? new Date(asm.availability_end) : null;
        const inWindow = (!availStart || now >= availStart) && (!availEnd || now <= availEnd);

        // Status
        let statusBadge = '';
        let actionBtn = '';
        const isCompleted = bestAtt && ['SUBMITTED', 'AUTO_SUBMITTED'].includes(bestAtt.status);

        if (!prereqMet) {
          statusBadge = `<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);">\uD83D\uDD12 Locked: ${escapeHtml(prereqTitle)}</span>`;
          actionBtn = `<button class="btn btn-sm" disabled style="opacity:0.45;cursor:not-allowed;background:rgba(255,255,255,0.05);border:1px solid var(--clr-border);">Locked</button>`;
        } else if (!inWindow) {
          statusBadge = `<span class="badge" style="background:rgba(148,163,184,0.15);color:#94a3b8;border:1px solid rgba(148,163,184,0.3);">Not Yet Available</span>`;
          actionBtn = `<button class="btn btn-sm" disabled style="opacity:0.45;cursor:not-allowed;background:rgba(255,255,255,0.05);border:1px solid var(--clr-border);">Unavailable</button>`;
        } else if (inProgAtt) {
          statusBadge = `<span class="badge" style="background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);">\u25BA In Progress</span>`;
          actionBtn = `<button class="btn btn-warning btn-sm" data-aid="${asm.id}">Resume</button>`;
        } else if (isCompleted) {
          const retakesAllowed = asm.max_attempts == null || (asm.max_attempts > (allAttempts.filter(a => (a.assessment_id || a.Assessment_id) === asm.id && a.status !== 'IN_PROGRESS').length));
          statusBadge = passed
            ? `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);">\u2713 Passed</span>`
            : `<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);">Needs Improvement</span>`;
          actionBtn = retakesAllowed && !passed
            ? `<button class="btn btn-sm btn-primary" data-aid="${asm.id}">Retake</button>`
            : `<button class="btn btn-sm" style="background:rgba(255,255,255,0.05);border:1px solid var(--clr-border);" data-aid-result="${bestAtt?.id}">View Result</button>`;
        } else {
          statusBadge = `<span class="badge" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);">Ready</span>`;
          actionBtn = `<button class="btn btn-primary btn-sm" data-aid="${asm.id}">Start</button>`;
        }

        const duration = asm.working_duration_minutes || asm.time_limit_minutes || 60;
        const qCount = asm.question_count || '—';
        const asmType = asm.assessment_type || asm.Assessment_type || 'Assessment';
        
        let asmTitle = asm.title || asm.name || asm.name || 'Assessment';
        if (asm.hasOwnProperty('auto_name_override') && !asm.auto_name_override) {
          const className = asm.classes?.name || 'Global';
          const typeName = asm.assessment_type || 'Task';
          const topicName = asm.topics?.name || 'No Topic';
          const moduleName = asm.modules?.name || 'Custom Module';
          asmTitle = `${className} - ${typeName} - ${topicName} - ${moduleName}`;
        }

        const ClassName = asm.modules?.name || asm.Classes?.name || '';

        cards += `
          <div class="v1-assessment-card" data-assessment-id="${asm.id}" style="
            background: var(--clr-card, rgba(30,41,59,0.8));
            border: 1px solid var(--clr-border, rgba(255,255,255,0.08));
            border-radius: 14px;
            padding: 1.25rem 1.5rem;
            margin-bottom: 0.75rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            flex-wrap: wrap;
            transition: border-color 0.2s;
          ">
            <div style="flex:1;min-width:200px;">
              <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.4rem;">
                <span style="font-weight:700;font-size:0.95rem;color:var(--clr-text-1);">${escapeHtml(asmTitle)}</span>
                ${ClassName ? `<span class="badge badge-neutral" style="font-size:0.7rem;">${escapeHtml(ClassName)}</span>` : ''}
                <span class="badge" style="font-size:0.68rem;background:rgba(255,255,255,0.06);color:var(--clr-text-3);border:1px solid var(--clr-border);">${escapeHtml(asmType)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
                <span style="font-size:0.78rem;color:var(--clr-text-3);">\u23F1 ${duration} min</span>
                ${qCount !== '—' ? `<span style="font-size:0.78rem;color:var(--clr-text-3);">\uD83D\uDCCB ${qCount} Questions</span>` : ''}
                ${statusBadge}
              </div>
              ${!prereqMet && prereqTitle ? `<div style="margin-top:0.5rem;"><span style="font-size:0.72rem;color:#f87171;">\uD83D\uDD12 Complete prerequisite first: <em>${escapeHtml(prereqTitle)}</em></span></div>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem;flex-shrink:0;">
              ${bestPct !== null ? `
                <div style="text-align:center;">
                  <div style="font-size:1.1rem;font-weight:800;color:${gradeColors[grade] || 'var(--clr-text-1)'}">${bestPct.toFixed(0)}%</div>
                  <div style="font-size:0.7rem;color:var(--clr-text-3);">Best Score</div>
                </div>
                <div style="width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem;border:2px solid ${gradeColors[grade] || '#64748b'};color:${gradeColors[grade] || '#64748b'};">${grade}</div>
              ` : ''}
              ${actionBtn}
            </div>
          </div>
        `;
      }

      section.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <h3 style="font-size:1rem;font-weight:700;color:var(--clr-text-1);margin:0;">\uD83D\uDCCB Assigned Assessments <span style="font-size:0.75rem;color:var(--clr-text-3);font-weight:400;margin-left:8px;">${assessments.length} total</span></h3>
        </div>
        ${cards || '<div class="empty-state" style="padding:2rem;text-align:center;"><p class="text-muted">No assessments assigned to you yet.</p></div>'}
      `;

      // Wire up buttons
      section.querySelectorAll('[data-aid]').forEach(btn => {
        btn.addEventListener('click', () => {
          sessionStorage.setItem('tec_assessment_id', btn.dataset.aid);
          window.location.href = 'assessment.html';
        });
      });
      section.querySelectorAll('[data-aid-result]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.location.href = `result.html?attempt_id=${btn.dataset.aidResult}`;
        });
      });
    }

    // ── Overall Stats Calculation (AGENTS.md §2.8 & §2.10) ──
    async function computeOverallStats(attempts, assessments = []) {
      // Rule 2.8: Overall score is average of all takeable Assessments for student.
      // Rule 2.7: Global average strictly counts unopened/unattempted available modules as 0.
      // Best score per assessment is preserved across attempts.
      const bestMap = {};
      attempts.forEach(att => {
        const uniqueKey = att.assessment_instance_id || att.assessment_id || att.Assessment_id;
        if (!uniqueKey) return;
        const pct = parseFloat(att.percentage || 0);
        if (att.is_best_score) {
          bestMap[uniqueKey] = pct;
        } else if (bestMap[uniqueKey] == null || pct > bestMap[uniqueKey]) {
          if (!Object.hasOwn(bestMap, uniqueKey + '_locked')) {
            bestMap[uniqueKey] = pct;
          }
        }
        if (att.is_best_score) bestMap[uniqueKey + '_locked'] = true;
      });

      // Filter assessments that are currently within their availability window
      const now = new Date();
      const availableAssms = (assessments || []).filter(a => {
        const start = a.availability_start ? new Date(a.availability_start) : null;
        const end = a.availability_end ? new Date(a.availability_end) : null;
        return (!start || now >= start) && (!end || now <= end);
      });

      let scores = [];
      if (availableAssms.length > 0) {
        // Global average strictly counts unopened/unattempted available modules as 0
        scores = availableAssms.map(a => {
          const score = bestMap[a.id];
          return score != null ? score : 0;
        });
      } else {
        scores = Object.entries(bestMap)
          .filter(([k]) => !k.endsWith('_locked'))
          .map(([, v]) => v);
      }

      const completedCount = Object.keys(bestMap).filter(k => !k.endsWith('_locked')).length;
      const AssessmentsCountEl = document.getElementById('stat-Assessments-done');
      if (AssessmentsCountEl) AssessmentsCountEl.textContent = completedCount;
      const ovCountEl = document.getElementById('overview-Assessments-count');
      if (ovCountEl) ovCountEl.textContent = completedCount;

      if (!scores.length) {
        document.getElementById('stat-overall-score').textContent = '0%';
        document.getElementById('stat-overall-grade-badge').textContent = '—';
        renderCompletedAssessmentsBottom(attempts);
        return;
      }

      const totalPct = scores.reduce((acc, curr) => acc + curr, 0);
      const avgPct = Math.round(totalPct / scores.length);
      const overallGrade = getGrade(avgPct);

      const scoreEl = document.getElementById('stat-overall-score');
      scoreEl.textContent = `${avgPct}%`;
      scoreEl.className = `fw-800 banner-score-text text-grade-${overallGrade}`;

      const gradeBadge = document.getElementById('stat-overall-grade-badge');
      gradeBadge.textContent = overallGrade;

      const gradeColors = { S: '#f59e0b', A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#ea580c', E: '#ef4444', F: '#94a3b8' };
      gradeBadge.style.color = gradeColors[overallGrade] || 'var(--clr-text-1)';

      renderCompletedAssessmentsBottom(attempts);
    }

    // --- Render Completed Assessments Section (Bottom of Dashboard) ---
    function renderCompletedAssessmentsBottom(attempts) {
      const container = document.getElementById('completed-Assessments-container');
      const badgeEl = document.getElementById('bottom-completed-badge');
      const statTotalEl = document.getElementById('bottom-stat-total-Assessments');
      const statAvgEl = document.getElementById('bottom-stat-avg-score');
      const statBestEl = document.getElementById('bottom-stat-best-score');

      if (!attempts || !attempts.length) {
        if (badgeEl) badgeEl.textContent = '0 Assessments Completed';
        if (statTotalEl) statTotalEl.textContent = '0';
        if (statAvgEl) statAvgEl.textContent = '0%';
        if (statBestEl) statBestEl.textContent = '0%';
        if (container) {
          container.innerHTML = `
            <div class="empty-state p-8 text-center" style="padding: 40px 20px;">
              <div class="empty-state__icon" style="font-size:2.5rem;margin-bottom:12px;">📈</div>
              <h3 class="fw-700 text-base mb-1" style="color:var(--clr-text-1);">No completed Assessments yet</h3>
              <p class="text-sm text-muted" style="max-width:440px;margin:0 auto;">
                Pick a Class above to start taking your assigned English assessments. Your scores, grades, and completion records will appear here.
              </p>
            </div>
          `;
        }
        return;
      }

      // Calculate summary statistics
      const bestAttemptsMap = {};
      let highestPct = 0;

      attempts.forEach(att => {
        const pct = parseFloat(att.percentage || 0);
        if (pct > highestPct) highestPct = pct;
        if (!bestAttemptsMap[att.Assessment_id] || pct > bestAttemptsMap[att.Assessment_id]) {
          bestAttemptsMap[att.Assessment_id] = pct;
        }
      });

      const uniqueAssessmentsCount = Object.keys(bestAttemptsMap).length;
      let totalPctSum = 0;
      Object.values(bestAttemptsMap).forEach(pct => totalPctSum += pct);
      const avgScore = uniqueAssessmentsCount > 0 ? (totalPctSum / uniqueAssessmentsCount).toFixed(1) : '0.0';

      if (badgeEl) badgeEl.textContent = `${uniqueAssessmentsCount} Assessment${uniqueAssessmentsCount === 1 ? '' : 's'} Completed`;
      if (statTotalEl) statTotalEl.textContent = uniqueAssessmentsCount;
      if (statAvgEl) statAvgEl.textContent = `${avgScore}%`;
      if (statBestEl) statBestEl.textContent = `${highestPct.toFixed(1)}%`;

      // Sort attempts by submitted_at desc
      const sortedAttempts = [...attempts].sort((a, b) => {
        const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
        return dateB - dateA;
      });

      const gradeColors = { S: '#f59e0b', A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#ea580c', E: '#ef4444', F: '#94a3b8' };

      // Desktop Table
      let tableHtml = `
        <div class="table-responsive">
          <table class="completed-Assessments-table">
            <thead>
              <tr>
                <th>Assessment Title</th>
                <th>Class</th>
                <th>Score</th>
                <th>Grade</th>
                <th>Date Completed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
      `;

      // Mobile List
      let mobileListHtml = `
        <div class="completed-Assessments-mobile-list">
      `;

      sortedAttempts.forEach(a => {
        const AssessmentObj = a.Assessments || {};
        const AssessmentTitle = AssessmentObj.name || 'English Assessment';
        const AssessmentType = AssessmentObj.Assessment_type || '';
        const ClassName = AssessmentObj.Classes?.name || 'General English';
        const pct = parseFloat(a.percentage || 0).toFixed(1);
        const grade = a.grade || getGrade(pct);
        const gradeColor = gradeColors[grade] || 'var(--clr-text-1)';
        const dateStr = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) : '—';
        const isPassed = parseFloat(pct) >= 60;
        const statusBadgeDesktop = isPassed
          ? `<span class="badge badge-success" style="font-size:0.75rem;padding:3px 8px;">✓ Passed</span>`
          : `<span class="badge badge-warning" style="font-size:0.75rem;padding:3px 8px;">⚠️ Retake Needed</span>`;
        const statusBadgeMobile = isPassed
          ? `<span style="color:#10b981;font-weight:700;">✓ Passed</span>`
          : `<span style="color:#f59e0b;font-weight:700;">⚠️ Retake</span>`;

        const attemptId = escapeHtml(a.id);
        const navLink = `window.location.href='result.html?attempt_id=${attemptId}'`;

        // Desktop Row
        tableHtml += `
          <tr onclick="${navLink}">
            <td>
              <div class="fw-700" style="color:var(--clr-text-1);">${escapeHtml(AssessmentTitle)}</div>
              ${AssessmentType ? `<div class="text-xs text-muted mt-1" style="font-size:0.75rem;">${escapeHtml(AssessmentType)}</div>` : ''}
            </td>
            <td>
              <span class="badge badge-neutral" style="font-size:0.75rem;">${escapeHtml(ClassName)}</span>
            </td>
            <td>
              <span class="fw-700 text-grade-${grade}" style="font-size:1rem;">${pct}%</span>
            </td>
            <td>
              <span class="grade-badge grade-${grade}" style="width:28px;height:28px;font-size:0.82rem;display:inline-flex;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.2);color:${gradeColor};border:1.5px solid ${gradeColor};">${grade}</span>
            </td>
            <td class="text-muted text-sm">
              ${escapeHtml(dateStr)}
            </td>
            <td>
              ${statusBadgeDesktop}
            </td>
          </tr>
        `;

        // Mobile Card
        mobileListHtml += `
          <div class="completed-Assessment-mobile-card" onclick="${navLink}">
            <div class="Assessment-card-header">
              <div class="Assessment-card-title">${escapeHtml(AssessmentTitle)}</div>
              <span class="grade-badge grade-${grade}" style="width:26px;height:26px;font-size:0.75rem;display:inline-flex;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.2);color:${gradeColor};border:1.5px solid ${gradeColor};flex-shrink:0;">${grade}</span>
            </div>
            <div class="Assessment-card-badges">
              <span class="badge badge-neutral" style="font-size:0.65rem;padding:2px 6px;">${escapeHtml(ClassName)}</span>
              ${AssessmentType ? `<span class="badge badge-neutral" style="font-size:0.65rem;padding:2px 6px;background:rgba(255,255,255,0.02);">${escapeHtml(AssessmentType)}</span>` : ''}
            </div>
            <div class="Assessment-card-footer">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="color:var(--clr-text-3);">Score: <strong style="color:var(--clr-text-1);">${pct}%</strong></span>
                <span style="color:var(--clr-text-3);">&bull;</span>
                <span>${statusBadgeMobile}</span>
              </div>
              <div style="color:var(--clr-text-4);">${escapeHtml(dateStr)}</div>
            </div>
          </div>
        `;
      });

      tableHtml += `
            </tbody>
          </table>
        </div>
      `;

      mobileListHtml += `
        </div>
      `;

      if (container) {
        container.innerHTML = tableHtml + mobileListHtml;
      }
    }

    // --- Profile Modal & History ---
    function setupProfileModal(attempts) {
      const modal = document.getElementById('profile-modal');
      const openBtn = document.getElementById('view-profile-btn');
      const closeBtn = document.getElementById('close-profile-modal');

      document.getElementById('prof-student-name').textContent = session.student_name;
      document.getElementById('prof-student-prog').textContent = `Institution: ${session.institution_name}`;
      document.getElementById('prof-student-class').textContent = `Program: ${session.program_name}`;
      const batchEl = document.getElementById('prof-student-batch');
      if (batchEl) {
        if (session.batch_name) {
          batchEl.textContent = `Batch: ${session.batch_name}`;
          batchEl.classList.remove('hidden');
        } else {
          batchEl.classList.add('hidden');
        }
      }

      // Fetch and display existing student photo
      (async () => {
        try {
          const sb = await (await import('./js/supabase.js')).getSupabase();
          const { data: st } = await sb.from('students').select('photo_url').eq('id', session.student_id).single();
          if (st?.photo_url) applyPhotoEverywhere(st.photo_url);
        } catch {}
      })();

      const tbody = document.getElementById('tbl-profile-history');
      if (tbody) tbody.innerHTML = '';

      if (!attempts.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-4">No completed Assessments yet.</td></tr>';
      } else {
        attempts.forEach(a => {
          const tr = document.createElement('tr');
          const title = a.Assessments ? `${a.Assessments.Assessment_type || ''} — ${a.Assessments.name || 'Assessment'}` : 'Assessment';
          const pct = parseFloat(a.percentage || 0).toFixed(1);
          const grade = a.grade || getGrade(pct);

          tr.innerHTML = `
            <td class="fw-600">${title}</td>
            <td class="fw-700 text-grade-${grade}">${pct}%</td>
            <td><span class="grade-badge grade-${grade}" style="width:24px;height:24px;font-size:0.75rem;display:inline-flex;">${grade}</span></td>
            <td class="text-muted text-sm">${a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : '—'}</td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Photo upload click handler
      const avatarContainer = document.getElementById('avatar-container');
      const fileInput = document.getElementById('photo-file-input');

      avatarContainer.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          showToast('Ukuran foto terlalu besar. Maksimal 2MB.', 'warning');
          return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
          const base64 = evt.target.result;
          showLoading('Mengunggah foto profil…');
          try {
            await uploadStudentPhoto(session.student_id, base64);
            applyPhotoEverywhere(base64);
            hideLoading();
            showToast('Profile photo updated successfully!', 'success');
          } catch(err) {
            hideLoading();
            showToast('Failed to upload photo: ' + err.message, 'error');
          }
        };
        reader.readAsDataURL(file);
      });

      // Change PIN Form Handler
      const changePinForm = document.getElementById('change-pin-form');
      
      const pinInputs = changePinForm.querySelectorAll('input');
      pinInputs.forEach(input => {
        input.addEventListener('input', () => {
          window.isProfileDirty = true;
        });
      });

      changePinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPin = document.getElementById('pin-old').value.trim();
        const newPin = document.getElementById('pin-new').value.trim();
        const confirmPin = document.getElementById('pin-confirm').value.trim();

        if (newPin !== confirmPin) {
          showToast('New PIN confirmation does not match.', 'warning');
          return;
        }
        if (newPin.length < 4) {
          showToast('PIN baru minimal 4 digit angka.', 'warning');
          return;
        }

        showLoading('Mengubah PIN…');
        try {
          await updateStudentPin(session.student_id, oldPin, newPin);
          hideLoading();
          showToast('PIN updated successfully!', 'success');
          changePinForm.reset();
          window.isProfileDirty = false;
        } catch(err) {
          hideLoading();
          showToast(err.message, 'error');
        }
      });

      // Gender & Title Buttons in Profile Modal
      document.getElementById('btn-prof-male')?.addEventListener('click', async () => {
        if (session.gender === 'male') return;
        showLoading('Updating title to Mr.…');
        try {
          await updateStudentGender(session.student_id, 'male');
          applyStudentGenderUI('male');
          hideLoading();
          showToast('Title updated to Mr.!', 'success');
        } catch(err) {
          hideLoading();
          showToast('Failed to update gender: ' + err.message, 'error');
        }
      });

      document.getElementById('btn-prof-female')?.addEventListener('click', async () => {
        if (session.gender === 'female') return;
        showLoading('Updating title to Miss.…');
        try {
          await updateStudentGender(session.student_id, 'female');
          applyStudentGenderUI('female');
          hideLoading();
          showToast('Title updated to Miss!', 'success');
        } catch(err) {
          hideLoading();
          showToast('Failed to update gender: ' + err.message, 'error');
        }
      });

      openBtn.addEventListener('click', () => {
        applyStudentGenderUI(session.gender);
        window.isProfileDirty = false;
        if(changePinForm) changePinForm.reset();
        modal.classList.remove('hidden');
      });
      closeBtn.addEventListener('click', () => {
        if (window.isProfileDirty) {
          if (!confirm('You have unsaved changes. Are you sure you want to close?')) return;
        }
        window.isProfileDirty = false;
        if(changePinForm) changePinForm.reset();
        modal.classList.add('hidden');
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (window.isProfileDirty) {
            if (!confirm('You have unsaved changes. Are you sure you want to close?')) return;
          }
          window.isProfileDirty = false;
          if(changePinForm) changePinForm.reset();
          modal.classList.add('hidden');
        }
      });

      // Header avatar also opens profile modal
      document.getElementById('header-avatar').addEventListener('click', () => {
        applyStudentGenderUI(session.gender);
        window.isProfileDirty = false;
        if(changePinForm) changePinForm.reset();
        modal.classList.remove('hidden');
      });
    }

    // --- Level Modal close ---
    document.getElementById('close-level-modal').addEventListener('click', () => {
      document.getElementById('level-modal').classList.add('hidden');
    });
    document.getElementById('level-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
    });

    // --- Gamification: Show Level Up Popup ---
    window.showLevelUpPopup = function(newLevel) {
      const overlay = document.getElementById('level-up-overlay');
      const badgeText = document.getElementById('lu-badge-text');
      badgeText.textContent = newLevel;
      
      // Make it visible
      overlay.classList.add('active');

      // Trigger Confetti (using Canvas Confetti library if included, otherwise skip or use a custom one)
      if (window.confetti) {
        window.confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          zIndex: 10000
        });
      }
    };

    // Close Gamification Popup
    document.getElementById('close-levelup-btn').addEventListener('click', () => {
      document.getElementById('level-up-overlay').classList.remove('active');
    });

    loadDashboard();
  