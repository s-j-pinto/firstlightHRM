
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
    type GeneratedForm as GenerateFormOutput
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
  prompt: `You are an expert AI assistant that creates a "fillable PDF" like experience from a document.

Your task is to analyze the provided PDF and convert its entire structure into a series of content 'blocks'. You must process **all pages** of the PDF from start to finish. The goal is to create a single JSON representation that can be rendered as a web form that looks and feels just like the original document.

You must identify every piece of content, in order, from the first page to the last, and classify it into one of the following block types:

1.  **'heading'**: For titles and section headers. Specify the appropriate heading level (1-6).
2.  **'paragraph'**: For regular paragraphs of text, instructions, or boilerplate information.
3.  **'html'**: For simple lists (<ul>, <ol>, <li>). Do not use for complex layouts.
4.  **'fields'**: For sections that contain one or more interactive form fields (like text inputs, checkboxes, etc.).

For the **'fields'** blocks, you must identify their layout in rows and columns:
- A field that takes up the full width should be in its own row, with one column containing that single field.
- Fields that appear side-by-side in the PDF should be in the same row, each in its own column object.
- A single column can contain multiple vertically-stacked fields if they are logically grouped (e.g., a list of checkboxes).

For each interactive field you find, extract:
- **fieldName**: A unique, programmatic, camelCase name (e.g., 'fullName').
- **fieldType**: The most semantically correct HTML input type ('text', 'email', 'tel', 'date', 'textarea', 'checkbox', 'radio', 'select').
- **label**: The exact user-visible text label.
- **options**: An array of string options for 'select' or 'radio' groups.
- **required**: Determine if the field is mandatory (e.g., marked with an asterisk *).

Return a single JSON object that strictly adheres to the output schema. The final 'blocks' array should represent the entire document from top to bottom, across all pages.

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
