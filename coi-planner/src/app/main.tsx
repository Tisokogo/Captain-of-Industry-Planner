import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import './styles/styles.css';
import './styles/diagram.css';
import './styles/simple-results.css';
import './styles/responsive.css';
import '../shared/error-boundary.css';
async function loadCurrentExport() {
  try {
    const response = await fetch('http://127.0.0.1:4174/api/current-data');
    if (!response.ok) return;
    const result = await response.json();
    if (result.available && result.data) {
      localStorage.setItem('harbor-current-export', JSON.stringify(result.data));
      localStorage.setItem('harbor-current-export-meta', JSON.stringify(result));
    }
  } catch {
    // Static hosting and manual starts use the bundled, validated fallback data.
  }
}

await loadCurrentExport();
const { App } = await import('./App');
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
