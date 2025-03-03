import * as winston from 'winston';

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
 * Determine the appropriate log level based on the environment.
 * In development, we want to see all logs.
 * In production, we only want to see warnings and errors.
 */
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

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
 * We log to the console and to files.
 */
const transports = [
  // Console transport
  new winston.transports.Console(),

  // File transport for errors
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),

  // File transport for all logs
  new winston.transports.File({
    filename: 'logs/all.log',
  }),
];

/**
 * Create the logger instance with our configuration.
 */
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

export default logger;
