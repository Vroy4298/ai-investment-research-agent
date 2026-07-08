/**
 * utils/logger.js
 *
 * Lightweight structured logger for the application.
 *
 * Responsibility:
 *   - Provide consistent, timestamped log output across all modules
 *   - Differentiate log levels: info, warn, error, debug
 *   - Suppress debug logs in production
 *
 * Why not console.log:
 *   - console.log has no timestamps, no severity levels, no structure
 *   - This logger adds context that makes debugging and monitoring practical
 *
 * Why not Winston or Pino:
 *   - This project doesn't need log file rotation, log shipping, or JSON output
 *   - A simple custom logger keeps dependencies minimal and the code readable
 *   - For a production SaaS, switching to Pino would be the right call
 *
 * Dependents: All modules that need logging
 */

import config from '../config/index.js';

// ANSI color codes for terminal readability
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

/**
 * Returns a formatted timestamp string for log prefixes.
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Core log function — formats and outputs a log entry.
 */
function log(level, color, label, message, meta = null) {
  const timestamp = `${colors.dim}${getTimestamp()}${colors.reset}`;
  const levelTag = `${color}[${label}]${colors.reset}`;
  const output = meta
    ? `${timestamp} ${levelTag} ${message}\n${JSON.stringify(meta, null, 2)}`
    : `${timestamp} ${levelTag} ${message}`;

  if (level === 'error') {
    console.error(output);
  } else {
    console.log(output);
  }
}

const logger = {
  /**
   * General informational messages — normal operation
   */
  info: (message, meta) => log('info', colors.green, 'INFO', message, meta),

  /**
   * Warnings — something unexpected but not fatal
   */
  warn: (message, meta) => log('warn', colors.yellow, 'WARN', message, meta),

  /**
   * Errors — something failed, needs attention
   */
  error: (message, meta) => log('error', colors.red, 'ERROR', message, meta),

  /**
   * Debug — verbose output, only shown in development
   */
  debug: (message, meta) => {
    if (config.isDevelopment) {
      log('debug', colors.cyan, 'DEBUG', message, meta);
    }
  },

  /**
   * Agent step logging — highlights LangGraph node execution
   */
  agent: (message, meta) =>
    log('agent', colors.magenta, 'AGENT', message, meta),
};

export default logger;
