import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

function ThrowingComponent(): never {
  throw new Error('render crash');
}

describe('ObservableErrorBoundary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    // Suppress SolidJS framework console.error noise when components throw
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error', async () => {
    const { ObservableErrorBoundary } = await import('../ErrorBoundary');
    render(() => (
      <ObservableErrorBoundary feature="test">
        <div>hello</div>
      </ObservableErrorBoundary>
    ));
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('renders fallback UI when child throws', async () => {
    const { ObservableErrorBoundary } = await import('../ErrorBoundary');
    render(() => (
      <ObservableErrorBoundary feature="test">
        <ThrowingComponent />
      </ObservableErrorBoundary>
    ));
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
  });

  it('passes original error directly to logger.error (not wrapped in object)', async () => {
    const { logger } = await import('../logger');
    const errorSpy = vi.spyOn(logger, 'error');
    const { ObservableErrorBoundary } = await import('../ErrorBoundary');
    render(() => (
      <ObservableErrorBoundary feature="scoring">
        <ThrowingComponent />
      </ObservableErrorBoundary>
    ));
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'ErrorBoundary caught error',
      expect.any(Error)
    );
    // The second argument must be the Error itself, not an object wrapping it
    const passedData = errorSpy.mock.calls[0][1];
    expect(passedData).toBeInstanceOf(Error);
    expect((passedData as Error).message).toBe('render crash');
  });

  it('logs feature context as info breadcrumb before the error', async () => {
    const { logger } = await import('../logger');
    const infoSpy = vi.spyOn(logger, 'info');
    const { ObservableErrorBoundary } = await import('../ErrorBoundary');
    render(() => (
      <ObservableErrorBoundary feature="scoring">
        <ThrowingComponent />
      </ObservableErrorBoundary>
    ));
    expect(infoSpy).toHaveBeenCalledWith(
      'ErrorBoundary triggered',
      { feature: 'scoring' }
    );
  });

  it('calls logger.error exactly once per catch (no double-reporting)', async () => {
    const { logger } = await import('../logger');
    const errorSpy = vi.spyOn(logger, 'error');
    const { ObservableErrorBoundary } = await import('../ErrorBoundary');
    render(() => (
      <ObservableErrorBoundary feature="scoring">
        <ThrowingComponent />
      </ObservableErrorBoundary>
    ));
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('uses custom fallback when provided', async () => {
    const { ObservableErrorBoundary } = await import('../ErrorBoundary');
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

  it('Try Again button resets the error boundary', async () => {
    const { ObservableErrorBoundary } = await import('../ErrorBoundary');
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
