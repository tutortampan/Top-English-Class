// TOP ENGLISH CLASS — Web Speech Recognition Module
// Supports: English US, English UK. Audio is NOT stored.
// Provides: retry, permission, unsupported-browser states.

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/**
 * Check browser speech recognition support.
 */
export function isSpeechSupported() {
  return !!SpeechRecognition;
}

/**
 * Detect supported audio MIME types across Chrome, Safari, iOS, Android, Firefox.
 * Avoids hardcoding one format.
 */
export function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/wav'
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return ''; // Browser default
}

/**
 * Comprehensive Microphone Capability & Permission Detection (Phase 12)
 * Tests HTTPS, device presence, getUserMedia, and cleans up tracks immediately.
 */
export async function testMicrophoneCapability() {
  // 1. Security Context / HTTPS Check
  if (window.isSecureContext === false && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return {
      ok: false,
      state: 'insecure_context',
      message: 'Microphone requires a secure HTTPS connection. Please access via HTTPS.'
    };
  }

  // 2. API Support Check
  if (!navigator?.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      state: 'unsupported_browser',
      message: 'Your browser or device does not support audio recording (getUserMedia is unavailable).'
    };
  }

  // 3. Permission Query (if supported by Permissions API)
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const perm = await navigator.permissions.query({ name: 'microphone' });
      if (perm.state === 'denied') {
        return {
          ok: false,
          state: 'permission_denied',
          message: 'Microphone access is blocked in your browser settings. Please click the lock/settings icon in the address bar to allow microphone access.'
        };
      }
    } catch (_) {
      // Permissions API for microphone is not supported in all browsers (e.g. Safari), continue
    }
  }

  // 4. Active Device Stream Test & Immediate Cleanup
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    // Check if audio tracks are active
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length || !audioTracks[0].enabled) {
      throw new Error('No active audio tracks received from microphone.');
    }

    const mimeType = getSupportedAudioMimeType();

    return {
      ok: true,
      state: 'granted',
      mimeType,
      message: 'Microphone is active and working properly.'
    };
  } catch (err) {
    let state = 'hardware_error';
    let message = err.message || 'Microphone error.';

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      state = 'permission_denied';
      message = 'Microphone permission was denied. Please allow microphone access to take speech exams.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      state = 'no_device';
      message = 'No microphone device was detected on your phone or computer. Please connect a microphone or headset.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      state = 'in_use';
      message = 'Microphone is already in use by another application. Please close other voice/call apps and try again.';
    } else if (err.name === 'OverconstrainedError') {
      state = 'unsupported_constraints';
      message = 'Requested microphone audio settings are not supported by your hardware.';
    }

    return { ok: false, state, message, error: err };
  } finally {
    // ALWAYS clean up tracks immediately so hardware indicator turns off
    if (stream) {
      try {
        stream.getTracks().forEach(track => {
          track.stop();
          stream.removeTrack(track);
        });
      } catch (_) {}
    }
  }
}

/**
 * Create a speech recognition session.
 * @param {Object} options
 * @param {string} options.lang - 'en-US' or 'en-GB'
 * @param {Function} options.onResult(transcript) - called with interim/final transcript
 * @param {Function} options.onFinal(transcript) - called on final result
 * @param {Function} options.onError(errorMessage) - called on error
 * @param {Function} options.onStart() - mic started
 * @param {Function} options.onEnd() - mic stopped
 * @returns {{ start, stop, isListening }}
 */
export function createSpeechSession({
  lang = 'en-US',
  onResult,
  onFinal,
  onError,
  onStart,
  onEnd,
} = {}) {
  if (!isSpeechSupported()) {
    onError?.('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
    return { start: () => {}, stop: () => {}, isListening: () => false };
  }

  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let _listening = false;

  recognition.onstart = () => {
    _listening = true;
    onStart?.();
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += t;
      } else {
        interim += t;
      }
    }
    if (interim) onResult?.(interim);
    if (final)   onFinal?.(normalizeTranscript(final));
  };

  recognition.onerror = (event) => {
    _listening = false;
    const messages = {
      'no-speech':         'No speech was detected. Please try again.',
      'audio-capture':     'Microphone not found. Please check your device settings.',
      'not-allowed':       'Microphone permission was denied. Please allow access in your browser settings.',
      'network':           'Network error during recognition. Please check your connection.',
      'aborted':           'Recognition was aborted.',
      'service-not-allowed': 'Speech service not allowed. Please check browser settings.',
    };
    onError?.(messages[event.error] || `Recognition error: ${event.error}`);
  };

  recognition.onend = () => {
    _listening = false;
    onEnd?.();
  };

  return {
    start() {
      if (!_listening) {
        try {
          recognition.start();
        } catch (e) {
          onError?.(`Could not start recognition: ${e.message}`);
        }
      }
    },
    stop() {
      if (_listening) {
        try { recognition.stop(); } catch {}
      }
    },
    isListening() { return _listening; },
  };
}

/**
 * Normalize transcript:
 * - lowercase, trim
 * - "I'm" -> "I am"
 * - "I've" -> "I have" etc. for common contractions
 */
function normalizeTranscript(text) {
  return text
    .trim()
    .replace(/\bi'm\b/gi, 'I am')
    .replace(/\bi've\b/gi, 'I have')
    .replace(/\bi'll\b/gi, 'I will')
    .replace(/\bi'd\b/gi, 'I would')
    .replace(/\bdon't\b/gi, 'do not')
    .replace(/\bdoesn't\b/gi, 'does not')
    .replace(/\bcan't\b/gi, 'cannot')
    .replace(/\bwon't\b/gi, 'will not')
    .replace(/\baren't\b/gi, 'are not')
    .replace(/\bwasn't\b/gi, 'was not')
    .replace(/\bweren't\b/gi, 'were not')
    .replace(/\bhasn't\b/gi, 'has not')
    .replace(/\bhaven't\b/gi, 'have not')
    .replace(/\bhadn't\b/gi, 'had not');
}
