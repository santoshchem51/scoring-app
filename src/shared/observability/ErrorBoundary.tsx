import { ErrorBoundary } from 'solid-js';
import type { JSX } from 'solid-js';
import { logger } from './logger';

interface Props {
  children: JSX.Element;
  feature?: string;
  fallback?: (err: unknown, reset: () => void) => JSX.Element;
}

export function ObservableErrorBoundary(props: Props) {
  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        const originalMessage = err instanceof Error ? err.message : String(err);
        const feature = props.feature ?? 'unknown';
        const enrichedError = err instanceof Error ? err : new Error(originalMessage);
        logger.info('ErrorBoundary triggered', { feature });
        logger.error(`ErrorBoundary caught error in ${feature}: ${originalMessage}`, enrichedError);

        if (props.fallback) {
          return props.fallback(err, reset);
        }

        return (
          <div class="flex flex-col items-center justify-center p-8 text-center">
            <h2 class="text-xl font-bold text-red-400 mb-2">Something went wrong</h2>
            <p class="text-gray-400 mb-4">
              {props.feature ? `Error in ${props.feature}` : 'An unexpected error occurred'}
            </p>
            <button
              type="button"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg"
              onClick={reset}
            >
              Try Again
            </button>
          </div>
        );
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}
