
'use server';
/**
 * @fileOverview A Genkit flow for generating a structured HTML form definition from a PDF document.
 *
 * This file defines a flow that uses a multimodal AI model to analyze a PDF file,
 * identify all its form fields, and return a structured JSON object describing the form.
 *
 * - generateFormFromPdf - The server action wrapper for the Genkit flow.
 * - GenerateFormInput - The Zod schema for the flow's input.
 * - GenerateFormOutput - The Zod schema for the flow's structured output.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Schema for a single field within the generated form.
const GeneratedFieldSchema = z.object({
  fieldName: z.string().describe("A unique, camelCase name for the form field, derived from the label (e.g., 'fullName', 'emailAddress')."),
  fieldType: z.enum(['text', 'email', 'tel', 'date', 'number', 'textarea', 'checkbox', 'radio', 'select'])
    .describe("The most appropriate HTML input type for this field."),
  label: z.string().describe("The user-visible label for the form field as it appears in the PDF."),
  options: z.array(z.string()).optional().describe("An array of string options, only for 'radio' or 'select' field types."),
  required: z.boolean().describe("True if the field appears to be mandatory (e.g., marked with an asterisk or is a standard required field like 'email')."),
});
export type GeneratedField = z.infer<typeof GeneratedFieldSchema>;


// Schema for the flow's input, which is a PDF file encoded as a data URI.
export const GenerateFormInputSchema = z.object({
  pdfDataUri: z.string().describe(
    "The PDF file to be analyzed, as a data URI that must include a 'data:application/pdf;base64,' prefix."
  ),
});
export type GenerateFormInput = z.infer<typeof GenerateFormInputSchema>;

// Schema for the flow's output, defining the entire form structure.
export const GenerateFormOutputSchema = z.object({
  formName: z.string().describe("A concise and appropriate name for the entire form, derived from the PDF's title or content (e.g., 'Client Intake Form')."),
  fields: z.array(GeneratedFieldSchema).describe("An array of all the form fields identified in the PDF."),
});
export type GenerateFormOutput = z.infer<typeof GenerateFormOutputSchema>;

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
