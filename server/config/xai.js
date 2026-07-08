/**
 * config/xai.js
 *
 * Initializes and exports the xAI (Grok) LLM instance.
 *
 * Responsibility:
 *   - Create a single, reusable LangChain ChatOpenAI instance pointing to xAI
 *   - Apply configuration from the centralized config module
 *
 * Why xAI instead of Gemini:
 *   - xAI's Grok API is OpenAI-compatible — uses the same REST interface
 *   - LangChain's ChatOpenAI supports a custom baseURL, making the swap trivial
 *   - grok-3-mini is fast, cheap, and fully supports function/tool calling
 *     which LangGraph requires for the ReAct research loop
 *
 * Why a separate file:
 *   - LLM initialization is configuration, not business logic
 *   - Keeps agent/graph files clean — they import a ready-to-use model
 *   - Easy to swap LLM providers: replace this file, nothing else changes
 *
 * LangChain Concept — ChatOpenAI with custom baseURL:
 *   LangChain provides a unified interface for all LLMs. ChatOpenAI normally
 *   points to OpenAI's servers, but accepts a baseURL override. xAI exposes
 *   an OpenAI-compatible endpoint at https://api.x.ai/v1, so we can use the
 *   same LangChain class without any custom provider package.
 *   This means .invoke(), .bindTools(), and .withStructuredOutput() all work
 *   identically to how they worked with Gemini.
 *
 * Dependencies: config/index.js, @langchain/openai
 * Dependents: agents/investmentAnalyst.js, graph/researchGraph.js
 */

import { ChatOpenAI } from '@langchain/openai';
import config from './index.js';

/**
 * xAI Grok LLM instance configured for investment analysis.
 *
 * Temperature is set low (0.2) because:
 *   - Financial analysis requires consistent, factual responses
 *   - Low temperature = more deterministic = fewer hallucinations
 *   - High temperature = more creative = inappropriate for investment decisions
 *
 * modelKwargs disables the parallel tool call feature because LangGraph's
 * ReAct loop works best when the model calls one tool at a time — this
 * keeps the agent loop predictable and easy to debug.
 */
const xaiModel = new ChatOpenAI({
  apiKey: config.xai.apiKey,
  model: config.xai.model,
  temperature: config.xai.temperature,
  maxRetries: 2,
  configuration: {
    baseURL: 'https://api.x.ai/v1',
  },
});

export default xaiModel;
