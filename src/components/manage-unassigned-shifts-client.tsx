
"use client";

import { useState, useMemo, useTransition } from "react";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { format, parseISO } from "date-fns";
import type { TeleTrackWeeklyUnassignedShiftsInventory } from "@/lib/types";
import { getUnassignedRecommendations, sendUnassignedRecommendationsEmail } from "@/lib/unassigned-shifts.actions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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

  // Fetch Inventory (Sorted locally to ensure we get the latest document)
  const inventoryQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, "teletrack_weekly_unassigned_shifts_inventory")) : null,
    [firestore]
  );
  const { data: inventoryData, isLoading: inventoryLoading } = useCollection<TeleTrackWeeklyUnassignedShiftsInventory>(inventoryQuery);
  
  const currentInventory = useMemo(() => {
      if (!inventoryData || inventoryData.length === 0) return null;
      // deterministic latest document based on sync timestamp
      return [...inventoryData].sort((a, b) => (b.syncedAt as any).toMillis() - (a.syncedAt as any).toMillis())[0];
  }, [inventoryData]);

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
            recommendations: recommendations.slice(0, 10), // Send all top matches
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
            Weekly Unassigned Inventory
          </h2>
          <p className="text-muted-foreground text-sm">
            {currentInventory ? `Week of ${format(parseISO(currentInventory.weekStart), 'MMMM d, yyyy')}` : 'Loading weekly data...'}
          </p>
        </div>
        {currentInventory && (
             <Badge variant="outline" className="h-fit py-1 px-3 border-accent text-accent font-bold">
                {currentInventory.totalShifts} Total Shifts
             </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Shift List */}
        <div className="lg:col-span-1 space-y-4">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select an Open Shift</Label>
          {inventoryLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-accent" /></div>
          ) : currentInventory?.shifts.length ? (
            <ScrollArea className="h-[calc(100vh-22rem)] pr-4">
                <div className="space-y-3">
                {currentInventory.shifts.map((shift, idx) => (
                    <Card 
                        key={idx} 
                        className={cn("cursor-pointer transition-all border-l-4 hover:bg-muted/50", selectedShiftIndex === idx ? "ring-2 ring-accent border-accent bg-accent/5" : "border-muted-foreground/30")}
                        onClick={() => handleGetRecommendations(idx)}
                    >
                        <CardContent className="p-4 space-y-2">
                            <div className="flex justify-between items-start">
                                <span className="font-bold flex items-center gap-1.5"><Calendar className="h-4 w-4 text-accent"/> {format(parseISO(shift.date), 'EEE, MMM d')}</span>
                                <Badge variant="secondary" className="font-mono">{shift.hours}h</Badge>
                            </div>
                            <div className="text-sm font-medium flex items-center gap-1.5"><User className="h-3 w-3 opacity-70"/> {shift.client.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="h-3 w-3 opacity-70"/> {shift.arrivalTime} - {shift.departureTime}</div>
                        </CardContent>
                    </Card>
                ))}
                </div>
            </ScrollArea>
          ) : (
            <div className="h-40 flex items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground">
                <p>No unassigned shifts found.</p>
            </div>
          )}
        </div>

        {/* Right Column: Recommendations */}
        <div className="lg:col-span-2">
            {selectedShiftIndex !== null ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <Card className="border-accent/30 shadow-md">
                        <CardHeader className="bg-accent/5 border-b pb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="flex items-center gap-2 font-headline text-xl">
                                        <Sparkles className="text-accent h-6 w-6"/> 
                                        Best Fit Caregivers
                                    </CardTitle>
                                    <CardDescription>Rules-based matching for {currentInventory?.shifts[selectedShiftIndex].client.name}</CardDescription>
                                </div>
                                <Button onClick={handleSendEmail} disabled={isSending || !recommendations.length} variant="default" size="sm" className="bg-accent hover:bg-accent/90">
                                    {isSending ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Send className="mr-2 h-4 w-4"/>}
                                    Send to Management
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {isRecommending ? (
                                <div className="flex flex-col items-center justify-center py-24 gap-3">
                                    <Loader2 className="animate-spin text-accent h-10 w-10" />
                                    <p className="text-sm text-muted-foreground font-medium italic animate-pulse">Running matching algorithm: Proximity, Continuity, and Overtime check...</p>
                                </div>
                            ) : recommendations.length > 0 ? (
                                <div className="space-y-4">
                                    {recommendations.map((rec, i) => (
                                        <Card key={rec.caregiverId} className={cn("overflow-hidden border transition-all", rec.isDenied ? "border-destructive bg-destructive/5" : "hover:border-accent hover:shadow-sm")}>
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <h4 className="font-bold text-lg flex items-center gap-2">
                                                            {formatCaregiverName(rec.caregiverName)}
                                                            {rec.isDenied && <XCircle className="text-destructive h-6 w-6" />}
                                                            {rec.isPriorCaregiver && <History className="text-green-600 h-5 w-5" />}
                                                        </h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {rec.isPriorCaregiver && <Badge className="bg-green-600 text-white text-[10px] uppercase font-bold px-1.5 h-5">Prior Caregiver</Badge>}
                                                            {rec.isDenied && <Badge variant="destructive" className="text-[10px] uppercase font-bold px-1.5 h-5">Access Denied</Badge>}
                                                            <Badge variant="outline" className="text-[10px] uppercase font-bold border-accent/40 text-accent h-5">Match Score: {rec.score}</Badge>
                                                            {rec.distance && <Badge variant="secondary" className="text-[10px] h-5 flex items-center gap-1"><MapPin className="h-3 w-3"/> {rec.distance}</Badge>}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <Label className="text-[10px] text-muted-foreground uppercase block mb-1">Availability Today</Label>
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <Badge variant={rec.overtimeHoursAvailable > 0 ? "outline" : "destructive"} className="font-mono text-[11px]">
                                                                <Zap className={cn("h-3 w-3 mr-1", rec.overtimeHoursAvailable > 0 ? "text-yellow-500" : "text-white")} />
                                                                {rec.overtimeHoursAvailable}h buffer
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-3 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reasoning</Label>
                                                        <ul className="space-y-1">
                                                            {rec.reasons.map((reason: string, rIdx: number) => (
                                                                <li key={rIdx} className={cn("text-[11px] leading-tight flex items-start gap-2", rec.isDenied ? "text-destructive font-bold" : "text-muted-foreground")}>
                                                                    <span className={cn("mt-1 h-1 w-1 rounded-full shrink-0", rec.isDenied ? "bg-destructive" : "bg-accent")} />
                                                                    {reason}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div className="bg-muted/30 p-2 rounded text-[10px] font-mono whitespace-pre-wrap overflow-hidden">
                                                        <Label className="text-[9px] uppercase font-bold text-muted-foreground mb-1 block">Raw Availability</Label>
                                                        {rec.dailyAvailability}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
                                    <p className="text-muted-foreground italic">No eligible caregivers found who meet the minimum criteria for this shift.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="h-full min-h-[400px] flex items-center justify-center border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground bg-muted/10">
                    <div className="space-y-4 max-w-sm">
                        <div className="bg-background p-4 rounded-full w-fit mx-auto shadow-sm">
                            <Calendar className="h-10 w-10 opacity-30 text-accent" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Awaiting Shift Selection</h3>
                        <p className="text-sm">Choose an unassigned shift from the inventory sidebar to trigger the rules-based matching engine.</p>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
