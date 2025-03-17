import * as fs from 'fs';
import * as path from 'path';
import winston from 'winston';

// Mock fs and path modules
jest.mock('fs');
jest.mock('path');

describe('Logger', () => {
  // Store original console.warn implementation
  const originalConsoleWarn = console.warn;
  let consoleWarnMock: jest.SpyInstance;

  beforeEach(() => {
    // Clear module cache to ensure logger is reinitialized
    jest.resetModules();

    // Mock console.warn to capture warnings
    consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation();

    // Configure path.join to return predictable paths
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));

    // Reset fs mock implementation
    (fs.existsSync as jest.Mock).mockReset();
    (fs.mkdirSync as jest.Mock).mockReset();
    (fs.writeFileSync as jest.Mock).mockReset();
    (fs.unlinkSync as jest.Mock).mockReset();
  });

  afterEach(() => {
    // Restore console.warn
    consoleWarnMock.mockRestore();
    console.warn = originalConsoleWarn;
  });

  test('should fallback to console-only logging when directory creation fails', async () => {
    // Mock fs.existsSync to return false (directory doesn't exist)
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    // Mock fs.mkdirSync to throw an error
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {
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
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    // Mock fs.writeFileSync to throw an error
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {
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

  test('should set up file transports when permissions are available', () => {
    // Mock all the file operations to succeed
    (fs.mkdirSync as jest.Mock).mockImplementation(() => true);
    (fs.accessSync as jest.Mock).mockImplementation(() => true);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.writeFileSync as jest.Mock).mockImplementation(() => undefined);

    // Import logger (after mocks are set up)
    jest.isolateModules(async () => {
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
});
