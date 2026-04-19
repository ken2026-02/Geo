import React from 'react';
import { recordRuntimeError } from '../utils/runtimeErrorLog';

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<{ children?: React.ReactNode }, AppErrorBoundaryState> {
  declare props: { children?: React.ReactNode };

  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    recordRuntimeError('react-error-boundary', error, {
      componentStack: errorInfo.componentStack,
    });
    console.error('[APP] React render error', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-6 p-10 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold text-red-600">A screen error occurred</h1>
            <p className="text-sm text-zinc-500">
              The error was recorded locally. Reload the app or open Diagnostics to review the log.
            </p>
          </div>
          <button
            onClick={this.handleReload}
            className="rounded-xl bg-zinc-900 px-6 py-3 font-bold text-white shadow-lg"
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}


