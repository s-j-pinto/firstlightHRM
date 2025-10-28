
'use server';
/**
 * @fileOverview A Genkit flow for generating a structured HTML form definition from a PDF document.
 *
 * This file defines a flow that uses a multimodal AI model to analyze a PDF file,
 * identify all its form fields, and return a structured JSON object describing the form.
 *
 * - generateFormFromPdf - The server action wrapper for the Genkit flow.
 */

import { ai } from '@/ai/genkit';
import { 
    GenerateFormInputSchema,
    GenerateFormOutputSchema,
    type GenerateFormInput,
    type GenerateFormOutput 
} from '@/lib/types';


/**
 * A server action that wraps the Genkit flow. This is the entry point called from the client.
 * @param input The PDF data URI.
 * @returns The structured JSON definition of the form.
 */
export async function generateFormFromPdf(input: GenerateFormInput): Promise<GenerateFormOutput> {
  return generateFormFromPdfFlow(input);
}

// Defines the prompt that instructs the AI on how to process the PDF.
const formGenerationPrompt = ai.definePrompt({
  name: 'formGenerationPrompt',
  input: { schema: GenerateFormInputSchema },
  output: { schema: GenerateFormOutputSchema },
  model: 'googleai/gemini-2.0-flash',
  prompt: `You are an expert AI assistant specialized in converting PDF documents into structured JSON data suitable for generating responsive HTML forms that visually mimic the PDF layout.

Your task is to analyze the provided PDF file and identify all the interactive form fields, including their layout in rows and columns.

For each field, extract the following information:
1.  **fieldName**: A unique, programmatic, camelCase name (e.g., 'fullName').
2.  **fieldType**: The most semantically correct HTML input type. Use 'email' for emails, 'tel' for phones, 'date' for dates, 'textarea' for large multi-line boxes, and 'text' for general single-line inputs.
3.  **label**: The exact user-visible text label for the field.
4.  **options**: If the field is a 'select' or 'radio' group, provide an array of the available string options.
5.  **required**: Determine if the field is mandatory (e.g., has an asterisk *).

Your primary goal is to group these fields into a layout that mirrors the PDF. Structure your output as an array of 'rows'. Each 'row' will contain an array of 'columns', and each 'column' will contain one or more 'fields'.

- A field that takes up the full width of a line should be in its own row, with one column containing that single field.
- Fields that appear side-by-side in the PDF should be in the same row, each in its own column object.
- A single column can contain multiple vertically-stacked fields if they are logically grouped (e.g., a checkbox list).

Return a single JSON object that strictly adheres to the output schema.

PDF for analysis:
{{media url=pdfDataUri}}
`,
});

// Defines the Genkit flow that orchestrates the call to the AI prompt.
const generateFormFromPdfFlow = ai.defineFlow(
  {
    name: 'generateFormFromPdfFlow',
    inputSchema: GenerateFormInputSchema,
    outputSchema: GenerateFormOutputSchema,
  },
  async (input) => {
    const { output } = await formGenerationPrompt(input);
    
    if (!output) {
      throw new Error("The AI model did not return a valid form definition.");
    }
    
    return output;
  }
);
