// TOP ENGLISH CLASS — Toast Notification System
let toastContainer = null;

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

/**
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration ms
 */
export function showToast(message, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  getContainer().appendChild(el);

  const remove = () => {
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };

  const timer = setTimeout(remove, duration);
  el.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

// TOP ENGLISH CLASS — Loading overlay helpers
let _overlay = null;

export function showLoading(message = 'Loading…') {
  if (!_overlay) {
    _overlay = document.createElement('div');
    _overlay.className = 'loading-overlay';
    document.body.appendChild(_overlay);
  }
  _overlay.innerHTML = `
    <div class="spinner"></div>
    <p style="color:var(--clr-text-2);font-size:0.9rem;">${message}</p>
  `;
  _overlay.style.display = 'flex';
}

export function hideLoading() {
  if (_overlay) _overlay.style.display = 'none';
}

// TOP ENGLISH CLASS — Scoring & Grade (client-display only, NOT authoritative)
// The authoritative calculation is in submit-exam Edge Function.

/** Escape HTML special characters */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Display-only grade lookup — mirrors AGENTS.md §2.10 */
export function getGrade(pct) {
  const p = parseFloat(pct);
  if (p === 100) return 'S';
  if (p >= 91)  return 'A';
  if (p >= 71)  return 'B';
  if (p >= 51)  return 'C';
  if (p >= 31)  return 'D';
  if (p >= 11)  return 'E';
  return 'F';
}

/** Format seconds to MM:SS */
export function formatTime(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Truncate text to maxLen chars */
export function truncate(str, maxLen = 60) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

/** Safely parse JSON or return fallback */
export function safeJsonParse(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

/** Create DOM element with attributes */
export function el(tag, attrs = {}, children = []) {
  const elem = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') elem.className = v;
    else if (k.startsWith('data-')) elem.setAttribute(k, v);
    else elem[k] = v;
  }
  for (const child of children) {
    if (typeof child === 'string') elem.insertAdjacentHTML('beforeend', child);
    else if (child) elem.appendChild(child);
  }
  return elem;
}

/** Delegate event (for dynamic lists) */
export function delegate(parent, selector, event, handler) {
  parent.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && parent.contains(target)) handler(e, target);
  });
}

/** Debounce utility */
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Scroll a panel to top */
export function scrollTop(el) {
  if (el) el.scrollTop = 0;
}
