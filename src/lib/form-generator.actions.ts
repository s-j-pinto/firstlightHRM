
"use server";

import { generateFormFromPdf as generateFormFromPdfFlow, GenerateFormInput, GenerateFormOutput } from "@/ai/flows/generate-form-from-pdf";

export async function generateFormFromPdf(payload: GenerateFormInput): Promise<GenerateFormOutput | { error: string }> {
  try {
    const result = await generateFormFromPdfFlow(payload);
    return result;
  } catch (e: any) {
    console.error("Error in generateFormFromPdf Server Action:", e);
    return { error: `An error occurred while generating the form: ${e.message}` };
  }
}
