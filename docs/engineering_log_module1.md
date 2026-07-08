# AI Investment Agent — Engineering Log & Interview Prep
### Module 1: Project Scaffold

---

## What We Built

A production-grade monorepo scaffold for an AI Investment Research Agent.

```
ai-investment-agent/
├── client/               ← React + Vite frontend
├── server/               ← Node.js + Express backend
│   ├── config/           ← LLM init, env config
│   ├── middleware/       ← CORS, rate limiting, error handling
│   ├── routes/           ← URL → controller mapping
│   ├── controllers/      ← HTTP request/response handling
│   ├── services/         ← Business logic orchestration
│   ├── graph/            ← LangGraph state machine
│   ├── agents/           ← LLM agent executor
│   ├── tools/            ← Things the agent can call
│   ├── prompts/          ← All LLM prompts
│   ├── utils/            ← Stateless helpers
│   └── index.js          ← Express entry point
├── .env.example          ← Safe, public config template
├── .gitignore            ← Keeps secrets out of git
└── package.json          ← Monorepo root scripts
```

---

## Concept 1 — Monorepo Architecture

### What is it?
A **monorepo** is a single git repository that contains multiple related projects — in our case, the `client/` (React) and `server/` (Express) together.

### Why did we choose it?
- Single submission zip for the take-home
- One `.env.example`, one `README.md`, one `git clone` gets everything
- Shared root `package.json` can orchestrate both apps with one command

### Interview Q: "Why not separate repos?"

> For a team project, separate repos give you independent deployments, separate CI/CD pipelines, and clear ownership boundaries. For a take-home or small project, a monorepo is the pragmatic choice — less overhead, easier to hand off and review.

### Trade-offs

| Monorepo | Separate Repos |
|---|---|
| ✅ Single clone, single submission | ✅ Independent deployments |
| ✅ Shared scripts and config | ✅ Better for large teams |
| ❌ Gets complex at scale | ❌ More setup overhead |
| ❌ Harder to set team permissions | ❌ Two repos to manage |

**Best choice here:** Monorepo — it's a solo take-home. Simplicity wins.

---

## Concept 2 — ES Modules (ESM) vs CommonJS

### What is it?
JavaScript has two module systems:

```js
// CommonJS (old) — require/module.exports
const express = require('express');
module.exports = router;

// ES Modules (new) — import/export
import express from 'express';
export default router;
```

### Why did we use ESM?
We set `"type": "module"` in `server/package.json`. This tells Node.js to treat every `.js` file as an ES Module.

**Reason:** LangChain.js is written as ESM. Mixing CJS and ESM causes `ERR_REQUIRE_ESM` errors that are painful to debug. By committing to ESM throughout, we avoid the entire class of import/export conflicts.

### Interview Q: "What's the difference between require() and import?"

> `require()` is synchronous and loads modules at runtime — it's the CommonJS (CJS) system used by older Node.js code. `import` is the ES Module (ESM) standard — it's static, meaning the module graph is resolved before code runs. ESM enables tree-shaking, top-level `await`, and works natively in browsers. Modern libraries like LangChain.js are ESM-first, so aligning your project with ESM avoids compatibility headaches.

### Trade-offs

| ESM | CommonJS |
|---|---|
| ✅ Native browser support | ✅ Massive ecosystem compatibility |
| ✅ Static analysis / tree-shaking | ✅ Works with older packages |
| ✅ LangChain.js compatible | ❌ Cannot use `require()` with ESM packages |
| ❌ No `__dirname` / `__filename` | ✅ `__dirname` works natively |
| ❌ Dynamic imports more verbose | ✅ `require()` is dynamic by default |

---

## Concept 3 — Environment Variables & `.env` Files

### What is it?
An environment variable is a value passed to your program from the operating system — not hardcoded in source code.

```bash
# Wrong (hardcoded secret in code — NEVER do this)
const apiKey = "AIzaSyABC123...";

# Right (read from environment)
const apiKey = process.env.GEMINI_API_KEY;
```

### The Three Files and Their Roles

| File | Git-tracked? | Contains real secrets? | Purpose |
|---|---|---|---|
| `.env.example` | ✅ Yes | ❌ No | Documents what env vars are needed |
| `server/.env` | ❌ No (in .gitignore) | ✅ Yes | Your real secrets — never committed |
| `.gitignore` | ✅ Yes | — | Ensures `.env` is never committed |

