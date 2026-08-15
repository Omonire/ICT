'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[error-boundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="text-[15px] font-semibold text-slate-900">Something went wrong</h2>
          <p className="max-w-md text-[13px] text-slate-500">
            {this.state.error.message || 'An unexpected error occurred while rendering this view.'}
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" /> Reload page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
