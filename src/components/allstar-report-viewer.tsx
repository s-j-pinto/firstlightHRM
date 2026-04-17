
      'use client';

import * as React from "react";
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { CareLog, AllstarRouteSheetFormData } from '@/lib/types';
import { startOfWeek, endOfWeek, format, subWeeks, parse, isValid } from 'date-fns';

import { AllstarRouteSheetForm } from './allstar-route-sheet-form';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Loader2, Save, Printer, Calendar as CalendarIcon, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { useToast } from "@/hooks/use-toast";
import { saveAllstarAdminData } from "@/lib/carelog.actions";
import { generateAllstarWeeklyReportPdf } from '@/lib/pdf.actions';

interface AllstarReportViewerProps {
    groupId: string;
}

const adminFormSchema = z.object({
  visits: z.array(z.any()), // Keep visits flexible as they are handled by field array
  dateSubmitted: z.string().optional(),
  checkedBy: z.string().optional(),
  checkedDate: z.string().optional(),
  remarks: z.string().optional(),
});

type AdminFormData = z.infer<typeof adminFormSchema>;

export function AllstarReportViewer({ groupId }: AllstarReportViewerProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isGeneratingPdf, startPdfGeneration] = React.useTransition();
    const [isSavingAdmin, startSavingAdminTransition] = React.useTransition();

    const weeks = React.useMemo(() => {
        return Array.from({ length: 12 }).map((_, i) => {
            const date = subWeeks(new Date(), i);
            const start = startOfWeek(date, { weekStartsOn: 1 }); // Assuming week starts on Monday
            const end = endOfWeek(date, { weekStartsOn: 1 });
            return {
                label: `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`,
                value: format(start, 'yyyy-MM-dd')
            };
        });
    }, []);

    const [selectedWeek, setSelectedWeek] = React.useState(weeks[0].value);

    const logsQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, 'carelogs'), where('careLogGroupId', '==', groupId), orderBy('shiftDateTime', 'desc')) : null,
        [firestore, groupId]
    );
    const { data: logs, isLoading: logsLoading } = useCollection<CareLog>(logsQuery);

    const form = useForm<AdminFormData>({
        resolver: zodResolver(adminFormSchema),
    });
    
    const { watch } = form;
    const formValues = watch();

    const selectedWeekLogs = React.useMemo(() => {
        if (!logs) return [];
        const start = parse(selectedWeek, 'yyyy-MM-dd', new Date());
        const end = endOfWeek(start, { weekStartsOn: 1 });
        return logs.filter(log => {
            const logDate = (log.shiftDateTime as any)?.toDate();
            return logDate && logDate >= start && logDate <= end;
        });
    }, [selectedWeek, logs]);

    const aggregatedData = React.useMemo(() => {
        if (!selectedWeekLogs || selectedWeekLogs.length === 0) {
            return { visits: [], employeeName: '', employeeSignature: '', title: '' };
        }
        
        const allVisits = selectedWeekLogs.flatMap(log => log.templateData?.allstar_route_sheet?.visits || []);

        // Sanitize visits to prevent uncontrolled to controlled input error
        const sanitizedVisits = allVisits.map(visit => ({
            serviceDate: visit.serviceDate || '',
            timeIn: visit.timeIn || '',
            timeOut: visit.timeOut || '',
            patientName: visit.patientName || '',
            patientSignature: visit.patientSignature || '',
            typeOfVisit: visit.typeOfVisit || '',
        }));
        
        // Find the log with the most recent employee signature details
        const mostRecentLog = selectedWeekLogs[0];
        const employeeDetails = mostRecentLog.templateData?.allstar_route_sheet;
        
        return {
            visits: sanitizedVisits,
            employeeName: employeeDetails?.employeeName || '',
            employeeSignature: employeeDetails?.employeeSignature || '',
            title: employeeDetails?.title || '',
        };
    }, [selectedWeekLogs]);

    const existingAdminData = React.useMemo(() => {
        if (!selectedWeekLogs || selectedWeekLogs.length === 0) {
            return { dateSubmitted: '', checkedBy: '', checkedDate: '', remarks: '' };
        }
        // Admin data could be on any log for that week, find the most recent one with data
        const logWithAdminData = selectedWeekLogs.find(log => log.templateData?.allstar_route_sheet?.checkedBy);
        const data = logWithAdminData?.templateData?.allstar_route_sheet;
        return {
            dateSubmitted: data?.dateSubmitted && (data.dateSubmitted as any).toDate ? format((data.dateSubmitted as any).toDate(), 'MM/dd/yyyy') : '',
            checkedBy: data?.checkedBy || '',
            checkedDate: data?.checkedDate && (data.checkedDate as any).toDate ? format((data.checkedDate as any).toDate(), 'MM/dd/yyyy') : '',
            remarks: data?.remarks || '',
        };
    }, [selectedWeekLogs]);
    
    React.useEffect(() => {
        form.reset({
            visits: aggregatedData.visits,
            dateSubmitted: existingAdminData.dateSubmitted || format(new Date(), "MM/dd/yyyy"),
            checkedBy: existingAdminData.checkedBy || "Lolita Pinto",
            checkedDate: existingAdminData.checkedDate || format(new Date(), "MM/dd/yyyy"),
            remarks: existingAdminData.remarks || "",
        });
    }, [aggregatedData, existingAdminData, form]);

    const handleGeneratePdf = async () => {
        if (!selectedWeekLogs || aggregatedData.visits.length === 0) {
            toast({ title: "No Data", description: "No visits found for the selected week to generate a report.", variant: 'destructive' });
            return;
        }

        const adminData = form.getValues();
        const mostRecentLog = selectedWeekLogs[0];
        const employeeDetails = mostRecentLog.templateData?.allstar_route_sheet;

        startPdfGeneration(async () => {
            try {
                const result = await generateAllstarWeeklyReportPdf({
                    visits: adminData.visits, // Use current form data
                    weekOf: format(parse(selectedWeek, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy'),
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
        // Save admin data against all logs for that week to ensure consistency
        const logIds = selectedWeekLogs.map(log => log.id);
    
        startSavingAdminTransition(async () => {
          for (const logId of logIds) {
            const result = await saveAllstarAdminData({
              logId: logId,
              adminData: data,
            });
      
            if (result.error) {
              toast({ title: 'Save Failed', description: result.error, variant: 'destructive' });
              return; // Stop on first error
            }
          }
          toast({ title: 'Admin Fields Saved', description: 'Your changes have been saved successfully across all logs for the week.' });
        });
    });
    
    const onCancel = () => {
         form.reset({
            visits: aggregatedData.visits,
            dateSubmitted: existingAdminData.dateSubmitted || format(new Date(), "MM/dd/yyyy"),
            checkedBy: existingAdminData.checkedBy || "Lolita Pinto",
            checkedDate: existingAdminData.checkedDate || format(new Date(), "MM/dd/yyyy"),
            remarks: existingAdminData.remarks || "",
        });
        toast({ title: "Changes Canceled", description: "Form fields have been reset to their last saved state." });
    };

    if (logsLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>;
    }
    
    return (
        <FormProvider {...form}>
            <Card>
                <CardHeader>
                    <CardTitle>Allstar Weekly Route Sheet Report</CardTitle>
                    <CardDescription>Select a week to view, edit, and generate a final PDF report for all submitted visits.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Label>Select a Week</Label>
                         <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                            <SelectTrigger className="w-full max-w-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {weeks.map(week => (
                                    <SelectItem key={week.value} value={week.value}>{week.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                                Save Changes
                            </Button>
                            <Button type="button" onClick={handleGeneratePdf} disabled={isGeneratingPdf || aggregatedData.visits.length === 0}>
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
