
'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, SlidersHorizontal, FilterX, Mail, CheckCircle, BellOff, Bell, Edit2, XCircle, AlertCircle, ClipboardList, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { sendHiringDocsNotification } from '@/lib/communication.actions';
import { Input } from './ui/input';
import { searchCandidatesAction } from '@/lib/caregiver.actions';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const hiringStatuses = [
  'Applied', 'Phonescreen Invite Needed', 'Phonescreen Scheduled', 'Hired', 'Orientation Scheduled', 'Final Interview Passed', 'Final Interview Pending', 'Final Interview Failed', 'Phone Screen Failed', 'Rejected at Orientation', 'Process Terminated', 'No Show'
];

const searchSchema = z.object({
    candidateName: z.string().optional(),
    hiringStatus: z.string().default('any'),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
});

type FormData = z.infer<typeof searchSchema>;

export default function AdvancedSearchClient() {
    const form = useForm<FormData>({
        resolver: zodResolver(searchSchema),
        defaultValues: { candidateName: "", hiringStatus: 'any', dateFrom: '', dateTo: '' }
    });
    
    const { control, reset } = form;
    const [results, setResults] = useState<any[]>([]);
    const [lastDocId, setLastDocId] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, startSearchTransition] = useTransition();
    const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
    const [indexError, setIndexError] = useState<string | null>(null);
    const router = useRouter();
    const { toast } = useToast();

    const performSearch = useCallback((isNewSearch: boolean = true, values?: FormData) => {
        const data = values || form.getValues();
        setIndexError(null);

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
            
            if (response.error) {
                setIndexError(response.error);
                return;
            }

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
        performSearch(true);
    }, []); // Initial load

    const handleClearFilters = () => {
        reset({ candidateName: "", hiringStatus: 'any', dateFrom: '', dateTo: '' });
        performSearch(true, { candidateName: "", hiringStatus: 'any', dateFrom: '', dateTo: '' });
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
            performSearch(true);
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
    
    const StatusBadge = ({ status }: { status: string }) => {
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
                <form onSubmit={form.handleSubmit((data) => performSearch(true, data))}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline"><SlidersHorizontal className="text-accent" /> Candidate Query Hub</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <FormField control={control} name="candidateName" render={({ field }) => ( <FormItem><FormLabel>Candidate Name (Prefix)</FormLabel><FormControl><Input placeholder="Search names..." {...field} /></FormControl></FormItem> )} />
                            <FormField control={control} name="hiringStatus" render={({ field }) => (
                                <FormItem><FormLabel>Hiring Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="any">Any Status</SelectItem>{hiringStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <div className="flex gap-2 col-span-2">
                                <Button type="submit" disabled={isLoading} className="flex-1 bg-accent hover:bg-accent/90">
                                    {isLoading ? <Loader2 className="mr-2 animate-spin"/> : <Search className="mr-2" />}
                                    Apply Filters
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

            {indexError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Performance Index Required</AlertTitle>
                    <AlertDescription>
                        This specific combination of filters requires a Firestore index to run efficiently. 
                        <br />
                        <a href={indexError.split('here: ')[1]} target="_blank" rel="noopener noreferrer" className="underline font-bold">
                            Click here to create the required index in the Firebase Console.
                        </a>
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Staffing Pool</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Candidate</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Current Status</TableHead>
                                <TableHead>Progress</TableHead>
                                <TableHead>Actions</TableHead>
                                <TableHead className="text-right">Manage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results.length > 0 ? results.map(candidate => (
                                <TableRow key={candidate.id}>
                                    <TableCell>
                                        <div className="font-medium">{candidate.fullName}</div>
                                        <div className="text-xs text-muted-foreground">{candidate.email}</div>
                                    </TableCell>
                                    <TableCell>{candidate.city}</TableCell>
                                    <TableCell><StatusBadge status={candidate.hiringStatus} /></TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {candidate.master360Saved ? <ClipboardList className="h-5 w-5 text-blue-500" title="Master 360 Complete" /> : <ClipboardList className="h-5 w-5 text-muted-foreground opacity-30" />}
                                            {candidate.newHireChecklistComplete ? <ClipboardCheck className="h-5 w-5 text-blue-500" title="Checklist Complete" /> : <ClipboardCheck className="h-5 w-5 text-muted-foreground opacity-30" />}
                                            <DocsStatusIcon status={candidate.docsStatus} candidateId={candidate.id} />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" disabled={sendingEmailId === candidate.id} onClick={() => sendNotificationEmail(candidate)} title="Notify Candidate for Onboarding">
                                            {sendingEmailId === candidate.id ? <Loader2 className="animate-spin" /> : <Mail className="h-4 w-4"/>}
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="outline" onClick={() => router.push(`/admin/manage-interviews?search=${encodeURIComponent(candidate.fullName)}`)}>
                                            Manage Interview
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        {isLoading ? "Consulting database..." : "No candidates found matching your criteria."}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    {hasMore && (
                        <div className="flex justify-center mt-6">
                            <Button variant="ghost" onClick={() => performSearch(false)} disabled={isLoading}>
                                {isLoading ? <Loader2 className="animate-spin mr-2"/> : null}
                                Load Next 10 Records
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
