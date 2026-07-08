/**
 * services/api.js
 * 
 * Frontend API Service Layer.
 * 
 * Responsibility:
 *   - Send research requests to the Express backend
 *   - Parse the response and format exceptions gracefully
 * 
 * Why this is separate:
 *   - Decouples HTTP request plumbing from React state components
 *   - Simplifies mocking/testing of API responses
 */

/**
 * Sends a POST request to analyze a company by name.
 * 
 * @param {string} companyName - The name of the company to analyze
 * @returns {Promise<Object>} - The formatted JSON payload from the backend
 */
export async function analyzeCompany(companyName) {
  try {
    const response = await fetch('/api/research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ companyName }),
    });

    const payload = await response.json();

    if (!response.ok) {
      // Create a descriptive error based on server-provided code/message
      const errorMsg = payload.error?.message || `HTTP error! status: ${response.status}`;
      const error = new Error(errorMsg);
      error.code = payload.error?.code || 'API_ERROR';
      error.fields = payload.error?.fields || null;
      throw error;
    }

    return payload.data;
  } catch (error) {
    // If it's a network issue or backend is down, standardise the error
    if (!error.code) {
      error.message = 'Unable to connect to the server. Please verify your connection or try again later.';
      error.code = 'NETWORK_ERROR';
    }
    throw error;
  }
}
