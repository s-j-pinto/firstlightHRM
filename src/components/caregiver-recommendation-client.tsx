
"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Loader2, UserCheck, Sparkles, Star, CalendarDays } from "lucide-react";
import { useDoc, firestore } from "@/firebase";
import { doc, getDocs, collection } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { getCaregiverRecommendations } from "@/lib/recommendations.actions";
import type { InitialContact, LevelOfCareFormData, ActiveCaregiver } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "./ui/table";
import { cn } from "@/lib/utils";

interface CaregiverRecommendationClientProps {
  contactId: string;
}

// --- Schedule Generation Logic ---

function parseEstimatedHours(text: string): { hoursPerDay: number | null; totalWeeklyHours: number | null } {
  if (!text) return { hoursPerDay: null, totalWeeklyHours: null };

  const perDayMatch = text.match(/(\d+)\s*hours?\s*per\s*day/i);
  if (perDayMatch) {
    return { hoursPerDay: parseInt(perDayMatch[1], 10), totalWeeklyHours: null };
  }

  const perWeekMatch = text.match(/(\d+)\s*hours?\s*per\s*week/i);
  if (perWeekMatch) {
    return { hoursPerDay: null, totalWeeklyHours: parseInt(perWeekMatch[1], 10) };
  }
  
  const simpleNumberMatch = text.match(/^\d+$/);
    if (simpleNumberMatch) {
        // Assume weekly hours if only a number is provided
        return { hoursPerDay: null, totalWeeklyHours: parseInt(simpleNumberMatch[0], 10) };
    }

  return { hoursPerDay: null, totalWeeklyHours: null };
}

function generateProposedSchedule(estimatedHoursText: string, availability: any): Record<string, string> {
  const { hoursPerDay, totalWeeklyHours } = parseEstimatedHours(estimatedHoursText);
  const proposedSchedule: Record<string, string> = {};
  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  if (!hoursPerDay && !totalWeeklyHours) {
    return { "schedule": "Could not determine required hours from input." };
  }
  
  if (!availability || Object.keys(availability).length === 0) {
      return { "schedule": "Caregiver has no availability defined." };
  }

  let remainingWeeklyHours = totalWeeklyHours;

  for (const day of daysOfWeek) {
    const dayAvailability = availability[day];
    if (dayAvailability && dayAvailability.length > 0) {
      const timeSlot = dayAvailability[0]; // Use the first available slot
      const [startStr, endStr] = timeSlot.split(' - ');
      const [startHour] = startStr.split(':').map(Number);
      
      let hoursToAssign = 0;
      if (hoursPerDay) {
        hoursToAssign = hoursPerDay;
      } else if (remainingWeeklyHours && remainingWeeklyHours > 0) {
        hoursToAssign = Math.min(remainingWeeklyHours, 4); // Default to 4-hour shifts if not specified
      }

      if (hoursToAssign > 0) {
        const endHour = startHour + hoursToAssign;
        const endAmPm = endHour >= 12 ? 'PM' : 'AM';
        const startAmPm = startHour >= 12 ? 'PM' : 'AM';
        
        const formattedStartHour = startHour % 12 === 0 ? 12 : startHour % 12;
        const formattedEndHour = endHour % 12 === 0 ? 12 : endHour % 12;

        proposedSchedule[day] = `${formattedStartHour}${startAmPm} - ${formattedEndHour}${endAmPm}`;

        if (remainingWeeklyHours) {
          remainingWeeklyHours -= hoursToAssign;
        }
      }
    }
  }

  return proposedSchedule;
}

// --- Component ---

