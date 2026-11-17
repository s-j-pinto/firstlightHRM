"use client";

import { useRef, useEffect, useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import SignatureCanvas from 'react-signature-canvas';
import { doc } from "firebase/firestore";
import Image from "next/image";
import { format } from "date-fns";

import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RefreshCw, Save, X, Loader2, Edit2, Building2 } from "lucide-react";
import { useUser, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { directDepositFormSchema, type DirectDepositFormData, type CaregiverProfile, type OnboardingSignatures } from "@/lib/types";
import { saveDirectDepositFormData } from "@/lib/candidate-hiring-forms.actions";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

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

const SignaturePadModal = ({
    isOpen,
    onClose,
    onSave,
    signatureData,
    title
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
    signatureData: string | undefined | null;
    title: string;
}) => {
    const sigPadRef = useRef<SignatureCanvas>(null);

    useEffect(() => {
        if (isOpen && sigPadRef.current) {
            sigPadRef.current.clear();
            if (signatureData) {
                sigPadRef.current.fromDataURL(signatureData);
            }
        }
    }, [isOpen, signatureData]);
    
    const handleClear = () => sigPadRef.current?.clear();
    
    const handleDone = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            onSave(sigPadRef.current.toDataURL());
        } else {
             onSave(""); 
        }
        onClose();
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] h-[400px] flex flex-col p-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="flex-grow p-2">
                    <SignatureCanvas
                        ref={sigPadRef}
                        penColor='black'
                        canvasProps={{ className: 'w-full h-full bg-muted/50 rounded-md' }}
                    />
                </div>
                <div className="flex justify-between p-4 border-t">
                    <Button type="button" variant="ghost" onClick={handleClear}>
                        <RefreshCw className="mr-2"/>
                        Clear
                    </Button>
                    <Button type="button" onClick={handleDone}>Done</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default function DirectDepositFormPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();
    const [activeSignature, setActiveSignature] = useState<{ fieldName: keyof DirectDepositFormData; title: string; } | null>(null);
    const firestore = useFirestore();

    const isPrintMode = searchParams.get('print') === 'true';
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "lpinto@firstlighthomecare.com";
    const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";
    const isAnAdmin = user?.email === adminEmail || user?.email === ownerEmail || user?.email === staffingAdminEmail;
    const candidateId = searchParams.get('candidateId');
    const profileIdToLoad = isAnAdmin && candidateId ? candidateId : user?.uid;

    const caregiverProfileRef = useMemoFirebase(
      () => (profileIdToLoad ? doc(firestore, 'caregiver_profiles', profileIdToLoad) : null),
      [profileIdToLoad, firestore]
    );
    const { data: existingData, isLoading: isDataLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);

    const signaturesRef = useMemoFirebase(
        () => (profileIdToLoad ? doc(firestore, `caregiver_profiles/${profileIdToLoad}/signatures`, 'direct_deposit') : null),
        [profileIdToLoad, firestore]
    );
    const { data: signaturesData, isLoading: isSignaturesLoading } = useDoc<OnboardingSignatures>(signaturesRef);
    
    const form = useForm<DirectDepositFormData>({
      resolver: zodResolver(directDepositFormSchema),
      defaultValues: {
        bankName1: '',
        accountType1: 'Checking',
        routingNumber1: '',
        accountNumber1: '',
        depositAmount1: '',
        accountType2: undefined,
        routingNumber2: '',
        accountNumber2: '',
        directDepositAuthorizedSignature: '',
        directDepositEmployeeId: '',
        directDepositPrintName: '',
        directDepositDate: '',
      },
    });

    const SignatureField = ({ fieldName, title }: { fieldName: keyof DirectDepositFormData; title: string; }) => {
        const signatureData = form.watch(fieldName) as string;
        const disabled = isPrintMode;
        const hasValidSignature = typeof signatureData === 'string' && signatureData.trim().length > 0 && (
            signatureData.startsWith('data:image/') ||
            signatureData.startsWith('http://') ||
            signatureData.startsWith('https://') ||
            signatureData.startsWith('/')
        );
        
        return (
            <div className="space-y-2">
                <FormLabel>{title}</FormLabel>
                <div className="relative rounded-md border bg-muted/30 h-28 flex items-center justify-center overflow-hidden">
                    {hasValidSignature ? (
                        <Image src={signatureData} alt="Signature" fill className="object-contain" />
                    ) : (
                        <span className="text-muted-foreground">Not Signed</span>
                    )}
                     {!disabled && (
                         <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-7 w-7 bg-background/80 hover:bg-background"
                            onClick={() => setActiveSignature({ fieldName, title })}
                        >
                            <Edit2 className="h-4 w-4" />
                        </Button>
                     )}
                </div>
                <FormMessage>{form.formState.errors[fieldName]?.message}</FormMessage>
            </div>
        );
    };

    useEffect(() => {
        if (isPrintMode && !isDataLoading) {
          setTimeout(() => window.print(), 1000);
        }
    }, [isPrintMode, isDataLoading]);

    useEffect(() => {
        if (existingData) {
            const combinedData = { ...existingData, ...signaturesData };
            const formData: DirectDepositFormData = {
                bankName1: '',
                accountType1: 'Checking',
                routingNumber1: '',
                accountNumber1: '',
                depositAmount1: '',
                accountType2: undefined,
                routingNumber2: '',
                accountNumber2: '',
                directDepositAuthorizedSignature: '',
                directDepositEmployeeId: '',
                directDepositPrintName: '',
                directDepositDate: '',
            };
            const formSchemaKeys = Object.keys(directDepositFormSchema.shape) as Array<keyof DirectDepositFormData>;
            
            formSchemaKeys.forEach(key => {
                if (combinedData[key] !== undefined && combinedData[key] !== null) {
                    const value = (combinedData as any)[key];
                    if (key.toLowerCase().includes('date') && value) {
                        const date = safeToDate(value);
                        (formData as any)[key] = date ? format(date, 'MM/dd/yyyy') : '';
                    } else if (key.toLowerCase().includes('signature')) {
                        (formData as any)[key] = (typeof value === 'string' && value.trim()) ? value : '';
                    } else {
                        (formData as any)[key] = value || '';
                    }
                }
            });

            // Populate Employee ID from PER ID (if form is new or field is empty)
            if (!formData.directDepositEmployeeId && existingData.perId) {
                formData.directDepositEmployeeId = existingData.perId;
            }
            if (!formData.directDepositPrintName && existingData.fullName) {
                formData.directDepositPrintName = existingData.fullName;
            }
            if (!formData.directDepositDate) {
                formData.directDepositDate = format(new Date(), "MM/dd/yyyy");
            }

            form.reset(formData);
        }
    }, [existingData, signaturesData, form]);

    const handleSaveSignature = (dataUrl: string) => {
        if (activeSignature) {
            form.setValue(activeSignature.fieldName, dataUrl, { shouldValidate: true, shouldDirty: true });
        }
    };

    const onSubmit = (data: DirectDepositFormData) => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveDirectDepositFormData(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Direct Deposit Form has been saved."});
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

    const isLoading = isUserLoading || isDataLoading || isSignaturesLoading;

    if(isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </div>
      )
    }

    return (
        <Card className={cn("max-w-4xl mx-auto", isPrintMode && "border-none shadow-none")}>
            <CardHeader className="border-b pb-6">
                <div className="flex justify-between items-center mb-4">
                    <CardTitle className="text-3xl font-light text-slate-500">Intuit QuickBooks Payroll</CardTitle>
                    <div className="text-4xl font-bold text-blue-600 font-code">intuit</div>
                </div>
                <Separator className="mb-4" />
                <CardTitle className="text-xl">Employee Direct Deposit Authorization</CardTitle>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-8 pt-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b pb-1">
                        <Label className="font-bold">Instructions</Label>
                        <div className="flex-grow h-px bg-slate-200" />
                    </div>
                    <div className="text-sm space-y-1">
                        <p><strong>Employee:</strong> Fill out and return to your employer.</p>
                        <p><strong>Employer:</strong> Save for your files only.</p>
                        <p className="text-muted-foreground mt-2">
                            This document must be signed by employees requesting automatic deposit of paychecks and retained on file by the employer. 
                            Do <strong>not</strong> send this form to Intuit. Employees must attach a voided check for each of their accounts to help 
                            verify their account numbers and bank routing numbers.
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">Account 1</Badge>
                        <Label className="font-bold uppercase">Bank Name:</Label>
                        <FormField control={form.control} name="bankName1" render={({ field }) => (
                            <FormItem className="flex-grow"><FormControl><Input {...field} className="border-x-0 border-t-0 rounded-none border-b-2 h-8" /></FormControl></FormItem>
                        )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField control={form.control} name="accountType1" render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel>Account 1 type:</FormLabel>
                                <FormControl>
                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="Checking" /></FormControl>
                                            <FormLabel className="font-normal">Checking</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="Savings" /></FormControl>
                                            <FormLabel className="font-normal">Savings</FormLabel>
                                        </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="routingNumber1" render={({ field }) => (
                            <FormItem><FormLabel>Bank routing number (ABA number):</FormLabel><FormControl><Input {...field} className="border-x-0 border-t-0 rounded-none border-b-2 h-8" /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField control={form.control} name="accountNumber1" render={({ field }) => (
                            <FormItem><FormLabel>Account number:</FormLabel><FormControl><Input {...field} className="border-x-0 border-t-0 rounded-none border-b-2 h-8" /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="depositAmount1" render={({ field }) => (
                            <FormItem><FormLabel>Percentage or dollar amount for this account:</FormLabel><FormControl><Input {...field} className="border-x-0 border-t-0 rounded-none border-b-2 h-8" /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">Account 2</Badge>
                        <Label className="text-muted-foreground text-xs italic">(remainder to be deposited to this account)</Label>
                        <div className="flex-grow h-px bg-slate-200" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <FormField control={form.control} name="accountType2" render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel>Account 2 type:</FormLabel>
                                <FormControl>
                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="Checking" /></FormControl>
                                            <FormLabel className="font-normal">Checking</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="Savings" /></FormControl>
                                            <FormLabel className="font-normal">Savings</FormLabel>
                                        </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="routingNumber2" render={({ field }) => (
                            <FormItem><FormLabel>Bank routing number (ABA number):</FormLabel><FormControl><Input {...field} className="border-x-0 border-t-0 rounded-none border-b-2 h-8" /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                     <FormField control={form.control} name="accountNumber2" render={({ field }) => (
                            <FormItem className="max-w-md"><FormLabel>Account number:</FormLabel><FormControl><Input {...field} className="border-x-0 border-t-0 rounded-none border-b-2 h-8" /></FormControl><FormMessage /></FormItem>
                        )} />
                </div>

                <div className="border-2 border-dashed rounded-lg p-12 text-center bg-slate-50 flex flex-col items-center justify-center">
                    <Building2 className="h-12 w-12 text-slate-300 mb-4" />
                    <p className="text-slate-400 italic font-serif">attach a voided check for each account here</p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Label className="font-bold">Authorization</Label>
                        <Label className="text-xs text-muted-foreground">(enter your company name in the blank space below)</Label>
                        <div className="flex-grow h-px bg-slate-200" />
                    </div>
                    <p className="text-sm leading-relaxed">
                        This authorizes <strong className="underline">FirstLight Home Care of Rancho Cucamonga</strong> (the "Company") to send credit entries (and appropriate debit and adjustment entries), electronically or by any other commercially accepted method, to my (our) account(s) indicated below and to other accounts I (we) identify in the future (the "Account"). This authorizes the financial institution holding the Account to post all such entries. I agree that the ACH transactions authorized herein shall comply with all applicable U.S. Law. This authorization will be in effect until the Company receives a written termination notice from myself and has a reasonable opportunity to act on it.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    <SignatureField fieldName="directDepositAuthorizedSignature" title="Authorized signature:" />
                    <FormField control={form.control} name="directDepositEmployeeId" render={({ field }) => (
                        <FormItem><FormLabel>Employee ID #:</FormLabel><FormControl><Input {...field} className="border-x-0 border-t-0 rounded-none border-b-2 h-8 bg-muted/20" readOnly={!isAnAdmin} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField control={form.control} name="directDepositPrintName" render={({ field }) => (
                        <FormItem><FormLabel>Print name:</FormLabel><FormControl><Input {...field} className="border-x-0 border-t-0 rounded-none border-b-2 h-8" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="directDepositDate" render={() => (
                        <FormItem>
                            <FormLabel>Date (MM/DD/YYYY):</FormLabel>
                            <FormControl>
                                <DateInput name="directDepositDate" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>

            </CardContent>
            {activeSignature && (
                <SignaturePadModal
                    isOpen={!!activeSignature}
                    onClose={() => setActiveSignature(null)}
                    onSave={handleSaveSignature}
                    signatureData={form.getValues(activeSignature.fieldName)}
                    title={activeSignature.title}
                />
            )}
            <CardFooter className="flex-col items-center gap-4 border-t pt-6 mt-6">
                 <div className={cn("flex w-full justify-end gap-4", isPrintMode && "no-print")}>
                    <Button type="button" variant="outline" onClick={handleCancel}>
                    <X className="mr-2" />
                    Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                    Save Form
                    </Button>
                </div>
                 <div className="flex justify-between w-full text-[10px] text-muted-foreground mt-8">
                    <p>Employee Direct Deposit Authorization Form</p>
                    <p>Ver. Authorization_for_Direct_Deposit-081912</p>
                </div>
            </CardFooter>
            </form>
            </Form>
        </Card>
    );
}
