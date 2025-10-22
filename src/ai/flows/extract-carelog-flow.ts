
'use server';
/**
 * @fileOverview A Genkit flow for extracting structured data from care log images or text.
 *
 * This file defines a flow that uses a multimodal AI model to perform OCR on a
 * handwritten care log or analyze plain text, extract the full content, and
 * identify a specific shift date and time.
 *
 * - extractCareLogData - A function that handles the data extraction process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';
import type { ExtractCareLogInput, ExtractCareLogOutput } from '@/lib/types';
import { ExtractCareLogInputSchema, ExtractCareLogOutputSchema } from '@/lib/types';


/**
 * A server action that wraps the Genkit flow for use on the client.
 * @param input - The image data URI or text content of the care log.
 * @returns The structured output from the AI model.
 */
export async function extractCareLogData(input: ExtractCareLogInput): Promise<ExtractCareLogOutput> {
  return extractCareLogFlow(input);
}

// Defines the prompt template that will be sent to the AI model.
const careLogPrompt = ai.definePrompt({
  name: 'careLogPrompt',
  input: { schema: ExtractCareLogInputSchema },
  output: { schema: ExtractCareLogOutputSchema },
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `You are an expert at reading and transcribing handwritten notes.
    
  Analyze the following image and transcribe the text you see as accurately as possible.
  Maintain the original line breaks if possible. If the image does not contain any discernible text, return an empty string.
  
{{#if imageDataUri}}
Image of the care log:
{{media url=imageDataUri}}
{{/if}}

{{#if textContent}}
Text of the care log:
{{{textContent}}}
{{/if}}
`,
});

// Defines the Genkit flow which orchestrates the call to the AI prompt.
const extractCareLogFlow = ai.defineFlow(
  {
    name: 'extractCareLogFlow',
    inputSchema: ExtractCareLogInputSchema,
    outputSchema: ExtractCareLogOutputSchema,
  },
  async (input) => {
    const { output } = await careLogPrompt(input);

    if (!output) {
      throw new Error("The AI model did not return a valid output.");
    }

    return output;
  }
);
