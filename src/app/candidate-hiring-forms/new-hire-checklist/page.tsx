
"use client";

import { useTransition, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc } from "firebase/firestore";
import Image from "next/image";

import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, X, ClipboardCheck } from "lucide-react";
import { useUser, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { newHireChecklistSchema, type NewHireChecklistFormData, type CaregiverProfile } from "@/lib/types";
import { saveNewHireChecklistAction } from "@/lib/candidate-hiring-forms.actions";
import { cn } from "@/lib/utils";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

const checklistItems = [
    { id: "driversLicense", label: "DRIVERS LICENSE" },
    { id: "dmvRecord", label: "DMV RECORD" },
    { id: "carInsurance", label: "CAR INSURANCE" },
    { id: "carRegistration", label: "CAR REGISTRATION" },
    { id: "ssnCard", label: "SOCIAL SECURITY CARD" },
    { id: "hcaClearance", label: "HCA CLEARANCE LETTER" },
    { id: "liveScanLetter", label: "LIVE SCAN LETTER" },
    { id: "tbTestResults", label: "TB TEST RESULTS" },
    { id: "vaccineRecord", label: "VACCINE SHOT RECORD" },
    { id: "physicalForm", label: "PHYSICAL FORM (HHA & CNA Required)" },
    { id: "cprFirstAid", label: "CPR/ First Aid" },
    { id: "other", label: "OTHER" },
] as const;

function NewHireChecklistContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();
    const firestore = useFirestore();

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "lpinto@firstlighthomecare.com";
    const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";
    const isAnAdmin = user?.email === adminEmail || user?.email === ownerEmail || user?.email === staffingAdminEmail;

    const candidateId = searchParams.get('candidateId');

    const caregiverProfileRef = useMemoFirebase(
      () => (candidateId ? doc(firestore, 'caregiver_profiles', candidateId) : null),
      [candidateId, firestore]
    );
    const { data: profileData, isLoading: isProfileLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);

    const form = useForm<NewHireChecklistFormData>({
      resolver: zodResolver(newHireChecklistSchema),
      defaultValues: {
          driversLicenseReceived: false,
          dmvRecordReceived: false,
          carInsuranceReceived: false,
          carRegistrationReceived: false,
          ssnCardReceived: false,
          hcaClearanceReceived: false,
          liveScanLetterReceived: false,
          tbTestResultsReceived: false,
          vaccineRecordReceived: false,
          physicalFormReceived: false,
          cprFirstAidReceived: false,
          otherReceived: false,
      },
    });

    useEffect(() => {
        if (profileData) {
            const formData: any = {};
            checklistItems.forEach(item => {
                formData[`${item.id}Received`] = (profileData as any)[`${item.id}Received`] || false;
                formData[`${item.id}Comment`] = (profileData as any)[`${item.id}Comment`] || "";
            });
            form.reset(formData);
        }
    }, [profileData, form]);

    const onSubmit = (data: NewHireChecklistFormData) => {
      if (!candidateId) return;
      startSavingTransition(async () => {
        const result = await saveNewHireChecklistAction(candidateId, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "New Hire Checklist saved."});
          router.push(`/candidate-hiring-forms?candidateId=${candidateId}`);
        }
      });
    }

    if (!isAnAdmin) {
        return <div className="p-8 text-center">Unauthorized. Only administrators can access this form.</div>;
    }

    if (isUserLoading || isProfileLoading) {
      return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-12 w-12 animate-spin text-accent" /></div>;
    }

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-2xl font-bold font-headline flex items-center gap-2">
                        <ClipboardCheck className="text-accent" />
                        NEW HIRE CHECKLIST
                    </CardTitle>
                    <CardDescription>Documentation verification checklist for: {profileData?.fullName}</CardDescription>
                </div>
                <Image src={logoUrl} alt="FirstLight Logo" width={150} height={30} className="object-contain" />
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px]">Document</TableHead>
                                    <TableHead className="text-center w-[100px]">Received</TableHead>
                                    <TableHead>Comment</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {checklistItems.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium text-sm">{item.label}</TableCell>
                                        <TableCell className="text-center">
                                            <FormField
                                                control={form.control}
                                                name={`${item.id}Received` as keyof NewHireChecklistFormData}
                                                render={({ field }) => (
                                                    <FormItem className="flex justify-center">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={!!field.value}
                                                                onCheckedChange={field.onChange}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`${item.id}Comment` as keyof NewHireChecklistFormData}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Input 
                                                                {...field} 
                                                                value={(field.value as string) || ""} 
                                                                placeholder="Add notes..." 
                                                                className="h-8 text-xs"
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-4 border-t pt-6">
                        <Button type="button" variant="outline" onClick={() => router.back()}>
                            <X className="mr-2 h-4 w-4" /> Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Checklist
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}

export default function NewHireChecklistPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-12 w-12 animate-spin text-accent" /></div>}>
            <NewHireChecklistContent />
        </Suspense>
    );
}
