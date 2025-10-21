'use server';
/**
 * @fileOverview A Genkit flow for extracting structured data from care log images.
 *
 * This file defines a flow that uses a multimodal AI model to perform OCR on a
 * handwritten care log, extract the full text, and identify a specific shift date and time.
 *
 * - extractCareLogData - A function that handles the data extraction process.
 * - ExtractCareLogInput - The input type for the flow (an image data URI).
 * - ExtractCareLogOutput - The return type for the flow (full text and a shift date).
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

// Defines the schema for the data that will be passed into the AI prompt.
const ExtractCareLogInputSchema = z.object({
  imageDataUri: z.string().describe(
    "A photo of a handwritten care log, as a data URI that must include a " +
    "MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
});
export type ExtractCareLogInput = z.infer<typeof ExtractCareLogInputSchema>;

// Defines the schema for the expected output from the AI model.
const ExtractCareLogOutputSchema = z.object({
  shiftDateTime: z.string().datetime().describe(
    "The exact start date and time of the shift, extracted from the notes. " +
    "This must be in a valid ISO 8601 format (e.g., '2024-07-29T14:30:00Z'). " +
    "If no date or time can be found, use the current date and time."
  ),
  extractedText: z.string().describe('The full, raw text extracted from the handwritten log.'),
});
export type ExtractCareLogOutput = z.infer<typeof ExtractCareLogOutputSchema>;

/**
 * A server action that wraps the Genkit flow for use on the client.
 * @param input - The image data URI of the care log.
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
  prompt: `You are an expert at reading handwritten documents and extracting structured information.
Your task is to analyze the attached image of a care log.

Your tasks are:
1.  Read all the text from the image, including messy handwriting.
2.  From the text, identify the date and start time of the shift. This is the most important piece of information.
3.  Format the identified date and time into a single, valid ISO 8601 timestamp for the 'shiftDateTime' field. Assume the current year if it's not specified. If you absolutely cannot find a date or time, use the current date and time.
4.  Provide the complete, unedited transcription of all the text you can read from the image in the 'extractedText' field.

Image of the care log:
{{media url=imageDataUri}}
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
