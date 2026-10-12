import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { loadDesktopClubEdits } from './data/editorPersistence';
import { initObservability } from './observability/sentry';
import { AccessGatekeeper } from './components/AccessGatekeeper';

// Initialize Sentry / Observability
initObservability();

async function start() {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  try {
    await loadDesktopClubEdits();
    root.render(
      <React.StrictMode>
        <AccessGatekeeper>
          <App />
        </AccessGatekeeper>
      </React.StrictMode>
    );
  } catch (error) {
    root.render(<div style={{ padding: 24, color: 'white', background: '#09120e', minHeight: '100vh' }}>
      <h1>Não foi possível carregar a base editada.</h1>
      <p>{String(error)}</p>
      <button onClick={() => location.reload()}>Tentar novamente</button>
    </div>);
  }
}

void start();
