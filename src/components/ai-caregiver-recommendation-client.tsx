

"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Loader2, UserCheck, Sparkles, Star, CalendarDays } from "lucide-react";
import { useDoc, firestore, useMemoFirebase } from "@/firebase";
import { doc, getDocs, collection, query, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { getAiCaregiverRecommendations } from "@/lib/ai.actions";
import type { InitialContact, LevelOfCareFormData, ActiveCaregiver, CaregiverForRecommendation } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";

interface AiCaregiverRecommendationClientProps {
  contactId: string;
}

// Helper function to convert Firestore Timestamps to ISO strings recursively
function sanitizeForServerAction(obj: any): any {
    if (!obj) return obj;
    if (Array.isArray(obj)) {
        return obj.map(sanitizeForServerAction);
    }
    if (typeof obj === 'object' && obj !== null) {
        // Check for Firestore Timestamp which has a toDate method
        if (typeof obj.toDate === 'function') {
            return obj.toDate().toISOString();
        }
        // Recurse through object properties
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = sanitizeForServerAction(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
}


export function AiCaregiverRecommendationClient({ contactId }: AiCaregiverRecommendationClientProps) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isGenerating, startGeneratingTransition] = useTransition();

  const contactDocRef = useMemoFirebase(() => doc(firestore, 'initial_contacts', contactId), [contactId]);
  const { data: contactData, isLoading: contactLoading } = useDoc<InitialContact>(contactDocRef);
  
  const locDocRef = useMemoFirebase(() => doc(firestore, 'level_of_care_assessments', contactId), [contactId]);
  const { data: locData, isLoading: locLoading } = useDoc<LevelOfCareFormData>(locDocRef);

  const [caregiversData, setCaregiversData] = useState<ActiveCaregiver[]>([]);
  const [caregiversLoading, setCaregiversLoading] = useState(true);

  const [availabilities, setAvailabilities] = useState<any>({});
  const [preferences, setPreferences] = useState<any>({});
  const [subcollectionsLoading, setSubcollectionsLoading] = useState(true);

  useEffect(() => {
    async function fetchCaregivers() {
        const caregiversQuery = query(collection(firestore, 'caregivers_active'));
        const snapshot = await getDocs(caregiversQuery);
        const data = snapshot.docs.map(d => ({...d.data(), id: d.id})) as ActiveCaregiver[];
        setCaregiversData(data);
        setCaregiversLoading(false);
    }
    fetchCaregivers();
  }, []);

  useEffect(() => {
    async function fetchSubcollections() {
      if (!caregiversData || caregiversData.length === 0) {
          setSubcollectionsLoading(false);
          return;
      };
      
      const avails: any = {};
      const prefs: any = {};

      for (const cg of caregiversData) {
          const availDocRef = doc(firestore, `caregivers_active/${cg.id}/availability/current_week`);
          const prefDocRef = doc(firestore, `caregivers_active/${cg.id}/preferences/current`);
          
          try {
            const availDoc = await getDoc(availDocRef);
            if (availDoc.exists()) {
                avails[cg.id] = availDoc.data();
            }

            const prefDoc = await getDoc(prefDocRef);
            if (prefDoc.exists()) {
                prefs[cg.id] = prefDoc.data();
            }
          } catch (error) {
              console.error(`Failed to fetch subcollections for caregiver ${cg.id}:`, error);
          }
      }

      setAvailabilities(avails);
      setPreferences(prefs);
      setSubcollectionsLoading(false);
    }

    if (!caregiversLoading) {
      fetchSubcollections();
    }
  }, [caregiversData, caregiversLoading]);

  // A caregiver's supported level of care would ideally be stored in their profile.
  // Here we'll infer it based on skills.
  const caregiverSupportsLevel = (caregiver: any): number => {
    // This is a placeholder. A more advanced check could look at `canUseHoyerLift`, etc.
    if(caregiver?.preferences?.canUseHoyerLift) return 4;
    return 3;
  };

  const handleGenerate = () => {
    if (!contactData || !caregiversData) return;

    startGeneratingTransition(async () => {
      const sanitizedContact = sanitizeForServerAction({ ...contactData });
      const sanitizedLoc = sanitizeForServerAction({ ...locData });
      const combinedData = { ...sanitizedContact, ...sanitizedLoc };

      const clientCareNeeds = {
        pets: combinedData.pets,
        estimatedHours: combinedData.estimatedHours,
        promptedCall: combinedData.promptedCall,
        companionCare_mealPreparation: combinedData.companionCare_mealPreparation,
        companionCare_cleanKitchen: combinedData.companionCare_cleanKitchen,
        companionCare_assistWithLaundry: combinedData.companionCare_assistWithLaundry,
        companionCare_provideAlzheimersRedirection: combinedData.companionCare_provideAlzheimersRedirection,
        companionCare_escortAndTransportation: combinedData.companionCare_escortAndTransportation,
        personalCare_provideAlzheimersCare: combinedData.personalCare_provideAlzheimersCare,
        level_1_independent_to_verbal_reminders: combinedData.level_1_independent_to_verbal_reminders,
        level_2_transfer_stand_by_assist: combinedData.level_2_transfer_stand_by_assist,
        level_2_mild_memory_impairment: combinedData.level_2_mild_memory_impairment,
        level_3_transfer_one_person_assist: combinedData.level_3_transfer_one_person_assist,
        level_3_impaired_memory: combinedData.level_3_impaired_memory,
        level_4_transfer_two_person_or_mechanical_lift: combinedData.level_4_transfer_two_person_or_mechanical_lift,
        level_4_severe_cognitive_and_memory_impairment: combinedData.level_4_severe_cognitive_and_memory_impairment,
      };

      const availableCaregivers: CaregiverForRecommendation[] = caregiversData
        .filter(cg => cg.status === 'Active')
        .map(cg => {
            const caregiverPrefs = preferences[cg.id] || {};
            return {
                id: cg.id,
                name: cg.Name,
                supportedLevelOfCare: caregiverSupportsLevel(caregiverPrefs),
                dementiaExperience: caregiverPrefs.dementiaExperience === 'Yes',
                worksWithPets: caregiverPrefs.worksWithPets === 'Yes',
                hasDriversLicense: !!cg['Drivers Lic'],
                availability: availabilities[cg.id] || {},
            };
        });
        
      const result = await getAiCaregiverRecommendations({ clientCareNeeds, availableCaregivers });

      if (result.recommendations) {
        setRecommendations(result.recommendations);
      } else {
        console.error(result.error);
      }
    });
  };

  const isLoading = contactLoading || locLoading || caregiversLoading || subcollectionsLoading;

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <Button onClick={handleGenerate} disabled={isGenerating || isLoading}>
          {isGenerating ? (
            <Loader2 className="mr-2 animate-spin" />
          ) : (
            <Sparkles className="mr-2" />
          )}
          {isLoading ? 'Loading Data...' : 'Generate AI Recommendations'}
        </Button>
      </div>

      {recommendations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">Top {recommendations.length} Recommended Caregivers (AI-Powered)</h3>
          {recommendations.map((rec, index) => (
             <Card key={rec.id}>
              <CardHeader className="p-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <UserCheck className="h-5 w-5" />
                        {index + 1}. {rec.name}
                    </CardTitle>
                    <span className="flex items-center text-sm font-medium text-yellow-500">
                    <Star className="h-4 w-4 mr-1 fill-current" />
                    Match Score: {rec.score.toFixed(0)}%
                    </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ul className="list-disc pl-5 text-xs space-y-1">
                    {rec.reasons.map((reason: string, i: number) => <li key={i}>{reason}</li>)}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!recommendations.length && !isGenerating && (
        <p className="text-center text-muted-foreground">Click the button to generate AI-powered caregiver recommendations.</p>
      )}
    </div>
  );
}
