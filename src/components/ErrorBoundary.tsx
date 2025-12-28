import * as React from "react";
import { Button } from "@/components/ui/button";

type ErrorBoundaryState = {
  hasError: boolean;
  error?: unknown;
};

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Keep this console output: it helps pinpoint which component caused the crash.
    // eslint-disable-next-line no-console
    console.error("UI crashed in ErrorBoundary", { error, info });
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message =
      this.state.error instanceof Error
        ? this.state.error.message
        : "Something went wrong while rendering.";

    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-bold">We hit a rendering error</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {message}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={this.handleReload}>Reload</Button>
            <Button variant="outline" onClick={() => history.back()}>
              Go back
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            If this keeps happening, it’s usually an import/export mismatch (a component
            is <code>undefined</code>), or a cached bundle after a refactor. Reloading
            typically fixes it.
          </p>
        </section>
      </main>
    );
  }
}
