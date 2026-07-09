/**
 * server/index.js
 *
 * Express application entry point.
 *
 * Responsibility:
 *   - Import and apply all middleware in the correct order
 *   - Mount route handlers
 *   - Start the HTTP server
 *
 * Middleware order matters in Express:
 *   1. Security headers (helmet) — first, so all responses are secured
 *   2. CORS — before routes, so preflight OPTIONS requests are handled
 *   3. Body parsing — before routes, so req.body is available
 *   4. HTTP logging (morgan) — early, so all requests are logged
 *   5. Rate limiting — before AI routes, protecting expensive endpoints
 *   6. Routes — the actual application logic
 *   7. Error handler — LAST, so it catches errors from all routes above
 *
 * What does NOT belong here:
 *   - Business logic (lives in services/)
 *   - Route definitions (live in routes/)
 *   - LLM configuration (lives in config/)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import config from './config/index.js';
import errorHandler from './middleware/errorHandler.js';
import rateLimiter from './middleware/rateLimiter.js';
import logger from './utils/logger.js';
import researchRoutes from './routes/research.routes.js';

const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────────

// Sets ~15 security-related HTTP response headers automatically
// e.g. X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security
app.use(helmet());

// Configure Cross-Origin Resource Sharing
// Supports comma-separated CLIENT_URL for multiple origins (e.g. prod + preview)
// Also allows any *.vercel.app subdomain for Vercel preview deployments
const allowedOrigins = config.clientUrl
  .split(',')
  .map((u) => u.trim().replace(/\/$/, '')); // strip trailing slashes

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      const clean = origin.replace(/\/$/, '');
      const allowed =
        allowedOrigins.includes(clean) ||
        /^https:\/\/.*\.vercel\.app$/.test(clean);
      if (allowed) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })
);

// ─── Request Parsing ───────────────────────────────────────────────────────────

// Parse incoming JSON request bodies (populates req.body)
// Limit set to 10kb — our research requests are tiny, this prevents payload attacks
app.use(express.json({ limit: '10kb' }));

// ─── HTTP Request Logging ─────────────────────────────────────────────────────

// 'dev' format: colorized, concise — perfect for development
// In production, switch to 'combined' for Apache-style logs
app.use(morgan(config.isDevelopment ? 'dev' : 'combined'));

// ─── Rate Limiting (applied only to /api routes) ──────────────────────────────

// Protects AI endpoints from abuse without affecting health checks
app.use('/api', rateLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check — no rate limiting, always available
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '1.0.0',
  });
});

// Research API routes — the core AI endpoint
// Mounted at /api so all routes are: POST /api/research
app.use('/api', researchRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────

// Catch requests to routes that don't exist
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found.',
      code: 'NOT_FOUND',
    },
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

// MUST be registered last — Express identifies error handlers by 4 arguments
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(config.port, () => {
  logger.info(`Server running on http://localhost:${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`CORS origin: ${config.clientUrl}`);
  logger.info(`Rate limit: ${config.rateLimit.max} requests per ${config.rateLimit.windowMs / 60000} minutes`);
});