export function CaregiverRecommendationClient({ contactId }: CaregiverRecommendationClientProps) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedCaregiver, setSelectedCaregiver] = useState<any | null>(null);
  const [proposedSchedule, setProposedSchedule] = useState<Record<string, string> | null>(null);
  const [isGenerating, startGeneratingTransition] = useTransition();

  const contactDocRef = doc(firestore, 'initial_contacts', contactId);
  const { data: contactData, isLoading: contactLoading } = useDoc<InitialContact>(contactDocRef);
  
  const locDocRef = doc(firestore, 'level_of_care_assessments', contactId);
  const { data: locData, isLoading: locLoading } = useDoc<LevelOfCareFormData>(locDocRef);

  const [caregiversData, setCaregiversData] = useState<ActiveCaregiver[]>([]);
  const [caregiversLoading, setCaregiversLoading] = useState(true);

  const [availabilities, setAvailabilities] = useState<any>({});
  const [preferences, setPreferences] = useState<any>({});
  const [subcollectionsLoading, setSubcollectionsLoading] = useState(true);

  useEffect(() => {
    async function fetchCaregivers() {
        const caregiversQuery = collection(firestore, 'caregivers_active');
        const snapshot = await getDocs(caregiversQuery);
        const data = snapshot.docs.map(d => ({...d.data(), id: d.id})) as ActiveCaregiver[];
        setCaregiversData(data);
        setCaregiversLoading(false);
    }
    fetchCaregivers();
  }, []);

  useEffect(() => {
    async function fetchSubcollections() {
      if (!caregiversData || caregiversData.length === 0) return;
      
      const avails: any = {};
      const prefs: any = {};

      for (const cg of caregiversData) {
          const availDocRef = doc(firestore, `caregivers_active/${cg.id}/availability/current_week`);
          const prefDocRef = doc(firestore, `caregivers_active/${cg.id}/preferences/current`);

          const availDoc = await getDoc(availDocRef);
          if (availDoc.exists()) {
              avails[cg.id] = availDoc.data();
          }

          const prefDoc = await getDoc(prefDocRef);
          if (prefDoc.exists()) {
              prefs[cg.id] = prefDoc.data();
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
  
  const handleGenerate = () => {
    if (!contactData || !caregiversData) return;

    startGeneratingTransition(async () => {
      const clientCareNeeds = { ...contactData, ...locData };
      const availableCaregivers = caregiversData
        .filter(cg => cg.status === 'Active')
        .map(cg => ({
            ...cg,
            availability: availabilities[cg.id] || {},
            preferences: preferences[cg.id] || {},
        }));
        
      const result = await getCaregiverRecommendations({ clientCareNeeds, availableCaregivers });

      if (result.recommendations) {
        setRecommendations(result.recommendations);
        setSelectedCaregiver(null); // Reset selection
        setProposedSchedule(null);
      } else {
        console.error(result.error);
      }
    });
  };
  
  const handleSelectCaregiver = (recommendation: any) => {
    if (selectedCaregiver?.id === recommendation.id) {
        // Deselect if clicking the same one
        setSelectedCaregiver(null);
        setProposedSchedule(null);
    } else {
        setSelectedCaregiver(recommendation);
        const caregiverFullData = caregiversData.find(cg => cg.id === recommendation.id);
        const caregiverAvailability = availabilities[recommendation.id];
        if (contactData?.estimatedHours && caregiverAvailability) {
            const schedule = generateProposedSchedule(contactData.estimatedHours, caregiverAvailability);
            setProposedSchedule(schedule);
        } else {
            setProposedSchedule({ schedule: 'Missing estimated hours or caregiver availability to generate a schedule.'});
        }
    }
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
          {isLoading ? 'Loading Data...' : 'Generate Recommendations'}
        </Button>
      </div>

      {recommendations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">Top {recommendations.length} Recommended Caregivers</h3>
          {recommendations.map((rec, index) => (
             <Card 
                key={rec.id} 
                onClick={() => handleSelectCaregiver(rec)}
                className={cn(
                    "cursor-pointer transition-all",
                    selectedCaregiver?.id === rec.id ? "ring-2 ring-accent border-accent" : "hover:bg-muted/50"
                )}
             >
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
      
       {selectedCaregiver && proposedSchedule && (
        <Card className="mt-6 animate-in fade-in-50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarDays />
                    Proposed Weekly Schedule for {selectedCaregiver.name}
                </CardTitle>
                <CardDescription>Based on an estimate of "{contactData?.estimatedHours}" and the caregiver's availability.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Day</TableHead>
                            <TableHead>Proposed Shift</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Object.entries(proposedSchedule).map(([day, shift]) => (
                            <TableRow key={day}>
                                <TableCell className="capitalize font-medium">{day}</TableCell>
                                <TableCell>{shift}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
       )}

      {!recommendations.length && !isGenerating && (
        <p className="text-center text-muted-foreground">Click the button to generate caregiver recommendations based on the client's needs.</p>
      )}
    </div>
  );
}

    