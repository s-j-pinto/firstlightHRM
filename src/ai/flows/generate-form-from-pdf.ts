
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

Your task is to analyze the provided PDF and convert its entire structure into a single, self-contained React JSX component string. The component should be fully functional and ready to be rendered.

**CRITICAL INSTRUCTIONS:**
1.  **Single Component String**: The entire output must be a single string of JSX code. Do not wrap it in markdown or any other formatting.
2.  **Full Document**: Process ALL pages of the PDF from start to finish. The final component must represent the entire document.
3.  **Styling**: Use Tailwind CSS for all styling. Replicate the PDF's layout using divs, flexbox, and grids. Use appropriate ShadCN components (\`Input\`, \`Checkbox\`, \`RadioGroup\`, \`Select\`, \`Textarea\`, \`Card\`, \`CardHeader\`, \`CardContent\`, etc.). Import them from "@/components/ui/...".
4.  **Logo**: At the very top of the form, you MUST include the FirstLight Home Care logo. It should be centered. Use the following code for the logo:
    \`<div className="flex justify-center mb-4">
        <Image src="https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc" alt="FirstLight Home Care Logo" width={250} height={40} priority className="object-contain" />
    </div>\`
    Make sure to import the 'Image' component from 'next/image'.
5.  **Component Definition**:
    - The component must be a default exported function.
    - It must accept a single prop: \`{ formData, onFormChange, isReadOnly }\`.
    - Every input field must have its \`value\` tied to \`formData.fieldName\` and its \`onChange\` handler must call \`onFormChange\`.
    - Add the \`readOnly={isReadOnly}\` attribute to all input fields to control their state.
6.  **Field Naming**: Use unique, descriptive, camelCase names for all form fields (e.g., \`clientName\`, \`emergencyContactPhone\`).
7.  **Structure**:
    - Use \`<Card>\`, \`<CardHeader>\`, and \`<CardContent>\` for logical sections.
    - Use \`<FormLabel>\` for all field labels.
    - Use \`<p>\` tags with Tailwind classes like \`text-muted-foreground\` for instructional text.
    - Replicate the layout of fields (side-by-side vs. stacked) using \`div\` containers with flexbox or grid classes (e.g., \`grid grid-cols-2 gap-4\`).

**EXAMPLE of a single field:**
\`<div className="space-y-2">
  <FormLabel htmlFor="clientName">Client Name</FormLabel>
  <Input id="clientName" name="clientName" value={formData.clientName || ''} onChange={onFormChange} readOnly={isReadOnly} />
</div>\`

Return ONLY the raw JSX string for the complete React component.

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
    
    if (!output || !output.jsxString) {
      throw new Error("The AI model did not return a valid JSX component string.");
    }
    
    return output;
  }
);
