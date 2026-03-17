
"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, X } from "lucide-react";
import { useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { saveLightHousekeepingAcknowledgement } from "@/lib/candidate-hiring-forms.actions";
import { cn } from "@/lib/utils";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";


export default function LightHousekeepingPage() {
    const router = useRouter();
    const { user } = useUser();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();

    const isPrintMode = searchParams.get('print') === 'true';
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
    const isAnAdmin = user?.email === adminEmail;
    const candidateId = searchParams.get('candidateId');
    const profileIdToLoad = isAnAdmin && candidateId ? candidateId : user?.uid;

    const handleAcknowledge = () => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveLightHousekeepingAcknowledgement(profileIdToLoad);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your acknowledgement has been saved."});
          if(isAnAdmin) {
            router.push(`/candidate-hiring-forms?candidateId=${profileIdToLoad}`);
          } else {
            router.push('/candidate-hiring-forms');
          }
        }
      });
    }

    const handleCancel = () => {
        if(isAnAdmin) {
            router.push(`/candidate-hiring-forms?candidateId=${profileIdToLoad}`);
        } else {
            router.push('/candidate-hiring-forms');
        }
    }


    return (
        <Card className={cn("max-w-2xl mx-auto", isPrintMode && "border-none shadow-none")}>
            <CardHeader className="items-center">
                <Image src={logoUrl} alt="FirstLight Home Care Logo" width={200} height={40} className="object-contain" />
                <CardTitle className="text-2xl tracking-wide pt-4">Light housekeeping</CardTitle>
                <CardDescription>Done only for our client</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm font-semibold mb-4">Examples of Light Housekeeping from your caregiver may include any of the following:</p>
                <ul className="list-disc list-inside space-y-3 text-sm text-muted-foreground">
                    <li><strong>Laundry</strong> (machine washing, drying, folding, putting back into drawers, hanging up). Done only for the client</li>
                    <li>Changing bed linens</li>
                    <li>Dishes will also be cleaned and put away</li>
                    <li>Wipe down of kitchen counters</li>
                    <li>Wiping down bathroom countertops, sinks, and shower/tub after bathing</li>
                    <li>Maintenance-level cleaning of the toilet in the client’s bathroom</li>
                    <li>Dusting of the surfaces of the client’s living area.</li>
                    <li>Vacuuming and sweeping of the client’s general living space and walkways</li>
                    <li>Gathering trash and taking trash to the collection spot at the end of the shift</li>
                </ul>
            </CardContent>
            <CardFooter className="flex-col items-center gap-4">
                 <div className={cn("flex w-full justify-end gap-4 pt-4", isPrintMode && "no-print")}>
                    <Button type="button" variant="outline" onClick={handleCancel}>
                      <X className="mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleAcknowledge} disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                      Acknowledge and Continue
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground pt-8 text-center">
                    First Light Home Care 9650 Business Center Dr. Ste 113 Rancho Cucamonga, CA 91730 909-321-4466
                </p>
            </CardFooter>
        </Card>
    );
}

    