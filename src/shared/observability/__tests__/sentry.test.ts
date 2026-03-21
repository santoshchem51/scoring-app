import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sentry/browser before any imports
const mockInit = vi.fn();
const mockSetTag = vi.fn();
const mockSetUser = vi.fn();
const mockFlush = vi.fn().mockResolvedValue(true);
const mockCaptureException = vi.fn();
const mockAddBreadcrumb = vi.fn();
const mockMakeFetchTransport = vi.fn();
const mockMakeBrowserOfflineTransport = vi.fn().mockReturnValue('offline-transport');

vi.mock('@sentry/browser', () => ({
  init: mockInit,
  setTag: mockSetTag,
  setUser: mockSetUser,
  flush: mockFlush,
  captureException: mockCaptureException,
  addBreadcrumb: mockAddBreadcrumb,
  makeFetchTransport: mockMakeFetchTransport,
  makeBrowserOfflineTransport: mockMakeBrowserOfflineTransport,
}));

// Mock settingsStore
let mockConsent = 'accepted';
vi.mock('../../../stores/settingsStore', () => ({
  settings: () => ({ analyticsConsent: mockConsent }),
}));

// Mock logger
const registeredSinks: Array<(level: string, msg: string, data?: unknown) => void> = [];
vi.mock('../logger', () => ({
  registerSink: (sink: (level: string, msg: string, data?: unknown) => void) => {
    registeredSinks.push(sink);
  },
}));

// Mock earlyErrors
const mockFlushEarlyErrors = vi.fn();
vi.mock('../earlyErrors', () => ({
  flushEarlyErrors: mockFlushEarlyErrors,
}));

// Mock import.meta.env
vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/123');
vi.stubEnv('MODE', 'test');
vi.stubEnv('VITE_APP_VERSION', '1.0.0');

