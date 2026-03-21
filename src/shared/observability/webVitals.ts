import { logger } from './logger';

export function initWebVitals() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    // LCP
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lcp = entries[entries.length - 1];
      if (lcp) logger.info('web_vital:LCP', { value: Math.round(lcp.startTime) });
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* unsupported entry type */ }

  // CLS — accumulate, report on page hide
  let clsValue = 0;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) clsValue += (entry as any).value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* unsupported */ }

  // INP — buffer worst value, report on page hide (NOT per-interaction)
  let worstInp = 0;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        worstInp = Math.max(worstInp, entry.duration);
      }
    }).observe({ type: 'event', buffered: true });
  } catch { /* unsupported */ }

  // Report on page hide
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // CLS is a unitless float (typically 0-1). Multiply by 1000 for integer
      // precision in logging. Dashboard consumers must divide by 1000.
      if (clsValue > 0) logger.info('web_vital:CLS', { value: Math.round(clsValue * 1000) });
      if (worstInp > 0) logger.info('web_vital:INP', { value: Math.round(worstInp) });
    }
  });
}
