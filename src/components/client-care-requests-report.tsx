
"use client";

import { useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import type { ClientCareRequest } from '@/lib/types';
import { Loader2, Search, Calendar, User, Clock } from 'lucide-react';
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

export default function ClientCareRequestsReport() {
    const [searchTerm, setSearchTerm] = useState('');

    const requestsRef = useMemoFirebase(() => collection(firestore, 'client_additional_care_requests'), []);
    const { data: requests, isLoading } = useCollection<ClientCareRequest>(requestsRef);

    const sortedRequests = useMemo(() => {
        if (!requests) return [];
        return requests.sort((a, b) => (b.createdAt as any) - (a.createdAt as any)); // Sort by most recent
    }, [requests]);

    const filteredRequests = useMemo(() => {
        if (!searchTerm) return sortedRequests;
        const lowercasedTerm = searchTerm.toLowerCase();
        return sortedRequests.filter(r => r.clientName.toLowerCase().includes(lowercasedTerm));
    }, [sortedRequests, searchTerm]);
    
    const StatusBadge = ({ status }: { status: ClientCareRequest['status'] }) => {
        const colorClass = 
            status === 'scheduled' ? 'bg-green-500' :
            status === 'reviewed' ? 'bg-blue-500' :
            status === 'pending' ? 'bg-yellow-500' :
            status === 'denied' ? 'bg-red-500' :
            'bg-gray-500';

        return <Badge className={cn("text-white", colorClass)}>{status}</Badge>;
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="ml-4 text-muted-foreground">Loading report data...</p>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Client Care Requests Status</CardTitle>
                <CardDescription>
                    A summary of all additional care requests submitted by clients.
                </CardDescription>
                <div className="relative pt-4">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by client name..."
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
                            <TableHead>Client</TableHead>
                            <TableHead>Requested On</TableHead>
                            <TableHead>Preferred Date</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Urgency</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRequests.length === 0 ? (
                             <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No requests found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRequests.map(request => (
                                <TableRow key={request.id}>
                                    <TableCell>
                                        <div className="font-medium">{request.clientName}</div>
                                        <div className="text-sm text-muted-foreground">{request.clientEmail}</div>
                                    </TableCell>
                                     <TableCell>
                                        {request.createdAt ? format((request.createdAt as any).toDate(), 'PP') : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span><Calendar className="inline-block mr-1 h-4 w-4" />{request.preferredDateTime ? format((request.preferredDateTime as any).toDate(), 'PP') : 'N/A'}</span>
                                            <span className="text-xs text-muted-foreground"><Clock className="inline-block mr-1 h-3 w-3" />{request.preferredDateTime ? format((request.preferredDateTime as any).toDate(), 'p') : ''}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{request.duration}</TableCell>
                                    <TableCell>{request.urgency}</TableCell>
                                    <TableCell>
                                        <StatusBadge status={request.status} />
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
