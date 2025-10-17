
'use server';
/**
 * @fileOverview This file initializes and configures the global Genkit AI instance.
 *
 * - ai: The singleton Genkit AI object used throughout the application.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Configure the global 'ai' object for Genkit.
// This is the single source of truth for Genkit configuration.
export const ai = genkit({
    plugins: [googleAI()],
    logLevel: "debug",
    enableTracingAndMetrics: true,
});
