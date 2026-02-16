
"use client";

import { useRef, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import SignatureCanvas from 'react-signature-canvas';
import { doc } from "firebase/firestore";
import { format } from "date-fns";
import Image from "next/image";

import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RefreshCw, Save, X, Loader2, CalendarIcon } from "lucide-react";
import { useUser, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { drugAlcoholPolicySchema, type DrugAlcoholPolicyFormData, type CaregiverProfile } from "@/lib/types";
import { saveDrugAlcoholPolicyData } from "@/lib/candidate-hiring-forms.actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";


const defaultFormValues: DrugAlcoholPolicyFormData = {
  drugAlcoholPolicySignature: '',
  drugAlcoholPolicySignatureDate: undefined,
};

const safeToDate = (value: any): Date | undefined => {
    if (!value) return undefined;
    if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate();
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
        return d;
    }
    return undefined;
};

export default function DrugAlcoholPolicyPage() {
    const sigPadRef = useRef<SignatureCanvas>(null);
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
    
    const form = useForm<DrugAlcoholPolicyFormData>({
      resolver: zodResolver(drugAlcoholPolicySchema),
      defaultValues: defaultFormValues,
    });

    useEffect(() => {
        if (isPrintMode && !isDataLoading) {
          setTimeout(() => window.print(), 1000);
        }
    }, [isPrintMode, isDataLoading]);

    useEffect(() => {
        if (existingData) {
            const formData:Partial<DrugAlcoholPolicyFormData> = {};
            const formSchemaKeys = Object.keys(drugAlcoholPolicySchema.shape) as Array<keyof DrugAlcoholPolicyFormData>;
            
            formSchemaKeys.forEach(key => {
                if (Object.prototype.hasOwnProperty.call(existingData, key)) {
                    const value = (existingData as any)[key];
                    if (key === 'drugAlcoholPolicySignatureDate' && value) {
                        (formData as any)[key] = safeToDate(value);
                    } else {
                        (formData as any)[key] = value;
                    }
                }
            });

            form.reset(formData);

             if (formData.drugAlcoholPolicySignature && sigPadRef.current) {
                sigPadRef.current.fromDataURL(formData.drugAlcoholPolicySignature);
            }
        }
    }, [existingData, form]);

    const clearSignature = () => {
        sigPadRef.current?.clear();
        form.setValue('drugAlcoholPolicySignature', '');
    };

    const onSubmit = (data: DrugAlcoholPolicyFormData) => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveDrugAlcoholPolicyData(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Drug and/or Alcohol Testing Consent Form has been saved."});
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
            <CardHeader className="text-center">
                 <Image src={logoUrl} alt="FirstLight Home Care Logo" width={250} height={50} className="object-contain mx-auto mb-4" />
                <CardTitle className="text-xl tracking-wide">
                    DRUG AND/OR ALCOHOL TESTING CONSENT FORM
                </CardTitle>
                <CardDescription className="font-bold pt-4 text-lg text-foreground">
                    EMPLOYEE AGREEMENT AND CONSENT TO DRUG AND/OR ALCOHOL TESTING
                </CardDescription>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-8">
                <div className="space-y-4 text-sm text-muted-foreground">
                    <p>
                        I hereby agree, upon a request made under the drug/alcohol testing policy of FirstLight HomeCare to submit to a drug or alcohol test and to furnish a sample of my saliva, urine, breath, and/or blood for analysis. I understand and agree that if I, at any time, refuse to submit to a drug or alcohol test under company policy, or if I otherwise fail to cooperate with the testing procedures, I will be subject to immediate termination. I further authorize and give full permission to have FirstLight HomeCare and/or a physician designated by FirstLight HomeCare send the specimen or specimens so collected to a laboratory for a screening test for the presence of any prohibited substances under the policy, and for the laboratory or other testing facility to release any and all documentation relating to such test to FirstLight HomeCare and/or to any governmental entity involved in a legal proceeding or investigation connected with the test. Finally, I authorize the FirstLight HomeCare to disclose any documentation relating to such test to any governmental entity involved in a legal proceeding or investigation connected with the test.
                    </p>
                    <p>
                        I understand that only duly-authorized FirstLight HomeCare officers, employees, and agents will have access to information furnished or obtained in connection with the test; that they will maintain and protect the confidentiality of such information to the greatest extent possible; and that they will share such information only to the extent necessary to make employment decisions and to respond to inquiries or notices from government entities.
                    </p>
                    <p>
                        I will hold harmless FirstLight HomeCare, its designated physician, and any testing laborator
                    </p>
                </div>
            </CardContent>
            <CardFooter className={cn("flex justify-end gap-4", isPrintMode && "no-print")}>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="mr-2" />
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                  Save Form
                </Button>
            </CardFooter>
            </form>
            </Form>
        </Card>
    );
}

    