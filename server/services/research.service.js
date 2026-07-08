/**
 * services/research.service.js
 *
 * Investment research orchestration service.
 *
 * Responsibility:
 *   - Invoke the LangGraph research graph with a company name
 *   - Handle graph-specific errors and map them to meaningful HTTP errors
 *   - Extract and format the graph result into a clean response object
 *   - Add metadata (duration, search count, timestamp) for observability
 *
 * Why a service layer:
 *   The controller handles HTTP concerns (req/res). The graph handles AI concerns.
 *   The service is the translation layer between them. If we swap LangGraph for
 *   a different framework tomorrow, only this file changes — not the routes,
 *   not the controllers, not the frontend.
 *
 * Error Mapping Strategy:
 *   LangGraph/LLM errors are technical — they mean nothing to an API consumer.
 *   We catch them here, classify them, and throw clean HTTP errors with
 *   meaningful messages and appropriate status codes for the error handler.
 *
 * Dependents: controllers/research.controller.js
 */

import { ToolMessage } from '@langchain/core/messages';
import app from '../graph/researchGraph.js';
import logger from '../utils/logger.js';

/**
 * Creates a structured HTTP error with a status code and error code.
 * These are caught by middleware/errorHandler.js.
 */
function createHttpError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Maps LangGraph / LLM error messages to clean HTTP errors.
 * Called when the graph throws — normalizes third-party errors.
 *
 * @param {Error} err - Raw error from graph execution
 * @throws {Error} - A structured HTTP error
 */
function handleGraphError(err) {
  const message = err.message || '';

  // LangGraph recursion limit exceeded — agent looped too many times
  if (message.toLowerCase().includes('recursion limit')) {
    throw createHttpError(
      'Research timed out — the agent required too many iterations. Try a more well-known company.',
      504,
      'RECURSION_LIMIT_EXCEEDED'
    );
  }

  // Gemini API rate limit — free-tier or paid quota exceeded
  if (message.includes('429') || message.toLowerCase().includes('quota')) {
    throw createHttpError(
      'AI service is temporarily rate-limited. Please wait a moment and try again.',
      503,
      'LLM_RATE_LIMIT'
    );
  }

  // Tavily search API error
  if (message.toLowerCase().includes('tavily')) {
    throw createHttpError(
      'Web search service is temporarily unavailable. Please try again.',
      503,
      'SEARCH_SERVICE_ERROR'
    );
  }

  // Graph produced no decision — shouldn't happen but is a safety net
  if (!message) {
    throw createHttpError(
      'Research completed but no decision was produced. Please try again.',
      500,
      'NO_DECISION_PRODUCED'
    );
  }

  // Unknown error — rethrow as-is (error handler gives it a 500)
  throw err;
}

/**
 * Researches a company using the LangGraph agent and returns
 * a structured investment analysis.
 *
 * @param {string} companyName - The name of the company to research
 * @returns {Promise<ResearchResult>} - Formatted result with decision + metadata
 * @throws {Error} - HTTP-structured error if research fails
 */
export async function researchCompany(companyName) {
  const startTime = Date.now();

  logger.info(`Research started: "${companyName}"`);

  let result;
  try {
    // Invoke the compiled LangGraph app
    // recursionLimit: 25 allows up to ~12 research iterations (generous but safe)
    result = await app.invoke(
      { companyName },
      { recursionLimit: 25 }
    );
  } catch (err) {
    logger.error(`Graph error for "${companyName}":`, { message: err.message });
    handleGraphError(err); // throws a structured HTTP error
  }

  // Validate the graph produced a decision
  if (!result?.decision) {
    throw createHttpError(
      'Research completed but produced no investment decision. Please try again.',
      500,
      'NO_DECISION_PRODUCED'
    );
  }

  const durationMs = Date.now() - startTime;

  // Count web searches performed by counting ToolMessages in the state
  // Each ToolMessage corresponds to one completed Tavily search
  const searchesPerformed = result.messages.filter(
    (msg) => msg instanceof ToolMessage
  ).length;

  logger.info(
    `Research complete: "${companyName}" → ${result.decision.decision} ` +
    `(${result.decision.confidence}% confidence) | ` +
    `${searchesPerformed} searches | ${durationMs}ms`
  );

  return {
    companyName,
    decision: result.decision,
    metadata: {
      researchDurationMs: durationMs,
      searchesPerformed,
      generatedAt: new Date().toISOString(),
    },
  };
}
