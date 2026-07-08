/**
 * tools/webSearch.tool.js
 *
 * Web search tool powered by Tavily AI Search API.
 *
 * Responsibility:
 *   - Provide the LangGraph agent with real-time web search capability
 *   - Search for company information, financials, news, and risk factors
 *   - Return structured, relevant results the LLM can reason over
 *
 * Why Tavily over Google/Bing:
 *   - Built specifically for AI agents — returns clean, structured content
 *   - No HTML parsing or scraping needed — results are already text
 *   - Native LangChain integration via @langchain/tavily
 *   - Filters out irrelevant ads and boilerplate automatically
 *   - Free tier available (1000 searches/month)
 *
 * LangChain Concept — TavilySearch:
 *   A pre-built LangChain Tool that wraps the Tavily Search API.
 *   It exposes a standard tool interface: the LLM can call it by name
 *   ("tavily_search"), passing a { query } input, and receives structured
 *   search results. The agent uses this tool multiple times per research
 *   session with different queries — company overview, financial data,
 *   news, risks, competition — accumulating knowledge in the graph state.
 *
 * Tool Schema (what the LLM can pass):
 *   query         — The search string (required)
 *   searchDepth   — 'basic' | 'advanced' (optional)
 *   topic         — 'general' | 'news' | 'finance' (optional)
 *   timeRange     — 'day' | 'week' | 'month' | 'year' (optional)
 *
 * Dependents: tools/index.js → agents/ → graph/
 */

import { TavilySearch } from '@langchain/tavily';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Configured Tavily search tool for investment research.
 *
 * The API key is read from TAVILY_API_KEY env var automatically by TavilySearch,
 * but we pass it explicitly via config for clarity and testability.
 */
const tavilySearch = new TavilySearch({
  // Explicit API key from centralized config
  tavilyApiKey: config.tavily.apiKey,

  // Return up to 2 sources per query — keeps token count within Groq free-tier TPM limits.
  // The agent runs multiple searches, so total coverage remains thorough.
  maxResults: 2,

  // Disabled: the AI summary adds ~200 extra tokens per search which pushes
  // the context over Groq's 6000 TPM free-tier limit.
  includeAnswer: false,
});

/**
 * Logged wrapper around the Tavily tool.
 *
 * Uses a JavaScript Proxy to intercept .invoke() calls.
 * This adds observability (logging) without modifying the tool object itself.
 * All LangChain metadata (name, description, schema) is preserved on the target.
 *
 * Why Proxy over subclassing:
 *   TavilySearch has complex internal state. Subclassing LangChain tool classes
 *   can interfere with their internal initialization. A Proxy is non-invasive —
 *   it wraps the fully initialized object without touching its internals.
 */
const webSearchTool = new Proxy(tavilySearch, {
  get(target, prop) {
    if (prop === 'invoke') {
      return async (input) => {
        // Normalize input — LLMs pass tool args in different shapes:
        // - string: some models pass just the query string directly
        // - { query }: standard LangChain Tavily schema
        // - { input }: some open-source models use 'input' as the key
        // - { __arg1 }: Llama 3.x sometimes uses positional keys
        const query =
          typeof input === 'string'
            ? input
            : input?.query ?? input?.input ?? input?.__arg1 ?? JSON.stringify(input);

        logger.agent(`Searching: "${query}"`);

        const result = await target.invoke(input);

        // Truncate each result's content to ~600 chars to control token usage
        // This keeps the agent's context within Groq's free-tier TPM limits
        // while still providing the LLM with enough signal to reason over.
        const truncated = Array.isArray(result)
          ? result.map((r) =>
              typeof r?.content === 'string'
                ? { ...r, content: r.content.slice(0, 600) }
                : r
            )
          : result;

        const resultCount = Array.isArray(truncated) ? truncated.length : 1;
        logger.agent(`Got ${resultCount} result(s) for: "${query}"`);

        return truncated;
      };
    }

    // Preserve all other properties (name, description, schema, etc.)
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

export default webSearchTool;
