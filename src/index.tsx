import { render } from 'solid-js/web';
import './styles.css';
import AppRouter from './app/router';
import { initPWAListeners } from './shared/pwa/pwaLifecycle';

initPWAListeners();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

render(() => <AppRouter />, root);
