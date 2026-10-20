
"use client";

import { useState, useMemo, useTransition } from "react";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { format } from "date-fns";
import type { ClientNotesSummary } from "@/lib/types";
import { sendWeeklySummaryEmail } from "@/lib/client-notes-summary.actions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, FileText, Mail, AlertTriangle, ShieldCheck, ClipboardCheck, Info, Users, Activity, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";

export default function ClientNotesSummaryViewer() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSending, startSendTransition] = useTransition();

  // Fetch up to 12 weeks of summaries
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
            {/* Executive Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-100">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-blue-800 uppercase">Clients Reviewed</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-blue-900">{selectedReport.clients.length}</div></CardContent>
                </Card>
                <Card className="bg-green-50 border-green-100">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-green-800 uppercase">Documented Visits</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-900">
                            {selectedReport.clients.reduce((acc, c) => acc + (c.response.documentationMetadata.totalVisits || 0), 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-100">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-orange-800 uppercase">Owner Follow-ups</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-900">
                            {selectedReport.clients.filter(c => c.response.agencyOwnerReview.recommendedFollowUp.length > 0).length}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-100">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-red-800 uppercase">Clients w/ Concerns</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-900">
                            {selectedReport.clients.filter(c => c.response.careConcernsAndFollowUp.length > 0).length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2"><Users className="text-accent"/> Client Summaries</h2>
                    {selectedReport.clients.map(client => (
                        <Card key={client.clientId} className="overflow-hidden border-l-4 border-l-accent">
                            <CardHeader className="bg-accent/5 border-b pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-xl">{client.clientName}</CardTitle>
                                        <CardDescription className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px] uppercase">{client.clientId}</Badge>
                                            <span className="text-xs">{client.response.reportPeriod.startDate} - {client.response.reportPeriod.endDate}</span>
                                        </CardDescription>
                                    </div>
                                    <Badge className={cn(
                                        client.response.agencyOwnerReview.overallStatus === 'Stable' ? 'bg-green-500' : 'bg-orange-500'
                                    )}>
                                        {client.response.agencyOwnerReview.overallStatus}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-accent"/> Weekly Overview</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{client.response.summary}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold flex items-center gap-2"><Activity className="h-4 w-4 text-accent"/> Care Highlights</h4>
                                        <ul className="space-y-1">
                                            {client.response.careActivities.highlights.map((h, i) => (
                                                <li key={i} className="text-xs flex items-start gap-2">
                                                    <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 shrink-0"/> {h}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent"/> Safety Observations</h4>
                                        <ul className="space-y-1">
                                            {client.response.healthAndSafetyObservations.positives.map((p, i) => (
                                                <li key={i} className="text-xs text-green-700 flex items-start gap-2">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"/> {p}
                                                </li>
                                            ))}
                                            {client.response.healthAndSafetyObservations.concerns.map((c, i) => (
                                                <li key={i} className="text-xs text-red-700 flex items-start gap-2">
                                                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0"/> {c}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                {client.response.careConcernsAndFollowUp.length > 0 && (
                                    <div className="pt-4 border-t">
                                        <h4 className="text-sm font-bold text-red-800 mb-3">Documented Concerns & Action Items</h4>
                                        <div className="space-y-3">
                                            {client.response.careConcernsAndFollowUp.map((item, i) => (
                                                <div key={i} className="p-3 rounded-lg border bg-destructive/5 border-destructive/20 text-xs">
                                                    <div className="flex justify-between font-bold mb-1">
                                                        <span>{item.concern} (${item.date})</span>
                                                        <Badge variant="outline" className="text-[9px] uppercase border-red-200 text-red-800">{item.severity}</Badge>
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

                {/* Sidebar: Checklists & Gaps */}
                <div className="space-y-6">
                    <Card className="shadow-lg border-accent/20">
                        <CardHeader className="bg-accent/5"><CardTitle className="text-lg flex items-center gap-2"><ClipboardCheck className="text-accent"/> Action Checklist</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                             <ScrollArea className="h-[400px] pr-4">
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
