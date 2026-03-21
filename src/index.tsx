import { render } from 'solid-js/web';
import './styles.css';
import './shared/observability/earlyErrors';
import AppRouter from './app/router';
import { initPWAListeners } from './shared/pwa/pwaLifecycle';
import { ObservableErrorBoundary } from './shared/observability/ErrorBoundary';
import { initSentry } from './shared/observability/sentry';

initPWAListeners();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

render(() => (
  <ObservableErrorBoundary feature="root">
    <AppRouter />
  </ObservableErrorBoundary>
), root);

// Lazy-load Sentry after render (Web Vitals wired in Task 11)
const scheduleIdle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1));
scheduleIdle(() => { initSentry(); });
