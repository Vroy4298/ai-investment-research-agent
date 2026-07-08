/**
 * config/index.js
 *
 * Centralized configuration module.
 *
 * Responsibility:
 *   - Read all environment variables in one place
 *   - Validate that required variables are present at startup
 *   - Export a clean config object used across the entire application
 *
 * Why this exists:
 *   - Eliminates scattered process.env calls throughout the codebase
 *   - Fails fast: app crashes at startup with a clear message if a required
 *     variable is missing, rather than failing silently at runtime
 *   - Single place to update if a variable name changes
 *
 * No other file should read process.env directly.
 */

import 'dotenv/config';

/**
 * Validates that all required environment variables are present.
 * Throws immediately at startup if any are missing.
 */
function requireEnv(key) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `[config] Missing required environment variable: ${key}\n` +
        `  → Check your server/.env file and ensure ${key} is set.\n` +
        `  → See .env.example for reference.`
    );
  }
  return value.trim();
}

/**
 * Optional env variable — returns a default value if not set.
 */
function optionalEnv(key, defaultValue) {
  return process.env[key]?.trim() || defaultValue;
}

// ─── Validate & Export Configuration ──────────────────────────────────────────

const config = {
  // Server
  port: parseInt(optionalEnv('PORT', '5000'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isDevelopment: optionalEnv('NODE_ENV', 'development') === 'development',
  isProduction: optionalEnv('NODE_ENV', 'development') === 'production',

  // CORS
  clientUrl: optionalEnv('CLIENT_URL', 'http://localhost:5173'),

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10), // 15 minutes
    max: parseInt(optionalEnv('RATE_LIMIT_MAX', '10'), 10),
  },

  // LLM — required, will throw at startup if missing
  groq: {
    apiKey: requireEnv('GROQ_API_KEY'),
    model: optionalEnv('GROQ_MODEL', 'llama-3.3-70b-versatile'),
    temperature: parseFloat(optionalEnv('LLM_TEMPERATURE', '0.2')),
  },

  // Tavily — required for web search
  tavily: {
    apiKey: requireEnv('TAVILY_API_KEY'),
  },
};

export default config;
