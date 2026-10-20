"use client";

import { useState, useMemo, useTransition } from "react";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import type { ClientNotesSummary } from "@/lib/types";
import { sendWeeklySummaryEmail } from "@/lib/client-notes-summary.actions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, FileText, Mail, AlertTriangle, ShieldCheck, ClipboardCheck, Info, Users, Activity, CheckCircle2, HeartPulse, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "./ui/scroll-area";
import { Label } from "./ui/label";

export default function ClientNotesSummaryViewer() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSending, startSendTransition] = useTransition();

  const summariesQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, "client_notes_summaries"), orderBy("reportDate", "desc"), limit(12)) : null,
    [firestore]
  );
  const { data: summaries, isLoading } = useCollection<ClientNotesSummary>(summariesQuery);

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const selectedReport = useMemo(() => {
    if (!summaries || !selectedReportId) return summaries?.[0] || null;
    return summaries.find(s => s.id === selectedReportId) || summaries[0];
  }, [summaries, selectedReportId]);

  const handleSendEmail = () => {
    if (!selectedReport) return;
    startSendTransition(async () => {
        const result = await sendWeeklySummaryEmail(selectedReport);
        if (result.error) {
            toast({ title: "Email Failed", description: result.error, variant: "destructive" });
        } else {
            toast({ title: "Success", description: result.message });
        }
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent h-10 w-10" /></div>;
  }

  if (!summaries || summaries.length === 0) {
    return (
        <Card className="text-center py-16 border-dashed border-2">
            <CardHeader><CardTitle>No Summaries Found</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Weekly notes summaries will appear here once the sync job runs on Sunday evening.</p></CardContent>
        </Card>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-muted/30 p-4 rounded-lg border">
        <div className="space-y-1 w-full sm:w-auto">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Report Period</Label>
            <Select value={selectedReportId || summaries[0].id} onValueChange={setSelectedReportId}>
                <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {summaries.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                            Week Ending: {s.clients[0]?.response.reportPeriod.endDate || s.id}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <Button onClick={handleSendEmail} disabled={isSending} className="bg-accent hover:bg-accent/90 shadow-md">
            {isSending ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Mail className="mr-2 h-4 w-4"/>}
            Email Report to Owner
        </Button>
      </div>

      {selectedReport && (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Executive Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-100">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-blue-800 uppercase">Clients Reviewed</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-blue-900">{selectedReport.clients.length}</div></CardContent>
                </Card>
                <Card className="bg-green-50 border-green-100">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-green-800 uppercase">Documented Visits</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-900">
                            {selectedReport.clients.reduce((acc, c) => acc + (c.response.summary.totalVisitsDocumented || 0), 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-100">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-orange-800 uppercase">Owner Follow-ups</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-900">
                            {selectedReport.clients.filter(c => c.response.agencyOwnerReview.recommendedFollowUp.length > 0 || c.response.careConcernsAndFollowUp.some(con => con.requiresOwnerReview)).length}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-100">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-red-800 uppercase">Total Concerns</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-900">
                            {selectedReport.clients.reduce((acc, c) => acc + (c.response.careConcernsAndFollowUp.length || 0), 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2"><Users className="text-accent"/> Client Summaries</h2>
                    {selectedReport.clients.map(client => (
                        <Card key={client.clientId} className="overflow-hidden border-l-4 border-l-accent">
                            <CardHeader className="bg-accent/5 border-b pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-xl">{client.clientName}</CardTitle>
                                        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px] uppercase">ID: {client.clientId}</Badge>
                                            <span className="text-xs">{client.response.reportPeriod.startDate} - {client.response.reportPeriod.endDate}</span>
                                        </div>
                                    </div>
                                    <Badge className={cn(
                                        client.response.agencyOwnerReview.overallStatus.toLowerCase().includes('stable') ? 'bg-green-500' : 'bg-orange-500'
                                    )}>
                                        {client.response.agencyOwnerReview.overallStatus}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-accent"/> Weekly Overview</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{client.response.summary.overview}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Care Highlights */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold flex items-center gap-2 mb-2"><Activity className="h-4 w-4 text-accent"/> Care Highlights</h4>
                                        <div className="space-y-4">
                                            {Object.entries(client.response.careActivities).map(([key, activities]) => {
                                                if (!Array.isArray(activities) || activities.length === 0) return null;
                                                return (
                                                    <div key={key}>
                                                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">{key.replace(/([A-Z])/g, ' $1')}</p>
                                                        <ul className="space-y-1">
                                                            {activities.map((act, i) => (
                                                                <li key={i} className="text-xs flex items-start gap-2">
                                                                    <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 shrink-0"/> {act}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Health Observations */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold flex items-center gap-2 mb-2"><HeartPulse className="h-4 w-4 text-accent"/> Health Observations</h4>
                                        <div className="space-y-4">
                                            {client.response.healthAndSafetyObservations.documentedPositiveObservations.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase text-green-700 mb-1">Positives</p>
                                                    <ul className="space-y-1">
                                                        {client.response.healthAndSafetyObservations.documentedPositiveObservations.map((p, i) => (
                                                            <li key={i} className="text-xs text-green-700 flex items-start gap-2">
                                                                <span className="h-1 w-1 rounded-full bg-green-500 mt-1.5 shrink-0"/> {p}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {client.response.healthAndSafetyObservations.medicalConcernsReported.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase text-red-700 mb-1">Reported Concerns</p>
                                                    <ul className="space-y-1">
                                                        {client.response.healthAndSafetyObservations.medicalConcernsReported.map((c, i) => (
                                                            <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                                                                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0"/> {c}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Concerns */}
                                {client.response.careConcernsAndFollowUp.length > 0 && (
                                    <div className="pt-4 border-t">
                                        <h4 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                                            <Zap className="h-4 w-4"/> Actionable Concerns
                                        </h4>
                                        <div className="space-y-3">
                                            {client.response.careConcernsAndFollowUp.map((item, i) => (
                                                <div key={i} className="p-3 rounded-lg border bg-destructive/5 border-destructive/20 text-xs">
                                                    <div className="flex justify-between font-bold mb-1">
                                                        <span>{item.concern} ({item.sourceDate})</span>
                                                        <div className="flex gap-1">
                                                            {item.requiresOwnerReview && <Badge className="bg-orange-500 text-[8px] h-4">OWNER</Badge>}
                                                            {item.requiresClinicalReview && <Badge className="bg-blue-500 text-[8px] h-4">CLINICAL</Badge>}
                                                            <Badge variant="outline" className="text-[9px] uppercase border-red-200 text-red-800">{item.severity}</Badge>
                                                        </div>
                                                    </div>
                                                    <p className="text-muted-foreground mb-2">{item.description}</p>
                                                    <div className="p-2 rounded bg-white/50 border border-destructive/10">
                                                        <strong className="text-accent uppercase text-[9px]">Recommended Action:</strong>
                                                        <p className="mt-1 font-medium">{item.recommendedAction}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card className="shadow-lg border-accent/20">
                        <CardHeader className="bg-accent/5"><CardTitle className="text-lg flex items-center gap-2"><ClipboardCheck className="text-accent"/> Follow-Up List</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                             <ScrollArea className="h-[500px] pr-4">
                                <div className="space-y-4">
                                    {selectedReport.clients.map(c => {
                                        const actions = Array.from(new Set([
                                            ...c.response.agencyOwnerReview.recommendedFollowUp,
                                            ...c.response.careConcernsAndFollowUp.map(item => item.recommendedAction)
                                        ]));
                                        if (actions.length === 0) return null;
                                        return (
                                            <div key={c.clientId} className="space-y-2">
                                                <p className="text-xs font-bold text-accent border-b pb-1">{c.clientName}</p>
                                                <ul className="space-y-2">
                                                    {actions.map((a, i) => (
                                                        <li key={i} className="text-xs flex items-start gap-2 bg-muted/30 p-2 rounded">
                                                            <div className="h-4 w-4 rounded-sm border border-accent/40 mt-0.5 shrink-0" /> {a}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                             </ScrollArea>
                        </CardContent>
                    </Card>

                    <Card className="border-orange-200">
                        <CardHeader className="bg-orange-50"><CardTitle className="text-lg flex items-center gap-2 text-orange-800"><Info className="h-5 w-5"/> Documentation Gaps</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                             <div className="space-y-4">
                                {selectedReport.clients.map(c => {
                                    const gaps = Array.from(new Set([
                                        ...c.response.agencyOwnerReview.documentationGaps,
                                        ...c.response.healthAndSafetyObservations.notDocumented,
                                        ...c.response.documentationMetadata.dataLimitations
                                    ]));
                                    if (gaps.length === 0) return null;
                                    return (
                                        <div key={c.clientId} className="space-y-1">
                                            <p className="text-[10px] font-bold text-orange-700">{c.clientName}</p>
                                            <ul className="space-y-1">
                                                {gaps.map((g, i) => (
                                                    <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-2">
                                                        <span className="mt-1 h-1 w-1 rounded-full bg-orange-300 shrink-0"/> {g}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })}
                             </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
