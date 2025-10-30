
"use client";

import { useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { format } from 'date-fns';
import { Loader2, FileText, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';


export default function ClientSignupList() {
  const signupsQuery = useMemoFirebase(() => 
    query(collection(firestore, 'client_signups'), orderBy('createdAt', 'desc')),
    []
  );
  const { data: signups, isLoading } = useCollection<any>(signupsQuery);

  const StatusBadge = ({ status }: { status: string }) => {
    const colorClass = 
        status === 'SIGNED AND PUBLISHED' ? 'bg-green-500' :
        status === 'PENDING CLIENT SIGNATURES' ? 'bg-yellow-500' :
        'bg-gray-500';

    return <Badge className={cn("text-white", colorClass)}>{status}</Badge>;
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="ml-4 text-muted-foreground">Loading signup documents...</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Signup Documents</CardTitle>
        <CardDescription>
          A list of all client intake forms that have been created or sent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {signups && signups.length > 0 ? (
              signups.map(signup => (
                <TableRow key={signup.id}>
                  <TableCell className="font-medium">{signup.formData?.clientName || 'N/A'}</TableCell>
                  <TableCell>{signup.formData?.clientPhone || 'N/A'}</TableCell>
                  <TableCell>{signup.formData?.clientAddress ? `${signup.formData.clientAddress}, ${signup.formData.clientCity || ''}` : 'N/A'}</TableCell>
                  <TableCell>
                    {signup.createdAt ? format((signup.createdAt as any).toDate(), 'PPp') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={signup.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/owner/new-client-signup?signupId=${signup.id}`} className="flex items-center justify-end text-accent hover:underline">
                      Open <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No signup documents found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
