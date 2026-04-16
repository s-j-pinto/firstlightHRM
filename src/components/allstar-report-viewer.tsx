
'use client';

import * as React from "react";
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { CareLog, AllstarRouteSheetFormData } from '@/lib/types';
import { startOfWeek, endOfWeek, format, parse, isValid } from 'date-fns';

import { AllstarRouteSheetForm } from './allstar-route-sheet-form';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Loader2, Save, Printer, Calendar as CalendarIcon, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from "./ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { saveAllstarAdminData } from "@/lib/carelog.actions";
import { generateAllstarWeeklyReportPdf } from '@/lib/pdf.actions';

interface AllstarReportViewerProps {
    groupId: string;
}

const adminFormSchema = z.object({
  dateSubmitted: z.string().optional(),
  checkedBy: z.string().optional(),
  checkedDate: z.string().optional(),
  remarks: z.string().optional(),
});

type AdminFormData = z.infer<typeof adminFormSchema>;

export function AllstarReportViewer({ groupId }: AllstarReportViewerProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
    const [isGeneratingPdf, startPdfGeneration] = React.useTransition();
    const [isSavingAdmin, startSavingAdminTransition] = React.useTransition();

    const logsQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, 'carelogs'), where('careLogGroupId', '==', groupId), orderBy('shiftDateTime', 'desc')) : null,
        [firestore, groupId]
    );
    const { data: logs, isLoading: logsLoading } = useCollection<CareLog>(logsQuery);

    const form = useForm<AllstarRouteSheetFormData & AdminFormData>({
        resolver: zodResolver(adminFormSchema),
    });
    
    const selectedWeekLogs = React.useMemo(() => {
        if (!logs) return [];
        const start = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
        const end = endOfWeek(selectedDate, { weekStartsOn: 1 }); // Sunday
        return logs.filter(log => {
            const logDate = (log.shiftDateTime as any)?.toDate();
            return logDate && logDate >= start && logDate <= end;
        });
    }, [selectedDate, logs]);

    const aggregatedVisits = React.useMemo(() => {
        if (!selectedWeekLogs) return [];
        return selectedWeekLogs.flatMap(log => log.templateData?.allstar_route_sheet?.visits || []);
    }, [selectedWeekLogs]);

    const existingAdminData = React.useMemo(() => {
        if (!selectedWeekLogs || selectedWeekLogs.length === 0) {
            return { dateSubmitted: '', checkedBy: '', checkedDate: '', remarks: '' };
        }
        const mostRecentLog = selectedWeekLogs[0]; // Already sorted by desc date
        const data = mostRecentLog.templateData?.allstar_route_sheet;
        return {
            dateSubmitted: data?.dateSubmitted ? format((data.dateSubmitted as any).toDate(), 'MM/dd/yyyy') : '',
            checkedBy: data?.checkedBy || '',
            checkedDate: data?.checkedDate ? format((data.checkedDate as any).toDate(), 'MM/dd/yyyy') : '',
            remarks: data?.remarks || '',
        };
    }, [selectedWeekLogs]);
    
    React.useEffect(() => {
        form.reset({
            dateSubmitted: existingAdminData.dateSubmitted || format(new Date(), "MM/dd/yyyy"),
            checkedBy: existingAdminData.checkedBy || "Lolita Pinto",
            checkedDate: existingAdminData.checkedDate || format(new Date(), "MM/dd/yyyy"),
            remarks: existingAdminData.remarks || "",
        });
    }, [existingAdminData, form]);

    const handleGeneratePdf = async () => {
        if (!selectedWeekLogs || aggregatedVisits.length === 0) {
            toast({ title: "No Data", description: "No visits found for the selected week to generate a report.", variant: 'destructive' });
            return;
        }

        const adminData = form.getValues();
        const mostRecentLog = selectedWeekLogs[0];
        const employeeDetails = mostRecentLog.templateData?.allstar_route_sheet;

        startPdfGeneration(async () => {
            try {
                const result = await generateAllstarWeeklyReportPdf({
                    visits: aggregatedVisits,
                    weekOf: format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'MM/dd/yyyy'),
                    employeeName: employeeDetails.employeeName,
                    employeeSignature: employeeDetails.employeeSignature,
                    title: employeeDetails.title,
                    ...adminData
                });

                if (result.error) {
                    toast({ title: 'PDF Generation Failed', description: result.error, variant: 'destructive' });
                } else if (result.pdfData) {
                    const byteCharacters = atob(result.pdfData);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                } else {
                    toast({ title: 'PDF Generation Failed', description: 'An unknown server error occurred during PDF generation', variant: 'destructive' });
                }
            } catch (e: any) {
                console.error("Critical error in handleGeneratePdf:", e);
                toast({ title: 'PDF Generation Failed', description: `A client-side error occurred: ${e.message}`, variant: 'destructive' });
            }
        });
    };

    const handleSaveAdminFields = form.handleSubmit(async (data) => {
        if (!selectedWeekLogs || selectedWeekLogs.length === 0) {
          toast({ title: "No Data", description: "No logs found for the selected week to save admin data against.", variant: 'destructive' });
          return;
        }
        // We save the admin data to the most recent log of that week.
        const mostRecentLogId = selectedWeekLogs[0].id;
    
        startSavingAdminTransition(async () => {
          const result = await saveAllstarAdminData({
            logId: mostRecentLogId,
            adminData: {
              dateSubmitted: data.dateSubmitted,
              checkedBy: data.checkedBy,
              checkedDate: data.checkedDate,
              remarks: data.remarks,
            },
          });
    
          if (result.error) {
            toast({ title: 'Save Failed', description: result.error, variant: 'destructive' });
          } else {
            toast({ title: 'Admin Fields Saved', description: 'Your notes have been saved successfully.' });
          }
        });
    });

    const onCancel = () => {
        form.reset({
            dateSubmitted: existingAdminData.dateSubmitted || format(new Date(), "MM/dd/yyyy"),
            checkedBy: existingAdminData.checkedBy || "Lolita Pinto",
            checkedDate: existingAdminData.checkedDate || format(new Date(), "MM/dd/yyyy"),
            remarks: existingAdminData.remarks || "",
        });
        toast({ title: "Changes Canceled", description: "Admin fields have been reset to their last saved state." });
    };


    if (logsLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>;
    }
    
    return (
        <FormProvider {...form}>
            <Card>
                <CardHeader>
                    <CardTitle>Allstar Weekly Route Sheet Report</CardTitle>
                    <CardDescription>Select a week to view all submitted visits and generate a final PDF report.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <Label>Select a Week</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[280px] justify-start text-left font-normal ml-4",
                                    !selectedDate && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? `Week of ${format(startOfWeek(selectedDate, {weekStartsOn: 1}), "MMM d, yyyy")}` : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => date && setSelectedDate(date)}
                                initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <form>
                        <AllstarRouteSheetForm mode="admin" />

                        <div className="flex justify-end gap-4 mt-6">
                            <Button type="button" variant="outline" onClick={onCancel}>
                                <X className="mr-2" />
                                Cancel
                            </Button>
                            <Button onClick={handleSaveAdminFields} disabled={isSavingAdmin}>
                                {isSavingAdmin ? <Loader2 className="mr-2 animate-spin"/> : <Save className="mr-2" />}
                                Save Admin Fields
                            </Button>
                            <Button type="button" onClick={handleGeneratePdf} disabled={isGeneratingPdf}>
                                {isGeneratingPdf ? <Loader2 className="mr-2 animate-spin"/> : <Printer className="mr-2" />}
                                Generate Weekly PDF
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </FormProvider>
    );
}

