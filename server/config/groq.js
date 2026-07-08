/**
 * config/groq.js
 *
 * Initializes and exports the Groq LLM instance.
 *
 * Responsibility:
 *   - Create a single, reusable LangChain ChatOpenAI instance pointing to Groq
 *   - Apply configuration from the centralized config module
 *
 * Why Groq:
 *   - Groq provides extremely fast inference (token generation) via their LPU hardware
 *   - Generous free tier: 14,400 requests/day, 6,000 tokens/minute
 *   - Runs open-source models: Llama 3.3, Mixtral, Gemma, etc.
 *   - Fully OpenAI-compatible API — no new LangChain package needed
 *   - llama-3.3-70b-versatile fully supports tool/function calling,
 *     which LangGraph's ReAct loop requires
 *
 * Why a separate file:
 *   - LLM initialization is configuration, not business logic
 *   - Keeps agent/graph files clean — they import a ready-to-use model
 *   - Easy to swap LLM providers: replace this file, nothing else changes
 *
 * LangChain Concept — ChatOpenAI with custom baseURL:
 *   LangChain's ChatOpenAI accepts a baseURL override. Groq exposes an
 *   OpenAI-compatible endpoint at https://api.groq.com/openai/v1, so we
 *   can use the same LangChain class without any custom provider package.
 *   This means .invoke(), .bindTools(), and .withStructuredOutput() all work
 *   identically to how they work with OpenAI's own API.
 *
 * Dependencies: config/index.js, @langchain/openai
 * Dependents: agents/investmentAnalyst.js
 */

import { ChatOpenAI } from '@langchain/openai';
import config from './index.js';

/**
 * Groq LLM instance configured for investment analysis.
 *
 * Model: llama-3.3-70b-versatile
 *   - Meta's Llama 3.3 70B — state-of-the-art open model
 *   - 'versatile' variant optimized for instruction following and tool use
 *   - Supports parallel tool calling for LangGraph's ReAct loop
 *
 * Temperature is set low (0.2) because:
 *   - Financial analysis requires consistent, factual responses
 *   - Low temperature = more deterministic = fewer hallucinations
 *   - High temperature = more creative = inappropriate for investment decisions
 */
const groqModel = new ChatOpenAI({
  apiKey: config.groq.apiKey,
  model: config.groq.model,
  temperature: config.groq.temperature,
  maxRetries: 2,
  configuration: {
    baseURL: 'https://api.groq.com/openai/v1',
  },
});

export default groqModel;
