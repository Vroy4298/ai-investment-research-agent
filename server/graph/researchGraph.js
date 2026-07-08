/**
 * graph/researchGraph.js
 *
 * The LangGraph StateGraph that orchestrates the investment research pipeline.
 *
 * Responsibility:
 *   - Define each node (researcher, tools, makeDecision)
 *   - Connect nodes with edges and conditional routing
 *   - Compile and export the runnable graph
 *
 * Graph Architecture (ReAct Pattern):
 *
 *   START
 *     │
 *     ▼
 *   [researcher] ─── has tool calls? ──► [tools] ──┐
 *     ▲                                             │
 *     └─────────────────────────────────────────────┘
 *     │
 *     └── no tool calls (done researching) ──► [makeDecision] ──► END
 *
 * Why ReAct over a fixed sequential pipeline:
 *   The ReAct (Reasoning + Acting) pattern lets the agent decide how many
 *   searches to perform and what to search for — rather than being hardcoded
 *   to 3 fixed searches. Real research is adaptive. If the first search
 *   reveals a complex competitive landscape, the agent searches deeper.
 *   If data is scarce, it tries alternative queries. This is genuine
 *   agentic behavior, not a scripted lookup.
 *
 * LangGraph Concepts Used:
 *   - StateGraph: graph builder with typed state
 *   - Annotation: state schema (from graph/state.js)
 *   - ToolNode: prebuilt node that executes tool calls found in AI messages
 *   - Conditional edges: routing logic between nodes
 *   - START / END: reserved LangGraph entry and exit points
 *
 * Dependents: services/research.service.js
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

import { GraphAnnotation } from './state.js';
import { modelWithTools, structuredModel } from '../agents/investmentAnalyst.js';
import tools from '../tools/index.js';
import systemPrompt from '../prompts/systemPrompt.js';
import logger from '../utils/logger.js';

// ─── Node 1: Researcher ───────────────────────────────────────────────────────

/**
 * The researcher node — the heart of the agent.
 *
 * What it does:
 *   - On the first iteration: sets up the research context (system + human message)
 *   - On subsequent iterations: continues research using accumulated messages
 *   - Invokes modelWithTools, which either:
 *       A) Returns an AIMessage with tool_calls → routed to [tools]
 *       B) Returns an AIMessage with no tool_calls → routed to [makeDecision]
 *
 * How the agent decides it's done:
 *   The LLM itself decides. Once it's satisfied with the research it has
 *   accumulated (via tool results in the messages), it stops calling tools
 *   and returns a completion message. LangGraph detects the absence of
 *   tool_calls and routes to makeDecision.
 *
 * @param {GraphAnnotation.State} state - Current graph state
 * @returns {{ messages: AIMessage[] }} - New AI message to append to state
 */
async function researcherNode(state) {
  const { messages, companyName } = state;

  logger.agent(`Researcher node — messages so far: ${messages.length}`);

  // On the very first call, messages contains only what the service layer injected.
  // We build the full prompt context on every call so the model always has:
  //   1. System prompt (analyst persona + methodology)
  //   2. Initial research request
  //   3. All accumulated tool results from previous iterations
  const contextMessages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `You are tasked with conducting a comprehensive investment analysis of: **${companyName}**

Use the web search tool to research ALL of the following:
1. Business model, products/services, revenue streams
2. Financial performance: revenue, growth rate, profitability, cash flow
3. Competitive landscape and moat (unique advantages)
4. Growth prospects and market opportunity
5. Key risks: financial, competitive, regulatory, operational

Search multiple times with specific, targeted queries to gather thorough data.
When you have gathered sufficient information across all 5 dimensions, stop searching.`
    ),
    // Append all prior AI + Tool messages (the research history)
    ...messages,
  ];

  const response = await modelWithTools.invoke(contextMessages);
  logger.agent(
    response.tool_calls?.length
      ? `Calling ${response.tool_calls.length} tool(s): ${response.tool_calls.map((t) => t.name).join(', ')}`
      : 'Research complete — routing to decision'
  );

  return { messages: [response] };
}

// ─── Node 2: Tools ────────────────────────────────────────────────────────────

/**
 * The tools node — a LangGraph prebuilt that executes any tool calls
 * found in the last AI message.
 *
 * LangGraph Concept — ToolNode:
 *   ToolNode inspects the last AIMessage in state.messages for tool_calls.
 *   For each tool_call, it finds the matching tool by name, executes it,
 *   and returns ToolMessages with the results. These are appended to
 *   state.messages (via the append reducer), making them available
 *   to the researcher on its next iteration.
 *
 * We don't write this node ourselves — LangGraph's prebuilt handles it.
 * We only need to provide the same tools array that was bound to the model.
 */
const toolsNode = new ToolNode(tools);

