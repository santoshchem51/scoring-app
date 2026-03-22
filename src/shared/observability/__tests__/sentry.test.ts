import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('sentry', () => {
  let mockInit: ReturnType<typeof vi.fn>;
  let mockSetTag: ReturnType<typeof vi.fn>;
  let mockSetUser: ReturnType<typeof vi.fn>;
  let mockFlush: ReturnType<typeof vi.fn>;
  let mockClose: ReturnType<typeof vi.fn>;
  let mockCaptureException: ReturnType<typeof vi.fn>;
  let mockAddBreadcrumb: ReturnType<typeof vi.fn>;
  let mockMakeFetchTransport: ReturnType<typeof vi.fn>;
  let mockMakeBrowserOfflineTransport: ReturnType<typeof vi.fn>;
  let mockConsent: string;
  let registeredSinks: Array<(level: string, msg: string, data?: unknown) => void>;
  let mockFlushEarlyErrors: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();

    mockInit = vi.fn();
    mockSetTag = vi.fn();
    mockSetUser = vi.fn();
    mockFlush = vi.fn().mockResolvedValue(true);
    mockClose = vi.fn().mockResolvedValue(true);
    mockCaptureException = vi.fn();
    mockAddBreadcrumb = vi.fn();
    mockMakeFetchTransport = vi.fn();
    mockMakeBrowserOfflineTransport = vi.fn().mockReturnValue('offline-transport');
    mockConsent = 'accepted';
    registeredSinks = [];
    mockFlushEarlyErrors = vi.fn();

    vi.doMock('@sentry/browser', () => ({
      init: mockInit,
      setTag: mockSetTag,
      setUser: mockSetUser,
      flush: mockFlush,
      close: mockClose,
      captureException: mockCaptureException,
      addBreadcrumb: mockAddBreadcrumb,
      makeFetchTransport: mockMakeFetchTransport,
      makeBrowserOfflineTransport: mockMakeBrowserOfflineTransport,
    }));

    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ analyticsConsent: mockConsent }),
    }));

    vi.doMock('../logger', () => ({
      registerSink: (sink: (level: string, msg: string, data?: unknown) => void) => {
        registeredSinks.push(sink);
      },
      removeSink: (sink: (level: string, msg: string, data?: unknown) => void) => {
        const idx = registeredSinks.indexOf(sink);
        if (idx !== -1) registeredSinks.splice(idx, 1);
      },
    }));

    vi.doMock('../earlyErrors', () => ({
      flushEarlyErrors: mockFlushEarlyErrors,
    }));

    vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/123');
    vi.stubEnv('MODE', 'test');
    vi.stubEnv('VITE_APP_VERSION', '1.0.0');

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
      );
      expect(mockFlushEarlyErrors).toHaveBeenCalledTimes(1);
    });

    it('configures offline transport wrapping fetch transport', async () => {
      const { initSentry } = await import('../sentry');
      await initSentry();

      expect(mockMakeBrowserOfflineTransport).toHaveBeenCalledWith(
        mockMakeFetchTransport,
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

    it('scrubs uid field from breadcrumb data objects', async () => {
      const { initSentry } = await import('../sentry');
      await initSentry();

      const sink = registeredSinks[0];
      sink('warn', 'duplicate detected', { uid: 'abc123', error: 'conflict' });

      expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1);
      const breadcrumbData = mockAddBreadcrumb.mock.calls[0][0].data;
      expect(breadcrumbData.uid).toBeUndefined();
      expect(breadcrumbData.error).toBe('conflict');
    });

    it('sanitizes Error objects in breadcrumb data for Firestore paths and emails', async () => {
      const { initSentry } = await import('../sentry');
      await initSentry();

      const sink = registeredSinks[0];
      sink('warn', 'fetch failed', {
        error: new Error('Cannot read users/xyz789/stats for john@example.com'),
        retryCount: 1,
      });

      expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1);
      const breadcrumbData = mockAddBreadcrumb.mock.calls[0][0].data;
      expect(breadcrumbData.error).toBe(
        'Cannot read users/[redacted]/stats for [email]',
      );
      expect(breadcrumbData.retryCount).toBe(1);
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

    it('increments daily counter on each call', async () => {
      const { scrubPII } = await import('../sentry');
      scrubPII({ message: 'err1' });
      scrubPII({ message: 'err2' });
      const stored = JSON.parse(localStorage.getItem('sentry_daily_count')!);
      expect(stored.count).toBe(2);
    });

    it('scrubs email patterns from exception value messages', async () => {
      const { scrubPII } = await import('../sentry');
      const event = {
        exception: {
          values: [
            { value: 'Error for john@example.com in handler' },
            { value: 'No email here' },
          ],
        },
      };
      const result = scrubPII(event);
      expect(result.exception.values[0].value).toBe('Error for [email] in handler');
      expect(result.exception.values[1].value).toBe('No email here');
    });

    it('scrubs Firestore paths from exception values', async () => {
      const { scrubPII } = await import('../sentry');
      const event = {
        exception: {
          values: [
            { value: 'Failed to read users/abc123def/stats/summary' },
          ],
        },
      };
      const result = scrubPII(event);
      expect(result.exception.values[0].value).toBe(
        'Failed to read users/[redacted]/stats/summary',
      );
    });

    it('resets counter on new day', async () => {
      const { scrubPII } = await import('../sentry');
      localStorage.setItem(
        'sentry_daily_count',
        JSON.stringify({ count: 100, date: 'Mon Jan 01 2024' }),
      );
      scrubPII({ message: 'new day' });
      const stored = JSON.parse(localStorage.getItem('sentry_daily_count')!);
      expect(stored.count).toBe(1);
      expect(stored.date).toBe(new Date().toDateString());
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

    it('strips multiple emails in one string', async () => {
      const { sanitizeMessage } = await import('../sentry');
      expect(sanitizeMessage('From a@b.com to c@d.org')).toBe('From [email] to [email]');
    });

    it('preserves email-like strings without valid TLD', async () => {
      const { sanitizeMessage } = await import('../sentry');
      expect(sanitizeMessage('Error for user@localhost')).toBe('Error for user@localhost');
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

    it('sets Sentry user when initialized', async () => {
      const { initSentry, setSentryUser } = await import('../sentry');
      await initSentry();
      setSentryUser('uid-123');
      // setSentryUser uses cached SentryModule (synchronous), so no await needed
      expect(mockSetUser).toHaveBeenCalledWith({ id: 'uid-123' });
    });

    it('flushes then clears user on sign-out', async () => {
      const { initSentry, setSentryUser } = await import('../sentry');
      await initSentry();
      setSentryUser(null);
      // flush returns a promise, wait for it
      await vi.waitFor(() => {
        expect(mockFlush).toHaveBeenCalledWith(2000);
      });
      await vi.waitFor(() => {
        expect(mockSetUser).toHaveBeenCalledWith(null);
      });
    });

    it('does not throw when flush rejects during sign-out', async () => {
      mockFlush.mockRejectedValueOnce(new Error('flush failed'));
      const { initSentry, setSentryUser } = await import('../sentry');
      await initSentry();
      expect(() => setSentryUser(null)).not.toThrow();
      // Wait a tick for the rejection to be handled
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe('teardownSentry', () => {
    it('calls Sentry.close() and resets initialized flag', async () => {
      const { initSentry, teardownSentry, setSentryUser } = await import('../sentry');
      await initSentry();

      await teardownSentry();

      // After teardown, setSentryUser should be a no-op
      mockSetUser.mockClear();
      setSentryUser('uid-456');
      expect(mockSetUser).not.toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('deregisters the logger sink on teardown', async () => {
      const { initSentry, teardownSentry } = await import('../sentry');
      await initSentry();
      expect(registeredSinks).toHaveLength(1);

      await teardownSentry();
      expect(registeredSinks).toHaveLength(0);
    });

    it('is a no-op when not initialized', async () => {
      mockConsent = 'pending';
      const { initSentry, teardownSentry } = await import('../sentry');
      await initSentry(); // won't init
      await expect(teardownSentry()).resolves.toBeUndefined();
      expect(mockClose).not.toHaveBeenCalled();
    });

    it('allows re-initialization after teardown (re-consent)', async () => {
      const { initSentry, teardownSentry } = await import('../sentry');
      await initSentry();
      await teardownSentry();

      mockInit.mockClear();
      mockFlushEarlyErrors.mockClear();
      registeredSinks.length = 0;

      await initSentry();

      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(registeredSinks).toHaveLength(1);
    });

    it('sink stops sending after teardown', async () => {
      const { initSentry, teardownSentry } = await import('../sentry');
      await initSentry();
      const sink = registeredSinks[0];

      await teardownSentry();

      // Even if the sink reference is still held externally, the guard stops it
      mockAddBreadcrumb.mockClear();
      mockCaptureException.mockClear();
      if (sink) {
        sink('error', 'should be ignored', new Error('ignored'));
      }
      expect(mockAddBreadcrumb).not.toHaveBeenCalled();
      expect(mockCaptureException).not.toHaveBeenCalled();
    });
  });
});
