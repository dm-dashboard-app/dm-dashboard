import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './components.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// When the phone locks or the tab is hidden for more than 30 seconds,
// force a full reload when it comes back so polling and state are fresh.
let hiddenAt = null;
const RELOAD_AFTER_MS = 30000;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
  } else if (document.visibilityState === 'visible') {
    if (hiddenAt && Date.now() - hiddenAt > RELOAD_AFTER_MS) {
      window.location.reload();
    }
    hiddenAt = null;
  }
});