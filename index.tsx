import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
  } else {
    void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((reg) => reg.unregister())).catch(() => undefined);
    void caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => undefined);
  }
}
