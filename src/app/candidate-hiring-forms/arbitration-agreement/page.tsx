
"use client";

import { useRef, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import SignatureCanvas from 'react-signature-canvas';
import { doc } from "firebase/firestore";
import { format } from "date-fns";

import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RefreshCw, Save, X, Loader2, CalendarIcon } from "lucide-react";
import { useUser, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { arbitrationAgreementSchema, type ArbitrationAgreementFormData, type CaregiverProfile } from "@/lib/types";
import { saveArbitrationAgreementData } from "@/lib/candidate-hiring-forms.actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const defaultFormValues: ArbitrationAgreementFormData = {
  arbitrationAgreementSignature: '',
  arbitrationAgreementSignatureDate: undefined,
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

export default function ArbitrationAgreementPage() {
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
    
    const form = useForm<ArbitrationAgreementFormData>({
      resolver: zodResolver(arbitrationAgreementSchema),
      defaultValues: defaultFormValues,
    });

    useEffect(() => {
        if (isPrintMode && !isDataLoading) {
          setTimeout(() => window.print(), 1000);
        }
    }, [isPrintMode, isDataLoading]);

    useEffect(() => {
        if (existingData) {
            const formData:Partial<ArbitrationAgreementFormData> = {};
            const formSchemaKeys = Object.keys(arbitrationAgreementSchema.shape) as Array<keyof ArbitrationAgreementFormData>;
            
            formSchemaKeys.forEach(key => {
                if (Object.prototype.hasOwnProperty.call(existingData, key)) {
                    const value = (existingData as any)[key];
                    if (key === 'arbitrationAgreementSignatureDate' && value) {
                        (formData as any)[key] = safeToDate(value);
                    } else {
                        (formData as any)[key] = value;
                    }
                }
            });

            form.reset(formData);

             if (formData.arbitrationAgreementSignature && sigPadRef.current) {
                sigPadRef.current.fromDataURL(formData.arbitrationAgreementSignature);
            }
        }
    }, [existingData, form]);

    const clearSignature = () => {
        sigPadRef.current?.clear();
        form.setValue('arbitrationAgreementSignature', '');
    };

    const onSubmit = (data: ArbitrationAgreementFormData) => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveArbitrationAgreementData(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Mutual Arbitration Agreement has been saved."});
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
            <CardHeader>
                <CardTitle className="text-center text-2xl tracking-wide">
                    MUTUAL ARBITRATION AGREEMENT
                </CardTitle>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-8">
                <div className="border-2 border-black p-4 space-y-4">
                  <p className="text-sm">
                    This Mutual Arbitration Agreement is a contract and covers important issues relating to your rights. It is your sole responsibility to read it and understand it. You are free to seek assistance from independent advisors of your choice outside the Company or to refrain from doing so if that is your choice.
                  </p>
                  <p className="text-sm">
                    El Acuerdo Mutuo de Arbitraje es un contrato y cubre aspectos importantes de sus derechos. Es tu absoluta responsabilidad leerlo y entenderlo. Tienes la libertad de buscar asistencia de asesores independientes de su elección fuera de la Compañia o de abstenerte de buscar asistencia si esa es su elección.
                  </p>
                </div>
                 <div className="space-y-4 text-sm text-muted-foreground">
                    <p>
                        <strong>1.</strong> This Mutual Arbitration Agreement (“Agreement”) is between Employee and [FIRSTLIGHT HOME CARE OF RANCHO CUCAMONGA] (“COMPANY”). The Federal Arbitration Act (9 U.S.C. §§ 1 et seq.) governs this Agreement, which evidences a transaction involving commerce. EXCEPT AS THIS AGREEMENT OTHERWISE PROVIDES, ALL DISPUTES COVERED BY THIS AGREEMENT WILL BE DECIDED BY AN ARBITRATOR THROUGH FINAL AND BINDING ARBITRATION AND NOT BY WAY OF COURT OR JURY TRIAL.
                    </p>
                    <p>
                        <strong>2. COVERED CLAIMS/DISPUTES.</strong> Except as otherwise provided in this Agreement, this Agreement applies to any and all disputes, past, present or future, that may arise between Employee (sometimes “you” or “your”) and COMPANY, including without limitation any dispute arising out of or related to Employee’s application, employment and/or separation of employment with COMPANY. This Agreement applies to a covered dispute that COMPANY may have against Employee or that Employee may have against COMPANY, its parent companies, subsidiaries, related companies and affiliates, franchisors, or their officers, directors, principals, shareholders, members, owners, employees, and managers or agents, each and all of which may enforce this Agreement as direct or third-party beneficiaries.
                    </p>
                    <p>
                        The claims subject to arbitration are those that absent this Agreement could be brought under applicable law. Except as it otherwise provides, this Agreement applies, without limitation, to claims based upon or related to the application for employment, background checks, privacy, the employment relationship, discrimination, harassment, retaliation, defamation (including claims of post-employment defamation or retaliation), breach of a contract or covenant, fraud, negligence, emotional distress, breach of fiduciary duty, trade secrets, unfair competition, wages, minimum wage and overtime or other compensation claimed to be owed, breaks and rest periods, expense reimbursement, seating, termination, tort claims, equitable claims, and all statutory and common law claims unless specifically excluded below. Except as it otherwise provides, the Agreement covers, without limitation, claims arising under the Fair Credit Reporting Act, Defend Trade Secrets Act, Title VII of the Civil Rights Act of 1964, 42 U.S.C. § 1981, the Americans With Disabilities Act, the Age Discrimination in Employment Act, the Family Medical Leave Act, the Fair Labor Standards Act, Rehabilitation Act, the Civil Rights Acts of 1866 and 1871, the Civil Rights Act of 1991, 8 U.S.C. § 1324 (unfair immigration related practices), the Pregnancy Discrimination Act, the Equal Pay Act, the Genetic Information Non-Discrimination Act, Employee Retirement Income Security Act of 1974 (except for claims for employee benefits under any benefit plan sponsored by the COMPANY and (a) covered by the Employee Retirement Income Security Act of 1974 or (b) funded by insurance), Affordable Care Act, Uniformed Services Employment and Reemployment Rights Act, Worker Adjustment and Retraining Notification Act, Older Workers Benefit Protection Act of 1990, False Claims Act, Occupational Safety and Health Act, Consolidated Omnibus Reconciliation Act of 1985, and state statutes or regulations, if any, addressing the same or similar subject matters, and all other federal or state legal claims arising out of or relating to Employee’s employment or the termination of employment.
                    </p>
                    <p>
                        Additionally, except as provided in this Section 3 of this Agreement, Employee and the COMPANY agree that the arbitrator shall have exclusive authority to resolve any dispute relating to the scope, validity, conscionability, interpretation, applicability, or enforceability of this Agreement.
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
