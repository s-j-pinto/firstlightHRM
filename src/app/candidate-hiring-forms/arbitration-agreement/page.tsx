
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
  applicantPrintedName: '',
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
                        <strong>2. COVERED CLAIMS/DISPUTES.</strong> Except as otherwise provided in this Agreement, this Agreement applies to any and all disputes, past, present or future, that may arise between Employee (sometimes “you” or “your”) and COMPANY, including without limitation any dispute arising out of or related to Employee’s application, employment and/or separation of employment with COMPANY. This Agreement applies to a covered dispute that COMPANY may have against Employee or that Employee may have against COMPANY, its parent companies, subsidiaries, related companies and affiliates, franchisors, or their
                        officers, directors, principals, shareholders, members, owners, employees, and managers or agents, each and all of which
                        may enforce this Agreement as direct or third-party beneficiaries.
                    </p>
                    <p>
                        The claims subject to arbitration are those that absent this Agreement could be brought under applicable law. Except
                        as it otherwise provides, this Agreement applies, without limitation, to claims based upon or related to the
                        application for employment, background checks, privacy, the employment relationship, discrimination,
                        harassment, retaliation, defamation (including claims of post-employment defamation or retaliation), breach
                        of a contract or covenant, fraud, negligence, emotional distress, breach of fiduciary duty, trade secrets,
                        unfair competition, wages, minimum wage and overtime or other compensation claimed to be owed, breaks
                        and rest periods, expense reimbursement, seating, termination, tort claims, equitable claims, and all
                        statutory and common law claims unless specifically excluded below. Except as it otherwise provides, the
                        Agreement covers, without limitation, claims arising under the Fair Credit Reporting Act, Defend Trade
                        Secrets Act, Title VII of the Civil Rights Act of 1964, 42 U.S.C. § 1981, the Americans With Disabilities Act,
                        the Age Discrimination in Employment Act, the Family Medical Leave Act, the Fair Labor Standards Act,
                        Rehabilitation Act, the Civil Rights Acts of 1866 and 1871, the Civil Rights Act of 1991, 8 U.S.C. § 1324
                        (unfair immigration related practices), the Pregnancy Discrimination Act, the Equal Pay Act, the Genetic
                        Information Non-Discrimination Act, Employee Retirement Income Security Act of 1974 (except for claims
                        for employee benefits under any benefit plan sponsored by the COMPANY and (a) covered by the
                        Employee Retirement Income Security Act of 1974 or (b) funded by insurance), Affordable Care Act,
                        Uniformed Services Employment and Reemployment Rights Act, Worker Adjustment and Retraining
                        Notification Act, Older Workers Benefit Protection Act of 1990, False Claims Act, Occupational Safety and
                        Health Act, Consolidated Omnibus Reconciliation Act of 1985, and state statutes or regulations, if any,
                        addressing the same or similar subject matters, and all other federal or state legal claims arising out of or
                        relating to Employee’s employment or the termination of employment.
                    </p>
                    <p>
                        Additionally, except as provided in this Section 3 of this Agreement, Employee and the COMPANY agree that the arbitrator
                        shall have exclusive authority to resolve any dispute relating to the scope, validity, conscionability, interpretation, applicability,
                        or enforceability of this Agreement.
                    </p>
                     <p>
                        <strong>EXCLUDED CLAIMS/DISPUTES.</strong> This Agreement does not apply to litigation between you and COMPANY pending in a state or federal court or arbitration as of the date of your receipt of this Agreement and in which you are a party or a member or putative member of an alleged class (“pending litigation”). If that pending litigation is subject to an agreement to arbitrate between Employee and the Company, that agreement will remain in full force and effect to that extent. The Agreement also does not apply to claims for worker’s compensation benefits, state disability insurance or unemployment insurance benefits; however, this Agreement applies to retaliation claims related to such benefits, such as claims for worker’s compensation retaliation.
                    </p>
                    <p>
                        Nothing contained in this Agreement shall be construed to prevent or excuse you (individually or in concert with others) or the COMPANY from utilizing the COMPANY's existing internal procedures for resolution of complaints, and this Agreement is not intended to be a substitute for the utilization of such procedures. In addition, either party may apply to a court of competent jurisdiction for temporary or preliminary injunctive relief in connection with an arbitrable controversy in accordance with applicable law, and any such application shall not be deemed incompatible with or waiver of this agreement to arbitrate. The court to which the application is made is authorized to consider the merits of the arbitrable controversy to the extent it deems necessary in making its ruling, but only to the extent permitted by applicable law. All determinations of final relief, however, will be decided in arbitration.
                    </p>
                    <p>
                        Nothing in this Agreement prevents you from making a report to or filing a claim or charge with a government agency, including without limitation the Equal Employment Opportunity Commission, U.S. Department of Labor, U.S. Securities and Exchange Commission, National Labor Relations Board, Occupational Health and Safety Administration or the Office of Federal Contract Compliance Programs. Nothing in this Agreement prevents the investigation by a government agency of any report, claim or charge otherwise covered by this Agreement. This Agreement also does not prevent federal administrative agencies from adjudicating claims and awarding remedies based on those claims, even if the claims would otherwise be covered by this Agreement. Nothing in this Agreement prevents or excuses a party from satisfying any conditions precedent and/or exhausting administrative remedies under applicable law before bringing a claim in arbitration. The COMPANY will not retaliate against you for filing a claim with an administrative agency or for exercising rights (individually or in concert with others) under Section 7 of the National Labor Relations Act.
                    </p>
                    <p>
                        This Agreement does not apply to any claim that an applicable federal statute states cannot be arbitrated or subject to a pre-dispute arbitration agreement.
                    </p>
                    <p>
                        <strong>3. CLASS AND COLLECTIVE ACTION WAIVER.</strong> Private attorney general representative actions brought on behalf of the state under the California Labor Code are not arbitrable, not within the scope of this Agreement and may be maintained in a court of law.. However, this Agreement affects your ability to otherwise participate in class and collective actions. Both you and COMPANY agree to bring any dispute in arbitration on an individual basis only, and not on a class or collective action basis on behalf of others. There will be no right or authority for any dispute to be brought, heard or arbitrated as a class or collective action and the arbitrator will have no authority to hear or preside over any such claim ("Class Action Waiver"). Regardless of anything else in this Agreement and/or the American Arbitration Association (“AAA") Rules (described below), any dispute relating to the scope,, validity, conscionability, interpretation, applicability, or enforceability of the Class Action Waiver, or any dispute relating to whether this Arbitration Agreement precludes a class or collective action proceeding, may only be determined by a court and not an arbitrator. In any case in which (1) the dispute is filed as a class or collective action and (2) there is a final judicial determination that all or part of the Class Action Waiver is unenforceable, the class or collective action to that extent must be litigated in a civil court of competent jurisdiction, but the portion of the Class Action Waiver that is enforceable shall be enforced in arbitration. You will not be retaliated against, disciplined or threatened with discipline by the filing of or participation in a class or collective action in any forum. However, COMPANY may lawfully seek enforcement of this Agreement and the Class Action Waiver under the Federal Arbitration Act and seek dismissal of such class or collective actions or claims. The Class Action Waiver shall be severable in any case in which the dispute is filed as an individual action and severance is necessary to ensure that the individual action proceeds in arbitration.
                    </p>
                    <p>
                        <strong>4. ARBITRATOR SELECTION.</strong> If the claim is not resolved via informal resolution, the parties will proceed to arbitration before a single arbitrator and in accordance with the then current American Arbitration Association (“AAA”) Employment Arbitration Rules (“AAA Rules”) (the AAA Rules may be found at www.adr.org or by searching for “AAA Employment Arbitration Rules” using a service such as www.Google.com), provided, however, that if there is a conflict between the AAA Rules and this Agreement, this Agreement will govern. Unless the parties mutually agree otherwise, the Arbitrator will be either an attorney experienced in employment law or a retired judge. The AAA will give each party a list of eleven (11) arbitrators drawn from its panel of arbitrators. Ten days after AAA’s transmission of the list of neutrals, AAA will convene a telephone conference and the parties will strike names alternately from the list of common names, until only one remains. The party who strikes first will be determined by a coin toss. The person that remains will be designated as the Arbitrator. If for any reason, the individual selected cannot serve as the Arbitrator, AAA will issue another list of eleven (11) arbitrators and repeat the alternate striking selection process. If for any reason the AAA will not administer the arbitration, either party may apply to a court of competent jurisdiction with authority over the location where the arbitration will be conducted to appoint a neutral Arbitrator.
                    </p>
                    <p>
                        <strong>5. INITIATING ARBITRATION.</strong> A party who wishes to arbitrate a claim covered by this Agreement must make a written Request for Arbitration and deliver it to the other party by hand or mail no later than the expiration of the statute of limitations (deadline for filing) that applicable law prescribes for the claim. The Request for Arbitration shall identify the claims asserted, the factual basis for the claim(s), and the relief and/or remedy sought. The Arbitrator will resolve all disputes regarding the timeliness or propriety of the Request for Arbitration and apply the statute of limitations that would have applied if the claim(s) had been brought in court.
                    </p>
                    <p>
                        <strong>6. RULES/STANDARDS GOVERNING PROCEEDING.</strong> The Arbitrator may award any remedy to which a party is entitled under applicable law, but remedies are limited to those that would be available to a party in his or her individual capacity in a court of law for the claims presented to and decided by the Arbitrator, and no remedies that otherwise would be available to an individual under applicable law will be forfeited by this Agreement. Each party can take the deposition of one individual witness and any expert witness designated by another party. Each party also has the right to make requests for production of documents to any party. The parties can jointly agree to more discovery, and either party can ask the Arbitrator to order more discovery. Each party will also have the right to subpoena witnesses and documents for the arbitration, including documents relevant to the case from third parties. At least thirty (30) days before the final hearing, the parties must exchange a list of witnesses, excerpts of depositions to be introduced, and copies of all exhibits to be used.
                    </p>
                    <p>
                        Unless the parties jointly agree in writing otherwise, the arbitration will take place in or near the city and in the same state in which Employee is or was last employed by the COMPANY. The Arbitrator has the authority to hear and rule on pre-hearing disputes. The Arbitrator will have the authority to hear and decide a motion to dismiss and/or a motion for summary judgment by any party, consistent with Rule 12 or Rule 56 of the Federal Rules of Civil Procedure, and must set a briefing schedule for such motions upon the request of either party. The Arbitrator will issue a written decision or award, stating the essential findings of fact and conclusions of law. A court of competent jurisdiction will have the authority to enter judgment upon the Arbitrator’s decision/award.
                    </p>
                    <p>
                        <strong>7. PAYMENT OF FEES.</strong> The COMPANY will pay the Arbitrator’s and arbitration fees and costs, except for the filing fee as required by the AAA. If you are financially unable to pay a filing fee, the COMPANY will pay the filing fee, and you will be relieved of the obligation to pay the filing fee. Disputes regarding the apportionment of fees will be decided by the Arbitrator. Each party will pay for its own costs and attorneys' fees, if any, but if any party prevails on a claim which affords the prevailing party costs or attorneys' fees, the Arbitrator may award costs and fees to the prevailing party as provided by law.
                    </p>
                    <p>
                        <strong>8. ENTIRE AGREEMENT/SEVERABILITY.</strong> Except as provided in Section 2, above, regarding pending litigation, this Agreement replaces all prior agreements regarding the arbitration of disputes and is the full and complete agreement relating to the resolution of disputes covered by this Agreement. If any portion of this Agreement is deemed invalid, void, voidable or otherwise unenforceable, the unenforceable provision will be severed from the Agreement and the remainder of the Agreement will be enforceable. This Agreement will survive the termination of Employee’s employment and the expiration of any benefit. This Agreement will also continue to apply notwithstanding any change in Employee’s duties, responsibilities, position, or title, or if Employee transfers to any affiliate of the COMPANY. This Agreement does not alter the "at-will" status of Employee’s employment. Notwithstanding any contrary language in any COMPANY policy or employee handbook, this Agreement may not be modified or terminated absent consent by both parties.
                    </p>
                    <p>
                        <strong>9. CONSIDERATION.</strong> The COMPANY and Employee agree that the mutual obligations by the COMPANY and Employee to arbitrate disputes provide adequate consideration for this Agreement.
                    </p>
                    <p>
                        <strong>10. EFFECTIVE DATE.</strong> continuing your employment with the COMPANY for a period of 30 days after your receipt of this Agreement constitutes mutual acceptance of the terms of this Agreement commencing upon completion of that 30-day period, and the Agreement will be binding on you and the Company. You have the right to consult with counsel of your choice concerning this Agreement.
                    </p>
                </div>
                <div className="space-y-6 pt-6">
                    <p className="font-bold">AGREED: [FIRSTLIGHT HOME CARE OF RANCHO CUCAMONGA]</p>
                    <p className="font-bold">RECEIVED AND AGREED:</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        <div className="space-y-2 md:col-span-2">
                            <Label>APPLICANT/EMPLOYEE SIGNATURE</Label>
                            <div className="relative w-full h-24 rounded-md border bg-muted/50">
                                <SignatureCanvas
                                    ref={sigPadRef}
                                    penColor='black'
                                    canvasProps={{ className: 'w-full h-full rounded-md' }}
                                    onEnd={() => {
                                        if (sigPadRef.current) {
                                            form.setValue('arbitrationAgreementSignature', sigPadRef.current.toDataURL())
                                        }
                                    }}
                                />
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="mt-2">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Clear Signature
                            </Button>
                        </div>
                        <FormField control={form.control} name="arbitrationAgreementSignatureDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>DATE</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                    </div>
                    <FormField control={form.control} name="applicantPrintedName" render={({ field }) => (
                        <FormItem><FormLabel>APPLICANT/EMPLOYEE NAME PRINTED</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
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