### The Mistake We Caught
The API keys were accidentally added to `.env.example` (the public template file) instead of `server/.env` (the private, ignored file). **This is one of the most common security mistakes in development.** Real keys in a public repo can be scraped by bots within minutes.

### Interview Q: "How do you manage secrets in a Node.js application?"

> I use `dotenv` to load environment variables from a `.env` file at runtime. The `.env` file is added to `.gitignore` and never committed. I maintain a `.env.example` that documents every variable with placeholder values — this is what gets committed. In production, secrets are injected via the hosting platform's environment variable dashboard (Vercel, Railway, etc.) — never via a `.env` file.

### Interview Q: "What happens if someone commits a `.env` file with real API keys?"

> The key should be considered compromised immediately — rotate it. Even if you remove it from git history, bots scan GitHub continuously. Beyond rotating, you'd use `git filter-branch` or BFG Repo Cleaner to rewrite history, and then force-push. The lesson is: prevent it with pre-commit hooks (like `git-secrets` or `husky + lint-staged`) that block commits containing secret patterns.

---

## Concept 4 — `dotenv` Package

### What is it?
`dotenv` reads your `.env` file and loads the key-value pairs into `process.env`.

```js
// At the very top of your entry file
import 'dotenv/config';

// Now anywhere in your app:
process.env.GEMINI_API_KEY  // ← Available
```

### Why `import 'dotenv/config'` instead of `dotenv.config()`?

With ESM, `import 'dotenv/config'` is the cleaner pattern — it's a side-effect import that runs the config loader immediately. With CJS you'd write `require('dotenv').config()`. Both do the same thing.

---

## Concept 5 — `concurrently` (Running Two Servers in Parallel)

### What is it?
In development we need two servers running simultaneously:
- **Vite dev server** on port 5173 (React frontend)
- **Express server** on port 5000 (Node.js backend)

`concurrently` is a npm package that runs multiple commands in parallel within one terminal.

```json
"dev": "concurrently --kill-others-on-fail --names \"SERVER,CLIENT\" --prefix-colors \"cyan,magenta\" \"npm run dev:server\" \"npm run dev:client\""
```

### Flags explained:
- `--kill-others-on-fail` → If server crashes, client process also dies. No orphaned processes.
- `--names` → Labels each process output for readability
- `--prefix-colors` → Color-codes the terminal output so you can instantly tell server vs client logs apart

### Interview Q: "Why not just open two terminal windows?"

> You could, and for a personal project it's fine. But using `concurrently` in `package.json` means any developer can clone the repo and run `npm run dev` to get the full development environment running. It's a DX (developer experience) decision — reduces onboarding friction and makes the project feel professional.

---

## Concept 6 — `node --watch` (Built-in Hot Reload)

### What is it?
Node.js 18+ has a built-in file watcher. When a file changes, Node restarts automatically.

```json
"dev": "node --watch index.js"
```

### Why not `nodemon`?

| `node --watch` | `nodemon` |
|---|---|
| ✅ Built into Node 18+ — zero dependencies | ✅ Highly configurable |
| ✅ Cleaner, no extra install | ✅ Ignore patterns, extensions |
| ❌ Less configurable | ❌ Extra dev dependency |

**Choice:** `node --watch` is the right call for this project. One less dependency, same result. A senior engineer prefers the platform's native capability over a third-party package when both do the job.

---

## Concept 7 — npm Package Versioning (`^` vs `~` vs exact)

### What do the symbols mean?

```json
"express": "^4.21.2"   // ^ = compatible with 4.x.x (minor + patch updates ok)
"express": "~4.21.2"   // ~ = 4.21.x only (patch updates ok)
"express": "4.21.2"    // exact = only this exact version
```

### Interview Q: "Which versioning strategy do you use in production?"

> In production, I use **exact versions** or commit the `package-lock.json` so every install gets identical dependencies. Using `^` in `dependencies` is fine during development but risky in production — a minor version bump in a dependency can introduce breaking changes. For a take-home project, `^` is acceptable since we're locking via `package-lock.json` and the project has a finite lifetime.

---

## Concept 8 — The Dependency Conflict We Hit (Peer Deps)

### What happened?
When we ran `npm install`, we got:

