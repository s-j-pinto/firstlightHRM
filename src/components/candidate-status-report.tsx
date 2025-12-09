

"use client";

import { useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { CaregiverProfile, Interview, CaregiverEmployee } from '@/lib/types';
import { Loader2, Search, Star } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

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

type CandidateStatus = 
  | 'Applied' 
  | 'Phone Screen Failed' 
  | 'Final Interview Pending'
  | 'Final Interview Failed'
  | 'Final Interview Passed'
  | 'Orientation Scheduled'
  | 'Hired';

interface EnrichedCandidate extends CaregiverProfile {
  status: CandidateStatus;
  interview?: Interview;
  employee?: CaregiverEmployee;
}

const ratingOptions = [
    { value: 'A', label: 'Excellent candidate; ready for hire' },
    { value: 'B', label: 'Good candidate; minor training needed' },
    { value: 'C', label: 'Average; may require supervision' },
    { value: 'D', label: 'Below average; limited suitability' },
    { value: 'F', label: 'Not recommended for hire' },
];

const getStatus = (
    profileId: string, 
    interviewsMap: Map<string, Interview>, 
    employeesMap: Map<string, CaregiverEmployee>
): { status: CandidateStatus, interview?: Interview, employee?: CaregiverEmployee } => {
    
    const employee = employeesMap.get(profileId);
    if (employee) {
        return { status: 'Hired', employee, interview: interviewsMap.get(profileId) };
    }

    const interview = interviewsMap.get(profileId);
    if (interview) {
        if (interview.phoneScreenPassed === 'No') {
            return { status: 'Phone Screen Failed', interview };
        }
        if (interview.phoneScreenPassed === 'Yes') {
            if (interview.orientationScheduled) {
                return { status: 'Orientation Scheduled', interview };
            }
            if (interview.finalInterviewStatus === 'Passed') {
                return { status: 'Final Interview Passed', interview };
            }
            if (interview.finalInterviewStatus === 'Failed') {
                return { status: 'Final Interview Failed', interview };
            }
            return { status: 'Final Interview Pending', interview };
        }
    }

    return { status: 'Applied', interview };
};


export default function CandidateStatusReport() {
    const [searchTerm, setSearchTerm] = useState('');

    const profilesRef = useMemoFirebase(() => collection(firestore, 'caregiver_profiles'), []);
    const { data: profiles, isLoading: profilesLoading } = useCollection<CaregiverProfile>(profilesRef);

    const interviewsRef = useMemoFirebase(() => collection(firestore, 'interviews'), []);
    const { data: interviews, isLoading: interviewsLoading } = useCollection<Interview>(interviewsRef);

    const employeesRef = useMemoFirebase(() => collection(firestore, 'caregiver_employees'), []);
    const { data: employees, isLoading: employeesLoading } = useCollection<CaregiverEmployee>(employeesRef);


    const candidates = useMemo((): EnrichedCandidate[] => {
        if (!profiles || !interviews || !employees) {
            return [];
        }

        const interviewsMap = new Map(interviews.map(i => [i.caregiverProfileId, i]));
        const employeesMap = new Map(employees.map(e => [e.caregiverProfileId, e]));

        return profiles.map(profile => {
            const { status, interview, employee } = getStatus(profile.id, interviewsMap, employeesMap);
            return {
                ...profile,
                status,
                interview,
                employee,
            };
        }).sort((a, b) => (b.createdAt as any) - (a.createdAt as any)); // Sort by most recent application

    }, [profiles, interviews, employees]);

    const filteredCandidates = useMemo(() => {
        if (!searchTerm) return candidates;
        const lowercasedTerm = searchTerm.toLowerCase();
        return candidates.filter(c => c.fullName.toLowerCase().includes(lowercasedTerm));
    }, [candidates, searchTerm]);
    
    const isLoading = profilesLoading || interviewsLoading || employeesLoading;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="ml-4 text-muted-foreground">Loading report data...</p>
            </div>
        );
    }

    const StatusBadge = ({ status }: { status: CandidateStatus }) => {
        const colorClass = 
            status === 'Hired' ? 'bg-green-500' :
            status === 'Orientation Scheduled' ? 'bg-cyan-500' :
            status === 'Final Interview Passed' ? 'bg-blue-500' :
            status === 'Final Interview Pending' ? 'bg-yellow-500' :
            status === 'Phone Screen Failed' || status === 'Final Interview Failed' ? 'bg-red-500' :
            'bg-gray-500';

        return <Badge className={cn("text-white", colorClass)}>{status}</Badge>;
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                    <div>
                        <CardTitle>Candidate Status Report</CardTitle>
                        <CardDescription>
                            Track candidates through the application, interview, and hiring process.
                        </CardDescription>
                    </div>
                     <Card className="p-3 text-xs bg-muted/50 w-full max-w-xs">
                        <h4 className="font-semibold mb-2 text-center">Rating Legend</h4>
                        <ul className="space-y-1">
                        {ratingOptions.map(option => (
                            <li key={option.value} className="flex justify-between">
                                <span className="font-bold">{option.value}:</span>
                                <span>{option.label}</span>
                            </li>
                        ))}
                        </ul>
                    </Card>
                </div>
                <div className="relative pt-4">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by candidate name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </CardHeader>
            <CardContent>
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
                        {filteredCandidates.length === 0 ? (
                             <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No candidates found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCandidates.map(candidate => (
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
                                        {candidate.createdAt ? format((candidate.createdAt as any).toDate(), 'PP') : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={candidate.status} />
                                    </TableCell>
                                    <TableCell>
                                        {candidate.status === 'Applied' && 'Needs Phone Screen'}
                                        {(candidate.status === 'Phone Screen Failed' || candidate.status === 'Final Interview Failed') && 'Process Ended'}
                                        {candidate.status === 'Final Interview Pending' && candidate.interview?.interviewDateTime && (
                                            `Final Interview: ${format((candidate.interview.interviewDateTime as any).toDate(), 'PPp')}`
                                        )}
                                        {candidate.status === 'Final Interview Passed' && 'Needs Orientation'}
                                        {candidate.status === 'Orientation Scheduled' && candidate.interview?.orientationDateTime && (
                                            `Orientation: ${format((candidate.interview.orientationDateTime as any).toDate(), 'PPp')}`
                                        )}
                                        {candidate.status === 'Hired' && candidate.employee?.hireDate && (
                                            `Hired On: ${format((candidate.employee.hireDate as any).toDate(), 'PP')}`
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
