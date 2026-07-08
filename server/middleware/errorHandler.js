/**
 * middleware/errorHandler.js
 *
 * Global error handling middleware for Express.
 *
 * Responsibility:
 *   - Catch all errors thrown anywhere in the request lifecycle
 *   - Return consistent, clean JSON error responses
 *   - Never expose internal stack traces to the client in production
 *   - Log errors for debugging
 *
 * How Express error middleware works:
 *   Express identifies error-handling middleware by its 4-argument signature:
 *   (err, req, res, next). When any route or middleware calls next(error) or
 *   throws inside an async handler (with proper wrapping), Express forwards
 *   control to this function.
 *
 * IMPORTANT: This must be registered LAST in server/index.js — after all
 * routes and other middleware. Express processes middleware in order.
 *
 * Dependents: server/index.js
 */

import logger from '../utils/logger.js';
import config from '../config/index.js';

/**
 * Global error handler middleware.
 * Must have exactly 4 parameters — Express uses this signature to identify
 * it as an error handler, not a regular middleware.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Determine HTTP status code
  // err.statusCode is set by us for known errors (e.g. validation failures)
  // err.status may be set by third-party libraries
  // Default to 500 (Internal Server Error) for unexpected errors
  const statusCode = err.statusCode || err.status || 500;

  // Log the full error internally (with stack trace)
  logger.error(`${req.method} ${req.path} → ${statusCode}`, {
    message: err.message,
    stack: config.isDevelopment ? err.stack : '[hidden in production]',
  });

  // Build the client-facing response
  const response = {
    success: false,
    error: {
      message: err.message || 'An unexpected error occurred.',
      // Only include the error code if it was explicitly set (operational errors)
      ...(err.code && { code: err.code }),
    },
  };

  // In development, include the stack trace for faster debugging
  if (config.isDevelopment && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