describe('sentry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();

    // Re-apply stubs after reset
    mockInit.mockClear();
    mockSetTag.mockClear();
    mockSetUser.mockClear();
    mockFlush.mockClear().mockResolvedValue(true);
    mockCaptureException.mockClear();
    mockAddBreadcrumb.mockClear();
    mockMakeBrowserOfflineTransport.mockClear().mockReturnValue('offline-transport');

    mockConsent = 'accepted';
    registeredSinks.length = 0;
    mockFlushEarlyErrors.mockClear();

    localStorage.clear();
  });

  describe('initSentry', () => {
    it('initializes Sentry when consent is accepted', async () => {
      const { initSentry } = await import('../sentry');
      await initSentry();

      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          sendDefaultPii: false,
          transport: 'offline-transport',
        }),
      );
      expect(mockMakeBrowserOfflineTransport).toHaveBeenCalledWith(
        mockMakeFetchTransport,
        { maxQueueSize: 50 },
      );
      expect(mockFlushEarlyErrors).toHaveBeenCalledTimes(1);
    });

    it('configures offline transport with maxQueueSize of 50', async () => {
      const { initSentry } = await import('../sentry');
      await initSentry();

      expect(mockMakeBrowserOfflineTransport).toHaveBeenCalledWith(
        mockMakeFetchTransport,
        { maxQueueSize: 50 },
      );
    });

    it('skips initialization when consent is pending', async () => {
      mockConsent = 'pending';
      const { initSentry } = await import('../sentry');
      await initSentry();

      expect(mockInit).not.toHaveBeenCalled();
    });

    it('registers a logger sink after init that routes errors to captureException', async () => {
      const { initSentry } = await import('../sentry');
      await initSentry();

      expect(registeredSinks).toHaveLength(1);
      const sink = registeredSinks[0];
      const testError = new Error('test error');
      sink('error', 'something failed', testError);

      expect(mockCaptureException).toHaveBeenCalledWith(testError, { extra: { message: 'something failed' } });
    });

    it('maps warn level to warning for Sentry breadcrumbs', async () => {
      const { initSentry } = await import('../sentry');
      await initSentry();

      const sink = registeredSinks[0];
      sink('warn', 'test warning');

      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'warning' }),
      );
    });

    it('wraps string data in an Error for captureException', async () => {
      const { initSentry } = await import('../sentry');
      await initSentry();

      const sink = registeredSinks[0];
      sink('error', 'msg', 'string data');

      expect(mockCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'string data' }),
        { extra: { message: 'msg' } },
      );
      expect(mockCaptureException.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it('scrubs sensitive fields from breadcrumb data objects', async () => {
      const { initSentry } = await import('../sentry');
      await initSentry();

      const sink = registeredSinks[0];
      sink('warn', 'sync failed', {
        email: 'john@example.com',
        playerName: 'John',
        retryCount: 3,
        teamName: 'Aces',
      });

      expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1);
      const breadcrumbData = mockAddBreadcrumb.mock.calls[0][0].data;
      expect(breadcrumbData.email).toBeUndefined();
      expect(breadcrumbData.playerName).toBeUndefined();
      expect(breadcrumbData.teamName).toBeUndefined();
      expect(breadcrumbData.retryCount).toBe(3);
    });

    it('wraps non-string non-Error data in an Error using msg as fallback', async () => {
      const { initSentry } = await import('../sentry');
      await initSentry();

      const sink = registeredSinks[0];
      sink('error', 'msg', { some: 'object' });

      expect(mockCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'msg' }),
        { extra: { message: 'msg' } },
      );
      expect(mockCaptureException.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });

  describe('scrubPII', () => {
    it('removes ip_address and email from user', async () => {
      const { scrubPII } = await import('../sentry');
      const event = {
        user: { id: 'u1', ip_address: '1.2.3.4', email: 'a@b.com' },
      };
      const result = scrubPII(event);
      expect(result.user.id).toBe('u1');
      expect(result.user.ip_address).toBeUndefined();
      expect(result.user.email).toBeUndefined();
    });

    it('removes sensitive field names from extras', async () => {
      const { scrubPII } = await import('../sentry');
      const event = {
        extra: {
          email: 'a@b.com',
          displayName: 'John',
          playerName: 'Jane',
          teamName: 'Aces',
          safeKey: 'keep',
        },
      };
      const result = scrubPII(event);
      expect(result.extra.email).toBeUndefined();
      expect(result.extra.displayName).toBeUndefined();
      expect(result.extra.playerName).toBeUndefined();
      expect(result.extra.teamName).toBeUndefined();
      expect(result.extra.safeKey).toBe('keep');
    });

    it('scrubs Firestore document paths', async () => {
      const { scrubPII } = await import('../sentry');
      const event = {
        message: 'Error in users/abc123/matches/xyz',
      };
      const result = scrubPII(event);
      expect(result.message).toBe('Error in users/[redacted]/matches/xyz');
    });

    it('rate limits at 200 errors per day', async () => {
      const { scrubPII } = await import('../sentry');
      // Simulate 200 events already sent today
      localStorage.setItem(
        'sentry_daily_count',
        JSON.stringify({ count: 200, date: new Date().toDateString() }),
      );
      const event = { message: 'test' };
      const result = scrubPII(event);
      expect(result).toBeNull();
    });

    it('removes sensitive field names from contexts', async () => {
      const { scrubPII } = await import('../sentry');
      const event = {
        contexts: {
          profile: {
            email: 'a@b.com',
            displayName: 'John',
            safeKey: 'keep',
          },
          device: {
            arch: 'x86',
            playerName: 'Jane',
          },
        },
      };
      const result = scrubPII(event);
      expect(result.contexts.profile.email).toBeUndefined();
      expect(result.contexts.profile.displayName).toBeUndefined();
      expect(result.contexts.profile.safeKey).toBe('keep');
      expect(result.contexts.device.playerName).toBeUndefined();
      expect(result.contexts.device.arch).toBe('x86');
    });

    it('allows fatal errors to bypass rate limit', async () => {
      const { scrubPII } = await import('../sentry');
      localStorage.setItem(
        'sentry_daily_count',
        JSON.stringify({ count: 200, date: new Date().toDateString() }),
      );
      const event = { message: 'fatal crash', tags: { error_type: 'fatal' } };
      const result = scrubPII(event);
      expect(result).not.toBeNull();
    });
  });

  describe('filterBreadcrumb', () => {
    it('keeps ui.click but strips textContent', async () => {
      const { filterBreadcrumb } = await import('../sentry');
      const breadcrumb = {
        category: 'ui.click',
        data: { textContent: 'Click me', 'target.innerText': 'Click me', target: '#btn' },
      };
      const result = filterBreadcrumb(breadcrumb);
      expect(result).not.toBeNull();
      expect(result.category).toBe('ui.click');
      expect(result.data.textContent).toBeUndefined();
      expect(result.data['target.innerText']).toBeUndefined();
      expect(result.data.target).toBe('#btn');
    });

    it('drops Firestore XHR breadcrumbs', async () => {
      const { filterBreadcrumb } = await import('../sentry');
      const breadcrumb = {
        category: 'xhr',
        data: { url: 'https://firestore.googleapis.com/v1/projects/...' },
      };
      const result = filterBreadcrumb(breadcrumb);
      expect(result).toBeNull();
    });

    it('drops console breadcrumbs', async () => {
      const { filterBreadcrumb } = await import('../sentry');
      const breadcrumb = { category: 'console', message: 'debug log' };
      const result = filterBreadcrumb(breadcrumb);
      expect(result).toBeNull();
    });

    it('strips authorization headers from XHR breadcrumb data', async () => {
      const { filterBreadcrumb } = await import('../sentry');
      const breadcrumb = {
        category: 'xhr',
        data: {
          url: 'https://identitytoolkit.googleapis.com/v1/accounts',
          request_headers: { Authorization: 'Bearer eyJhbGciOi...' },
        },
      };
      const result = filterBreadcrumb(breadcrumb);
      expect(result).not.toBeNull();
      expect(result.data.request_headers).toBeUndefined();
    });

    it('strips authorization headers from fetch breadcrumb data', async () => {
      const { filterBreadcrumb } = await import('../sentry');
      const breadcrumb = {
        category: 'fetch',
        data: {
          url: 'https://cloudfunctions.net/api',
          headers: { Authorization: 'Bearer eyJhbGciOi...' },
        },
      };
      const result = filterBreadcrumb(breadcrumb);
      expect(result).not.toBeNull();
      expect(result.data.headers).toBeUndefined();
    });
  });

  describe('sanitizeMessage', () => {
    it('strips email addresses', async () => {
      const { sanitizeMessage } = await import('../sentry');
      expect(sanitizeMessage('User john@example.com failed')).toBe('User [email] failed');
    });

    it('leaves non-email text unchanged', async () => {
      const { sanitizeMessage } = await import('../sentry');
      expect(sanitizeMessage('No emails here')).toBe('No emails here');
    });
  });

  describe('setSentryUser', () => {
    it('does nothing when Sentry is not initialized', async () => {
      mockConsent = 'pending';
      const { initSentry, setSentryUser } = await import('../sentry');
      await initSentry(); // won't init because consent is pending

      setSentryUser('user-123');
      // Should not attempt to import @sentry/browser for setUser
      expect(mockSetUser).not.toHaveBeenCalled();
    });
  });
});
