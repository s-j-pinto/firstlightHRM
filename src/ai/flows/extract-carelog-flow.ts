
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
  model: googleAI.model('gemini-1.5-flash'),
  prompt: `You are an expert at reading documents and extracting structured information.
Your task is to analyze the attached content, which is from a caregiver's shift log.

Your tasks are:
1.  Read all the text from the provided content (it could be an image or plain text).
2.  From the text, identify the date and start time of the shift. This is the most important piece of information.
3.  Format the identified date and time into a single, valid ISO 8601 timestamp for the 'shiftDateTime' field. Assume the current year if it's not specified. If you absolutely cannot find a date or time, use the current date and time.
4.  Provide the complete, unedited transcription of all the text you can read from the content in the 'extractedText' field. If the input was plain text, return it as is.

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