// ─── Node 3: Make Decision ────────────────────────────────────────────────────

/**
 * The makeDecision node — synthesizes accumulated research into a structured decision.
 *
 * What it does:
 *   - Reads all messages from state (the complete research history)
 *   - Asks the structured model to synthesize a final INVEST/PASS decision
 *   - Returns the typed decision object (matching investmentDecisionSchema)
 *
 * Key difference from researcher node:
 *   Uses structuredModel (no tools) — forces Gemini to output typed JSON.
 *   This node does NOT loop. It runs exactly once and produces the final answer.
 *
 * @param {GraphAnnotation.State} state - Current graph state (full research history)
 * @returns {{ decision: InvestmentDecision }} - Structured decision object
 */
async function makeDecisionNode(state) {
  const { messages, companyName } = state;

  logger.agent(`Making investment decision for: ${companyName}`);

  // Wait 15 seconds before calling the decision model.
  // Why: Groq's free tier has a 12,000 TPM (tokens per minute) limit.
  // The research phase already uses ~8,000 tokens in tool calls and responses.
  // The decision call needs ~6,500 tokens. Combined they exceed the limit.
  // A 15-second pause lets the rolling TPM window partially reset so the
  // decision call succeeds without a 429 error.
  logger.agent('Waiting 15s for TPM window to reset before decision call...');
  await new Promise((resolve) => setTimeout(resolve, 15000));

  const synthesisMessages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `You are now tasked with conducting a comprehensive investment analysis of: **${companyName}**`
    ),
    ...messages,
    new HumanMessage(
      `Based on all the research you have conducted above on ${companyName}, ` +
        `provide your complete investment analysis and final INVEST or PASS decision. ` +
        `Be specific and cite the data you found.\n\n` +
        `You MUST respond with ONLY a valid JSON object using EXACTLY these field names:\n` +
        `{\n` +
        `  "decision": "INVEST" or "PASS",\n` +
        `  "confidence": <integer 0-100>,\n` +
        `  "summary": "<2-3 sentence executive summary>",\n` +
        `  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],\n` +
        `  "risks": ["<risk 1>", "<risk 2>", "<risk 3>"],\n` +
        `  "financialHighlights": [\n` +
        `    {"metric": "<metric name>", "value": "<value with units>"},\n` +
        `    {"metric": "<metric name>", "value": "<value with units>"}\n` +
        `  ],\n` +
        `  "reasoning": "<detailed 3-4 sentence explanation citing specific data>",\n` +
        `  "sources": ["<url1>", "<url2>"]\n` +
        `}\n\n` +
        `Do not use any other field names. Output raw JSON only — no markdown, no backticks.`
    ),
  ];

  const decision = await structuredModel.invoke(synthesisMessages);

  logger.agent(
    `Decision: ${decision.decision} (${decision.confidence}% confidence)`
  );

  return { decision };
}

// ─── Conditional Routing ──────────────────────────────────────────────────────

/**
 * Routing function for the edge leaving the researcher node.
 *
 * Logic:
 *   - If the last AI message contains tool_calls → the agent wants to search more
 *     → route to 'tools' node
 *   - If no tool_calls → the agent is satisfied with its research
 *     → route to 'makeDecision' node
 *
 * This is the core of the ReAct loop. The LLM's decision to call or not call
 * a tool determines whether the loop continues or terminates.
 *
 * @param {GraphAnnotation.State} state
 * @returns {'tools' | 'makeDecision'}
 */
function routeAfterResearch(state) {
  const lastMessage = state.messages[state.messages.length - 1];

  if (lastMessage?.tool_calls?.length > 0) {
    return 'tools';
  }

  return 'makeDecision';
}

// ─── Graph Construction ───────────────────────────────────────────────────────

/**
 * Build and compile the research graph.
 *
 * Compilation validates:
 *   - All referenced node names exist
 *   - All conditional edge return values map to valid nodes
 *   - The graph has a reachable START and END
 *
 * The compiled graph is a Runnable — it exposes .invoke(), .stream(), etc.
 */
const researchGraph = new StateGraph(GraphAnnotation)
  // Register nodes
  .addNode('researcher', researcherNode)
  .addNode('tools', toolsNode)
  .addNode('makeDecision', makeDecisionNode)

  // Entry point: always start at researcher
  .addEdge(START, 'researcher')

  // After researcher: conditionally go to tools or makeDecision
  .addConditionalEdges('researcher', routeAfterResearch, {
    tools: 'tools',
    makeDecision: 'makeDecision',
  })

  // After tools: always loop back to researcher
  .addEdge('tools', 'researcher')

  // After makeDecision: always end
  .addEdge('makeDecision', END);

// Compile the graph into a runnable
const app = researchGraph.compile();

export default app;
