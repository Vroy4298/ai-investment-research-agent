/**
 * controllers/research.controller.js
 *
 * HTTP request handler for the investment research endpoint.
 *
 * Responsibility:
 *   - Extract validated inputs from req.body (already sanitized by middleware)
 *   - Call the research service
 *   - Send a consistent JSON response
 *   - Forward errors to the global error handler via next()
 *
 * What does NOT belong here:
 *   - LangGraph invocation (lives in services/)
 *   - Input validation (handled by validateRequest middleware)
 *   - Error formatting (handled by middleware/errorHandler.js)
 *   - Business logic of any kind
 *
 * Clean Architecture Rule:
 *   Controllers are thin. They translate HTTP ↔ service calls.
 *   If your controller has more than ~20 lines of logic, extract to a service.
 *
 * Dependents: routes/research.routes.js
 */

import { researchCompany } from '../services/research.service.js';
import logger from '../utils/logger.js';

/**
 * POST /api/research
 *
 * Analyzes a company and returns an INVEST or PASS decision.
 *
 * Request body (validated upstream):
 *   { companyName: string } — 2-100 chars, alphanumeric + common symbols
 *
 * Success response (200):
 *   {
 *     success: true,
 *     data: {
 *       companyName: string,
 *       decision: InvestmentDecision,
 *       metadata: { researchDurationMs, searchesPerformed, generatedAt }
 *     }
 *   }
 *
 * Error responses:
 *   400 — validation error (caught by validateRequest middleware)
 *   429 — rate limit exceeded (caught by rateLimiter middleware)
 *   503 — AI/search service temporarily unavailable
 *   504 — research timed out (recursion limit)
 *   500 — unexpected error
 */
export async function analyzeCompany(req, res, next) {
  // req.body is already Zod-validated and sanitized by validateRequest middleware
  const { companyName } = req.body;

  logger.info(`[controller] Research request: "${companyName}"`);

  try {
    const result = await researchCompany(companyName);

    // 200 OK — research completed successfully
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    // Forward to global error handler (middleware/errorHandler.js)
    // The error handler formats it as JSON with the right status code
    next(err);
  }
}
