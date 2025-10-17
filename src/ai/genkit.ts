import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Initialize Genkit and configure the Google AI plugin.
// This instance will be used across the Next.js server environment.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  // Log all traces to the console for debugging.
  enableTracingAndMetrics: true,
});
