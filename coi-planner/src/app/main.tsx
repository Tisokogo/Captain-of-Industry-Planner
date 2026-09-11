import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import './styles/styles.css';
import './styles/diagram.css';
import './styles/simple-results.css';
import './styles/responsive.css';
import '../shared/error-boundary.css';
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