```
npm error ERESOLVE unable to resolve dependency tree
npm error Found: better-sqlite3@12.11.1
npm error peerOptional better-sqlite3@">=9.4.0 <12.0.0" from @langchain/community
```

### What does this mean?
`@langchain/community` said *"I need `better-sqlite3` between version 9.4.0 and 12.0.0"* but something else in the tree already pulled in `12.11.1`. npm's strict peer dep resolution refused to proceed.

### The Fix: `--legacy-peer-deps`
```bash
npm install --legacy-peer-deps
```

This tells npm to use the older, more permissive peer resolution algorithm — it installs the packages and trusts that the author marked the peer dep correctly. Since `better-sqlite3` is an **optional** peer dep (for a database integration we don't use), this is completely safe.

### Interview Q: "What's a peer dependency?"

> A peer dependency is a dependency that your package **expects the consumer to provide** — rather than bundling it itself. It's used when multiple packages need to share the same instance of a library (like React components all needing the same version of React). If the consumer installs a version outside the specified range, npm warns or errors. `--legacy-peer-deps` bypasses strict checking, which is pragmatic for ecosystems like LangChain where transitive deps are complex.

### Why we also deprecated `@langchain/community`
We discovered `@langchain/community` is **deprecated**. The LangChain team has moved individual integrations to their own packages. We switched to:

```json
"@langchain/tavily": "^1.2.0"  // ← standalone, maintained
```

Instead of:
```json
"@langchain/community": "^1.1.29"  // ← deprecated, avoid
```

**Lesson:** Always read npm install output. Deprecation warnings matter — deprecated packages don't receive security updates.

---

## Concept 9 — The Package Architecture (Why These Specific Packages?)

### `express` — Web Framework
The de-facto Node.js HTTP framework. Minimal, un-opinionated, massive ecosystem. We use it to define routes, parse request bodies, and send responses.

### `helmet` — Security Headers
```js
app.use(helmet());
```
Adds ~15 HTTP security headers automatically (Content-Security-Policy, X-Frame-Options, etc.). One line of code, significant security improvement.

**Interview Q:** "What does `helmet` do?" → *"Helmet sets HTTP response headers that protect against common web vulnerabilities like XSS, clickjacking, and MIME-type sniffing. It's a middleware that adds headers like `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security` with sensible defaults."*

### `morgan` — HTTP Request Logger
Logs every incoming request: method, URL, status code, response time. Essential for debugging and monitoring.

### `express-rate-limit` — Abuse Prevention
Limits how many requests a single IP can make in a time window. Without this, anyone could spam your AI endpoint and rack up huge API costs.

### `cors` — Cross-Origin Resource Sharing
Browsers block requests from one origin (e.g., `localhost:5173`) to another (e.g., `localhost:5000`) by default. CORS middleware tells the browser which origins are allowed.

### `zod` — Schema Validation
Runtime validation library. We use it for:
1. Validating incoming API requests (company name input)
2. Parsing and validating LLM output into structured data

**Interview Q:** "Why Zod over Joi or Yup?" → *"Zod is TypeScript-first but works perfectly in JavaScript. It has a great developer experience, excellent error messages, and integrates natively with LangChain's structured output parsing via `.withStructuredOutput(zodSchema)`."*

### `@langchain/langgraph` — The Core of the Agent
A graph-based orchestration framework. Instead of one big LLM call, the agent runs through defined nodes (steps) in a state machine. Each node has one responsibility. State flows between nodes.

### `@langchain/google-genai` — Google Gemini Integration
The official LangChain adapter for Google Gemini models. Provides a standard LangChain interface so Gemini works identically to OpenAI, Anthropic, or any other LLM.

### `@langchain/tavily` — Web Search Tool
Gives the agent the ability to search the web in real-time. Without this, the agent only knows what Gemini was trained on (which may be stale for financial data).

---

## Concept 10 — Clean Architecture (Folder Responsibility Rules)

This is the pattern we're following — each folder has one job:

```
routes/       → "What URL maps to what handler?" (no logic)
controllers/  → "Parse HTTP request, call service, send response" (no business logic)
services/     → "Orchestrate the agent and format the result" (no HTTP concerns)
graph/        → "Define the LangGraph state machine" (no HTTP, no formatting)
agents/       → "Configure the LLM agent" (just LLM setup)
tools/        → "What can the agent do?" (just tool definitions)
prompts/      → "What do we say to the LLM?" (just strings/templates)
utils/        → "Stateless helper functions" (no side effects)
config/       → "Centralized configuration" (one source of truth)
middleware/   → "Cross-cutting concerns" (applied to all routes)
```

### Interview Q: "Why separate routes from controllers?"

> Routes define the *contract* (which HTTP method on which URL) while controllers define the *behavior* (what to do with the request). Separating them means you can change your URL structure without touching business logic, and you can test controllers without spinning up a full HTTP server.

### Interview Q: "Why a dedicated `prompts/` folder?"

> Prompts change frequently during iteration — you tune them, test them, version them. If prompts are embedded inside agent code, every prompt change requires touching agent logic. Isolating prompts means a non-engineer (even a product manager) can read and iterate on them without understanding the orchestration code.

---

## Concept 11 — The `/health` Endpoint

```js
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});
```

### Why does every production server need this?

| Use Case | Why |
|---|---|
| **Load balancers** | Check if the instance is alive before routing traffic |
| **Deployment platforms** | Vercel, Railway, Docker verify the app started correctly |
| **Monitoring** | Uptime services ping `/health` every 30s |
| **Debugging** | First thing you check when "is the server even running?" |

### Interview Q: "What should a health endpoint return?"

> At minimum: a 200 status with `{"status": "ok"}`. In production you'd include version, uptime, and dependency health (database connected, external APIs reachable). But keep it lightweight — it should respond in < 10ms and never perform heavy computation.

---

## Issues Encountered — Root Causes & Fixes

### Issue 1: `ERESOLVE` Peer Dependency Conflict
- **Root cause:** `@langchain/community` had a strict peer dep on `better-sqlite3 <12.0.0` but the transitive tree resolved `12.11.1`
- **Fix:** `npm install --legacy-peer-deps`
- **Why safe:** `better-sqlite3` is an optional integration we don't use. The conflict is in dead code for our use case.

### Issue 2: `@langchain/langgraph@^0.2.77` Not Found
- **Root cause:** Version number was fabricated (hallucinated). Actual latest is `1.4.7`.
- **Fix:** Ran `npm view @langchain/langgraph version` to get the real version before installing.
- **Lesson:** Always verify package versions against the npm registry, especially for fast-moving AI libraries.

### Issue 3: `@langchain/community` Deprecated
- **Root cause:** LangChain split the community package into individual scoped packages.
- **Fix:** Replaced with `@langchain/tavily@^1.2.0` — the dedicated, maintained Tavily package.
- **Lesson:** Read deprecation warnings in install output. Deprecated packages stop receiving security fixes.

### Issue 4: API Keys Added to Wrong File
- **Root cause:** Keys were added to `.env.example` (git-tracked) instead of `server/.env` (git-ignored).
- **Fix:** Moved keys to `server/.env`, confirmed `.gitignore` covers it, verified via `node -e` that keys load correctly.
- **Lesson:** The difference between `.env` and `.env.example` is one of the most common beginner mistakes. `.env` = your secrets. `.env.example` = the documented shape.

---

## Commands Reference

```bash
# Install everything
npm install                          # root (installs concurrently)
npm install --legacy-peer-deps       # server (handles LangChain peer deps)
npm install                          # client (standard Vite deps)

# Run everything
npm run dev                          # starts both server + client

# Check a package's real latest version
npm view <package-name> version

# Verify env vars load correctly (ESM)
node -e "import('dotenv/config').then(() => console.log(process.env.GEMINI_API_KEY ? 'KEY SET' : 'MISSING'))"

# Test health endpoint
curl http://localhost:5000/health
```

---

## What's Next

| Module | What It Adds | Why It Matters |
|---|---|---|
| **Module 2** | Config + Middleware | Security headers, logging, error handling, rate limiting, input validation |
| **Module 3** | LangChain Tools | Tavily web search tool the agent can call |
| **Module 4** | Prompts | System prompts, analyst persona, structured output schema |
| **Module 5** | LangGraph Agent | The 4-node research → analyze → risk → decide graph |
| **Module 6** | Services | Bridges HTTP layer with the graph |
| **Module 7** | Routes + Controllers | Full REST API endpoint |
| **Module 8** | React Frontend | UI to enter company name, display results |
| **Module 9** | README | Professional submission documentation |
| **Module 10** | Vercel Deployment | Production deployment config |
