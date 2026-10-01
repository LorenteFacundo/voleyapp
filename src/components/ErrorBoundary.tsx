import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/lib/monitoring';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(error, errorInfo.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-line p-6">
        <div role="alert" className="max-w-md rounded-2xl border border-ink/10 bg-white p-8 text-center shadow-soft">
          <h1 className="font-display text-2xl font-bold text-ink">Algo salió mal</h1>
          <p className="mt-3 text-sm text-ink/65">
            Ocurrió un error inesperado. Recargá la página para intentar de nuevo.
          </p>
          <button
            className="mt-5 min-h-11 rounded-xl bg-vb-orange px-5 text-sm font-bold text-white hover:bg-vb-orange/90"
            onClick={() => window.location.reload()}
            type="button"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }
}
