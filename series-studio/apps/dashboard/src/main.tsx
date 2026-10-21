import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { connectLive } from './live';
import { getToken } from './api';
import './styles.css';

getToken(); // capture ?token= before anything else
connectLive();
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
