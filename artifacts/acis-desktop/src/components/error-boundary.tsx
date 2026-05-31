import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  pageName?: string;
}
interface State {
  error: Error | null;
  info: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ACIS ErrorBoundary]", error, errorInfo);
  }

  reset = () => this.setState({ error: null, info: "" });

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8" dir="rtl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <div className="text-center space-y-2 max-w-md">
            <h2 className="text-xl font-bold text-foreground">
              حدث خطأ في {this.props.pageName || "هذه الصفحة"}
            </h2>
            <p className="text-sm text-muted-foreground">
              واجه النظام خطأً غير متوقع. يمكنك إعادة المحاولة أو العودة للوحة القيادة.
            </p>
            <details className="text-left mt-3">
              <summary className="text-xs font-mono text-muted-foreground/50 cursor-pointer hover:text-muted-foreground">
                تفاصيل الخطأ
              </summary>
              <pre className="mt-2 text-[10px] font-mono bg-secondary/50 border border-border/50 rounded p-3 text-red-300/70 overflow-auto max-h-32 text-left">
                {this.state.error.toString()}
              </pre>
            </details>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={this.reset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors text-sm font-medium"
            >
              <RefreshCw size={14} />
              إعادة المحاولة
            </button>
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground border border-border/50 hover:bg-secondary/80 transition-colors text-sm font-medium"
            >
              <Home size={14} />
              لوحة القيادة
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
