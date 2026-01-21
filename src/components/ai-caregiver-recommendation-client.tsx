

"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import { Loader2, UserCheck, Sparkles, Star, CalendarDays, Check, ChevronsUpDown, Mail } from "lucide-react";
import { useDoc, firestore, useMemoFirebase } from "@/firebase";
import { doc, getDocs, collection, query, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { getAiCaregiverRecommendations } from "@/lib/ai.actions";
import type { InitialContact, LevelOfCareFormData, ActiveCaregiver, CaregiverForRecommendation } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "./ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, parse } from 'date-fns';
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { sendPotentialShiftEmail } from "@/lib/communication.actions";


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

const AvailabilityCalendar = ({ data }: { data: any }) => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    if (!data) {
        return <p className="text-muted-foreground mt-4 text-center">No availability data found for this caregiver.</p>;
    }

    const hasAvailability = days.some(day => data[day] && data[day].length > 0);

    if (!hasAvailability) {
        return <p className="text-muted-foreground mt-4 text-center">This caregiver has no availability specified for the current week.</p>;
    }

    const formatTimeRange = (range: string) => {
        const [start, end] = range.split(' - ');
        if (!start || !end) return range; // fallback
        try {
            const startTime12 = format(parse(start, 'HH:mm', new Date()), 'h:mm a');
            const endTime12 = format(parse(end, 'HH:mm', new Date()), 'h:mm a');
            return `${startTime12} - ${endTime12}`;
        } catch (e) {
            console.error(`Error formatting time range "${range}":`, e);
            return range; // fallback on parsing error
        }
    };
    
    const badgeColors = [
        "bg-blue-100 text-blue-800 hover:bg-blue-100",
        "bg-green-100 text-green-800 hover:bg-green-100",
        "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
        "bg-pink-100 text-pink-800 hover:bg-pink-100",
        "bg-sky-100 text-sky-800 hover:bg-sky-100",
        "bg-amber-100 text-amber-800 hover:bg-amber-100",
        "bg-rose-100 text-rose-800 hover:bg-rose-100",
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2 mt-2">
            {days.map((day, index) => {
                const daySlots = data[day] as string[] | undefined;
                return (
                    <Card key={day} className="flex flex-col">
                        <CardHeader className="p-3 pb-2">
                            <CardTitle className="text-center text-sm capitalize">{day}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 flex-grow flex flex-col justify-center items-center">
                            {daySlots && daySlots.length > 0 ? (
                                <div className="space-y-1 w-full">
                                {daySlots.map((slot, i) => (
                                    <Badge key={i} variant="outline" className={cn("w-full justify-center text-center block whitespace-nowrap", badgeColors[index % badgeColors.length])}>
                                        {formatTimeRange(slot)}
                                    </Badge>
                                ))}
                                </div>
                            ) : (
                                <div className="text-center text-xs text-muted-foreground h-full flex items-center justify-center">
                                    Not Available
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};

export function AiCaregiverRecommendationClient({ contactId }: { contactId: string; }) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isGenerating, startGeneratingTransition] = useTransition();
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const { toast } = useToast();

  const contactDocRef = useMemoFirebase(() => doc(firestore, 'initial_contacts', contactId), [contactId]);
  const { data: contactData, isLoading: contactLoading } = useDoc<InitialContact>(contactDocRef);
  
  const locDocRef = useMemoFirebase(() => doc(firestore, 'level_of_care_assessments', contactId), [contactId]);
  const { data: locData, isLoading: locLoading } = useDoc<LevelOfCareFormData>(locDocRef);

  const [caregiversData, setCaregiversData] = useState<ActiveCaregiver[]>([]);
  const [caregiversLoading, setCaregiversLoading] = useState(true);

  const [availabilities, setAvailabilities] = useState<any>({});
  const [preferences, setPreferences] = useState<any>({});
  const [subcollectionsLoading, setSubcollectionsLoading] = useState(true);
  
  const [selectedCaregiverIds, setSelectedCaregiverIds] = useState<string[]>([]);
  const [availabilityDisplays, setAvailabilityDisplays] = useState<Record<string, {name: string; data: any}>>({});
  const [isCheckingAvailability, startCheckingAvailabilityTransition] = useTransition();
  const [popoverOpen, setPopoverOpen] = useState(false);

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
        clientAddress: sanitizedContact.clientAddress,
        clientCity: sanitizedContact.city,
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
            const availabilityData = availabilities[cg.id] || {};
            return {
                id: cg.id,
                name: cg.Name,
                address: cg.Address,
                city: cg.City,
                supportedLevelOfCare: caregiverSupportsLevel(caregiverPrefs),
                dementiaExperience: caregiverPrefs.dementiaExperience === 'Yes',
                worksWithPets: caregiverPrefs.worksWithPets === 'Yes',
                hasDriversLicense: !!cg['Drivers Lic'],
                availability: sanitizeForServerAction(availabilityData),
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
  
  const handleCheckAvailability = () => {
    startCheckingAvailabilityTransition(() => {
        if (selectedCaregiverIds.length === 0) {
            setAvailabilityDisplays({});
            return;
        }
        const newDisplays: Record<string, {name: string, data: any}> = {};
        selectedCaregiverIds.forEach(id => {
            const availabilityData = availabilities[id];
            const caregiver = caregiversData.find(cg => cg.id === id);
            if (caregiver) {
                newDisplays[id] = { name: caregiver.Name, data: availabilityData };
            }
        });
        setAvailabilityDisplays(newDisplays);
    });
  };

  const handleSendShiftEmail = async (caregiverId: string) => {
    setSendingEmailId(caregiverId);

    const caregiver = caregiversData.find(cg => cg.id === caregiverId);
    if (!caregiver || !contactData) {
        toast({ title: "Error", description: "Caregiver or client data not found.", variant: "destructive" });
        setSendingEmailId(null);
        return;
    }
    
    // Sanitize the objects before creating the payload
    const sanitizedContactData = sanitizeForServerAction(contactData);
    const sanitizedLocData = sanitizeForServerAction(locData);

    const payload = {
        caregiver: {
            name: caregiver.Name,
            email: caregiver.Email,
        },
        client: {
            id: contactId,
            name: sanitizedContactData.clientName,
            city: sanitizedContactData.city,
            estimatedHours: sanitizedContactData.estimatedHours,
            estimatedStartDate: sanitizedContactData.estimatedStartDate,
            promptedCall: sanitizedContactData.promptedCall,
            pets: sanitizedContactData.pets,
            levelOfCareData: sanitizedLocData,
            careNeedsData: sanitizedContactData,
        }
    };

    const result = await sendPotentialShiftEmail(payload);

    if (result.error) {
        toast({ title: "Email Failed", description: result.error, variant: "destructive" });
    } else {
        toast({ title: "Email Sent", description: `Shift opportunity sent to ${caregiver.Name}.` });
    }
    setSendingEmailId(null);
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

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Caregiver Availability Time Slots</CardTitle>
          <CardDescription>Select up to 5 caregivers to compare their weekly availability. Click the email icon to e-mail potential shift information to the caregiver</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full max-w-sm justify-between"
                >
                  {selectedCaregiverIds.length > 0
                    ? `${selectedCaregiverIds.length} caregiver(s) selected`
                    : "Select caregivers..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search caregivers..." />
                  <CommandList>
                    <CommandEmpty>No caregivers found.</CommandEmpty>
                    <CommandGroup>
                      {caregiversData.filter(cg => cg.status === 'Active').sort((a, b) => a.Name.localeCompare(b.Name)).map(cg => (
                        <CommandItem
                          key={cg.id}
                          value={cg.Name}
                          onSelect={() => {
                            const isSelected = selectedCaregiverIds.includes(cg.id);
                            if (isSelected) {
                              setSelectedCaregiverIds(selectedCaregiverIds.filter(id => id !== cg.id));
                            } else if (selectedCaregiverIds.length < 5) {
                              setSelectedCaregiverIds([...selectedCaregiverIds, cg.id]);
                            } else {
                              toast({
                                title: "Limit Reached",
                                description: "You can select up to 5 caregivers.",
                                variant: "default"
                              })
                            }
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCaregiverIds.includes(cg.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {cg.Name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Button onClick={handleCheckAvailability} disabled={selectedCaregiverIds.length === 0 || isCheckingAvailability}>
              {isCheckingAvailability ? <Loader2 className="mr-2 animate-spin" /> : null}
              Check Availability
            </Button>
          </div>
          {isCheckingAvailability ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : (
             <div className="mt-6 space-y-4">
                {Object.entries(availabilityDisplays).map(([id, displayData]) => (
                    <div key={id}>
                        <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{displayData.name}</h4>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSendShiftEmail(id)} disabled={sendingEmailId === id}>
                                {sendingEmailId === id ? <Loader2 className="animate-spin" /> : <Mail />}
                            </Button>
                        </div>
                        <AvailabilityCalendar data={displayData.data} />
                    </div>
                ))}
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
