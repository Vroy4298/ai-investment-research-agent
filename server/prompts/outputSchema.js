/**
 * prompts/outputSchema.js
 *
 * Zod schema defining the structured output of the investment analysis.
 *
 * Responsibility:
 *   - Define the exact shape of the INVEST/PASS decision output
 *   - Used by LangChain's .withStructuredOutput() to constrain LLM output
 *   - Acts as the contract between the AI layer and the API/frontend layers
 *
 * Why Zod for LLM output schema:
 *   LangChain's .withStructuredOutput(zodSchema) converts this Zod schema to
 *   JSON Schema format and passes it to Gemini's function-calling API.
 *   Gemini is then constrained to only output JSON matching this schema.
 *   This eliminates: free-text parsing, regex extraction, and format errors.
 *
 * Two purposes of this schema:
 *   1. RUNTIME CONSTRAINT — passed to .withStructuredOutput() so the LLM
 *      is forced to produce well-formed JSON
 *   2. DOCUMENTATION — the schema IS the API contract. Any developer reading
 *      this file knows exactly what the agent returns.
 *
 * Schema Design Decisions:
 *   - decision: enum (not string) — only two valid values, prevents typos
 *   - confidence: 0-100 int — a percentage humans can intuitively understand
 *   - strengths/risks: arrays of strings — easier to render as lists in UI
 *   - financialHighlights: separate from strengths — financial data deserves
 *     its own section for credibility and quick scanning
 *   - reasoning: required long-form text — the "why" behind the decision,
 *     most important for human trust in the AI recommendation
 *   - sources: optional array — agent may or may not find citable URLs
 *
 * Dependents:
 *   - agents/investmentAnalyst.js (passed to .withStructuredOutput())
 *   - controllers/research.controller.js (validates shape before sending to client)
 */

import { z } from 'zod';

/**
 * Schema for a single financial metric.
 * Separating label and value makes it easy to render as a table in the UI.
 */
const financialHighlightSchema = z.object({
  metric: z.string().describe('Name of the financial metric, e.g. "Annual Revenue"'),
  value: z.string().describe('The value with units, e.g. "$391B" or "6% YoY growth"'),
});

/**
 * Main investment decision schema.
 *
 * Every field has a .describe() call — this text is sent to the LLM as part
 * of the schema definition. It tells the model exactly what to put in each field.
 * Think of .describe() as documentation for the LLM, not just for humans.
 */
export const investmentDecisionSchema = z.object({
  /**
   * The binary decision.
   * z.enum ensures only "INVEST" or "PASS" are valid — no "invest", "maybe", etc.
   */
  decision: z
    .enum(['INVEST', 'PASS'])
    .describe('The final investment decision: INVEST if the company is worth investing in, PASS if not.'),

  /**
   * Confidence as an integer percentage.
   * int() ensures no decimals (85, not 85.7%) — cleaner UX.
   */
  confidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Confidence in the decision as a percentage from 0 to 100.'),

  /**
   * 2-3 sentence executive summary — what a busy investor reads first.
   */
  summary: z
    .string()
    .describe(
      'A concise 2-3 sentence executive summary of the company and the investment thesis.'
    ),

  /**
   * Top strengths — positive factors supporting an INVEST decision.
   * Array of short, specific statements. Not vague ("good company") —
   * specific ("32% YoY revenue growth with expanding margins").
   */
  strengths: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe(
      'Top 3-5 specific strengths of the company. Each item should be a concise, specific statement backed by data.'
    ),

  /**
   * Key risks — factors that could harm investment returns.
   */
  risks: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe(
      'Top 3-5 specific risks or concerns. Each item should be a concise, specific statement.'
    ),

  /**
   * Financial highlights as structured metric-value pairs.
   * Structured format enables table rendering in the UI.
   * Minimum 1 required — agent must find at least one financial data point.
   */
  financialHighlights: z
    .array(financialHighlightSchema)
    .min(1)
    .max(8)
    .describe(
      'Key financial metrics as metric-value pairs. Examples: { metric: "Annual Revenue", value: "$391B" }, { metric: "Revenue Growth", value: "6% YoY" }.'
    ),

  /**
   * The reasoning paragraph — the most important field.
   * This is where the analyst explains WHY this decision was made.
   * Humans need to understand and trust the AI's reasoning.
   */
  reasoning: z
    .string()
    .describe(
      'Detailed reasoning explaining why this INVEST or PASS decision was made. Must reference specific data points found during research. Minimum 3-4 sentences.'
    ),

  /**
   * Sources — URLs of pages that informed the analysis.
   * Optional because the agent may not always find clean, citable URLs.
   */
  sources: z
    .array(z.string().url())
    .describe('URLs of the web sources that informed this analysis. Returns an empty array if no sources are used.'),
});

export default investmentDecisionSchema;
