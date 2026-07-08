/**
 * tools/index.js
 *
 * Tool registry — single export point for all agent tools.
 *
 * Responsibility:
 *   - Collect and export all available tools as an array
 *   - Act as the contract between tools/ and the agent/graph layers
 *
 * Why a registry pattern:
 *   The agent imports ONE array of tools. Adding a new tool means:
 *     1. Create the tool file in tools/
 *     2. Import and add it here
 *   The agent code never needs to change. This is the Open/Closed principle:
 *   open for extension (new tools), closed for modification (agent code).
 *
 * How tools flow to the agent:
 *   tools/index.js → agents/investmentAnalyst.js → model.bindTools(tools)
 *   → LangGraph nodes can call these tools during graph execution
 *
 * Dependents: agents/investmentAnalyst.js
 */

import webSearchTool from './webSearch.tool.js';

/**
 * All tools available to the investment research agent.
 *
 * The order doesn't matter — the LLM decides which tool to call
 * based on each tool's name and description.
 *
 * To add a new tool:
 *   1. Create tools/myNewTool.tool.js
 *   2. Import it here
 *   3. Add it to this array
 *   Agent behavior automatically updates — no other files need changing.
 */
const tools = [webSearchTool];

export default tools;
