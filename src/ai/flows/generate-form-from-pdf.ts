
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
  model: 'googleai/gemini-2.0-pro',
  prompt: `You are an expert AI assistant specialized in converting PDF documents into structured JSON data suitable for generating HTML forms.

Your task is to analyze the provided PDF file and identify all the interactive form fields within it. This includes text inputs, email fields, phone numbers, text areas, checkboxes, radio button groups, and select/dropdown menus.

For each field you identify, you must extract the following information:
1.  **fieldName**: Create a unique, programmatic, camelCase name for the field based on its label. For example, 'Full Name' becomes 'fullName'.
2.  **fieldType**: Determine the most semantically correct HTML input type. Use 'email' for emails, 'tel' for phone numbers, 'date' for dates, 'textarea' for large multi-line text boxes, and 'text' for general single-line inputs.
3.  **label**: The exact user-visible text label associated with the field.
4.  **options**: If the field is a 'select' or 'radio' group, provide an array of the available string options.
5.  **required**: Analyze the field and its context to determine if it is mandatory. Fields marked with an asterisk (*) or common fields like 'Name' or 'Email' should be considered required.

Return a single JSON object that strictly adheres to the provided output schema, containing a 'formName' and an array of all the field objects you have identified.

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
