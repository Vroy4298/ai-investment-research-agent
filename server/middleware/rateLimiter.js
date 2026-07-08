/**
 * middleware/rateLimiter.js
 *
 * Rate limiting middleware using express-rate-limit.
 *
 * Responsibility:
 *   - Restrict how many requests a single IP can make per time window
 *   - Protect the AI research endpoint from abuse and accidental over-calling
 *   - Return a clear 429 Too Many Requests response when the limit is exceeded
 *
 * Why rate limiting matters for AI apps:
 *   Every research request triggers:
 *     - 1+ Tavily search API calls (paid)
 *     - 3-5 Gemini LLM calls (paid per token)
 *   Without limits, a single user or bot can generate significant API costs.
 *
 * Configuration is read from .env so it can be tuned per environment
 * without touching code.
 *
 * Dependents: server/index.js (applied to /api routes)
 */

import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

const rateLimiter = rateLimit({
  // Time window in milliseconds (default: 15 minutes)
  windowMs: config.rateLimit.windowMs,

  // Maximum number of requests per IP per window (default: 10)
  max: config.rateLimit.max,

  // Return rate limit info in response headers
  // X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  standardHeaders: true,

  // Disable the legacy X-RateLimit-* headers (use standardHeaders instead)
  legacyHeaders: false,

  // Custom response when limit is exceeded
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        message:
          'Too many requests. You have exceeded the rate limit. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: `${Math.ceil(config.rateLimit.windowMs / 60000)} minutes`,
      },
    });
  },
});

export default rateLimiter;
