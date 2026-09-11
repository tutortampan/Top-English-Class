// TOP ENGLISH CLASS — Server-Authoritative Timer Module
// Client timer is UI-only. Server validates deadline on submit.

/** 
 * @param {string} expectedEndAtISO - ISO string from server
 * @param {Object} options
 * @param {Function} options.onTick(remainingSeconds)
 * @param {Function} options.onWarning(remainingSeconds) - called at 5min and 2min marks
 * @param {Function} options.onExpire() - called when timer reaches zero
 * @returns {{ stop: Function }}
 */
export function startCountdown(expectedEndAtISO, { onTick, onWarning, onExpire } = {}) {
  const endTime = new Date(expectedEndAtISO).getTime();
  let intervalId = null;
  let warningFired5 = false;
  let warningFired2 = false;

  function tick() {
    const remaining = Math.floor((endTime - Date.now()) / 1000);

    if (remaining <= 0) {
      clearInterval(intervalId);
      onTick?.(0);
      onExpire?.();
      return;
    }

    onTick?.(remaining);

    // Warning at 5 minutes
    if (!warningFired5 && remaining <= 300) {
      warningFired5 = true;
      onWarning?.(remaining);
    }

    // Warning at 2 minutes
    if (!warningFired2 && remaining <= 120) {
      warningFired2 = true;
      onWarning?.(remaining);
    }
  }

  tick(); // immediate first call
  intervalId = setInterval(tick, 1000);

  return {
    stop() { clearInterval(intervalId); },
    getRemainingSeconds() {
      return Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    }
  };
}

/** Returns true if the server deadline has passed */
export function isExpired(expectedEndAtISO) {
  return new Date(expectedEndAtISO).getTime() < Date.now();
}
