import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerShutdownHandlers } from '../../../src/lifecycle/graceful-shutdown';

type FakeApp = {
  close: ReturnType<typeof vi.fn>;
  log: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
};

function fakeApp(): FakeApp {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
}

describe('registerShutdownHandlers', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.useRealTimers();
  });

  it('closes the app once and exits 0 on SIGTERM', async () => {
    const app = fakeApp();
    const exit = vi.fn();
    cleanup = registerShutdownHandlers(app as never, { exit, signals: ['SIGTERM'] });

    process.emit('SIGTERM', 'SIGTERM');

    await vi.waitFor(() => {
      expect(app.close).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(0);
    });
  });

  it('ignores a repeated signal while shutting down', () => {
    const app = fakeApp();
    app.close.mockImplementation(() => new Promise<void>(() => undefined));
    const exit = vi.fn();
    cleanup = registerShutdownHandlers(app as never, { exit, signals: ['SIGTERM'] });

    process.emit('SIGTERM', 'SIGTERM');
    process.emit('SIGTERM', 'SIGTERM');

    expect(app.close).toHaveBeenCalledTimes(1);
    expect(app.log.warn).toHaveBeenCalled();
  });

  it('forces exit 1 when close hangs past the timeout', async () => {
    vi.useFakeTimers();
    const app = fakeApp();
    app.close.mockImplementation(() => new Promise<void>(() => undefined));
    const exit = vi.fn();
    cleanup = registerShutdownHandlers(app as never, {
      exit,
      signals: ['SIGTERM'],
      timeoutMs: 5000,
    });

    process.emit('SIGTERM', 'SIGTERM');
    await vi.advanceTimersByTimeAsync(5000);

    expect(exit).toHaveBeenCalledWith(1);
  });
});
