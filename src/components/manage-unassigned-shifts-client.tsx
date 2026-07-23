
"use client";

import { useState, useMemo, useTransition } from "react";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { format, parseISO } from "date-fns";
import type { TeleTrackWeeklyUnassignedShiftsInventory } from "@/lib/types";
import { getUnassignedRecommendations, sendUnassignedRecommendationsEmail } from "@/lib/unassigned-shifts.actions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, Calendar, Clock, User, Sparkles, Send, MapPin, XCircle, History, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "./ui/scroll-area";

export default function ManageUnassignedShiftsClient() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedShiftIndex, setSelectedShiftId] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isRecommending, startRecommendationTransition] = useTransition();
  const [isSending, startSendTransition] = useTransition();

  // Fetch Inventory
  const inventoryQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, "teletrack_weekly_unassigned_shifts_inventory"), orderBy("syncedAt", "desc"), limit(1)) : null,
    [firestore]
  );
  const { data: inventoryData, isLoading: inventoryLoading } = useCollection<TeleTrackWeeklyUnassignedShiftsInventory>(inventoryQuery);
  const currentInventory = inventoryData?.[0];

  const formatCaregiverName = (name: string) => {
    if (!name || !name.includes(',')) return name;
    const [last, first] = name.split(',').map(s => s.trim());
    return `${first} ${last}`;
  };

  const handleGetRecommendations = (index: number) => {
    if (!currentInventory) return;
    setSelectedShiftId(index);
    setRecommendations([]);

    startRecommendationTransition(async () => {
        const result = await getUnassignedRecommendations({
            shiftIndex: index,
            weekStart: currentInventory.weekStart,
        });

        if (result.error) {
            toast({ title: "Recommendation Error", description: result.error, variant: "destructive" });
        } else if (result.recommendations) {
            setRecommendations(result.recommendations);
        }
    });
  };

  const handleSendEmail = () => {
    if (!currentInventory || selectedShiftIndex === null || !recommendations.length) return;
    const shift = currentInventory.shifts[selectedShiftIndex];

    startSendTransition(async () => {
        const result = await sendUnassignedRecommendationsEmail({
            clientName: shift.client.name,
            shiftDate: shift.date,
            shiftTime: `${shift.arrivalTime} - ${shift.departureTime}`,
            shiftHours: shift.hours,
            recommendations: recommendations.slice(0, 5), // Send top 5
        });

        if (result.error) {
            toast({ title: "Email Failed", description: result.error, variant: "destructive" });
        } else {
            toast({ title: "Email Sent", description: result.message });
        }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold font-headline">
            Unassigned Shifts for {currentInventory ? `${format(parseISO(currentInventory.weekStart), 'MMM d')} - ${format(parseISO(currentInventory.weekEnd), 'MMM d, yyyy')}` : '...'}
          </h2>
          <p className="text-muted-foreground text-sm">
            Browse unassigned shifts from TeleTrack and get AI-powered caregiver matches.
          </p>
        </div>
        {currentInventory && (
             <Badge variant="outline" className="h-fit">Total: {currentInventory.totalShifts} Shifts</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Shift List */}
        <div className="lg:col-span-1 space-y-4">
          {inventoryLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-accent" /></div>
          ) : currentInventory?.shifts.length ? (
            <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
                <div className="space-y-3">
                {currentInventory.shifts.map((shift, idx) => (
                    <Card 
                        key={idx} 
                        className={cn("cursor-pointer transition-all hover:bg-muted/50", selectedShiftIndex === idx && "ring-2 ring-accent bg-accent/5")}
                        onClick={() => handleGetRecommendations(idx)}
                    >
                        <CardContent className="p-4 space-y-2">
                            <div className="flex justify-between items-start">
                                <span className="font-bold flex items-center gap-1.5"><Calendar className="h-4 w-4 text-accent"/> {format(parseISO(shift.date), 'EEE, MMM d')}</span>
                                <Badge variant="secondary">{shift.hours}h</Badge>
                            </div>
                            <div className="text-sm font-medium flex items-center gap-1.5"><User className="h-3 w-3 opacity-70"/> {shift.client.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="h-3 w-3 opacity-70"/> {shift.arrivalTime} - {shift.departureTime}</div>
                        </CardContent>
                    </Card>
                ))}
                </div>
            </ScrollArea>
          ) : (
            <p className="text-center text-muted-foreground py-12">No unassigned shifts found for this week.</p>
          )}
        </div>

        {/* Right Column: Recommendations */}
        <div className="lg:col-span-2">
            {selectedShiftIndex !== null ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <Card className="border-accent/20 bg-accent/5">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><Sparkles className="text-accent h-5 w-5"/> AI Recommendations</CardTitle>
                                    <CardDescription>Matching active caregivers for {currentInventory?.shifts[selectedShiftIndex].client.name}</CardDescription>
                                </div>
                                <Button onClick={handleSendEmail} disabled={isSending || !recommendations.length} variant="outline" size="sm" className="bg-background">
                                    {isSending ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Send className="mr-2 h-4 w-4"/>}
                                    Email Admin & Owner
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isRecommending ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 className="animate-spin text-accent h-8 w-8" />
                                    <p className="text-sm text-muted-foreground font-medium">Analyzing schedules, prior relationships, and travel distance...</p>
                                </div>
                            ) : recommendations.length > 0 ? (
                                <div className="space-y-4">
                                    {recommendations.map((rec, i) => (
                                        <Card key={rec.caregiverId} className={cn("overflow-hidden", rec.isDenied && "border-destructive/50 bg-destructive/5")}>
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-bold text-lg flex items-center gap-2">
                                                            {formatCaregiverName(rec.caregiverName)}
                                                            {rec.isDenied && <XCircle className="text-destructive h-5 w-5" title="DENIED" />}
                                                            {rec.isPriorCaregiver && <History className="text-green-500 h-5 w-5" title="Worked before" />}
                                                        </h4>
                                                        <div className="flex gap-2 mt-1">
                                                            <Badge variant="outline" className="text-[10px]">Score: {rec.score}</Badge>
                                                            {rec.distance && <Badge variant="outline" className="text-[10px] flex items-center gap-1"><MapPin className="h-2.5 w-2.5"/> {rec.distance}</Badge>}
                                                            <Badge variant="outline" className={cn("text-[10px]", rec.overtimeHoursAvailable > 0 ? "text-green-600" : "text-red-600")}>
                                                                {rec.overtimeHoursAvailable}h buffer
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <div className="text-right hidden sm:block">
                                                        <Label className="text-[10px] text-muted-foreground uppercase block">Today&apos;s Availability</Label>
                                                        <span className="text-xs font-mono">{rec.dailyAvailability}</span>
                                                    </div>
                                                </div>
                                                <div className="mt-3 pt-3 border-t">
                                                    <ul className="space-y-1">
                                                        {rec.reasons.map((reason: string, rIdx: number) => (
                                                            <li key={rIdx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                                <span className="mt-1 h-1 w-1 rounded-full bg-accent shrink-0" />
                                                                {reason}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center py-20 text-muted-foreground italic">No suitable caregivers found matching the shift criteria.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground">
                    <div className="space-y-3">
                        <Calendar className="h-12 w-12 mx-auto opacity-20" />
                        <p>Select a shift from the inventory to view AI matches.</p>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
