# AI Investment Agent — Engineering Log & Interview Prep
### Module 2: Config & Middleware

---

## What We Built

6 files that form the **security and reliability foundation** of the entire backend.
Every subsequent module (tools, agent, routes) builds on top of these.

```
server/
├── config/
│   ├── index.js           ← Centralized environment config (fail-fast)
│   └── gemini.js          ← Gemini LLM singleton initialization
├── middleware/
│   ├── errorHandler.js    ← Global error boundary
│   ├── rateLimiter.js     ← Abuse prevention
│   └── validateRequest.js ← Input validation with Zod
├── utils/
│   └── logger.js          ← Structured logging
└── index.js               ← Updated: all middleware wired in correct order
```

---

## Concept 1 — The Fail-Fast Pattern (`config/index.js`)

### What is it?
The fail-fast pattern means: **crash immediately at startup with a clear error message** if something required is missing, rather than failing silently minutes later during an API call.

```js
// Without fail-fast (bad — silent failure)
const apiKey = process.env.GEMINI_API_KEY;  // undefined — no error
llm.call(apiKey);  // crashes 30 seconds later with a confusing message

// With fail-fast (good — immediate, clear error)
function requireEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}
const apiKey = requireEnv('GEMINI_API_KEY');  // crashes NOW with clear message
```

### Why this matters
When the app starts and you have a missing API key, you want to know **at startup** — not after the server has been running for 10 minutes and the first user hits an error.

### Interview Q: "What is fail-fast and why is it a good pattern?"

> Fail-fast means your system detects and reports problems as early as possible — ideally at startup. The benefit is that errors are caught at a predictable, controlled moment rather than surfacing randomly during runtime. For configuration errors (missing API keys, invalid settings), fail-fast means a developer sees exactly what's wrong when they first run the app, rather than discovering it buried in a stack trace during a live request.

### Interview Q: "Why centralize all `process.env` access in one file?"

> Scattered `process.env` calls are a maintenance problem. If the variable name changes, you update it in 10 places. If a variable is missing, it fails silently at the point of use. Centralizing in `config/index.js` means: one place to validate, one place to update, one place to document. Every other file imports clean, typed values — not raw string-or-undefined from process.env.

### Trade-offs

| Centralized Config | Scattered `process.env` |
|---|---|
| ✅ Validates at startup | ✅ Simpler initially |
| ✅ Single place to update names | ❌ Fails silently at runtime |
| ✅ Adds default values in one place | ❌ Duplicated across files |
| ❌ One extra file to maintain | ❌ Hard to audit what config exists |

---

## Concept 2 — The Singleton Pattern (`config/gemini.js`)

### What is it?
A singleton is an object that is **created once and reused** everywhere.

```js
// gemini.js — created ONCE
const geminiModel = new ChatGoogleGenerativeAI({ ... });
export default geminiModel;

// agents/investmentAnalyst.js — REUSED
import geminiModel from '../config/gemini.js';
```

### Why not create a new LLM instance per request?

```js
// BAD — new instance on every API call
app.post('/research', (req, res) => {
  const llm = new ChatGoogleGenerativeAI({ apiKey: ... });  // wasteful
  const result = await llm.invoke(...);
});
```

Each `new ChatGoogleGenerativeAI()` call initializes the HTTP client, validates credentials, and allocates memory. Doing this per request wastes resources and adds latency.

### Interview Q: "What is the Singleton pattern and when do you use it?"

> A singleton is a design pattern that ensures a class has only one instance, shared across the application. You use it for expensive-to-initialize resources: database connections, LLM clients, HTTP clients. In our case, the Gemini model is initialized once at module load time and imported wherever needed — Node.js module caching ensures the same instance is returned on every import.

### Why LLM Temperature = 0.2

| Temperature | Behavior | Use Case |
|---|---|---|
| `0.0` | Fully deterministic | Factual lookup, structured parsing |
| `0.2` | Mostly consistent, slight variation | **Investment analysis (our choice)** |
| `0.7` | Creative, varied | Brainstorming, creative writing |
| `1.0` | Highly random | Poetry, fiction |

