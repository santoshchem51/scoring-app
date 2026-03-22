type Sink = (level: string, msg: string, data?: unknown) => void;
const sinks: Sink[] = [];

export function registerSink(sink: Sink) {
  sinks.push(sink);
}

export function removeSink(sink: Sink) {
  const idx = sinks.indexOf(sink);
  if (idx !== -1) sinks.splice(idx, 1);
}

function emit(level: string, msg: string, data?: unknown) {
  try {
    const consoleFn = (console as unknown as Record<string, unknown>)[level];
    if (typeof consoleFn === 'function') {
      consoleFn.call(console, msg, data);
    } else {
      console.log(msg, data);
    }
    const snapshot = [...sinks];
    for (const sink of snapshot) {
      try {
        sink(level, msg, data);
      } catch {
        // sink failures never propagate
      }
    }
  } catch {
    console.error('[logger-fallback]', msg, data);
  }
}

export const logger = {
  debug: (msg: string, data?: unknown) => emit('debug', msg, data),
  info: (msg: string, data?: unknown) => emit('info', msg, data),
  warn: (msg: string, data?: unknown) => emit('warn', msg, data),
  error: (msg: string, data?: unknown) => emit('error', msg, data),
};
