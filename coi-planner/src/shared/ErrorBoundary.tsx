import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Harbor planner render failure', error, info.componentStack);
  }

  private downloadDiagnostics = () => {
    const payload = {
      timestamp: new Date().toISOString(),
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      plan: localStorage.getItem('harbor-plan'),
      userAgent: navigator.userAgent,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'harbor-diagnostics.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <h1>Harbor Production Planner</h1>
        <p>Die Oberfläche konnte nicht vollständig geladen werden.</p>
        <code>{this.state.error.message}</code>
        <div>
          <button onClick={() => location.reload()}>Neu laden</button>
          <button onClick={this.downloadDiagnostics}>Diagnose herunterladen</button>
        </div>
      </main>
    );
  }
}