**Why 0.2 for finance:** Investment analysis needs consistent, factual reasoning. High temperature introduces hallucination risk — the model might creatively invent financial figures.

---

## Concept 3 — LangChain's `ChatGoogleGenerativeAI`

### What is it?
A LangChain class that wraps Google Gemini and exposes it as a standard LangChain **chat model**.

```js
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  temperature: 0.2,
});

const result = await model.invoke('What is Apple Inc?');
```

### Why LangChain's wrapper instead of Google's SDK directly?

| LangChain Wrapper | Google SDK Directly |
|---|---|
| ✅ Swap providers without rewriting (same interface for OpenAI, Anthropic, Gemini) | ✅ Direct access, no abstraction overhead |
| ✅ Works natively with LangGraph, tools, chains | ❌ Must rewrite if switching providers |
| ✅ `.withStructuredOutput()`, streaming built-in | ❌ Manual structured output handling |
| ❌ Abstraction layer (slightly more to learn) | ✅ Simpler for single-model apps |

### Interview Q: "What is LangChain and what problem does it solve?"

> LangChain is an orchestration framework for building applications with LLMs. It solves the problem of **vendor lock-in and complexity** — without it, you write raw API calls to each LLM provider differently, manually handle retries, chain prompts together with string formatting, and build tool-calling logic from scratch. LangChain provides standard interfaces: a chat model is always invoked with `.invoke()`, a tool is always called the same way, structured output parsing works the same across providers.

### Interview Q: "What is `maxRetries: 2` in the LLM config?"

> LLM APIs can return transient errors — rate limit hits, network blips, temporary service unavailability. `maxRetries: 2` tells LangChain to automatically retry the API call up to 2 times before giving up. Without this, a single transient error would fail the entire research request. It's a resilience pattern — cheap to add, high value.

---

## Concept 4 — Structured Logging (`utils/logger.js`)

### What's wrong with `console.log`?

```js
// Bad
console.log('server started');
// Output: server started   ← no timestamp, no level, no context

// Good (our logger)
logger.info('Server running on http://localhost:5000');
// Output: 2026-07-07T13:51:05.427Z [INFO] Server running on http://localhost:5000
```

### Log Levels and When to Use Each

| Level | Color | When to Use |
|---|---|---|
| `info` | 🟢 Green | Normal operation — server started, request received |
| `warn` | 🟡 Yellow | Unexpected but non-fatal — slow response, near limit |
| `error` | 🔴 Red | Something failed — API error, invalid state |
| `debug` | 🔵 Cyan | Verbose dev-only output — suppressed in production |
| `agent` | 🟣 Magenta | LangGraph node execution steps |

### Interview Q: "Why suppress debug logs in production?"

> Debug logs contain verbose internal state — variable values, intermediate computations, full request/response bodies. In production this creates: (1) log storage costs, (2) potential PII/secret leakage if sensitive data appears in debug output, and (3) noise that makes finding real errors harder. Debug logs exist for developer understanding during development, not for production operations.

### Interview Q: "Why not use Winston or Pino?"

