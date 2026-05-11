import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeLiff } from './lib/liff';

async function bootstrap() {
  await initializeLiff();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
