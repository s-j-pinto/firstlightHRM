
'use client';

import * as React from "react";
import { useForm, FormProvider, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import type { VATaskTemplate, VAMedicalRecord, Client } from '@/lib/types';
import { startOfWeek, endOfWeek, format, subWeeks, parseISO, addDays, isWithinInterval } from 'date-fns';

import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Loader2, Save, Printer } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from './ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { saveVaShiftAdminData } from "@/lib/carelog.actions";
import { generateVaWeeklyReportPdf } from "@/lib/pdf.actions";
import { Input } from "./ui/input";

interface VaReportViewerProps {
    groupId: string;
}

const reportSchema = z.object({
  shifts: z.array(z.object({
    id: z.string(),
    tasks: z.record(z.boolean().nullable().optional()).optional(),
    providerSignature: z.string().optional().nullable(),
  })),
});
type ReportFormData = z.infer<typeof reportSchema>;

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getInitials = (name: string): string => {
    if (!name) return '';
    const cleanedName = name.replace(/,/g, ''); 
    const parts = cleanedName.split(' ').filter(p => p.length > 0);
    if (parts.length > 1) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    } else if (parts.length === 1 && parts[0].length > 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return '';
};

export function VaReportViewer({ groupId }: VaReportViewerProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isGeneratingPdf, startPdfGeneration] = React.useTransition();
    const [isSaving, startSavingTransition] = React.useTransition();

    const weeks = React.useMemo(() => {
        return Array.from({ length: 12 }).map((_, i) => {
            const date = subWeeks(new Date(), i);
            const start = startOfWeek(date, { weekStartsOn: 0 }); // Sunday
            return format(start, 'yyyy-MM-dd');
        });
    }, []);

    const [selectedWeek, setSelectedWeek] = React.useState(weeks[0]);
    const [selectedCaregiverName, setSelectedCaregiverName] = React.useState<string>('');

    const groupRef = useMemoFirebase(() => firestore ? doc(firestore, 'carelog_groups', groupId) : null, [groupId, firestore]);
    const { data: groupData, isLoading: groupLoading } = useDoc<any>(groupRef);

    const shiftsQuery = useMemoFirebase(
        () => groupData && firestore ? query(collection(firestore, 'va_teletrack_shifts'), where('clientName', '==', groupData.clientName)) : null,
        [groupData, firestore]
    );
    const { data: allShifts, isLoading: shiftsLoading } = useCollection<VAMedicalRecord>(shiftsQuery);
    
    const form = useForm<ReportFormData>({ resolver: zodResolver(reportSchema), defaultValues: { shifts: [] } });
    const { control, handleSubmit, reset } = form;
    
    const { fields } = useFieldArray({ control, name: "shifts", keyName: "key" });
    
    const weeklyShifts = React.useMemo(() => {
        if (!allShifts) return [];
        const weekStart = parseISO(selectedWeek);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });

        return allShifts.filter(shift => {
            if (!shift.date?.toDate) return false;
            const shiftDate = shift.date.toDate();
            return isWithinInterval(shiftDate, { start: weekStart, end: weekEnd });
        });
    }, [allShifts, selectedWeek]);

    const caregiversForWeek = React.useMemo(() => {
        const caregiverNames = new Set<string>();
        weeklyShifts.forEach(shift => {
            if (shift.caregiverName) {
                caregiverNames.add(shift.caregiverName);
            }
        });
        return Array.from(caregiverNames).sort((a, b) => a.localeCompare(b));
    }, [weeklyShifts]);

    React.useEffect(() => {
        if (caregiversForWeek.length > 0 && !selectedCaregiverName) {
            setSelectedCaregiverName(caregiversForWeek[0]);
        } else if (caregiversForWeek.length > 0 && !caregiversForWeek.includes(selectedCaregiverName)) {
            setSelectedCaregiverName(caregiversForWeek[0]);
        } else if (caregiversForWeek.length === 0) {
            setSelectedCaregiverName('');
        }
    }, [caregiversForWeek, selectedCaregiverName]);
    
    const caregiverWeeklyShifts = React.useMemo(() => {
        return weeklyShifts.filter(shift => shift.caregiverName === selectedCaregiverName);
    }, [weeklyShifts, selectedCaregiverName]);

    const caregiverInitials = React.useMemo(() => getInitials(selectedCaregiverName), [selectedCaregiverName]);

    React.useEffect(() => {
        reset({
            shifts: caregiverWeeklyShifts.map(s => ({
                id: s.id,
                tasks: s.tasks || {},
                providerSignature: s.providerSignature || caregiverInitials
            }))
        });
    }, [caregiverWeeklyShifts, reset, caregiverInitials]);

    const shiftsByDay = React.useMemo(() => {
        const shiftsMap: { [key: number]: VAMedicalRecord } = {}; // Only one shift per day for this UI
        caregiverWeeklyShifts.forEach(shift => {
            if (!shift.date?.toDate) return;
            const dayIndex = shift.date.toDate().getDay(); // 0 = Sunday
            if (!shiftsMap[dayIndex]) {
                shiftsMap[dayIndex] = shift;
            }
        });
        return shiftsMap;
    }, [caregiverWeeklyShifts]);

    const templateRef = useMemoFirebase(() => groupData?.careLogTemplateId && firestore ? doc(firestore, 'va_task_templates', groupData.careLogTemplateId) : null, [groupData, firestore]);
    const { data: templateData, isLoading: templateLoading } = useDoc<VATaskTemplate>(templateRef);

    const onSubmit = (data: ReportFormData) => {
        startSavingTransition(async () => {
            let successCount = 0;
            let hasError = false;
            for (const shift of data.shifts) {
                const cleanedTasks: Record<string, boolean> = {};
                if (shift.tasks) {
                    for (const [key, value] of Object.entries(shift.tasks)) {
                        cleanedTasks[key] = !!value; 
                    }
                }
                const result = await saveVaShiftAdminData({
                    shiftId: shift.id,
                    tasks: cleanedTasks,
                    providerSignature: shift.providerSignature || '',
                    groupId: groupId,
                });
                if (result.error) {
                    toast({
                        title: 'Save Failed',
                        description: `Could not save data for shift ${shift.id}: ${result.error}`,
                        variant: 'destructive',
                    });
                    hasError = true;
                    break; 
                } else {
                    successCount++;
                }
            }

            if (!hasError && successCount > 0) {
                toast({ title: "Save Complete", description: `Successfully saved data for ${successCount} shifts.` });
            } else if (!hasError && successCount === 0) {
                toast({ title: "No Changes", description: "No data was changed or saved." });
            }
        });
    };

    const handleGeneratePdf = async () => {
        const weekStart = parseISO(selectedWeek);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
        const weekOf = `${format(weekStart, 'MM/dd/yy')} - ${format(weekEnd, 'MM/dd/yy')}`;

        const shiftsToInclude = caregiverWeeklyShifts.map(s => {
            const formShift = form.getValues().shifts.find(fs => fs.id === s.id);
            return {
                ...s,
                tasks: formShift?.tasks || {},
                providerSignature: formShift?.providerSignature || ''
            };
        });
        
        const payload = {
            weekOf,
            groupId,
            caregiverName: selectedCaregiverName || 'N/A',
            shifts: shiftsToInclude,
        };

        startPdfGeneration(async () => {
            const result = await generateVaWeeklyReportPdf(payload);
            if (result.error) {
                toast({ title: "PDF Generation Failed", description: result.error, variant: 'destructive' });
            } else if (result.pdfData) {
                const byteCharacters = atob(result.pdfData);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) { byteNumbers[i] = byteCharacters.charCodeAt(i); }
                const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
                window.open(URL.createObjectURL(blob), '_blank');
            }
        });
    };

    const isLoading = groupLoading || shiftsLoading || templateLoading;
    const taskLabels = templateData?.tasks?.filter(t => t !== 'providerSignature') || [];

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>;
    }
    
    return (
        <FormProvider {...form}>
            <Card>
                <CardHeader>
                    <CardTitle>VA Weekly Report</CardTitle>
                    <CardDescription>Review shifts, check off completed tasks, and generate the weekly care notes PDF.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="w-full sm:w-auto">
                            <Label>Select Week</Label>
                             <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                                <SelectTrigger className="w-full max-w-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>{weeks.map(w => <SelectItem key={w} value={w}>{`${format(parseISO(w), 'MMM d')} - ${format(endOfWeek(parseISO(w), { weekStartsOn: 0 }), 'MMM d, yyyy')}`}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="w-full sm:w-auto">
                            <Label>Select Caregiver</Label>
                             <Select value={selectedCaregiverName} onValueChange={setSelectedCaregiverName}>
                                <SelectTrigger className="w-full max-w-sm"><SelectValue placeholder="Select a caregiver..." /></SelectTrigger>
                                <SelectContent>
                                    {caregiversForWeek.length > 0 ? (
                                        caregiversForWeek.map(cgName => <SelectItem key={cgName} value={cgName}>{cgName}</SelectItem>)
                                    ) : (
                                        <div className="p-4 text-sm text-muted-foreground text-center">No caregivers with shifts this week</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)}>
                        <div className="overflow-x-auto border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[180px] align-bottom">Tasks Performed</TableHead>
                                        {daysOfWeek.map((day, dayIndex) => (
                                            <TableHead key={day} className="text-center min-w-[140px]">
                                                {day}<br/>{format(addDays(parseISO(selectedWeek), dayIndex), 'MM/dd')}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                    <TableRow>
                                        <TableHead className="font-normal text-xs">Shift Times</TableHead>
                                        {daysOfWeek.map((day, dayIndex) => {
                                            const shift = shiftsByDay[dayIndex];
                                            return (
                                                <TableCell key={`${day}-times`} className="text-center text-xs p-1 align-top bg-muted/50">
                                                    {shift ? (
                                                        <div className="whitespace-nowrap">
                                                            {shift.arrivalTime || ''} - {shift.departureTime || ''}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {taskLabels.map(task => (
                                        <TableRow key={task}>
                                            <TableCell className="font-medium">{task.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}</TableCell>
                                            {daysOfWeek.map((_, dayIndex) => {
                                                const shiftForDay = shiftsByDay[dayIndex];
                                                if (!shiftForDay) {
                                                    return <TableCell key={dayIndex} />;
                                                }
                                                const fieldIndex = fields.findIndex(f => f.id === shiftForDay.id);
                                                
                                                return fieldIndex > -1 ? (
                                                    <TableCell key={dayIndex} className="text-center">
                                                        <Controller
                                                            name={`shifts.${fieldIndex}.tasks.${task}`}
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Checkbox
                                                                    checked={!!field.value}
                                                                    onCheckedChange={field.onChange}
                                                                    className="mx-auto"
                                                                />
                                                            )}
                                                        />
                                                    </TableCell>
                                                ) : (
                                                    <TableCell key={dayIndex} className="text-center">
                                                        <Checkbox disabled className="mx-auto" />
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                    <TableRow>
                                        <TableCell className="font-medium">Provider Signature</TableCell>
                                         {daysOfWeek.map((_, dayIndex) => {
                                            const shiftForDay = shiftsByDay[dayIndex];
                                            if (!shiftForDay) {
                                                return <TableCell key={dayIndex} />;
                                            }
                                            const fieldIndex = fields.findIndex(f => f.id === shiftForDay.id);
                                            return fieldIndex > -1 ? (
                                                <TableCell key={dayIndex} className="text-center p-1">
                                                    <Controller
                                                        name={`shifts.${fieldIndex}.providerSignature`}
                                                        control={control}
                                                        render={({ field }) => (
                                                            <Input
                                                                {...field}
                                                                className="h-8 text-sm min-w-[100px] font-serif italic text-center"
                                                            />
                                                        )}
                                                    />
                                                </TableCell>
                                            ) : <TableCell key={dayIndex} />;
                                        })}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex justify-end gap-4 mt-6">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 animate-spin"/> : <Save className="mr-2" />} Save Changes
                            </Button>
                            <Button type="button" onClick={handleGeneratePdf} disabled={isGeneratingPdf || fields.length === 0}>
                                {isGeneratingPdf ? <Loader2 className="mr-2 animate-spin"/> : <Printer className="mr-2" />} Generate Weekly PDF
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </FormProvider>
    );
}
