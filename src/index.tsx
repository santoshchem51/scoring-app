import { render } from 'solid-js/web';
import './styles.css';
import AppRouter from './app/router';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

render(() => <AppRouter />, root);
