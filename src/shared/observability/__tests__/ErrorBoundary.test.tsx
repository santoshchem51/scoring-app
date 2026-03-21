import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { ObservableErrorBoundary } from '../ErrorBoundary';
import { logger } from '../logger';

function ThrowingComponent(): never {
  throw new Error('render crash');
}

describe('ObservableErrorBoundary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(() => (
      <ObservableErrorBoundary feature="test">
        <div>hello</div>
      </ObservableErrorBoundary>
    ));
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('renders fallback UI when child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(() => (
      <ObservableErrorBoundary feature="test">
        <ThrowingComponent />
      </ObservableErrorBoundary>
    ));
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
  });

  it('calls logger.error when child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, 'error');
    render(() => (
      <ObservableErrorBoundary feature="scoring">
        <ThrowingComponent />
      </ObservableErrorBoundary>
    ));
    expect(errorSpy).toHaveBeenCalledWith(
      'ErrorBoundary caught error',
      expect.objectContaining({ feature: 'scoring' })
    );
  });

  it('uses custom fallback when provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(() => (
      <ObservableErrorBoundary
        feature="test"
        fallback={(err, reset) => <div>Custom: {String(err)}</div>}
      >
        <ThrowingComponent />
      </ObservableErrorBoundary>
    ));
    expect(screen.getByText(/Custom:/)).toBeTruthy();
  });

  it('Try Again button resets the error boundary', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let thrown = false;
    function ThrowOnce(): any {
      if (!thrown) {
        thrown = true;
        throw new Error('once');
      }
      return <div>recovered</div>;
    }
    render(() => (
      <ObservableErrorBoundary feature="test">
        <ThrowOnce />
      </ObservableErrorBoundary>
    ));
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    fireEvent.click(screen.getByText('Try Again'));
    expect(screen.getByText('recovered')).toBeTruthy();
  });
});
