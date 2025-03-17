import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Logging levels:
 * error: 0 - Severe errors that cause the application to crash or malfunction
 * warn: 1 - Warnings that don't stop the application but should be addressed
 * info: 2 - General information about application operation
 * http: 3 - HTTP request/response information
 * debug: 4 - Detailed debugging information
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * By default, logging is set to the silent level unless explicitly enabled
 * This makes logging opt-in rather than enabled by default
 */
const defaultLevel = 'silent';

/**
 * Define colors for each log level to improve readability in the console.
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to Winston
winston.addColors(colors);

/**
 * Define the format for log messages.
 * We include a timestamp, colorize the output, and format the message.
 */
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
);

/**
 * Define the transports for log messages.
 * Always log to console, and only log to files if we have permission.
 */
// Base transports array (always include console)
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console(),
];

// Attempt to add file transports only if we have write permissions
try {
  const logsDir = path.join(process.cwd(), 'logs');

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Test write permissions with a small file
  const testFile = path.join(logsDir, '.permissions-test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);

  // If we reach here, we have write permissions - add file transports
  transports.push(
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'all.log'),
    })
  );
} catch (error) {
  // If any error occurs during the file operations, log to console only
  console.warn(
    `Unable to set up file logging: ${error instanceof Error ? error.message : String(error)}`
  );
  console.warn('Falling back to console logging only');
}

/**
 * Create the logger instance with our configuration.
 * By default, logging is disabled (silent) but can be enabled by setting the level.
 */
const logger = winston.createLogger({
  level: defaultLevel, // Start with silent logging by default
  levels,
  format,
  transports,
});

/**
 * Enable logging at the specified level.
 *
 * @param level - The log level to enable ('error', 'warn', 'info', 'http', 'debug')
 */
export function enableLogging(level: keyof typeof levels | 'silent' = 'info'): void {
  logger.level = level;
  logger.info(`Logging enabled at level: ${level}`);
}

/**
 * Disable all logging.
 */
export function disableLogging(): void {
  logger.level = 'silent';
}

export default logger;
