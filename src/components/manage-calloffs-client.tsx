
"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { collection, query, where, limit, orderBy } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { format, startOfWeek, addDays, parseISO, isValid } from "date-fns";
import type { TeleTrackWeeklyShiftsInventory, ReplacementRecommendation } from "@/lib/types";
import { getReplacementRecommendations } from "@/lib/calloff.actions";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, Calendar, Clock, User, AlertCircle, CheckCircle2, Sparkles, Star, History, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function ManageCalloffsClient() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // --- Week Selection Logic ---
  const weeks = useMemo(() => {
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
    const nextWeekStart = addDays(currentWeekStart, 7);

    return [
      { label: `Current Week (${format(currentWeekStart, "MMM d")} - ${format(addDays(currentWeekStart, 6), "MMM d")})`, value: format(currentWeekStart, "yyyy-MM-dd") },
      { label: `Next Week (${format(nextWeekStart, "MMM d")} - ${format(addDays(nextWeekStart, 6), "MMM d")})`, value: format(nextWeekStart, "yyyy-MM-dd") },
    ];
  }, []);

  const [selectedWeek, setSelectedWeek] = useState<string>(weeks[0].value);
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  
  const [recommendations, setRecommendations] = useState<ReplacementRecommendation[]>([]);
  const [isRecommending, startRecommendationTransition] = useTransition();

  // --- Firestore Data Fetching ---
  const inventoryQuery = useMemoFirebase(
    () => firestore && selectedWeek ? query(
      collection(firestore, "teletrack_weekly_shifts_inventory"),
      where("weekStart", "==", selectedWeek),
      orderBy("syncedAt", "desc"),
      limit(1)
    ) : null,
    [firestore, selectedWeek]
  );
  const { data: inventoryData, isLoading: inventoryLoading } = useCollection<TeleTrackWeeklyShiftsInventory>(inventoryQuery);
  
  const currentInventory = inventoryData?.[0];

  // --- Derived Data ---
  const clientsInWeek = useMemo(() => {
    if (!currentInventory?.shifts) return [];
    const clientNames = Array.from(new Set(currentInventory.shifts.map(s => s.client.name)));
    return clientNames.sort();
  }, [currentInventory]);

  const shiftsForClient = useMemo(() => {
    if (!currentInventory?.shifts || !selectedClientName) return [];
    return currentInventory.shifts
      .filter(s => s.client.name === selectedClientName)
      .sort((a, b) => a.date.localeCompare(b.date) || a.arrivalTime.localeCompare(b.arrivalTime));
  }, [currentInventory, selectedClientName]);

  // Reset selection when week changes
  useEffect(() => {
    setSelectedClientName("");
    setSelectedShiftId(null);
    setRecommendations([]);
  }, [selectedWeek]);

  const formatCaregiverName = (name: string) => {
    if (!name.includes(',')) return name;
    const [last, first] = name.split(',').map(s => s.trim());
    return `${first} ${last}`;
  };

  const handleGetRecommendations = () => {
    if (!selectedShiftId || !selectedClientName) return;

    startRecommendationTransition(async () => {
        const result = await getReplacementRecommendations({
            shiftId: selectedShiftId,
            weekStart: selectedWeek,
            clientName: selectedClientName,
        });

        if (result.error) {
            toast({
                title: "Recommendation Error",
                description: result.error,
                variant: "destructive",
            });
        } else if (result.recommendations) {
            setRecommendations(result.recommendations);
            // Scroll to results
            setTimeout(() => {
                const element = document.getElementById('recommendation-results');
                if (element) element.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    });
  };

  return (
    <div className="space-y-8 pb-12">
      <Card className="border-accent/20">
        <CardHeader className="bg-accent/5">
          <CardTitle>Step 1: Select Week & Client</CardTitle>
          <CardDescription>
            Choose a week to see the scheduled shifts from TeleTrack.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Select Week</Label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weeks.map(w => (
                    <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Client</Label>
              <Select 
                value={selectedClientName} 
                onValueChange={setSelectedClientName}
                disabled={inventoryLoading || clientsInWeek.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={inventoryLoading ? "Loading clients..." : "Choose a client..."} />
                </SelectTrigger>
                <SelectContent>
                  {clientsInWeek.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClientName && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Step 2: Identify the Calloff Shift</CardTitle>
              <CardDescription>
                Click on the shift where the caregiver has called off.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-accent border-accent h-fit">
              {shiftsForClient.length} Total Shifts
            </Badge>
          </CardHeader>
          <CardContent>
            {shiftsForClient.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {shiftsForClient.map((shift) => (
                  <Card 
                    key={shift.scheduleId}
                    className={cn(
                      "cursor-pointer transition-all hover:ring-2 hover:ring-accent/50",
                      selectedShiftId === shift.scheduleId ? "ring-2 ring-accent bg-accent/5" : "bg-muted/30"
                    )}
                    onClick={() => {
                        setSelectedShiftId(shift.scheduleId);
                        setRecommendations([]);
                    }}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Calendar className="h-4 w-4 text-accent" />
                          {format(parseISO(shift.date), "EEE, MMM do")}
                        </div>
                        <Badge variant="secondary">{shift.hours} hrs</Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {shift.arrivalTime} - {shift.departureTime}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{formatCaregiverName(shift.caregiver.name)}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Button 
                          variant={selectedShiftId === shift.scheduleId ? "default" : "outline"} 
                          size="sm" 
                          className="w-full"
                        >
                          {selectedShiftId === shift.scheduleId ? (
                            <><CheckCircle2 className="mr-2 h-4 w-4" /> Selected for Calloff</>
                          ) : (
                            "Select for Calloff"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 border-dashed border-2 rounded-lg">
                <p className="text-muted-foreground">No shifts found for this client in the selected week.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedShiftId && !recommendations.length && (
        <div className="flex justify-center pt-4 animate-in zoom-in-95 duration-300">
           <Button size="lg" className="px-12 bg-accent hover:bg-accent/90 shadow-xl" onClick={handleGetRecommendations} disabled={isRecommending}>
             {isRecommending ? (
                 <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing Replacement Data...</>
             ) : (
                 "Find Replacement Recommendations"
             )}
           </Button>
        </div>
      )}

      {recommendations.length > 0 && (
          <div id="recommendation-results" className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center gap-2 border-b pb-2">
                  <Sparkles className="h-6 w-6 text-accent animate-pulse" />
                  <h2 className="text-2xl font-bold font-headline">AI-Powered Replacement Recommendations</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {recommendations.map((rec, index) => (
                    <Card key={rec.caregiverId} className={cn("relative overflow-hidden", index === 0 && "ring-2 ring-accent")}>
                        {index === 0 && (
                            <div className="absolute top-0 right-0 bg-accent text-white px-3 py-1 text-xs font-bold rounded-bl-lg">
                                BEST MATCH
                            </div>
                        )}
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-xl">{formatCaregiverName(rec.caregiverName)}</CardTitle>
                                    <div className="flex gap-2 mt-2">
                                        {rec.isPriorCaregiver && (
                                            <Badge className="bg-green-100 text-green-800 border-green-200">
                                                <History className="mr-1 h-3 w-3" /> Continuity Match
                                            </Badge>
                                        )}
                                        <Badge variant="outline" className="bg-muted">
                                            Score: {rec.score}/100
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> AI Reasoning
                                </Label>
                                <ul className="space-y-1">
                                    {rec.reasons.map((reason, rIndex) => (
                                        <li key={rIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                                            {reason}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground uppercase">Workload Capacity</Label>
                                    <div className="flex items-center gap-2">
                                        <Zap className={cn("h-4 w-4", rec.overtimeHoursAvailable > 0 ? "text-yellow-500" : "text-red-500")} />
                                        <span className="text-sm font-semibold">{rec.overtimeHoursAvailable} hrs buffer</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground uppercase">Daily Schedule</Label>
                                    <p className="text-xs font-mono line-clamp-2">{rec.dailyAvailability}</p>
                                </div>
                            </div>
                            
                            <Button className="w-full mt-2" variant="outline">
                                Assign for Replacement
                            </Button>
                        </CardContent>
                    </Card>
                ))}
              </div>
          </div>
      )}

      {inventoryLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p>Fetching TeleTrack inventory...</p>
        </div>
      )}

      {!inventoryLoading && !currentInventory && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Data Missing</AlertTitle>
          <AlertDescription>
            No shift inventory found for the selected week ({selectedWeek}). Please ensure the weekly sync has run.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
