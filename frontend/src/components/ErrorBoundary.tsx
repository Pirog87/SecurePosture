import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--red, #ef4444)", marginBottom: 12 }}>
            Wystapil blad w aplikacji
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted, #888)", marginBottom: 16, maxWidth: 500, margin: "0 auto 16px" }}>
            {this.state.error?.message || "Nieznany blad"}
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              padding: "8px 20px", fontSize: 13, cursor: "pointer",
              background: "var(--blue, #3b82f6)", color: "#fff", border: "none", borderRadius: 6,
            }}
          >
            Odswierz strone
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
