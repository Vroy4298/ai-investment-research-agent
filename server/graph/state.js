/**
 * graph/state.js
 *
 * Defines the shared state that flows through the LangGraph research graph.
 *
 * Responsibility:
 *   - Declare every piece of data that nodes read from and write to
 *   - Define how each field is updated when a node writes to it (reducer)
 *
 * LangGraph Concept — State & Reducers:
 *   In LangGraph, all nodes share a single state object. When a node returns
 *   data, LangGraph uses the field's "reducer" function to merge it with the
 *   existing state. This is the key difference from a simple function pipeline.
 *
 *   Two common reducer patterns:
 *     "replace": (current, new) => new     — overwrites the field
 *     "append":  (current, new) => [...current, ...new] — adds to the field
 *
 *   MessagesAnnotation uses the "append" reducer, which is why messages
 *   accumulate across nodes rather than being replaced.
 *
 * State Fields:
 *   messages     — Full conversation history (system, human, AI, tool messages)
 *                  Grows throughout the graph as research accumulates.
 *   companyName  — The company being researched (set once at graph entry)
 *   decision     — The final structured output (set by makeDecision node)
 *
 * Dependents: graph/researchGraph.js
 */

import { Annotation, MessagesAnnotation } from '@langchain/langgraph';

/**
 * GraphAnnotation — the complete state schema for the research graph.
 *
 * Extends MessagesAnnotation.spec which provides:
 *   messages: a messages array with append-reducer behavior.
 *   This means every node's returned messages are ADDED to the array,
 *   not replacing it — the full research history is always preserved.
 */
export const GraphAnnotation = Annotation.Root({
  // Inherit the messages array with its append reducer
  // This accumulates: SystemMessage, HumanMessage, AIMessage, ToolMessages
  ...MessagesAnnotation.spec,

  /**
   * The company name being researched.
   * Replace reducer (_, b) => b — always takes the latest value.
   * Set once at graph entry, read by nodes to contextualize prompts.
   */
  companyName: Annotation({
    reducer: (_, b) => b,
    default: () => '',
  }),

  /**
   * The final structured investment decision.
   * Replace reducer — set once by makeDecision node, null until then.
   * Shape matches investmentDecisionSchema from prompts/outputSchema.js
   */
  decision: Annotation({
    reducer: (_, b) => b,
    default: () => null,
  }),
});
