/**
 * routes/research.routes.js
 *
 * Route definitions for the investment research API.
 *
 * Responsibility:
 *   - Declare HTTP method + URL path for each endpoint
 *   - Apply route-specific middleware (validation) in correct order
 *   - Connect routes to their controller handlers
 *
 * Why routes are separate from controllers:
 *   Routes define the API contract (what URLs exist and what they accept).
 *   Controllers define the behavior (what happens when a URL is hit).
 *   Separating them means you can change URL structure without touching
 *   controller logic, and you can see the full API surface at a glance.
 *
 * Middleware Order on a Route:
 *   validateRequest(schema) runs BEFORE analyzeCompany.
 *   If validation fails → 400 response returned immediately.
 *   If validation passes → analyzeCompany is called with clean req.body.
 *   This pattern is called "middleware chaining" or "route-level middleware."
 *
 * Mounted at: /api (in server/index.js)
 * Full path:  POST /api/research
 *
 * Dependents: server/index.js
 */

import { Router } from 'express';
import { analyzeCompany } from '../controllers/research.controller.js';
import validateRequest, {
  researchRequestSchema,
} from '../middleware/validateRequest.js';

const router = new Router();

/**
 * POST /api/research
 *
 * Analyzes a company and returns an investment decision.
 *
 * Middleware chain:
 *   1. validateRequest(researchRequestSchema) → validate + sanitize body
 *   2. analyzeCompany → invoke AI agent, return decision
 *
 * Example request:
 *   POST /api/research
 *   Content-Type: application/json
 *   { "companyName": "Apple Inc" }
 */
router.post(
  '/research',
  validateRequest(researchRequestSchema),
  analyzeCompany
);

export default router;
