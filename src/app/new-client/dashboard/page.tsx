
"use client";

import { useUser, firestore, useCollection, useMemoFirebase } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileText, ChevronRight } from "lucide-react";
import Link from 'next/link';
import { collection, query, where } from "firebase/firestore";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function NewClientDashboardPage() {
  const { user, isUserLoading } = useUser();

  const signupsQuery = useMemoFirebase(() => 
    user?.email 
      ? query(
          collection(firestore, 'client_signups'), 
          where('clientEmail', '==', user.email)
        )
      : null,
    [user?.email]
  );
  
  const { data: documents, isLoading: docsLoading } = useCollection<any>(signupsQuery);

  const isLoading = isUserLoading || docsLoading;
  
  const pendingDocuments = documents?.filter(doc => doc.status === 'Pending Client Signatures');


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight font-headline mb-2">
        Welcome, {user?.displayName || user?.email}!
      </h1>
      <p className="text-muted-foreground mb-8">
        Please review and sign the documents below to complete your onboarding process.
      </p>
      
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Documents Awaiting Your Signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              {pendingDocuments && pendingDocuments.length > 0 ? (
                  pendingDocuments.map(doc => (
                      <Link href={`/client-sign/${doc.id}`} key={doc.id} className="block">
                          <Card className="hover:shadow-md transition-shadow cursor-pointer">
                              <CardContent className="p-4 flex justify-between items-center">
                                  <div className="flex items-center gap-4">
                                      <FileText className="h-8 w-8 text-accent" />
                                      <div>
                                          <h3 className="font-semibold">{doc.formData?.formName || 'Client Service Agreement'}</h3>
                                          <p className="text-sm text-muted-foreground">
                                              Sent on {format((doc.lastUpdatedAt as any).toDate(), 'PP')}
                                          </p>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                      <Badge>Awaiting Signature</Badge>
                                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                  </div>
                              </CardContent>
                          </Card>
                      </Link>
                  ))
              ) : (
                  <div className="text-center py-16 border-dashed border-2 rounded-lg">
                      <h3 className="text-lg font-medium">No Documents Found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">There are no documents awaiting your signature at this time.</p>
                  </div>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
