/**
 * middleware/validateRequest.js
 *
 * Input validation middleware using Zod.
 *
 * Responsibility:
 *   - Validate the incoming request body before it reaches the controller
 *   - Return a structured 400 Bad Request with field-level error details
 *   - Prevent invalid data from ever reaching the AI pipeline
 *
 * Why validate before the AI layer:
 *   LLM API calls are expensive (time + money). Rejecting bad input at the
 *   HTTP layer — before any AI processing — saves API costs and improves
 *   response time for invalid requests.
 *
 * Why Zod:
 *   - Runtime validation with excellent error messages
 *   - Same library used to parse structured LLM output (one pattern, two uses)
 *   - Schema is readable and self-documenting
 *
 * Dependents: routes/research.routes.js
 */

import { z } from 'zod';

/**
 * Zod schema for the research request body.
 * Defines the shape and constraints of a valid research request.
 */
export const researchRequestSchema = z.object({
  companyName: z
    .string({
      required_error: 'companyName is required.',
      invalid_type_error: 'companyName must be a string.',
    })
    .trim()
    .min(2, 'companyName must be at least 2 characters.')
    .max(100, 'companyName must not exceed 100 characters.')
    .regex(
      /^[a-zA-Z0-9\s\-.,&'()]+$/,
      'companyName contains invalid characters.'
    ),
});

/**
 * Express middleware factory that validates the request body against a Zod schema.
 *
 * Usage:
 *   router.post('/research', validateRequest(researchRequestSchema), controller)
 *
 * @param {z.ZodSchema} schema - The Zod schema to validate against
 */
const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    // Flatten Zod's error format into a clean field → message map
    const errors = result.error.flatten().fieldErrors;

    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed. Please check your input.',
        code: 'VALIDATION_ERROR',
        fields: errors,
      },
    });
  }

  // Replace req.body with the parsed (and sanitized) data
  // This ensures trimming and coercion applied by Zod are reflected downstream
  req.body = result.data;
  next();
};

export default validateRequest;
