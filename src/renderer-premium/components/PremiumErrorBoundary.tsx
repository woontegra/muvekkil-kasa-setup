import { Component, type ErrorInfo, type ReactNode } from "react";
import { premiumRestartHint } from "../lib/bootErrorHint";

type Props = { children: ReactNode };
type State = { error: Error | null; retryKey: number };

export class PremiumErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
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
      this.setState({ error: null, retryKey: this.state.retryKey + 1 });
    }
  };

  handleRetry = () => {
    this.setState((s) => ({ error: null, retryKey: s.retryKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <div
          className="pm-auth-page pm-auth-page--loading"
          style={{ background: "#f1f5f9", minHeight: "100vh" }}
        >
          <div
            className="pm-auth-card"
            style={{
              maxWidth: 520,
              padding: 24,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              boxShadow: "0 8px 24px rgba(15,23,42,.08)",
            }}
          >
            <h2 style={{ margin: "0 0 12px", color: "#0f2744" }}>Arayüz yüklenemedi</h2>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
              Beklenmeyen bir hata oluştu. Aşağıdaki düğmeyle yeniden deneyin veya {premiumRestartHint()}
            </p>
            <pre
              style={{
                margin: "0 0 16px",
                padding: 12,
                borderRadius: 8,
                background: "#fef2f2",
                color: "#b91c1c",
                fontSize: 12,
                overflow: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {this.state.error.message}
            </pre>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
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
