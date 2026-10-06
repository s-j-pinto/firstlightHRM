
"use client";

import { useMemo, useState, useEffect, useTransition, useCallback } from 'react';
import { Loader2, Search, Star, ChevronRight, AlertCircle } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { cn } from "@/lib/utils";
import { getCandidateStatusReportAction } from '@/lib/caregiver.actions';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const ratingOptions = [
    { value: 'A', label: 'Excellent candidate; ready for hire' },
    { value: 'B', label: 'Good candidate; minor training needed' },
    { value: 'C', label: 'Average; may require supervision' },
    { value: 'D', label: 'Below average; limited suitability' },
    { value: 'F', label: 'Not recommended for hire' },
];

const safeFormatDate = (dateVal: any, formatStr: string) => {
    if (!dateVal) return 'N/A';
    try {
        const d = typeof dateVal?.toDate === 'function' ? dateVal.toDate() : new Date(dateVal);
        if (!isValid(d)) return 'Invalid Date';
        return format(d, formatStr);
    } catch (e) {
        return 'Invalid Date';
    }
};

export default function CandidateStatusReport() {
    const [searchTerm, setSearchTerm] = useState('');
    const [candidates, setCandidates] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [lastDocId, setLastDocId] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchReportData = useCallback((isNewSearch: boolean = true) => {
        setError(null);
        startTransition(async () => {
            const params = {
                searchTerm: searchTerm,
                lastDocId: isNewSearch ? undefined : (lastDocId || undefined),
                limit: 20
            };

            const response = await getCandidateStatusReportAction(params);

            if (response.error) {
                setError(response.error);
                return;
            }

            if (isNewSearch) {
                setCandidates(response.results);
            } else {
                setCandidates(prev => [...prev, ...response.results]);
            }
            
            setLastDocId(response.lastDocId || null);
            setHasMore(response.hasMore);
        });
    }, [searchTerm, lastDocId]);

    useEffect(() => {
        fetchReportData(true);
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchReportData(true);
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const defaultRejectedStatuses = [
            'Phone Screen Failed', 'Final Interview Failed', 'Rejected at Orientation', 'No Show', 'Process Terminated',
            'Insufficient docs provided.','Pay rate too low','Invalid References provided.','Not a good fit (attitude, soft skills etc)','CG ghosted appointment', 'Candidate withdrew application'
        ];

        const colorClass = 
            status === 'Hired' ? 'bg-green-500' :
            status === 'Orientation Scheduled' ? 'bg-cyan-500' :
            status === 'Final Interview Passed' ? 'bg-blue-500' :
            (status === 'Phonescreen Scheduled') ? 'bg-purple-500' :
            status === 'Phonescreen Invite Needed' ? 'bg-orange-500' :
            status === 'Final Interview Pending' || status === 'Pending reference checks' ? 'bg-yellow-500' :
            defaultRejectedStatuses.includes(status) ? 'bg-red-500' :
            'bg-gray-500';

        return <Badge className={cn("text-white whitespace-normal text-center", colorClass)}>{status}</Badge>;
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                    <div>
                        <CardTitle>Candidate Status Report</CardTitle>
                        <CardDescription>
                            Track candidates through the application, interview, and hiring process.
                        </CardDescription>
                    </div>
                     <Card className="p-3 text-xs bg-muted/50 w-full max-w-xs shrink-0">
                        <h4 className="font-semibold mb-2 text-center">Rating Legend</h4>
                        <ul className="space-y-1">
                        {ratingOptions.map(option => (
                            <li key={option.value} className="flex justify-between">
                                <span className="font-bold">{option.value}:</span>
                                <span className="text-right">{option.label}</span>
                            </li>
                        ))}
                        </ul>
                    </Card>
                </div>
                <form onSubmit={handleSearch} className="relative pt-4 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by candidate name..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <Button type="submit" disabled={isLoading}>Search</Button>
                </form>
            </CardHeader>
            <CardContent>
                {error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Candidate</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead>Application Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Next Step</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {candidates.length === 0 ? (
                             <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" /> : "No candidates found."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            candidates.map(candidate => (
                                <TableRow key={candidate.id}>
                                    <TableCell>
                                        <div className="font-medium">{candidate.fullName}</div>
                                        <div className="text-sm text-muted-foreground">{candidate.email}</div>
                                    </TableCell>
                                    <TableCell>{candidate.phone}</TableCell>
                                    <TableCell>
                                        {candidate.interview?.candidateRating ? (
                                            <div className="flex items-center">
                                                <Star className="w-4 h-4 text-yellow-400 mr-1" />
                                                {candidate.interview.candidateRating}
                                            </div>
                                        ) : (
                                            'N/A'
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {candidate.createdAt ? safeFormatDate(candidate.createdAt, 'PP') : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={candidate.status} />
                                    </TableCell>
                                    <TableCell>
                                        {candidate.status === 'Applied' && 'Needs Phone Screen'}
                                        {candidate.status === 'Phonescreen Scheduled' && candidate.appointment?.startTime && (
                                            `PhoneScreen: ${safeFormatDate(candidate.appointment.startTime, 'PPp')}`
                                        )}
                                        {candidate.status === 'Phonescreen Invite Needed' && 'Needs calendar invite'}
                                        {(candidate.status === 'Phone Screen Failed' || candidate.status === 'Final Interview Failed' || candidate.status === 'Rejected at Orientation' || candidate.status === 'No Show') && 'Process Ended'}
                                        {candidate.status === 'Final Interview Pending' && candidate.interview?.interviewDateTime && (
                                            `Final Interview: ${safeFormatDate(candidate.interview.interviewDateTime, 'PPp')}`
                                        )}
                                        {candidate.status === 'Final Interview Passed' && 'Needs Orientation'}
                                        {candidate.status === 'Orientation Scheduled' && candidate.interview?.orientationDateTime && (
                                            `Orientation: ${safeFormatDate(candidate.interview.orientationDateTime, 'PPp')}`
                                        )}
                                        {candidate.status === 'Hired' && candidate.employee?.hireDate && (
                                            `Hired On: ${safeFormatDate(candidate.employee.hireDate, 'PP')}`
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                
                {hasMore && (
                    <div className="flex justify-center mt-6">
                        <Button 
                            variant="outline" 
                            onClick={() => fetchReportData(false)} 
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                            Load Next 20 Records
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
