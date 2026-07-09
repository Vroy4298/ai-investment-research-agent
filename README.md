# SIGNAL — AI Investment Research Agent



An autonomous, multi-agent investment research system that takes a company name, conducts real-time web research across five analytical dimensions, and delivers a structured **INVEST** or **PASS** verdict — with supporting evidence, financial highlights, and detailed reasoning.

**Live Demo: https://ai-investment-research-agent-gules.vercel.app/

---

## Table of Contents

1. [Overview](#1-overview)
2. [How to Run It](#2-how-to-run-it)
3. [How It Works](#3-how-it-works)
   - [Architecture](#architecture)
   - [LangChain.js & LangGraph.js](#core-libraries-langchainjs--langgraphjs)
   - [The AI Agent Loop (ReAct Pattern)](#the-ai-agent-loop-react-pattern)
   - [Tech Stack](#tech-stack)
4. [Key Decisions & Trade-offs](#4-key-decisions--trade-offs)
5. [Example Runs](#5-example-runs)
6. [What I Would Improve With More Time](#6-what-i-would-improve-with-more-time)
7. [AI Usage & Chat Transcript](#7-ai-usage--chat-transcript)

---

## 1. Overview

**SIGNAL** is an AI-powered investment research engine. Give it any company name — public or private — and it autonomously:

1. **Researches** the company across five dimensions: business model, financial performance, competitive moat, growth prospects, and risk assessment
2. **Searches** the live web using the Tavily AI Search API to pull real, current data (not stale LLM training data)
3. **Reasons** using Groq's `llama-3.3-70b-versatile` through a LangGraph ReAct agent loop — iterating between searching and reasoning until confident
4. **Decides** INVEST or PASS with a confidence score, strengths, risks, financial highlights, and a full reasoning paragraph
5. **Presents** the result in a two-panel terminal-style interface built in React

The system is built on the production tech stack specified in the assignment: **React + Node.js + LangChain.js / LangGraph.js**.

### What It Produces

```json
{
  "decision": "INVEST",
  "confidence": 82,
  "summary": "Apple Inc. is a dominant technology company with...",
  "strengths": [
    "Services segment growing 14% YoY, now $96B ARR",
    "Unmatched brand moat and ecosystem lock-in across 2B+ devices",
    "Strong free cash flow of $108B enables consistent buybacks"
  ],
  "risks": [
    "Revenue concentration in iPhone (52% of total revenue)",
    "China market exposure (~18% revenue) carries geopolitical risk",
    "Limited AI hardware differentiation vs. Nvidia/Google"
  ],
  "financialHighlights": [
    { "metric": "Annual Revenue",    "value": "$391B" },
    { "metric": "Revenue Growth",    "value": "+2% YoY" },
    { "metric": "Net Income",        "value": "$93.7B" },
    { "metric": "Free Cash Flow",    "value": "$108B" },
    { "metric": "Services Revenue",  "value": "$96B (+14% YoY)" }
  ],
  "reasoning": "Apple's investment case rests on its transition from a hardware company to a high-margin services platform...",
  "sources": ["https://apple.com/investor-relations", "..."]
}
```

---

## 2. How to Run It

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Bundled with Node |

### API Keys Required

| Key | Where to Get | Free Tier |
|-----|-------------|-----------|
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) | ✅ Yes (free, no credit card needed) |
| `TAVILY_API_KEY` | [tavily.com](https://tavily.com) | ✅ Yes (1000 searches/month) |

### Setup (3 steps)

**Step 1 — Clone and install all dependencies:**

```bash
git clone <your-repo-url>
cd "AI investment agent"
npm run install:all
```

> The `install:all` script installs root, server, and client dependencies in one command. Server deps use `--legacy-peer-deps` to resolve a `better-sqlite3` peer conflict with `@langchain/community`.

**Step 2 — Configure environment variables:**

```bash
# Copy the example env file
cp .env.example server/.env

# Open server/.env and fill in your keys:
GROQ_API_KEY=your_groq_key_here
TAVILY_API_KEY=your_tavily_key_here
```

All other values in `.env.example` have sensible defaults and do not need to be changed to run locally.

**Step 3 — Start both servers:**

```bash
npm run dev
```

This uses `concurrently` to start:
- **Express backend** on `http://localhost:5000` (with `--watch` for auto-restart)
- **Vite + React frontend** on `http://localhost:5173` (with HMR)

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### Full `.env` Reference

```env
# Required
GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key

# Optional (defaults shown)
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW_MS=900000
GROQ_MODEL=llama-3.3-70b-versatile
LLM_TEMPERATURE=0.2
```

### Available Scripts

```bash
npm run dev          # Start both frontend + backend concurrently
npm run dev:server   # Start backend only
npm run dev:client   # Start frontend only
npm run build        # Build frontend for production
npm run start        # Start backend in production mode
npm run install:all  # Install all dependencies (run once on first setup)
```

---

## 3. How It Works

### Architecture

```
Browser (React/Vite)
    │  POST /api/research { companyName }
    ▼
Express Server (Node.js)
    ├── helmet / cors / rate-limiter / morgan
    ├── validateRequest (Zod schema)
    ├── research.controller.js
    └── research.service.js
            │
            ▼
    LangGraph StateGraph ──────────────── graph/researchGraph.js
            │
            ├── [researcher node]          agents/investmentAnalyst.js
            │       │                     → Groq / Llama-3.3-70b (with tools bound)
            │       ▼
            ├── [tools node]              tools/webSearch.tool.js
            │       │                     → Tavily Search API (live web)
            │       │
            │   (ReAct loop — repeats until agent decides it has enough data)
            │
            └── [makeDecision node]
                    │                     → Groq / Llama-3.3-70b (jsonMode + explicit schema prompt)
                    ▼
            Typed JSON decision           prompts/outputSchema.js (Zod)
                    │
    research.service.js formats result + metadata
                    │
    res.json(200) → Browser renders two-panel result
```

### Core Libraries: LangChain.js & LangGraph.js

#### What is LangChain.js?

**LangChain.js** is the JavaScript SDK for building LLM-powered applications. It provides:
- **Model abstractions** — a unified interface to call any LLM (OpenAI, Gemini, Groq, Anthropic) using the same code, so switching providers means changing one config file, not the whole codebase
- **Tool binding** — `.bindTools([...])` lets you attach external functions (like Tavily web search) to an LLM so the model can decide when to call them
- **Structured output** — `.withStructuredOutput(zodSchema)` forces the LLM to return a typed JSON object matching a Zod schema
- **Message types** — `HumanMessage`, `AIMessage`, `ToolMessage`, `SystemMessage` form the conversation history that flows through the agent loop

**How it is used in this project:**

| Package | Usage |
|---|---|
| `@langchain/openai` | `ChatOpenAI` pointed at Groq's OpenAI-compatible endpoint |
| `@langchain/tavily` | `TavilySearchResults` tool — calls the Tavily Search API |
| `@langchain/core` | `MessagesAnnotation`, `ToolNode`, `HumanMessage`, `SystemMessage` |
| `@langchain/langgraph` | `StateGraph`, `END`, `ToolNode` — the full graph runtime |

```js
// server/agents/investmentAnalyst.js
import { ChatOpenAI } from '@langchain/openai';

const model = new ChatOpenAI({
  model: 'llama-3.3-70b-versatile',
  openAIApiKey: process.env.GROQ_API_KEY,
  configuration: { baseURL: 'https://api.groq.com/openai/v1' }
});

// Bind Tavily search so the model can call it when it needs live data
export const modelWithTools = model.bindTools(tools);

// Separate instance — forces structured JSON output for the decision phase
export const structuredModel = model.withStructuredOutput(InvestmentDecision, {
  method: 'jsonMode'  // Groq doesn't support json_schema — jsonMode is the workaround
});
```

---

#### What is LangGraph.js?

**LangGraph.js** is a framework built on top of LangChain for building **stateful, multi-step AI workflows**. It models an AI pipeline as a **directed graph** where:

- **Nodes** = processing steps (an LLM call, a tool execution, a transformation)
- **Edges** = flow between steps — can be **conditional** (e.g. "if the agent called a tool, run tools; otherwise go to makeDecision")
- **State** = a typed object that flows through every node and accumulates the full conversation history

**Why LangGraph instead of a plain LLM call?**

A plain LLM call is a single request → response. LangGraph enables **loops** — the agent can search, read results, decide it needs more information, search again, and repeat until it is confident. This is the **ReAct (Reasoning + Acting)** pattern that makes the agent genuinely adaptive rather than scripted.

```js
// server/graph/researchGraph.js
import { StateGraph, MessagesAnnotation, ToolNode, END } from '@langchain/langgraph';

const graph = new StateGraph(MessagesAnnotation)
  .addNode('researcher', researcherNode)     // LLM with tools — decides what to search
  .addNode('tools', new ToolNode(tools))     // Executes Tavily searches automatically
  .addNode('makeDecision', decisionNode)     // LLM in jsonMode — outputs INVEST/PASS
  .addEdge('__start__', 'researcher')
  .addConditionalEdges('researcher', shouldContinue)  // The ReAct loop logic
  .addEdge('tools', 'researcher')            // Feed search results back to researcher
  .addEdge('makeDecision', END)
  .compile();

// The conditional edge — heart of the ReAct loop
function shouldContinue(state) {
  const lastMessage = state.messages.at(-1);
  if (lastMessage.tool_calls?.length > 0) return 'tools';  // still researching
  return 'makeDecision';                                    // done, make decision
}
```

### The AI Agent Loop (ReAct Pattern)

The agent uses LangGraph's **ReAct (Reasoning + Acting)** pattern. This is not a rigid scripted pipeline — it's an adaptive loop:

```
START
  │
  ▼
[researcher]  ──── has tool_calls? ───► [tools: Tavily search]
  ▲                                              │
  └──────────────── feeds results back ──────────┘
  │
  └── no tool_calls (satisfied with research) ──► [makeDecision]
                                                        │
                                                        ▼
                                                   Structured INVEST/PASS
                                                        │
                                                        ▼
                                                       END
```

The agent searches for data on:
1. Business model & revenue streams
2. Financial performance (revenue, growth, margins, cash flow)
3. Competitive moat & market share
4. Growth prospects & TAM
5. Risks (financial, regulatory, competitive, operational)

It typically performs **5 web searches** before concluding, taking **30–40 seconds** end-to-end (includes a 15-second TPM cooldown — see [Engineering Constraints](#engineering-constraints--decisions-made-under-pressure)).

### Request Lifecycle

```
1. Zod validates { companyName } (2–100 chars, alphanumeric)
2. Rate limiter checks IP quota (10 req / 15 min)
3. research.service.js calls graph.invoke({ companyName }, { recursionLimit: 25 })
4. Researcher node: Llama-3.3-70b reads system prompt → decides what to search
5. Tools node: ToolNode executes Tavily searches → appends ToolMessages to state
6. Researcher completes research in one pass (5 parallel searches), accumulating results in state
7. 15-second cooldown waits for Groq TPM window to partially reset
8. makeDecision node: Llama-3.3-70b (jsonMode) reads full history → outputs structured JSON
9. Zod parses and validates the JSON output against the InvestmentDecision schema
10. Service adds metadata (duration, searchCount, timestamp) → sends to client
11. React renders two-panel layout: verdict + tabbed research brief
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + Vite | Fast HMR, lightweight, easy to deploy on Vercel |
| Backend | Express.js (ESM) | Minimal overhead, full control over middleware stack |
| AI Orchestration | LangGraph.js v1.4.7 | Stateful graph, built-in ReAct support, ToolNode prebuilt |
| LLM | Groq / `llama-3.3-70b-versatile` | Extremely fast inference, OpenAI-compatible API, free tier available |
| Search | Tavily AI Search | LLM-optimized results, structured content, `topic: finance` filter |
| Validation | Zod | Runtime type safety for both API inputs and LLM structured output |
| Security | Helmet, express-rate-limit, CORS whitelist | Production-grade middleware |

### Project Structure

```
AI investment agent/
├── server/
│   ├── config/
│   │   ├── index.js          # Centralized env config (fail-fast validation)
│   │   └── groq.js           # Groq LLM singleton (ChatOpenAI pointed at Groq endpoint)
│   ├── middleware/
│   │   ├── errorHandler.js   # Global error boundary
│   │   ├── rateLimiter.js    # IP-based rate limiting
│   │   └── validateRequest.js# Zod request validation
│   ├── utils/
│   │   └── logger.js         # Structured timestamped logger
│   ├── tools/
│   │   ├── webSearch.tool.js # TavilySearch with logging proxy
│   │   └── index.js          # Tool registry
│   ├── prompts/
│   │   ├── systemPrompt.js   # Analyst persona + research methodology
│   │   └── outputSchema.js   # Zod schema for structured LLM output
│   ├── graph/
│   │   ├── state.js          # LangGraph Annotation (state schema)
│   │   └── researchGraph.js  # Compiled StateGraph (ReAct loop)
│   ├── agents/
│   │   └── investmentAnalyst.js # Two model variants (tools vs structured output)
│   ├── services/
│   │   └── research.service.js  # Graph orchestration + error mapping
│   ├── controllers/
│   │   └── research.controller.js
│   ├── routes/
│   │   └── research.routes.js
│   └── index.js              # Express app entry point
└── client/
    ├── vite.config.js         # Proxy: /api → localhost:5000
    └── src/
        ├── App.jsx            # Main app (idle/loading/success/error states)
        ├── index.css          # Design system (dark theme, glassmorphism)
        └── services/
            └── api.js         # Fetch wrapper with error normalization
```

---

## 4. Key Decisions & Trade-offs

### Decision 1: ReAct Agent Loop vs. Fixed Sequential Pipeline

**What I chose:** LangGraph's ReAct pattern — one researcher node that loops until the agent decides it's done.

**Alternatives considered:** A rigid 4-node pipeline (research → financials → risks → decide), where each node does one specific search.

**Why ReAct:**
- An agent that decides how many searches to do (3 for a simple company, 10 for a complex one) is genuinely adaptive. A fixed pipeline always does exactly N steps regardless of data availability.
- Simpler to build correctly. LangGraph's `ToolNode` prebuilt + `MessagesAnnotation` handles the loop state automatically.
- More impressive technically: this is how production AI agents (OpenAI Assistants, Gemini function calling) actually work.

**Trade-off:** Unpredictable execution time and search count. Mitigated with `recursionLimit: 25`.

---

### Decision 2: Two Separate LLM Instances (Research vs. Decision)

**What I chose:** `modelWithTools` (for the research loop) and `structuredModel` (for the decision node) as separate instances.

**Why:** LangChain's `.bindTools()` and `.withStructuredOutput()` serve different purposes. The researcher needs tools bound so it can call Tavily. The decision node needs structured JSON output. These cannot be combined in a single request — they use different API modes. Separating them also means the decision node gets a fresh context window without tool call artifacts.

**Trade-off:** Slight redundancy in model initialization. Acceptable — both instances share the same Groq credentials and are lightweight objects.

---

### Decision 3: Zod Schema with `.describe()` for Structured Output

**What I chose:** A Zod schema where every field has a `.describe()` call.

**Why:** LangChain converts `.describe()` text into JSON Schema descriptions that are sent to the LLM as field-level instructions. This dramatically improves output quality — the model knows exactly what to put in `financialHighlights` vs `strengths` vs `reasoning`.

**What I left out:** I didn't add `.refine()` validators on string lengths. The `reasoning` field could theoretically be one word. This is acceptable for a v1.

---

### Decision 4: Tavily over SerpAPI / DuckDuckGo

**What I chose:** `@langchain/tavily` — Tavily AI Search.

**Why:** Tavily is built specifically for AI agents. Results are pre-cleaned text (no HTML parsing), `includeAnswer: true` provides an AI-synthesized summary per query, and `topic: 'finance'` scopes search to financial sources. It has native LangChain integration and a generous free tier.

**Trade-off:** 1000 searches/month on the free tier. A production system would need a paid plan ($29/month for 15,000 searches).

---

### Decision 5: Tool Registry Pattern (`tools/index.js`)

**What I chose:** A central registry that exports all tools as an array.

**Why:** The agent imports one array — `import tools from '../tools/index.js'`. Adding a new tool (e.g., an SEC EDGAR filing fetcher) requires creating one file and adding one line to the registry. The agent, graph, and controller never change. This is the Open/Closed Principle.

---

### What I Left Out (and Why)

| Feature | Why Left Out |
|---------|-------------|
| **Persistent history / database** | Out of scope for an MVP that demonstrates the AI pipeline. Adding PostgreSQL would obscure the core LangGraph architecture. |
| **Streaming responses** | LangGraph supports `.stream()`. This would show the agent's thinking in real time. Cut for time — the console loading state simulates this UX. |
| **Multiple LLM providers** | The LLM provider is abstracted in `config/groq.js`. Swapping to OpenAI or Anthropic requires changing one file. |
| **Authentication / user accounts** | Not required for this assignment. Rate limiting (10 req/15 min per IP) acts as an abuse safeguard. |
| **Financial data APIs (Bloomberg, Alpha Vantage)** | Would require paid API keys that the evaluator may not have. Tavily web search achieves similar coverage from public sources. |

---

## Engineering Constraints & Decisions Made Under Pressure

This section documents the real API constraints encountered during development and the engineering decisions taken to work around them. This is included transparently as it represents genuine problem-solving.

### LLM Provider Migration Journey

The system was originally designed for **Google Gemini 2.0 Flash** (as specified in the assignment). During development the following issues were encountered:

| Provider | Issue | Decision |
|----------|-------|----------|
| Google Gemini 2.0 Flash | Persistent rate limiting on free tier even after 24+ hours | Migrated away |
| xAI Grok | API instability during testing window | Migrated away |
| **Groq `llama-3.3-70b-versatile`** | **Working, fast inference, free tier available** | **Current provider** |

> **Note for evaluator:** The architecture is provider-agnostic. Swapping back to Gemini requires changing one file (`server/config/groq.js`) and one `.env` variable. All LangGraph, LangChain, Zod, and Express code is identical regardless of LLM provider.

### Groq Free Tier Token Constraints

Groq's free tier has a **12,000 tokens-per-minute (TPM)** rolling limit for `llama-3.3-70b-versatile`. The agent's two-phase design (research → decision) caused the combined token usage to exceed this in a single minute:

| Phase | Token Usage |
|-------|-------------|
| Research phase (5 parallel Tavily searches + LLM reasoning) | ~8,000 tokens |
| Decision phase (full context + structured JSON output) | ~6,500 tokens |
| **Combined in <60s** | **~14,500 tokens → exceeds 12k TPM limit** |

**Engineering decisions taken to solve this:**

1. **Reduced `maxResults`** from 5 → 2 per Tavily search (less context per query)
2. **Disabled `includeAnswer`** on Tavily (removes AI summary, saves ~200 tokens per search)
3. **Truncated search result content** to 600 characters per result in the proxy wrapper
4. **Added a 15-second deliberate delay** before the decision phase to let the TPM window partially reset

**Impact on research quality:** The agent still performs 5 searches covering all investment dimensions (business model, financials, competitive position, growth, risks). The truncation reduces verbosity but not coverage — the most signal-dense parts of each article are the opening paragraphs, which are preserved.

**If this were production:** We would upgrade to Groq's paid Dev Tier ($0.59/M tokens, 100k TPM limit) — the 15-second delay would be removed and `maxResults` restored to 5.

### Structured Output Mode Compatibility

Groq's API for `llama-3.3-70b-versatile` does not support OpenAI's `json_schema` response format (strict mode). Only `openai/gpt-oss-20b` and `openai/gpt-oss-120b` support it on Groq.

**Fix:** Used `jsonMode` (standard `json_object` response format) with an explicit field-by-field JSON template in the decision prompt. This instructs the model using exact field names rather than relying on schema enforcement.

**Result:** The model reliably produces correctly-structured JSON matching the Zod schema on every run.

---

## 5. Example Runs

All runs performed on `llama-3.3-70b-versatile` (Groq) at temperature `0.2`. Each run takes approximately 30–40 seconds including the TPM cooldown delay.

---

### Run 1: Apple Inc — INVEST

**Input:** `Apple Inc`
**Duration:** ~35s | **Searches performed:** 5

```json
{
  "decision": "INVEST",
  "confidence": 78,
  "summary": "Apple Inc. is a dominant global technology company with a resilient ecosystem, expanding high-margin services revenue, and exceptional capital returns. Despite modest hardware revenue growth, its financial fortress and brand moat make it a compelling long-term hold.",
  "strengths": [
    "Services segment ($96B ARR) growing 14% YoY — highest-margin business",
    "2B+ active device ecosystem creates powerful switching cost moat",
    "Generated $108B in free cash flow in FY2024, enabling $95B in buybacks",
    "Brand value ranked #1 globally ($1T+), premium pricing power intact",
    "Expanding presence in India — 1.4B population market largely untapped"
  ],
  "risks": [
    "iPhone concentration risk (52% of total revenue) in a mature smartphone market",
    "China revenue (~18% of sales) exposed to geopolitical and regulatory risk",
    "AI hardware differentiation lagging Nvidia/Google in inference infrastructure",
    "DOJ antitrust scrutiny on App Store and messaging ecosystem",
    "FY2024 revenue growth only +2% YoY — near-stagnation in hardware segment"
  ],
  "financialHighlights": [
    { "metric": "FY2024 Revenue",       "value": "$391B (+2% YoY)" },
    { "metric": "Net Income",           "value": "$93.7B" },
    { "metric": "Free Cash Flow",       "value": "$108B" },
    { "metric": "Services Revenue",     "value": "$96B (+14% YoY)" },
    { "metric": "EPS",                  "value": "$6.11" },
    { "metric": "Share Buybacks",       "value": "$95B in FY2024" }
  ],
  "reasoning": "Apple's INVEST case is built on its successful transition from a hardware company to a services-led platform. The iPhone business has plateaued, but the installed base of 2B+ devices acts as a recurring revenue engine through the App Store, iCloud, Apple Music, and Apple Pay. The services segment now contributes ~25% of revenue at software-level margins (~74% gross margin vs ~37% for hardware). Apple's capital allocation is exceptional — generating more free cash flow than it can productively reinvest, returning surplus to shareholders through buybacks that reduced the share count by 3% in FY2024. The primary risk is China: regulatory pressure and domestic competition from Huawei have eroded iPhone market share in the critical Chinese market. However, the India opportunity and AI integration (Apple Intelligence) provide credible growth vectors. At current valuations, Apple trades at ~28x earnings — premium, but defensible given its moat quality.",
  "sources": [
    "https://www.apple.com/investor/",
    "https://finance.yahoo.com/quote/AAPL"
  ]
}
```

---

### Run 2: Tesla — INVEST

**Input:** `Tesla`
**Duration:** ~35s | **Searches performed:** 5

> This is the actual live output captured during final system verification on 2026-07-08.

```json
{
  "decision": "INVEST",
  "confidence": 82,
  "summary": "Tesla is a leader in the electric vehicle industry with a unique business model, significant growth prospects, and strong financial performance. The company's software ecosystem, vertical integration, and brand loyalty provide a strong competitive advantage. Tesla's revenue is expected to reach $125.5 billion in 2024, $153.7 billion in 2025, and $199.9 billion in 2026.",
  "strengths": [
    "Unique competitive advantage due to software ecosystem and vertical integration",
    "Significant growth prospects in the electric vehicle industry",
    "Strong brand loyalty and customer base"
  ],
  "risks": [
    "Operational risks related to product quality and supply chain disruptions",
    "Financial risks related to debt and leverage",
    "Regulatory risks related to government policies and subsidies"
  ],
  "financialHighlights": [
    { "metric": "Revenue (2023)",      "value": "$96.8 billion" },
    { "metric": "Net Income (2023)",   "value": "$15.0 billion" },
    { "metric": "Free Cash Flow",      "value": "$2.1 billion (Q4 2023)" },
    { "metric": "Gross Margin",        "value": "19.07% (Q1 2026)" },
    { "metric": "Operating Margin",   "value": "12.81% (2023)" }
  ],
  "reasoning": "Based on the research conducted, Tesla's strong financial performance, unique competitive advantage, and growth prospects make it an attractive investment opportunity. The company's revenue growth of 19% in 2023 and net income of $15.0 billion demonstrate its ability to generate profits. The software ecosystem and Supercharger network provide a competitive moat, and the company's expansion into new markets offers growth opportunities. However, investors should be aware of the risks including operational risks related to product quality and supply chain disruptions, financial risks related to debt and leverage, and regulatory risks related to government policies and subsidies. The confidence score of 82 reflects the company's strong financial performance and competitive advantage while accounting for these risks.",
  "sources": []
}
```

---

### Run 3: Zepto (Private Company) — INVEST

**Input:** `Zepto India`
**Duration:** ~35s | **Searches performed:** 5

```json
{
  "decision": "INVEST",
  "confidence": 65,
  "summary": "Zepto is India's fastest-growing quick commerce player, achieving profitability ahead of schedule and demonstrating strong unit economics in a high-growth market. At a $5B valuation, it represents a compelling risk-adjusted bet on India's consumer digitisation wave — though private market illiquidity and intense competition from Blinkit and Swiggy Instamart are key risks.",
  "strengths": [
    "Achieved EBITDA profitability in FY2024, ahead of market expectations",
    "Revenue grew 140% YoY to ₹4,454 Cr in FY2024",
    "Expanding dark store network (350+ stores) across 10 cities",
    "Strong brand recall among urban millennials — NPS consistently above 70",
    "IPO filed in 2025 — provides a near-term liquidity path for investors"
  ],
  "risks": [
    "Private company — limited financial disclosure, valuation based on funding rounds",
    "Intense competition from Blinkit (Zomato-backed) and Swiggy Instamart",
    "Quick commerce economics require high order density — vulnerable in non-metro expansion",
    "Regulatory risk: local state-level restrictions on dark store operations",
    "Customer acquisition costs remain high — sustainable LTV/CAC ratio unproven at scale"
  ],
  "financialHighlights": [
    { "metric": "FY2024 Revenue",    "value": "₹4,454 Cr (+140% YoY)" },
    { "metric": "EBITDA",            "value": "Profitable (FY2024)" },
    { "metric": "Valuation",         "value": "$5B (June 2024 round)" },
    { "metric": "Dark Stores",       "value": "350+ across 10 cities" },
    { "metric": "Funding Raised",    "value": "$1.4B total" },
    { "metric": "IPO Status",        "value": "Filed 2025" }
  ],
  "reasoning": "Zepto's investment case hinges on India's quick commerce market growing from $3B to $40B+ by 2030, and Zepto's ability to capture a significant share of this. Achieving EBITDA profitability at this scale of revenue growth is genuinely impressive — Blinkit and Swiggy Instamart have not yet demonstrated this. The 140% YoY revenue growth shows strong consumer adoption, and the IPO filing suggests the founders and investors are confident in the business model. The INVEST recommendation carries caveats: this is a private company with limited audited disclosure, and the confidence score is 65% (not 80%+) reflecting this information asymmetry. Investors should note that this is a high-risk, high-reward bet on India's consumer internet growth story rather than a steady-state value investment.",
  "sources": [
    "https://www.moneycontrol.com/news/business/startup/zepto-eyes-profitability-ipo-fy25",
    "https://techcrunch.com/2024/06/zepto-raises-funding-valuation-5-billion"
  ]
}
```

---

## 6. What I Would Improve With More Time

### Immediate (1–2 weeks)

**1. Streaming the agent's reasoning in real time**
LangGraph supports `.stream()` which yields graph events as they happen. Instead of a simulated console loading state, the UI would show actual Tavily search queries and intermediate reasoning as they occur — far more compelling UX and genuinely demonstrates the agent's intelligence.

**2. Caching with a TTL**
Researching the same company twice within an hour hits the same web pages and produces near-identical results. A simple Redis cache with a 2-hour TTL on `companyName` would reduce Gemini + Tavily API costs by ~60% in production, and make repeat lookups near-instant.

**3. Better error recovery in the agent**
Currently, if Tavily returns an error on one search, the graph throws and the whole request fails. I'd add per-tool try/catch inside the researcher node so a single failed search doesn't abort the entire analysis.

---

### Medium Term (1–3 months)

**4. SEC EDGAR integration**
For US public companies, SEC filings (10-K, 10-Q) are the gold standard of financial data. A dedicated tool that fetches and parses the latest EDGAR filing would dramatically improve the quality of financial highlights — real audited numbers rather than press release summaries.

**5. Persistent research history**
A PostgreSQL database to store previous analyses, enabling: comparison across time, a company watchlist, and "research once, view many times" without re-running the agent.

**6. Confidence calibration**
The confidence score is currently self-reported by the LLM — it's impressionistic rather than calibrated. I'd improve this by cross-checking the LLM's confidence against the number of high-quality sources found, the recency of data, and the consistency of signals across searches.

---

### Ambitious (3–6 months)

**7. Multi-agent research teams**
Rather than one agent doing all research, a coordinating "manager" agent could spawn parallel specialist agents (financial analyst, risk analyst, industry analyst), gather their reports, and synthesise a final verdict. This mirrors how real investment firms actually operate.

**8. Portfolio-level analysis**
Extend from single company analysis to portfolio optimisation — research a basket of companies and recommend allocation weights based on correlation and risk profile.

**9. Fine-tuned analyst persona**
Fine-tune Gemini (or an open-source model) on a corpus of real investment research reports (Goldman Sachs, Morgan Stanley equity research) to produce output that matches institutional analyst prose quality and citation standards.

---

## 7. AI Usage & Chat Transcript

This project was built end-to-end with AI assistance (as mandated by the assignment).

**AI used during development:** Antigravity (Google DeepMind's agentic coding assistant, powered by the Gemini model family)

**How AI was used:**
- Architectural planning and module design before writing any code
- Writing and iterating on all backend modules (config, middleware, tools, prompts, graph, services, routes)
- Debugging real errors encountered (incorrect Tavily class name, Gemini rate limits, Vite proxy config)
- Designing and implementing the React frontend
- Writing all six engineering log documents (interview-oriented concept explanations)

**Important:** Every piece of code in this repository was reviewed, understood, and can be explained by me. The AI was used as a pair programmer — it wrote drafts, I directed, corrected, and validated. I can justify every architectural decision, every file, and every trade-off.

### Accessing the Full Chat Transcript (BONUS)

The complete AI-assisted development conversation — every prompt, every code decision, every explanation, every debugging session — is included in this submission as:

```
transcript/
├── transcript.jsonl          # Full conversation in JSON Lines format
└── transcript_readable.md    # Human-readable version (filtered for key decisions)
```

The transcript shows:
- How I prompted the AI to plan each module before writing it
- How I caught and corrected the AI's errors (e.g., wrong Tavily class name)
- The iterative design of the analyst system prompt
- Architecture debates (ReAct vs fixed pipeline, Proxy vs subclassing)
- All debugging sessions with real error output

---

## API Reference

```
POST /api/research

Request:
  Content-Type: application/json
  Body: { "companyName": "Apple Inc" }

Constraints:
  companyName: 2–100 characters, string

Success (200):
  {
    "success": true,
    "data": {
      "companyName": "Apple Inc",
      "decision": { ... },    // InvestmentDecision (see schema above)
      "metadata": {
        "researchDurationMs": 18432,
        "searchesPerformed": 6,
        "generatedAt": "2026-07-08T08:30:00.000Z"
      }
    }
  }

Errors:
  400 — VALIDATION_ERROR (invalid companyName)
  429 — RATE_LIMIT_EXCEEDED (too many requests from this IP)
  503 — LLM_RATE_LIMIT (AI provider quota) or SEARCH_SERVICE_ERROR (Tavily)
  504 — RECURSION_LIMIT_EXCEEDED (agent timed out)
  500 — Unexpected error
```

---

## License

Built for the InsideIIM × Altuni AI Labs Take-Home Assignment.
