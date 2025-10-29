
"use server";

import { generateFormFromPdf as generateFormFromPdfFlow, type GenerateFormInput, type GeneratedForm } from "@/ai/flows/generate-form-from-pdf";
import { serverDb } from "@/firebase/server-init";

export async function generateFormFromPdf(payload: GenerateFormInput): Promise<GeneratedForm | { error: string }> {
  try {
    const result = await generateFormFromPdfFlow(payload);
    return result;
  } catch (e: any) {
    console.error("Error in generateFormFromPdf Server Action:", e);
    return { error: `An error occurred while generating the form: ${e.message}` };
  }
}

export async function saveFormAsTemplate(formDefinition: GeneratedForm) {
  try {
    const templateRef = serverDb.collection("settings").doc("clientIntakeFormTemplate");
    await templateRef.set(formDefinition);
    return { message: "Client intake form template saved successfully." };
  } catch (e: any) {
    console.error("Error saving form template:", e);
    return { message: `Failed to save template: ${e.message}`, error: true };
  }
}