> For this project scope, a custom lightweight logger is the right trade-off. Winston and Pino shine when you need log file rotation, log shipping to Datadog/CloudWatch, JSON-structured logs for log aggregation tools, or async non-blocking writes (Pino's main advantage). We don't need any of that here — adding Winston would be overengineering for a take-home project.

---

## Concept 5 — Global Error Handling in Express

### The Problem Without It

Without a global error handler, Express's default behavior is to send raw HTML stack traces:

```html
<!DOCTYPE html>
<html><body>
<h1>Error: Cannot read property 'apiKey' of undefined</h1>
<pre>at /server/agents/analyst.js:42:18
at /server/services/research.js:28:5
...
</pre>
</body></html>
```

This is: (1) ugly, (2) inconsistent format, (3) a **security vulnerability** — stack traces reveal internal file paths, package versions, and logic.

### Our Error Handler

```js
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message,
      code: err.code,       // only if we set it
      stack: isDevelopment  // only in dev
        ? err.stack
        : undefined,
    },
  });
};
```

### The 4-Argument Signature

Express identifies error-handling middleware by its **exactly 4 parameters**: `(err, req, res, next)`.

```js
// Regular middleware — 3 params
app.use((req, res, next) => { });

// Error handler — 4 params (err comes first)
app.use((err, req, res, next) => { });
```

If you accidentally write only 3 params, Express treats it as regular middleware — errors are never caught.

### Interview Q: "How does Express error handling work?"

> Any middleware or route can pass an error to Express by calling `next(error)` or, in async code, by having an unhandled promise rejection (with the right setup). Express looks for the nearest error-handling middleware downstream — identified by having 4 parameters. It must be registered last so it can catch errors from all routes and middleware above it. Our error handler formats the error as JSON and hides stack traces in production for security.

### Interview Q: "What's the difference between `err.statusCode` and `err.status`?"

> There's no standard — different libraries set different properties. Express itself uses `err.status`, some others use `err.statusCode`. We check both and fall back to 500 with `err.statusCode || err.status || 500` to handle errors from any library in the stack.

---

## Concept 6 — Rate Limiting

### Why It Matters for AI Applications Specifically

A normal web endpoint failing costs nothing. An AI endpoint failing costs money:

```
One research request =
  2-3 Tavily search API calls  ($)
  + 4 Gemini LLM calls          ($$$)
  + ~5,000-15,000 tokens        ($$$)

10 requests/15 minutes limit = protected from accidental or malicious drains
```

### What the Headers Tell the Client

With `standardHeaders: true`, every API response includes:

```
X-RateLimit-Limit: 10           ← max requests allowed
X-RateLimit-Remaining: 7        ← how many left in this window
X-RateLimit-Reset: 1720360500   ← when the window resets (Unix timestamp)
```

The frontend can read these to show the user "You have 7 research requests remaining."

### Interview Q: "What is rate limiting and how does it work?"

> Rate limiting caps the number of requests an IP address can make within a time window. `express-rate-limit` tracks request counts in memory (or Redis for distributed systems) per IP. When a client exceeds the limit, the server returns 429 Too Many Requests and the client must wait until the window resets. It protects against: accidental infinite loops in the frontend, intentional API abuse, and runaway cost accumulation on paid APIs.

### Interview Q: "What's the limitation of in-memory rate limiting?"

> In-memory rate limiting doesn't work across multiple server instances. If you have 3 instances running behind a load balancer, each tracks its own counter — a user could make 30 requests (10 per instance) instead of 10. The production solution is a shared Redis store (`express-rate-limit` has a Redis store adapter). For a single-instance deployment like this project, in-memory is perfectly fine.

---

## Concept 7 — Input Validation with Zod

### Why Validate Before Calling the AI?

```
User sends: { companyName: "" }
           → Without validation: Tavily searches for "" → garbage results
           → With validation: 400 Bad Request returned immediately, no API call made
```

Validation is a **cost gate** — invalid input is caught at the HTTP layer before any expensive operations run.

### How `safeParse` Works

```js
const result = schema.safeParse(req.body);

// Always returns an object — never throws
if (!result.success) {
  result.error.flatten().fieldErrors
  // { companyName: ['companyName must be at least 2 characters.'] }
}

if (result.success) {
  result.data  // { companyName: "Apple Inc" } — trimmed and validated
}
```

Compare with `parse()` which throws on failure:
```js
try {
  const data = schema.parse(req.body);  // throws ZodError if invalid
} catch (err) {
  // must catch — verbose, requires try/catch everywhere
}
```

### Our Validation Schema Explained

```js
companyName: z
  .string()                    // must be a string
  .trim()                      // remove leading/trailing whitespace
  .min(2, '...')               // "A" is not a company name
  .max(100, '...')             // prevent absurdly long inputs
  .regex(/^[a-zA-Z0-9\s\-.,&'()]+$/, '...') // alphanumeric + common symbols only
```

The regex allows: `Apple Inc`, `Johnson & Johnson`, `Berkshire Hathaway, Inc.`, `Meta (Platforms)` — but blocks SQL injection attempts and scripts.

### The `req.body = result.data` Pattern

After validation succeeds, we replace `req.body` with `result.data`:

```js
req.body = result.data;  // Zod-parsed, trimmed, coerced data
next();
```

This means downstream controllers receive **clean data** — not raw user input. If Zod trimmed whitespace or coerced a value, the controller sees the clean version automatically.

### Interview Q: "Why Zod over express-validator or Joi?"

> Zod is schema-first and TypeScript-native, but works perfectly in JavaScript too. The key advantage for this project: we use Zod in two places — request validation *and* LLM structured output parsing (via LangChain's `.withStructuredOutput(zodSchema)`). One library, consistent mental model. Joi is older and more complex; express-validator is middleware-first and less composable as a schema.

---

## Concept 8 — Middleware Order in Express

This is one of the most commonly asked Express interview questions.

### Our Order and Why

```js
// 1. Security headers — applied to EVERY response, must be first
app.use(helmet());

// 2. CORS — must handle preflight OPTIONS before routes process anything
app.use(cors({ origin: config.clientUrl }));

// 3. Body parsing — must run before routes that read req.body
app.use(express.json({ limit: '10kb' }));

// 4. HTTP logging — early, so ALL requests are logged (including errors)
app.use(morgan('dev'));

// 5. Rate limiting — only on /api, protects AI endpoints
app.use('/api', rateLimiter);

// 6. Routes — actual application logic
app.use('/api', researchRoutes);

// 7. 404 handler — catches unmatched routes (after all routes tried)
app.use((_req, res) => res.status(404).json({ ... }));

// 8. Error handler — LAST, catches errors from everything above
app.use(errorHandler);
```

### Interview Q: "What happens if you register the error handler before routes?"

> Errors thrown in routes after the error handler in the middleware chain never reach it. Express forwards to the next error handler *downstream* — so if the error handler is upstream (registered first), it's skipped. This is why the error handler must always be last.

### Interview Q: "Why apply rate limiting only to `/api` and not `/health`?"

> The `/health` endpoint needs to respond to load balancer health checks and uptime monitors — these ping it continuously. Rate limiting `/health` would cause false alerts ("server is down!") when it's actually just been rate-limited. Health checks should always respond instantly with no restrictions.

---

## Concept 9 — CORS In Plain English

### The Problem

```
Browser on localhost:5173 (Vite) tries to fetch localhost:5000 (Express)

Browser: "Wait — these are different origins (different ports). 
          I'll send an OPTIONS preflight first to ask if this is allowed."

Server without CORS: No response / wrong headers
Browser: "Blocked. Same-origin policy violation."

Server with CORS (our setup): 
  Access-Control-Allow-Origin: http://localhost:5173
Browser: "OK, this is allowed. Proceeding with actual request."
```

### What "Origin" Means

Two URLs have the same origin only if all three match: **protocol + hostname + port**.

| URL A | URL B | Same Origin? |
|---|---|---|
| `http://localhost:5173` | `http://localhost:5000` | ❌ Different port |
| `http://localhost:5173` | `https://localhost:5173` | ❌ Different protocol |
| `http://localhost:5173` | `http://localhost:5173` | ✅ Same |

### Interview Q: "What is a CORS preflight request?"

> When a browser wants to make a cross-origin request that isn't "simple" (e.g., it has a custom Content-Type header or uses methods other than GET/POST), it first sends an HTTP OPTIONS request — the preflight. The server responds with headers saying which origins, methods, and headers are allowed. If the server approves, the browser sends the actual request. This prevents cross-site request forgery where a malicious site silently makes authenticated API calls on a user's behalf.

---

## Concept 10 — `helmet` Security Headers

One line of code: `app.use(helmet())`

What it sets automatically:

| Header | Protects Against |
|---|---|
| `X-Content-Type-Options: nosniff` | MIME-type sniffing attacks |
| `X-Frame-Options: SAMEORIGIN` | Clickjacking (embedding your app in iframes) |
| `Strict-Transport-Security` | Forces HTTPS in future visits |
| `X-XSS-Protection` | Reflected XSS in older browsers |
| `Content-Security-Policy` | Script injection from untrusted sources |
| `Referrer-Policy` | Controls what URL info is sent in Referer header |

### Interview Q: "What is clickjacking and how does helmet prevent it?"

> Clickjacking is when an attacker embeds your site in a transparent iframe on their malicious site, then tricks users into clicking things on your site (thinking they're clicking on the attacker's UI). The `X-Frame-Options: SAMEORIGIN` header tells browsers to refuse to render the page inside an iframe unless the iframe is on the same origin. Helmet sets this automatically.

---

## Issues Encountered in Module 2

### None — Clean Build

Module 2 had zero dependency or runtime issues. This is because:
- All packages were already installed in Module 1
- Config validation catches missing env vars at startup, not runtime
- Middleware is stateless — nothing to initialize asynchronously

---

## Test Results

| Test | Command | Expected | Result |
|---|---|---|---|
| Health check | `GET /health` | `200 { success: true }` | ✅ |
| 404 handler | `GET /nonexistent` | `404 { code: "NOT_FOUND" }` | ✅ |
| Structured logs | Start server | Timestamped INFO lines | ✅ |
| Morgan logging | Any request | `GET /health 200 6ms` | ✅ |
| Config validation | Remove key from .env | Clear error at startup | ✅ |

---

## Module 2 Engineering Log

```
MODULE: Config & Middleware
BUILT:
  - config/index.js      — fail-fast env validation, clean config object
  - config/gemini.js     — Gemini LLM singleton (temperature 0.2 for finance)
  - utils/logger.js      — 5-level structured logger, ANSI colors, dev-only debug
  - middleware/errorHandler.js  — 4-arg Express error handler, JSON responses, 
                                   hides stacks in production
  - middleware/rateLimiter.js   — 10 req/15 min per IP, structured 429 response
  - middleware/validateRequest.js — Zod safeParse, req.body replacement, 
                                    field-level error messages
  - server/index.js (updated)   — all middleware in correct order

DECISIONS:
  - Fail-fast over silent defaults for required env vars
  - Singleton LLM instance — one init, many reuses
  - Zod for both HTTP validation and LLM output parsing (same library, two uses)
  - safeParse over parse — no try/catch needed in middleware
  - Custom logger over Winston/Pino — right tool for this project's scope
  - Rate limit only /api routes, not /health — load balancer compatibility

TRADE-OFFS:
  - Custom logger: simpler but can't ship logs to Datadog/CloudWatch
  - In-memory rate limiting: works for single instance, breaks at scale
  - Zod regex for company name: catches most attacks, may reject exotic 
    company names with non-ASCII characters (acceptable for this scope)

AI ASSISTANCE:
  - Concepts explained inline in code comments
  - Interview Q&As generated for each concept
  - Middleware order rationale documented

IMPORTANT NOTES:
  - Error handler MUST be last in Express middleware chain
  - 4-parameter signature is how Express identifies error handlers
  - req.body = result.data ensures clean, Zod-processed data flows downstream
```

---

## Quick Reference — What Belongs Where

| I need to... | File to touch |
|---|---|
| Add a new env variable | `config/index.js` + `.env` + `.env.example` |
| Change the LLM model | `server/.env` → `GEMINI_MODEL=gemini-1.5-pro` |
| Change rate limit | `server/.env` → `RATE_LIMIT_MAX=20` |
| Add a new validation field | `middleware/validateRequest.js` → update Zod schema |
| Add a new log level | `utils/logger.js` |
| Change how errors look | `middleware/errorHandler.js` |
| Add new security headers | `server/index.js` → configure `helmet()` options |

---

## What's Next

| Module | Builds On | Adds |
|---|---|---|
| **Module 3: Tools** | `config/gemini.js`, `utils/logger.js` | Tavily search tool the agent can call |
| **Module 4: Prompts** | Nothing (pure strings) | System prompts, analyst persona |
| **Module 5: LangGraph Agent** | Tools + Prompts + Gemini | The 4-node research graph |
| **Module 6: Services** | Agent | Orchestration layer |
| **Module 7: Routes + Controllers** | Services + validateRequest | REST API |
| **Module 8: Frontend** | API endpoint | React UI |
