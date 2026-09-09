// TOP ENGLISH CLASS — Web Speech Recognition Module
// Supports: English US, English UK. Audio is NOT stored.
// Provides: retry, permission, unsupported-browser states.

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/**
 * Check browser support.
 */
export function isSpeechSupported() {
  return !!SpeechRecognition;
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
