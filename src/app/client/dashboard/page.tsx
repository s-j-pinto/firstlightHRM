
"use client";

import { useUser, firestore } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileText, Video } from "lucide-react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { requestVideoCheckin } from "@/lib/video-checkin.actions";
import { HelpDialog } from "@/components/HelpDialog";


const videoCheckinSchema = z.object({
  requestedBy: z.string().min(1, "Please specify who this check-in is for."),
  notes: z.string().optional(),
});
type VideoCheckinFormData = z.infer<typeof videoCheckinSchema>;

export default function ClientDashboardPage() {
  const { user, isUserLoading } = useUser();
  const [canViewReports, setCanViewReports] = useState(false);
  const [clientName, setClientName] = useState<string | null>(null);
  const [isClaimsLoading, setIsClaimsLoading] = useState(true);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [isRequesting, startRequestTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<VideoCheckinFormData>({
    resolver: zodResolver(videoCheckinSchema),
    defaultValues: { requestedBy: '', notes: '' },
  });

  useEffect(() => {
    const fetchClaimsAndGroupId = async () => {
      if (user) {
        try {
          const tokenResult = await user.getIdTokenResult();
          const claims = tokenResult.claims;
          setClientName(claims.name || user.displayName || 'Client');
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
  
  useEffect(() => {
    if(clientName) {
        form.setValue('requestedBy', clientName);
    }
  }, [clientName, form]);

  const handleViewReportsClick = () => {
    if (canViewReports && groupId) {
      router.push(`/client/reports/carelog/${groupId}`);
    }
  };
  
  const onVideoCheckinSubmit = (data: VideoCheckinFormData) => {
    startRequestTransition(async () => {
        const result = await requestVideoCheckin(data);
        if (result.error) {
            toast({ title: 'Request Failed', description: result.message, variant: 'destructive' });
        } else {
            toast({ title: 'Request Sent', description: result.message });
            setIsModalOpen(false);
            form.reset();
        }
    });
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
      <div className="flex justify-between items-start mb-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline mb-2">
                Welcome, {clientName || 'Client'}!
            </h1>
            <p className="text-muted-foreground">
                This is your personal client portal.
            </p>
        </div>
        <HelpDialog topic="clientDashboard" />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Portal Features</CardTitle>
          <CardDescription>
            Here&apos;s what you can do from your portal.
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
          
           <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">Request Video Check-in</h3>
              <p className="text-sm text-muted-foreground">Schedule a brief video call with a caregiver.</p>
            </div>
             <Button onClick={() => setIsModalOpen(true)}>
                <Video className="mr-2" />
                Request Call
              </Button>
          </div>

        </CardContent>
      </Card>
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Request a Video Check-in</DialogTitle>
                <DialogDescription>
                    Fill out the details below to request a video check-in. A staff member will schedule it and send a confirmation.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onVideoCheckinSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="requestedBy"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Check-in is for</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., Jane Doe" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notes (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Any specific instructions or topics for the call..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isRequesting}>
                            {isRequesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Request
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
