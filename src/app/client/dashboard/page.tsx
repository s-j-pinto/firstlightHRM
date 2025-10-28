
"use client";

import { useUser, firestore } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileText } from "lucide-react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function ClientDashboardPage() {
  const { user, isUserLoading } = useUser();
  const [canViewReports, setCanViewReports] = useState(false);
  const [isClaimsLoading, setIsClaimsLoading] = useState(true);
  const [groupId, setGroupId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchClaimsAndGroupId = async () => {
      if (user) {
        try {
          const tokenResult = await user.getIdTokenResult();
          const claims = tokenResult.claims;
          const userCanView = !!claims.canViewReports;
          setCanViewReports(userCanView);

          if (userCanView && claims.clientId) {
            const q = query(collection(firestore, "carelog_groups"), where("clientId", "==", claims.clientId));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setGroupId(querySnapshot.docs[0].id);
            }
          }
        } catch (error) {
          console.error("Error fetching user claims or group ID:", error);
          setCanViewReports(false);
        } finally {
          setIsClaimsLoading(false);
        }
      } else {
        setIsClaimsLoading(false);
      }
    };

    if (!isUserLoading) {
      fetchClaimsAndGroupId();
    }
  }, [user, isUserLoading]);

  const handleViewReportsClick = () => {
    if (canViewReports && groupId) {
      router.push(`/client/reports/carelog/${groupId}`);
    }
  };

  const isLoading = isUserLoading || isClaimsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight font-headline mb-2">
        Welcome, Client!
      </h1>
      <p className="text-muted-foreground mb-8">
        This is your personal client portal. Use the menu in the header to request additional care.
      </p>
      
      <Card>
        <CardHeader>
          <CardTitle>Portal Features</CardTitle>
          <CardDescription>
            Here's what you can do from your portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">Request Additional Care</h3>
              <p className="text-sm text-muted-foreground">Need extra help? Submit a request for more care hours.</p>
            </div>
            <Button asChild>
              <Link href="/client/request-care">
                Make a Request
              </Link>
            </Button>
          </div>

           <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className={cn("font-semibold", !canViewReports && "text-muted-foreground")}>View Care Log Reports</h3>
              <p className="text-sm text-muted-foreground">
                {canViewReports
                  ? "Access detailed care logs submitted by your caregivers."
                  : "This feature is not yet enabled for your account. Please contact your administrator to get access."}
              </p>
            </div>
             <Button variant="outline" disabled={!canViewReports || !groupId} onClick={handleViewReportsClick}>
                <FileText className="mr-2" />
                View Reports
              </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
