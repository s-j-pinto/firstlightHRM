import { onCallGenkit } from "@genkit-ai/firebase/functions";
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const caregiverFormSchema = z.object({
    uid: z.string().optional(),
    fullName: z.string().min(2, "Full name must be at least 2 characters."),
    email: z.string().email("Invalid email address."),
    phone: z.string().min(10, "Phone number must be at least 10 digits."),
    address: z.string().min(5, "Address is required."),
    city: z.string().min(2, "City is required."),
    state: z.string().min(2, "State is required."),
    zip: z.string().min(5, "Zip code is required."),
    yearsExperience: z.coerce.number().min(0, "Years of experience is required."),
    previousRoles: z.string().optional(),
    summary: z.string().optional(),
    canChangeBrief: z.boolean().optional().default(false),
    canTransfer: z.boolean().optional().default(false),
    canPrepareMeals: z.boolean().optional().default(false),
    canDoBedBath: z.boolean().optional().default(false),
    canUseHoyerLift: z.boolean().optional().default(false),
    canUseGaitBelt: z.boolean().optional().default(false),
    canUsePurwick: z.boolean().optional().default(false),
    canEmptyCatheter: z.boolean().optional().default(false),
    canEmptyColostomyBag: z.boolean().optional().default(false),
    canGiveMedication: z.boolean().optional().default(false),
    canTakeBloodPressure: z.boolean().optional().default(false),
    hasDementiaExperience: z.boolean().optional().default(false),
    hasHospiceExperience: z.boolean().optional().default(false),
    hca: z.boolean().default(false),
    hha: z.boolean().default(false),
    cna: z.boolean().default(false),
    liveScan: z.boolean().default(false),
    otherLanguages: z.string().optional(),
    negativeTbTest: z.boolean().default(false),
    cprFirstAid: z.boolean().default(false),
    canWorkWithCovid: z.boolean().default(false),
    covidVaccine: z.boolean().default(false),
    cnaLicense: z.string().optional(),
    otherCertifications: z.string().optional(),
    availability: z.object({
        monday: z.array(z.string()),
        tuesday: z.array(z.string()),
        wednesday: z.array(z.string()),
        thursday: z.array(z.string()),
        friday: z.array(z.string()),
        saturday: z.array(z.string()),
        sunday: z.array(z.string()),
    }).refine(val => Object.values(val).some(shifts => shifts.length > 0), {
        message: "Please select at least one shift.",
        path: ['sunday']
    }),
    hasCar: z.enum(["yes", "no"]),
    validLicense: z.enum(["yes", "no"]),
});

export const ai = genkit({
    plugins: [googleAI()],
    logLevel: "debug",
    enableTracingAndMetrics: true,
});

const InterviewInsightsInputSchema = z.object({
    caregiverProfile: caregiverFormSchema.extend({ id: z.string() }),
    interviewNotes: z.string().describe('The notes taken by the interviewer during the phone screen.'),
    candidateRating: z.number().min(0).max(5).describe('A 0-5 rating given by the interviewer.'),
});

const InterviewInsightsOutputSchema = z.object({
    aiGeneratedInsight: z.string().describe('A concise summary of the candidate (max 200 words), followed by a clear hiring recommendation (e.g., "Recommend for in-person interview," "Proceed with caution," "Do not recommend") with a brief justification.'),
});

const interviewInsightsFlow = {
    name: 'interviewInsightsFlow',
    inputSchema: InterviewInsightsInputSchema,
    outputSchema: InterviewInsightsOutputSchema,
    async aot(input) {
        const prompt = `You are an expert HR assistant for a home care agency. Your task is to analyze a caregiver candidate's profile and the notes from their phone screen to provide a single, combined insight containing a summary and a hiring recommendation.

Analyze the following information:

**Caregiver Profile:**
- Full Name: {{caregiverProfile.fullName}}
- Years of Experience: {{caregiverProfile.yearsExperience}}
- Experience Summary: {{#if caregiverProfile.summary}}{{caregiverProfile.summary}}{{else}}Not provided{{/if}}
- Skills:
  - Hoyer Lift: {{#if caregiverProfile.canUseHoyerLift}}Yes{{else}}No{{/if}}
  - Dementia Experience: {{#if caregiverProfile.hasDementiaExperience}}Yes{{else}}No{{/if}}
  - Hospice Experience: {{#if caregiverProfile.hasHospiceExperience}}Yes{{else}}No{{/if}}
- Certifications:
  - CNA: {{#if caregiverProfile.cna}}Yes{{else}}No{{/if}}
  - HHA: {{#if caregiverProfile.hha}}Yes{{else}}No{{/if}}
  - HCA: {{#if caregiverProfile.hca}}Yes{{else}}No{{/if}}
- Availability: 
  {{#each caregiverProfile.availability}}
  {{@key}}: {{#if this}}{{#each this}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Not available{{/if}}
  {{/each}}
- Transportation: Has car: {{caregiverProfile.hasCar}}, Valid License: {{caregiverProfile.validLicense}}

**Interviewer's Phone Screen Feedback:**
- Rating (out of 5): {{candidateRating}}
- Notes:
{{{interviewNotes}}}

**Your Task:**

Generate a single string for the 'aiGeneratedInsight' field. This string should contain two parts:

1.  **Summary:** First, write a concise professional summary of the candidate. Highlight their key strengths, potential weaknesses, and alignment with a caregiver role. The summary must be a maximum of 200 words.

2.  **Recommendation:** After the summary, add two new lines, then provide a clear, actionable hiring recommendation. Start this part with "Recommendation:". Choose from "Recommend for in-person interview," "Proceed with caution," or "Do not recommend." Justify your choice with 1-2 key reasons based on the provided data.

Example format:
[Summary of the candidate...]

Recommendation: [Your recommendation and justification...]
`;
        const { output } = await ai.generate({
            model: 'gemini-1.5-flash',
            prompt: prompt,
            input: input,
            output: {
                schema: InterviewInsightsOutputSchema,
            },
        });
        return output!;
    },
};

export const interviewInsights = onCallGenkit(interviewInsightsFlow);
