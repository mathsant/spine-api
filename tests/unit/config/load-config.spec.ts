import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../../src/config';

const validEnv = {
  MONGO_URI: 'mongodb://localhost:27017',
  MONGO_DB_NAME: 'better_books',
};

function stubExit() {
  return vi.spyOn(process, 'exit').mockImplementation(((): never => {
    throw new Error('process.exit called');
  }) as never);
}

describe('loadConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a typed config applying defaults for optional vars', () => {
    const config = loadConfig({ ...validEnv });

    expect(config).toEqual({
      nodeEnv: 'development',
      port: 3000,
      host: '0.0.0.0',
      mongoUri: 'mongodb://localhost:27017',
      mongoDbName: 'better_books',
      logLevel: 'info',
    });
  });

  it('coerces PORT and honours provided values', () => {
    const config = loadConfig({
      ...validEnv,
      PORT: '8080',
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn',
    });

    expect(config.port).toBe(8080);
    expect(config.nodeEnv).toBe('production');
    expect(config.logLevel).toBe('warn');
  });

  it('exits the process naming the missing required variable', () => {
    const exit = stubExit();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => loadConfig({ MONGO_DB_NAME: 'better_books' })).toThrow('process.exit called');
    expect(exit).toHaveBeenCalledWith(1);
    expect(errSpy.mock.calls.flat().join(' ')).toContain('MONGO_URI');
  });

  it('exits when PORT is not a number', () => {
    const exit = stubExit();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => loadConfig({ ...validEnv, PORT: 'abc' })).toThrow('process.exit called');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits when MONGO_URI is not a mongodb URI', () => {
    const exit = stubExit();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => loadConfig({ ...validEnv, MONGO_URI: 'http://nope' })).toThrow(
      'process.exit called',
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});
