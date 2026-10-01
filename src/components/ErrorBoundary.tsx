import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { friendlyErrorMessage, isChunkLoadError } from "@/lib/errors";

interface Props {
  children: ReactNode;
  /** Muda quando a rota muda, para limpar o erro ao navegar */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/** Evita a tela branca: mostra uma mensagem amigável quando uma página quebra. */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro na interface:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkLoadError(error);
    return (
      <div role="alert" className="min-h-[50vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="h-10 w-10 mx-auto text-warning" aria-hidden />
          <h1 className="text-xl font-semibold">Ops, algo deu errado nesta tela</h1>
          <p className="text-sm text-muted-foreground">{friendlyErrorMessage(error)}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {chunk ? (
              <Button onClick={() => window.location.reload()} className="gap-2">
                <RefreshCw className="h-4 w-4" aria-hidden />Recarregar página
              </Button>
            ) : (
              <Button onClick={() => this.setState({ error: null })} className="gap-2">
                <RefreshCw className="h-4 w-4" aria-hidden />Tentar de novo
              </Button>
            )}
            <Button variant="outline" onClick={() => { window.location.href = "/"; }}>
              Voltar ao início
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
