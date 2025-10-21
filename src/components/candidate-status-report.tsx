"use client";

import { useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { CaregiverProfile, Interview, CaregiverEmployee } from '@/lib/types';
import { Loader2, User, Phone, Calendar, Check, X, FileText, Search } from 'lucide-react';
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

type CandidateStatus = 'Applied' | 'Phone Screen Failed' | 'Interview Scheduled' | 'Hired';

interface EnrichedCandidate extends CaregiverProfile {
  status: CandidateStatus;
  interview?: Interview;
  employee?: CaregiverEmployee;
}

const getStatus = (
    profileId: string, 
    interviewsMap: Map<string, Interview>, 
    employeesMap: Map<string, CaregiverEmployee>
): { status: CandidateStatus, interview?: Interview, employee?: CaregiverEmployee } => {
    
    const employee = employeesMap.get(profileId);
    if (employee) {
        return { status: 'Hired', employee };
    }

    const interview = interviewsMap.get(profileId);
    if (interview) {
        if (interview.phoneScreenPassed === 'Yes') {
            return { status: 'Interview Scheduled', interview };
        }
        if (interview.phoneScreenPassed === 'No') {
            return { status: 'Phone Screen Failed', interview };
        }
    }

    return { status: 'Applied' };
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
        const variant: "default" | "secondary" | "destructive" =
            status === 'Hired' ? 'default' :
            status === 'Interview Scheduled' ? 'secondary' :
            status === 'Phone Screen Failed' ? 'destructive' :
            'outline';
        
        const colorClass = 
            status === 'Hired' ? 'bg-green-500' :
            status === 'Interview Scheduled' ? 'bg-blue-500' :
            status === 'Phone Screen Failed' ? 'bg-red-500' :
            'bg-gray-500';

        return <Badge className={cn("text-white", colorClass)}>{status}</Badge>;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Candidate Status Report</CardTitle>
                <CardDescription>
                    Track candidates through the application, interview, and hiring process.
                </CardDescription>
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
                            <TableHead>Application Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Next Step</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCandidates.length === 0 ? (
                             <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
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
                                    <TableCell>
                                        {candidate.createdAt ? format((candidate.createdAt as any).toDate(), 'PP') : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={candidate.status} />
                                    </TableCell>
                                    <TableCell>
                                        {candidate.status === 'Applied' && 'Needs Phone Screen'}
                                        {candidate.status === 'Phone Screen Failed' && 'Process Ended'}
                                        {candidate.status === 'Interview Scheduled' && (
                                            `Interview: ${format((candidate.interview!.interviewDateTime as any).toDate(), 'PPp')}`
                                        )}
                                        {candidate.status === 'Hired' && (
                                            `Hired On: ${format((candidate.employee!.hireDate as any).toDate(), 'PP')}`
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
