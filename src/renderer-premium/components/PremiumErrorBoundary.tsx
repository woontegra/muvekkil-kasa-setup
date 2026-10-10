import { Component, type ErrorInfo, type ReactNode } from "react";
import { premiumRestartHint } from "../lib/bootErrorHint";

type Props = { children: ReactNode };
type State = { error: Error | null; retryKey: number; showDetail: boolean };

export class PremiumErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0, showDetail: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, showDetail: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[premium] render error", error, info.componentStack);
  }

  componentDidMount() {
    window.addEventListener("hashchange", this.handleHashChange);
  }

  componentWillUnmount() {
    window.removeEventListener("hashchange", this.handleHashChange);
  }

  handleHashChange = () => {
    if (this.state.error) {
      this.setState({ error: null, retryKey: this.state.retryKey + 1, showDetail: false });
    }
  };

  handleRetry = () => {
    this.setState((s) => ({ error: null, retryKey: s.retryKey + 1, showDetail: false }));
  };

  render() {
    if (this.state.error) {
      const detail = this.state.error.message?.trim() || "Bilinmeyen hata";
      return (
        <div className="pm-error-boundary">
          <div className="pm-error-boundary-card" role="alert">
            <h2 className="pm-error-boundary-title">Arayüz yüklenemedi</h2>
            <p className="pm-error-boundary-desc">
              Beklenmeyen bir hata oluştu. Aşağıdaki düğmeyle yeniden deneyin veya {premiumRestartHint()}
            </p>
            <details
              className="pm-error-boundary-details"
              open={this.state.showDetail}
              onToggle={(e) => this.setState({ showDetail: (e.target as HTMLDetailsElement).open })}
            >
              <summary>Teknik detay</summary>
              <pre className="pm-error-boundary-pre">{detail}</pre>
            </details>
            <div className="pm-error-boundary-actions">
              <button type="button" className="pm-btn pm-btn--primary" onClick={this.handleRetry}>
                Tekrar dene
              </button>
              <button type="button" className="pm-btn pm-btn--ghost" onClick={() => window.location.reload()}>
                Sayfayı yenile
              </button>
            </div>
          </div>
        </div>
      );
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
