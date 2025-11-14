

"use server";

import { revalidatePath } from "next/cache";
import { serverDb } from "@/firebase/server-init";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import type { CampaignTemplate } from "./types";

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Name is required."),
  description: z.string().optional(),
  subject: z.string().min(5, "Subject is required."),
  body: z.string().min(10, "Email body is required."),
  intervalDays: z.coerce.number().min(0, "Interval must be at least 0."),
  type: z.literal("email").default("email"),
  sendImmediatelyFor: z.array(z.string()).optional(),
});

export async function saveCampaignTemplate(payload: z.infer<typeof templateSchema>) {
  const validation = templateSchema.safeParse(payload);

  if (!validation.success) {
    return { message: "Invalid data provided.", error: true };
  }

  const { id, ...templateData } = validation.data;
  const firestore = serverDb;
  const now = Timestamp.now();

  try {
    if (id) {
      const templateRef = firestore.collection("campaign_templates").doc(id);
      await templateRef.update({ ...templateData, lastUpdatedAt: now });
    } else {
      await firestore.collection("campaign_templates").add({
        ...templateData,
        createdAt: now,
        lastUpdatedAt: now,
      });
    }

    revalidatePath("/owner/campaigns");
    return { message: "Campaign template saved successfully." };
  } catch (error: any) {
    return { message: `An error occurred: ${error.message}`, error: true };
  }
}

export async function deleteCampaignTemplate(id: string) {
    if (!id) {
        return { message: "Template ID is required.", error: true };
    }
    const firestore = serverDb;
    try {
        await firestore.collection('campaign_templates').doc(id).delete();
        revalidatePath('/owner/campaigns');
        return { message: 'Template deleted successfully.' };
    } catch (e: any) {
        return { message: `Error deleting template: ${e.message}`, error: true };
    }
}
