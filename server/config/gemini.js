/**
 * config/gemini.js
 *
 * Initializes and exports the Google Gemini LLM instance.
 *
 * Responsibility:
 *   - Create a single, reusable LangChain ChatGoogleGenerativeAI instance
 *   - Apply configuration from the centralized config module
 *
 * Why a separate file:
 *   - LLM initialization is configuration, not business logic
 *   - Keeps agent/graph files clean — they import a ready-to-use model
 *   - Easy to swap LLM providers: replace this file, nothing else changes
 *
 * Dependencies: config/index.js
 * Dependents: agents/, graph/
 *
 * LangChain Concept — ChatGoogleGenerativeAI:
 *   LangChain provides a unified interface for all LLMs. ChatGoogleGenerativeAI
 *   wraps the Google Gemini API and exposes it as a standard LangChain "chat model".
 *   This means we can call .invoke(), .stream(), or .withStructuredOutput() the
 *   same way regardless of whether the underlying model is Gemini, GPT-4, or Claude.
 *   This is the power of LangChain's abstraction layer.
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import config from './index.js';

/**
 * Gemini LLM instance configured for investment analysis.
 *
 * Temperature is set low (0.2) because:
 *   - Financial analysis requires consistent, factual responses
 *   - Low temperature = more deterministic = fewer hallucinations
 *   - High temperature = more creative = inappropriate for investment decisions
 */
const geminiModel = new ChatGoogleGenerativeAI({
  apiKey: config.gemini.apiKey,
  model: config.gemini.model,
  temperature: config.gemini.temperature,
  maxRetries: 2, // Retry on transient API failures before giving up
});

export default geminiModel;
