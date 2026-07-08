/**
 * agents/investmentAnalyst.js
 *
 * Configures the two LLM model variants used in the research graph.
 *
 * Responsibility:
 *   - Export a model with tools bound (for the research/ReAct loop)
 *   - Export a model with structured output (for the final decision)
 *
 * Why two separate model variants?
 *   LangChain's .bindTools() and .withStructuredOutput() both work by
 *   registering "functions" with the LLM's function-calling API.
 *   Using separate instances keeps the two concerns clean:
 *     modelWithTools    → researcher node (can call webSearch, loop freely)
 *     structuredModel   → makeDecision node (reads research, outputs typed JSON)
 *
 * LangChain Concept — bindTools():
 *   Registers tool schemas with the LLM so it knows what tools it can call
 *   and what inputs each tool expects. xAI receives these as function
 *   declarations alongside the prompt, identical to the OpenAI function-calling
 *   protocol.
 *
 * LangChain Concept — withStructuredOutput():
 *   Forces the LLM to output JSON matching a Zod schema by registering the
 *   schema as a function the LLM must "call." Returns a plain JS object
 *   instead of an AIMessage with string content. Works identically across
 *   all OpenAI-compatible providers.
 *
 * Dependents: graph/researchGraph.js
 */

import groqModel from '../config/groq.js';
import tools from '../tools/index.js';
import investmentDecisionSchema from '../prompts/outputSchema.js';

/**
 * Research model — Llama 3.3 70B with web search tools bound.
 *
 * Used in the researcher node. The LLM can choose to call webSearch
 * with any query it decides is relevant for investment research.
 * Loops until the LLM decides it has gathered sufficient data.
 */
export const modelWithTools = groqModel.bindTools(tools);

/**
 * Decision model — Llama 3.3 70B with structured output schema.
 *
 * Used in the makeDecision node only. Receives all accumulated research
 * from the messages array and must output a structured INVEST/PASS decision.
 * Cannot call tools — its only job is to synthesize and decide.
 */
export const structuredModel = groqModel.withStructuredOutput(
  investmentDecisionSchema,
  {
    method: 'jsonMode',
  }
);
