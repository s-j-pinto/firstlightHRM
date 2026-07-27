
'use client';

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import type { CaregiverProfile, Interview, Appointment } from '@/lib/types';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { dateString } from '@/lib/types';
import { format, parse, isValid } from 'date-fns';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, SlidersHorizontal, FilterX, Briefcase, Mail, CheckCircle, BellOff, Bell, Edit2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { sendHiringDocsNotification } from '@/lib/communication.actions';
import { Input } from './ui/input';
import { DateInput } from './ui/date-input';
import { searchCandidatesAction } from '@/lib/caregiver.actions';

const hiringStatuses = [
  'Applied', 'Phonescreen Invite Needed', 'Phonescreen Scheduled', 'Hired', 'Orientation Scheduled', 'Final Interview Passed', 'Final Interview Pending', 'Final Interview Failed', 'Phone Screen Failed', 'Rejected at Orientation', 'Process Terminated', 'No Show'
];

const searchSchema = z.object({
    candidateName: z.string().optional(),
    hiringStatus: z.string().default('any'),
    dateFrom: dateString,
    dateTo: dateString,
});

type FormData = z.infer<typeof searchSchema>;

export default function AdvancedSearchClient() {
    const form = useForm<FormData>({
        resolver: zodResolver(searchSchema),
        defaultValues: { candidateName: "", hiringStatus: 'any', dateFrom: '', dateTo: '' }
    });
    
    const { handleSubmit, control, reset } = form;
    const [results, setResults] = useState<any[]>([]);
    const [lastDocId, setLastDocId] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, startSearchTransition] = useTransition();
    const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
    const router = useRouter();
    const { toast } = useToast();

    const fetchResults = useCallback((isNewSearch: boolean = true) => {
        const data = form.getValues();
        startSearchTransition(async () => {
            const params = {
                namePrefix: data.candidateName,
                hiringStatus: data.hiringStatus,
                dateFrom: data.dateFrom,
                dateTo: data.dateTo,
                lastDocId: isNewSearch ? undefined : lastDocId,
                limit: 10
            };

            const response = await searchCandidatesAction(params);
            
            if (isNewSearch) {
                setResults(response.results);
            } else {
                setResults(prev => [...prev, ...response.results]);
            }
            
            setLastDocId(response.lastDocId || undefined);
            setHasMore(response.hasMore);
        });
    }, [form, lastDocId]);

    useEffect(() => {
        fetchResults(true);
    }, []); // Initial load

    const handleClearFilters = () => {
        reset({ candidateName: "", hiringStatus: 'any', dateFrom: '', dateTo: '' });
        fetchResults(true);
    }

    const sendNotificationEmail = async (candidate: any) => {
        setSendingEmailId(candidate.id);
        const result = await sendHiringDocsNotification({
            caregiverId: candidate.id,
            fullName: candidate.fullName,
            email: candidate.email,
            phone: candidate.phone,
        });
        setSendingEmailId(null);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'Notification sent.' });
            fetchResults(true);
        }
    }

    const DocsStatusIcon = ({ status, candidateId }: { status: string, candidateId: string }) => {
        const content = () => {
            switch (status) {
                case 'not-notified': return <BellOff className="h-5 w-5 text-muted-foreground" title="Not Notified" />;
                case 'notified': return <Bell className="h-5 w-5 text-blue-500" title="Notified" />;
                case 'started': return <Edit2 className="h-5 w-5 text-yellow-500" title="Started by Candidate" />;
                case 'awaiting-admin': return <XCircle className="h-5 w-5 text-red-500" title="Awaiting Admin Completion" />;
                case 'admin-signoff': return <CheckCircle className="h-5 w-5 text-blue-500" title="Admin Signoff Complete" />;
                default: return <BellOff className="h-5 w-5 text-muted-foreground" />;
            }
        };
        return (
            <Link href={`/candidate-hiring-forms?candidateId=${candidateId}`}>
                {content()}
            </Link>
        );
    };
    
    const StatusBadge = ({ status, candidateId }: { status: string, candidateId: string }) => {
        const colorClass = 
            status === 'Hired' ? 'bg-green-500' :
            status === 'Orientation Scheduled' ? 'bg-cyan-500' :
            status === 'Final Interview Passed' ? 'bg-blue-500' :
            status === 'Phonescreen Scheduled' ? 'bg-purple-500' :
            status === 'Phonescreen Invite Needed' ? 'bg-orange-500' :
            status === 'Final Interview Pending' ? 'bg-yellow-500' :
            'bg-gray-500';

        return <Badge className={cn("text-white whitespace-normal text-center", colorClass)}>{status}</Badge>;
    };

    return (
        <div className="space-y-6">
            <Form {...form}>
                <form onSubmit={handleSubmit(() => fetchResults(true))}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><SlidersHorizontal /> Query Builder</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <FormField control={control} name="candidateName" render={({ field }) => ( <FormItem><FormLabel>Candidate Name (Prefix)</FormLabel><FormControl><Input placeholder="Search..." {...field} /></FormControl></FormItem> )} />
                            <FormField control={control} name="hiringStatus" render={({ field }) => (
                                <FormItem><FormLabel>Hiring Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="any">Any Status</SelectItem>{hiringStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <div className="flex gap-2 col-span-2">
                                <Button type="submit" disabled={isLoading} className="flex-1">
                                    {isLoading ? <Loader2 className="mr-2 animate-spin"/> : <Search className="mr-2" />}
                                    Search
                                </Button>
                                <Button type="button" variant="outline" onClick={handleClearFilters} disabled={isLoading}>
                                    <FilterX className="mr-2" />
                                    Clear
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </Form>

            <Card>
                <CardHeader>
                    <CardTitle>Results (Limit 10 per page)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>City</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Next Step</TableHead>
                                <TableHead>Docs</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results.map(candidate => (
                                <TableRow key={candidate.id}>
                                    <TableCell>
                                        <div className="font-medium">{candidate.fullName}</div>
                                        <div className="text-xs text-muted-foreground">{candidate.email}</div>
                                    </TableCell>
                                    <TableCell>{candidate.city}</TableCell>
                                    <TableCell><StatusBadge status={candidate.hiringStatus} candidateId={candidate.id} /></TableCell>
                                    <TableCell>
                                        <div className="text-xs">
                                            {candidate.nextStepText}
                                            {candidate.nextStepTime && <div className="text-muted-foreground">{format(new Date(candidate.nextStepTime), 'PPp')}</div>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <DocsStatusIcon status={candidate.docsStatus} candidateId={candidate.id} />
                                            <Button variant="ghost" size="icon" disabled={sendingEmailId === candidate.id} onClick={() => sendNotificationEmail(candidate)}>
                                                {sendingEmailId === candidate.id ? <Loader2 className="animate-spin" /> : <Mail className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="outline" onClick={() => router.push(`/admin/manage-interviews?search=${encodeURIComponent(candidate.fullName)}`)}>
                                            Manage
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {hasMore && (
                        <div className="flex justify-center mt-6">
                            <Button variant="ghost" onClick={() => fetchResults(false)} disabled={isLoading}>
                                {isLoading ? <Loader2 className="animate-spin mr-2"/> : null}
                                Load More Results
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
