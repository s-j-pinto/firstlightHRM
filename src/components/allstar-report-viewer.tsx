
'use client';

import * as React from "react";
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import type { CareLog, AllstarRouteSheetFormData, CareLogGroup, ActiveCaregiver } from '@/lib/types';
import { startOfWeek, endOfWeek, format, subWeeks, parse, isValid, isDate } from 'date-fns';

import { AllstarRouteSheetForm } from './allstar-route-sheet-form';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Loader2, Save, Printer, Calendar as CalendarIcon, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { saveAllstarVisitAndAdminData } from "@/lib/carelog.actions";
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

const safeFormatDateFromFirestore = (dateValue: any): string => {
    if (!dateValue) return '';
    // This handles nested Timestamps which are serialized as plain objects with seconds/nanoseconds
    if (dateValue.seconds && typeof dateValue.seconds === 'number') {
        return format(new Date(dateValue.seconds * 1000), 'MM/dd/yyyy');
    }
    // This handles cases where it might already be a JS Date object
    if (isDate(dateValue)) {
        return format(dateValue, 'MM/dd/yyyy');
    }
    // This handles cases where data might come from the server as a Timestamp object with a toDate method
    if (typeof dateValue.toDate === 'function') {
        return format(dateValue.toDate(), 'MM/dd/yyyy');
    }
    // If it's already a formatted string, return it as is.
    if (typeof dateValue === 'string') {
        return dateValue;
    }
    return ''; // Return empty for unknown formats
};


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
    const [selectedCaregiverEmail, setSelectedCaregiverEmail] = React.useState<string>('');

    const groupRef = useMemoFirebase(() => firestore ? doc(firestore, 'carelog_groups', groupId) : null, [groupId, firestore]);
    const { data: groupData, isLoading: groupLoading } = useDoc<CareLogGroup>(groupRef);

    const caregiversRef = useMemoFirebase(() => firestore ? collection(firestore, 'caregivers_active') : null, [firestore]);
    const { data: allCaregiversData, isLoading: caregiversLoading } = useCollection<ActiveCaregiver>(caregiversRef);

    const logsQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, 'carelogs'), where('careLogGroupId', '==', groupId), orderBy('shiftDateTime', 'desc')) : null,
        [firestore, groupId]
    );
    const { data: logs, isLoading: logsLoading } = useCollection<CareLog>(logsQuery);
    
    const caregiversInGroup = React.useMemo(() => {
        if (!groupData || !allCaregiversData) return [];
        const caregiverEmailSet = new Set(groupData.caregiverEmails);
        return allCaregiversData.filter(cg => caregiverEmailSet.has(cg.Email) && cg.status === 'Active');
    }, [groupData, allCaregiversData]);
    
    // Effect to select the first caregiver by default
    React.useEffect(() => {
        if (caregiversInGroup.length > 0 && !selectedCaregiverEmail) {
            setSelectedCaregiverEmail(caregiversInGroup[0].Email);
        }
    }, [caregiversInGroup, selectedCaregiverEmail]);

    const form = useForm<AdminFormData>({
        resolver: zodResolver(adminFormSchema),
    });

    const selectedWeekLogs = React.useMemo(() => {
        if (!logs || !selectedCaregiverEmail) return [];
        
        const start = parse(selectedWeek, 'yyyy-MM-dd', new Date());
        const end = endOfWeek(start, { weekStartsOn: 1 });

        return logs.filter(log => {
            if (log.caregiverId !== selectedCaregiverEmail) return false;
            const logDate = (log.shiftDateTime as any)?.toDate();
            return logDate && logDate >= start && logDate <= end;
        });
    }, [selectedWeek, logs, selectedCaregiverEmail]);

    const aggregatedData = React.useMemo(() => {
        if (!selectedWeekLogs || selectedWeekLogs.length === 0) {
            return { visits: [], employeeName: '', employeeSignature: '', title: '' };
        }

        const visits = selectedWeekLogs.map(log => {
            const visitData = log.templateData?.allstar_route_sheet || {};
            return {
                logId: log.id,
                serviceDate: safeFormatDateFromFirestore(visitData.serviceDate),
                timeIn: visitData.timeIn || '',
                timeOut: visitData.timeOut || '',
                patientName: visitData.patientName || '',
                patientSignature: visitData.patientSignature || '',
                typeOfVisit: visitData.typeOfVisit || undefined,
            };
        });

        const firstLog = selectedWeekLogs[0].templateData?.allstar_route_sheet;
        
        return {
            visits,
            employeeName: firstLog?.employeeName || '',
            employeeSignature: firstLog?.employeeSignature || '',
            title: firstLog?.title || '',
        };
    }, [selectedWeekLogs]);

    const existingAdminData = React.useMemo(() => {
        if (!selectedWeekLogs || selectedWeekLogs.length === 0) {
            return { dateSubmitted: '', checkedBy: '', checkedDate: '', remarks: '' };
        }
        const logWithAdminData = selectedWeekLogs.find(log => log.templateData?.allstar_route_sheet?.checkedBy);
        const data = logWithAdminData?.templateData?.allstar_route_sheet;
        
        return {
            dateSubmitted: safeFormatDateFromFirestore(data?.dateSubmitted),
            checkedBy: data?.checkedBy || '',
            checkedDate: safeFormatDateFromFirestore(data?.checkedDate),
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
        const formData = form.getValues();
        if (!formData.visits || formData.visits.length === 0) {
            toast({ title: "No Data", description: "No visits found for the selected week to generate a report.", variant: 'destructive' });
            return;
        }

        startPdfGeneration(async () => {
            try {
                const result = await generateAllstarWeeklyReportPdf({
                    visits: formData.visits,
                    weekOf: format(parse(selectedWeek, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy'),
                    employeeName: aggregatedData.employeeName,
                    employeeSignature: aggregatedData.employeeSignature,
                    title: aggregatedData.title,
                    ...formData
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
                toast({ title: 'PDF Generation Failed', description: `A client-side error occurred: ${e.message}`, variant: 'destructive' });
            }
        });
    };

    const handleSaveAdminFields = form.handleSubmit(async (data) => {
        const { visits, ...adminData } = data;
        if (!visits || visits.length === 0) {
            toast({ title: "No Data to Save", variant: "destructive" });
            return;
        }

        startSavingAdminTransition(async () => {
            let hasError = false;
            for (const visit of visits) {
                const { logId, ...visitData } = visit;
                const result = await saveAllstarVisitAndAdminData({
                    logId,
                    visitData,
                    adminData
                });
                if (result.error) {
                    hasError = true;
                    toast({ title: "Save Failed", description: `Could not save visit for ${visit.patientName}. Error: ${result.error}`, variant: "destructive" });
                    break;
                }
            }
            if (!hasError) {
                toast({ title: "Success", description: "All changes for the week have been saved." });
            }
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

    const isLoading = logsLoading || groupLoading || caregiversLoading;

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>;
    }
    
    return (
        <FormProvider {...form}>
            <Card>
                <CardHeader>
                    <CardTitle>Allstar Weekly Route Sheet Report</CardTitle>
                    <CardDescription>Select a week and caregiver to view, edit, and generate a final PDF report.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="w-full sm:w-auto">
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
                        <div className="w-full sm:w-auto">
                            <Label>Select a Caregiver</Label>
                             <Select value={selectedCaregiverEmail} onValueChange={setSelectedCaregiverEmail}>
                                <SelectTrigger className="w-full max-w-sm">
                                    <SelectValue placeholder="Select a caregiver..."/>
                                </SelectTrigger>
                                <SelectContent>
                                    {caregiversInGroup.map(cg => (
                                        <SelectItem key={cg.id} value={cg.Email}>{cg.Name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
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
