import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-line p-6">
          <div className="max-w-md rounded-lg border border-ink/10 bg-white p-8 text-center shadow-soft">
            <h1 className="font-display text-2xl font-bold text-ink">Algo salio mal</h1>
            <p className="mt-3 text-sm text-ink/65">
              Ocurrio un error inesperado. Recarga la pagina para intentar de nuevo.
            </p>
            <button
              className="btn-primary mt-5"
              onClick={() => window.location.reload()}
              type="button"
            >
              Recargar pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
