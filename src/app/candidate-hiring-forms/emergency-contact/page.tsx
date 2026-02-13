
"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc } from "firebase/firestore";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save, X, Loader2, UserCircle, ShieldQuestion } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useUser, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { emergencyContactSchema, type EmergencyContactFormData, type CaregiverProfile } from "@/lib/types";
import { saveEmergencyContactData } from "@/lib/candidate-hiring-forms.actions";
import { cn } from "@/lib/utils";

const defaultFormValues: EmergencyContactFormData = {
  emergencyContact1_name: '',
  emergencyContact1_phone: '',
  emergencyContact1_address: '',
  emergencyContact1_cityStateZip: '',
  emergencyContact2_name: '',
  emergencyContact2_phone: '',
  emergencyContact2_address: '',
  emergencyContact2_cityStateZip: '',
};

export default function EmergencyContactPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();

    const isPrintMode = searchParams.get('print') === 'true';
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "lpinto@firstlighthomecare.com";
    const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";
    const isAnAdmin = user?.email === adminEmail || user?.email === ownerEmail || user?.email === staffingAdminEmail;
    const candidateId = searchParams.get('candidateId');
    const profileIdToLoad = isAnAdmin && candidateId ? candidateId : user?.uid;
    
    const caregiverProfileRef = useMemoFirebase(
      () => (profileIdToLoad ? doc(firestore, 'caregiver_profiles', profileIdToLoad) : null),
      [profileIdToLoad]
    );
    const { data: existingData, isLoading: isDataLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);

    const form = useForm<EmergencyContactFormData>({
      resolver: zodResolver(emergencyContactSchema),
      defaultValues: defaultFormValues,
    });
    
    useEffect(() => {
        if (isPrintMode && !isDataLoading) {
          setTimeout(() => window.print(), 1000);
        }
    }, [isPrintMode, isDataLoading]);

    useEffect(() => {
        if (existingData) {
            const formData: Partial<EmergencyContactFormData> = {};
            for (const key in defaultFormValues) {
                if (Object.prototype.hasOwnProperty.call(defaultFormValues, key)) {
                   formData[key as keyof EmergencyContactFormData] = existingData[key as keyof CaregiverProfile] as string || '';
                }
            }
            form.reset(formData);
        }
    }, [existingData, form]);

    const onSubmit = (data: EmergencyContactFormData) => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveEmergencyContactData(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Emergency Contacts have been saved."});
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
            router.push(`/admin/advanced-search?search=${encodeURIComponent(existingData?.fullName || '')}`);
        } else {
            router.push('/candidate-hiring-forms');
        }
    }

    const isLoading = isUserLoading || isDataLoading;

    if(isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </div>
      )
    }

    return (
        <Card className={cn("max-w-4xl mx-auto", isPrintMode && "border-none shadow-none")}>
            <CardHeader>
                <CardTitle className="text-center text-2xl tracking-wide">
                    Caregiver Emergency Contact Numbers
                </CardTitle>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-8">
                
                {/* Your Information Section */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2"><UserCircle/> Your Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/30">
                        <div className="space-y-1">
                            <Label>Name</Label>
                            <Input value={existingData?.fullName || ''} readOnly disabled />
                        </div>
                        <div className="space-y-1">
                            <Label>Phone/Cell</Label>
                            <Input value={existingData?.phone || ''} readOnly disabled />
                        </div>
                        <div className="space-y-1">
                            <Label>Address</Label>
                            <Input value={existingData?.address || ''} readOnly disabled />
                        </div>
                         <div className="space-y-1">
                            <Label>City/State/Zip</Label>
                            <Input value={`${existingData?.city || ''}, ${existingData?.state || ''} ${existingData?.zip || ''}`} readOnly disabled />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Emergency Information Section */}
                <div className="space-y-4">
                     <h3 className="text-lg font-semibold flex items-center gap-2"><ShieldQuestion/> In Case of Emergency please notify:</h3>
                     {/* First Person */}
                     <div className="space-y-4 border p-4 rounded-md">
                        <h4 className="font-medium">First Person</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="emergencyContact1_name" render={({ field }) => ( <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="emergencyContact1_phone" render={({ field }) => ( <FormItem><FormLabel>Phone/Cell</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="emergencyContact1_address" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="emergencyContact1_cityStateZip" render={({ field }) => ( <FormItem><FormLabel>City/State/Zip</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                     </div>
                      {/* Second Person */}
                     <div className="space-y-4 border p-4 rounded-md">
                        <h4 className="font-medium">Second Person</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="emergencyContact2_name" render={({ field }) => ( <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="emergencyContact2_phone" render={({ field }) => ( <FormItem><FormLabel>Phone/Cell</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="emergencyContact2_address" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="emergencyContact2_cityStateZip" render={({ field }) => ( <FormItem><FormLabel>City/State/Zip</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                     </div>
                </div>

            </CardContent>
            <CardFooter className={cn("flex justify-between items-center pt-8", isPrintMode && "no-print")}>
                 <p className="text-xs text-muted-foreground">REV 02/03/17</p>
                <div className="flex gap-4">
                    <Button type="button" variant="outline" onClick={handleCancel}>
                    <X className="mr-2" />
                    Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                    Save Form
                    </Button>
                </div>
            </CardFooter>
            </form>
            </Form>
        </Card>
    );
}
