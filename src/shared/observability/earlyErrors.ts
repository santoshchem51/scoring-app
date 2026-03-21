const MAX_BUFFER = 20;
const earlyErrors: { error: unknown; timestamp: number }[] = [];
let flushed = false;

function onError(error: unknown) {
  if (flushed) return;
  if (earlyErrors.length < MAX_BUFFER) {
    earlyErrors.push({ error, timestamp: Date.now() });
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => onError(e.error));
  window.addEventListener('unhandledrejection', (e) => onError(e.reason));
}

export function flushEarlyErrors(captureException: (err: unknown) => void) {
  for (const { error } of earlyErrors) {
    captureException(error);
  }
  earlyErrors.length = 0;
  flushed = true;
}

export function getEarlyErrorCount() {
  return earlyErrors.length;
}

/** @internal - for testing only */
export function simulateError(error: unknown) {
  onError(error);
}
