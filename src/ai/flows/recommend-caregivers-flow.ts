

'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ClientCareNeedsSchema, CaregiverForRecommendationSchema } from '@/lib/types';
import { googleAI } from '@genkit-ai/google-genai';
import { getDistance } from '@/lib/services/google-maps';

const CaregiverWithDistanceSchema = CaregiverForRecommendationSchema.extend({
    distance: z.object({
        text: z.string(),
        value: z.number(),
    }).optional(),
});
type CaregiverWithDistance = z.infer<typeof CaregiverWithDistanceSchema>;

const RecommendationPayloadSchema = z.object({
  clientCareNeeds: ClientCareNeedsSchema.describe('An object containing all known information about the client\'s care needs, preferences, and situation.'),
  availableCaregivers: z.array(CaregiverForRecommendationSchema).describe('An array of all available caregivers, including their skills, experience, availability schedules, and preferences.'),
});

const RecommendationOutputSchema = z.object({
  recommendations: z.array(z.object({
    id: z.string().describe("The unique ID of the recommended caregiver."),
    name: z.string().describe("The full name of the recommended caregiver."),
    score: z.number().describe("A match score from 0 to 100 indicating how well the caregiver fits the client's needs."),
    reasons: z.array(z.string()).describe("A list of explicit reasons explaining why this caregiver is a good match, including the distance if available."),
  })),
  exclusions: z.array(z.object({
      name: z.string().describe("The name of a caregiver who was excluded."),
      reason: z.string().describe("The specific reason why this caregiver was not considered a match (the hard filter they failed).")
  })).optional().describe("A list of caregivers who were excluded and the reason for their exclusion."),
});

const recommendCaregiversPrompt = ai.definePrompt({
  name: 'recommendCaregiversPrompt',
  input: { schema: z.object({
    clientCareNeeds: ClientCareNeedsSchema,
    availableCaregivers: z.array(CaregiverWithDistanceSchema)
  }) },
  output: { schema: RecommendationOutputSchema },
  model: 'googleai/gemini-pro',
  prompt: `You are an expert scheduler for a home care agency. Your task is to recommend the best-fit caregivers for a client based on a comprehensive set of data.

You must follow a strict two-step process: Hard Filters and Weighted Scoring.

**Client's Needs Profile:**
{{{json clientCareNeeds}}}

**Available Caregiver Pool (with distance from client):**
{{{json availableCaregivers}}}


**Step 1: Hard Filters (Exclusion Criteria)**
First, you MUST exclude any caregiver who does not meet the following mandatory requirements. List any excluded caregivers and the specific reason for their exclusion in the 'exclusions' output field.
- **Level of Care:** The caregiver's 'supportedLevelOfCare' MUST be equal to or greater than the client's required level. (A caregiver who can handle Level 3 can also handle Level 2, but not Level 4).
- **Mandatory Skills:** If the client has a mandatory need (e.g., 'personalCare_provideAlzheimersCare' is true), the caregiver MUST have the corresponding skill (e.g., 'dementiaExperience' is true).

**Step 2: Weighted Scoring & Ranking (For Remaining Caregivers)**
For all caregivers who pass the hard filters, calculate a Match Score from 0 to 100. Assign points based on the following criteria and weights. For each recommended caregiver, you MUST provide explicit reasons for why points were awarded in the 'reasons' output field. Make sure to include the caregiver's distance from the client in the reasons.

- **Level of Care Match (30 pts):** Awarded if the caregiver meets the hard filter.
- **Dementia Experience (20 pts):** Award if the client needs dementia care and the caregiver has this experience.
- **Works with Pets (10 pts):** Award if the client has pets and the caregiver is willing to work with them.
- **Driving Capability (10 pts):** Award if the client needs transportation and the caregiver has a driver's license.
- **Schedule Overlap (20 pts):** Analyze the client's estimated weekly hours and the caregiver's availability. A higher score indicates a better fit. A caregiver who can cover all or most of the requested hours should get the full 20 points.
- **Proximity (10 pts):** Award points based on distance. 10 points for under 5 miles, 5 points for 5-15 miles, 0 points for over 15 miles. Use the 'distance.text' field for this calculation and include it in your reasoning.

**Final Output:**
- Rank the caregivers by their final Match Score in descending order.
- Return the top 3-5 caregivers in the 'recommendations' array.
- For each recommendation, include their ID, name, final score (normalized to 100), and the list of scoring reasons (including distance).
- List any caregivers who were filtered out and the reason why in the 'exclusions' array.
`,
});

export const recommendCaregivers = ai.defineFlow(
  {
    name: 'recommendCaregiversFlow',
    inputSchema: RecommendationPayloadSchema,
    outputSchema: RecommendationOutputSchema,
  },
  async (payload) => {
    
    const clientAddress = `${payload.clientCareNeeds.clientAddress}, ${payload.clientCareNeeds.clientCity}`;
    
    const caregiversWithDistance: CaregiverWithDistance[] = await Promise.all(
        payload.availableCaregivers.map(async (caregiver) => {
            if (!caregiver.address || !caregiver.city) {
                return { ...caregiver, distance: undefined };
            }
            const caregiverAddress = `${caregiver.address}, ${caregiver.city}`;
            const distance = await getDistance(clientAddress, caregiverAddress);
            return {
                ...caregiver,
                distance: distance || undefined,
            };
        })
    );

    const { output } = await recommendCaregiversPrompt({
        clientCareNeeds: payload.clientCareNeeds,
        availableCaregivers: caregiversWithDistance,
    });

    if (!output) {
      throw new Error("The AI model did not return a valid recommendation output.");
    }
    return output;
  }
);
