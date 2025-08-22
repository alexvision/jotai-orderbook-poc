import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'jotai';
import { DevTools } from 'jotai-devtools';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider>
      <DevTools />
      <App />
    </Provider>
  </React.StrictMode>
);
