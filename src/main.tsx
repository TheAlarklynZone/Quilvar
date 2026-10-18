import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { QuickDrawWindow } from './components/QuickDrawWindow';
import './styles/globals.css';

// The same bundle powers the main window and the floating Quick Draw overlay.
const isQuickDrawWindow = window.location.hash === '#quickdraw';
if (isQuickDrawWindow) document.documentElement.classList.add('qd-window');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isQuickDrawWindow ? <QuickDrawWindow /> : <App />}
  </React.StrictMode>
);
