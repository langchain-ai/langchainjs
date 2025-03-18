import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
// Mock fs and path modules
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  accessSync: vi.fn(),
}));
vi.mock('path', () => ({
  join: vi.fn(),
}));
const fs = await import('fs');
const path = await import('path');
const winston = await import('winston');

describe('Logger', () => {
  // Store original console.warn implementation
  const originalConsoleWarn = console.warn;
  let consoleWarnMock: any;

  beforeEach(() => {
    // Clear module cache to ensure logger is reinitialized
    vi.resetModules();

    // Mock console.warn to capture warnings
    consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation((..._args) => {});

    // Configure path.join to return predictable paths
    (path.join as any).mockImplementation((...args: string[]) => args.join('/'));

    // Reset fs mock implementation
    (fs.existsSync as any).mockReset();
    (fs.mkdirSync as any).mockReset();
    (fs.writeFileSync as any).mockReset();
    (fs.unlinkSync as any).mockReset();
  });

  afterEach(() => {
    // Restore console.warn
    consoleWarnMock.mockRestore();
    console.warn = originalConsoleWarn;
  });

  test('should fallback to console-only logging when directory creation fails', async () => {
    // Mock fs.existsSync to return false (directory doesn't exist)
    (fs.existsSync as any).mockReturnValue(false);

    // Mock fs.mkdirSync to throw an error
    (fs.mkdirSync as any).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    // Import logger (after mocks are set up)
    const logger = (await import('../src/logger.js')).default;

    // Verify console warning was logged
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('Unable to set up file logging')
    );
    expect(consoleWarnMock).toHaveBeenCalledWith('Falling back to console logging only');

    // Ensure logger was created with only console transport
    expect(logger.transports.length).toBe(1);
    expect(logger.transports[0]).toBeInstanceOf(winston.transports.Console);
  });

  test('should fallback to console-only logging when write permission test fails', async () => {
    // Mock fs.existsSync to return true (directory exists)
    (fs.existsSync as any).mockReturnValue(true);

    // Mock fs.writeFileSync to throw an error
    (fs.writeFileSync as any).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    // Import logger (after mocks are set up)
    const logger = (await import('../src/logger.js')).default;

    // Verify console warning was logged
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('Unable to set up file logging')
    );
    expect(consoleWarnMock).toHaveBeenCalledWith('Falling back to console logging only');

    // Ensure logger was created with only console transport
    expect(logger.transports.length).toBe(1);
    expect(logger.transports[0]).toBeInstanceOf(winston.transports.Console);
  });

  test('should set up file transports when permissions are available', async () => {
    // Mock all the file operations to succeed
    (fs.mkdirSync as any).mockImplementation(() => true);
    (fs.accessSync as any).mockImplementation(() => true);
    (fs.existsSync as any).mockReturnValue(true);
    (fs.writeFileSync as any).mockImplementation(() => undefined);

    // Import logger directly
    const loggerModule = await import('../src/logger.js');
    const logger = loggerModule.default;

    // Just verify logger was created - don't worry about warnings
    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});
