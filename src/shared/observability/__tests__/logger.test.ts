import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('logs to console at each level', async () => {
    const { logger } = await import('../logger');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('test message');
    expect(spy).toHaveBeenCalledWith('test message', undefined);
  });

  it('calls registered sinks', async () => {
    const { logger, registerSink } = await import('../logger');
    const sink = vi.fn();
    registerSink(sink);
    logger.warn('sink test', { key: 'value' });
    expect(sink).toHaveBeenCalledWith('warn', 'sink test', { key: 'value' });
  });

  it('calls all registered sinks in order', async () => {
    const { logger, registerSink } = await import('../logger');
    const order: number[] = [];
    registerSink(() => order.push(1));
    registerSink(() => order.push(2));
    vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('test');
    expect(order).toEqual([1, 2]);
  });

  it('calls remaining sinks even when an earlier sink throws', async () => {
    const { logger, registerSink } = await import('../logger');
    const secondSink = vi.fn();
    registerSink(() => {
      throw new Error('boom');
    });
    registerSink(secondSink);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('test');
    expect(secondSink).toHaveBeenCalled();
  });

  it('never throws even if sink throws', async () => {
    const { logger, registerSink } = await import('../logger');
    registerSink(() => {
      throw new Error('sink exploded');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => logger.error('should not throw')).not.toThrow();
  });

  it('handles undefined data gracefully', async () => {
    const { logger } = await import('../logger');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(() => logger.info('no data')).not.toThrow();
    expect(spy).toHaveBeenCalledWith('no data', undefined);
  });

  it('falls back to console.error if console[level] fails', async () => {
    const { logger } = await import('../logger');
    const fallbackSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {
      throw new Error('broken');
    });
    expect(() => logger.debug('test')).not.toThrow();
    expect(fallbackSpy).toHaveBeenCalledWith(
      '[logger-fallback]',
      'test',
      undefined,
    );
  });
});
