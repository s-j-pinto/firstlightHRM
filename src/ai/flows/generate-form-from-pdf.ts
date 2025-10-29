
'use server';
/**
 * @fileOverview A Genkit flow for generating a structured React component from a PDF document.
 *
 * This file defines a flow that uses a multimodal AI model to analyze a PDF file,
 * identify all its form fields, and return a self-contained React component as a string.
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

// Defines the prompt that instructs the AI on how to process the PDF and generate a React component.
const formGenerationPrompt = ai.definePrompt({
  name: 'formGenerationPrompt',
  input: { schema: GenerateFormInputSchema },
  output: { schema: GenerateFormOutputSchema },
  model: 'googleai/gemini-2.0-flash-lite',
  prompt: `You are an expert React developer specializing in creating forms with ShadCN UI and Tailwind CSS.

Your task is to analyze the provided PDF and convert its entire structure into a structured JSON object representing a form.

**CRITICAL INSTRUCTIONS:**
1.  **Full Document**: Process ALL pages of the PDF from start to finish.
2.  **Structure**: The output must be a JSON object with a 'formName' and an array of 'blocks'. Each block can be a heading, paragraph, or a group of fields.
3.  **Field Identification**:
    *   Identify all input fields, checkboxes, radio buttons, text areas, and select dropdowns.
    *   **Crucially, identify fields that are embedded within sentences.** For example, in the sentence "The hourly rate for providing the Services is $______.", the blank should be identified as a 'text' field named 'hourlyRate' with the label 'The hourly rate for providing the Services is $'. The surrounding text should be part of the paragraph.
4.  **Field Naming**: Use unique, descriptive, camelCase names for all form fields (e.g., \`clientName\`, \`emergencyContactPhone\`).
5.  **Layout Replication**: Replicate the PDF's layout by grouping fields into rows and columns within 'fields' blocks.

Return ONLY the raw JSON object.

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
    
    if (!output || !output.formName || !output.blocks) {
      throw new Error("The AI model did not return a valid form structure.");
    }
    
    return output;
  }
);
