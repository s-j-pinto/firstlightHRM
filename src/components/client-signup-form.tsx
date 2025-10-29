

"use client";

import * as React from "react";
import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import SignatureCanvas from 'react-signature-canvas';
import { useDoc, useMemoFirebase, firestore } from "@/firebase";
import { doc } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Send, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type GeneratedForm, type FormBlock, type GeneratedField } from "@/lib/types";
import { saveFormAsTemplate } from "@/lib/form-generator.actions";

// Placeholder for the server action
async function saveAndSendForSignature(data: any): Promise<{ error?: string; message?: string }> {
  console.log("Saving form data and sending for signature:", data);
  // This is where the logic to save to 'client_signups' and email the link would go.
  // For the prototype, we just simulate a success.
  await new Promise(resolve => setTimeout(resolve, 1500));
  return { message: "Client intake form has been saved and an invitation to sign has been sent to the client." };
}

const DynamicFormRenderer = ({ formDefinition, onSave, isSaving }: { formDefinition: any, onSave: (data: any) => void, isSaving: boolean }) => {
  const [isSubmitting, startSubmitTransition] = useTransition();
  const { toast } = useToast();
  const sigPadRef = useRef<SignatureCanvas>(null);

  const formSchema = z.object({
      clientEmail: z.string().email("A valid client email is required to send the signature link."),
      todaysDate: z.string().optional(),
      referralDate: z.string().optional(),
      dateOfInitialContact: z.string().optional(),
      clientNameAgreement: z.string().optional(),
      signatureDate: z.string().optional(),
      relationshipIfNotClient: z.string().optional(),
      // Add other fields from your dynamic form here if needed for validation
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { clientEmail: '', todaysDate: '', referralDate: '', dateOfInitialContact: '', clientNameAgreement: '', signatureDate: '', relationshipIfNotClient: '' },
  });

  const onSubmit = (data: any) => {
    startSubmitTransition(async () => {
      const result = await saveAndSendForSignature(data);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: result.message });
        form.reset();
      }
    });
  };

  const renderField = (field: GeneratedField) => {
     if (field.label.toLowerCase().includes('signature')) {
        return (
            <FormItem key={field.fieldName}>
                <FormLabel>{field.label}</FormLabel>
                 <div className="relative w-full h-24 rounded-md border bg-slate-50">
                    <SignatureCanvas
                        penColor='black'
                        canvasProps={{className: 'w-full h-full'}}
                    />
                </div>
            </FormItem>
        )
    }

    const isInitials = field.label.toLowerCase().includes('client initials');

     return (
       <FormField
        key={field.fieldName}
        control={form.control}
        name={field.fieldName}
        render={({ field: formField }) => {
            let inputComponent;
            switch (field.fieldType) {
                case 'textarea':
                    inputComponent = <Textarea placeholder={`Enter ${field.label.toLowerCase()}`} {...formField} />;
                    break;
                case 'checkbox':
                    return (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-2">
                        <FormControl>
                            <Checkbox checked={formField.value} onCheckedChange={formField.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>{field.label}</FormLabel>
                        </div>
                        </FormItem>
                    );
                case 'radio':
                    inputComponent = (
                         <RadioGroup onValueChange={formField.onChange} defaultValue={formField.value} className="flex gap-4">
                            {field.options?.map(option => (
                                <FormItem key={option} className="flex items-center space-x-3 space-y-0">
                                    <FormControl><RadioGroupItem value={option} /></FormControl>
                                    <FormLabel className="font-normal">{option}</FormLabel>
                                </FormItem>
                            ))}
                        </RadioGroup>
                    );
                    break;
                case 'select':
                    inputComponent = (
                        <Select onValueChange={formField.onChange} defaultValue={formField.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder={`Select ${field.label.toLowerCase()}`} /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {field.options?.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                        </Select>
                    );
                    break;
                default:
                    inputComponent = <Input type={field.fieldType} placeholder={`Enter ${field.label.toLowerCase()}`} {...formField} className={isInitials ? 'w-24' : ''} />;
                    break;
            }

            return (
                <FormItem>
                    <FormLabel>{field.label}</FormLabel>
                    <FormControl>{inputComponent}</FormControl>
                    <FormMessage />
                </FormItem>
            );
        }}
      />
     )
  }

  const renderBlock = (block: FormBlock, index: number) => {
    // Check for the specific set of checkboxes to align horizontally
    const waiverCheckboxLabels = ["Notice of Privacy Practices", "Client Rights and Responsibilities", "Advance Directives", "Rate Sheet", "Transportation Waiver"];
    const isWaiverBlock = block.type === 'fields' && 
      block.rows?.some(row => 
        row.columns.some(col => 
          col.fields?.some(field => waiverCheckboxLabels.includes(field.label))
        )
      );

    if (block.type === 'heading' && block.content && block.content.trim().toUpperCase().includes('FIRSTLIGHT')) {
        return (
            <div key={index} className="break-before-page flex justify-center my-6">
            <Image
                src="https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc"
                alt="FirstLight Home Care Logo"
                width={250}
                height={40}
                priority
                className="object-contain"
            />
            </div>
        );
    }
    
    // Skip rendering the "HOME CARE" and "®" blocks
    if (block.content && (block.content.trim().toUpperCase() === "HOME CARE" || block.content.trim() === "®")) {
        return null;
    }
  
    if (isWaiverBlock) {
      const allFields = block.rows!.flatMap(row => row.columns.flatMap(col => col.fields || []));
      return (
        <div key={index} className="grid grid-cols-5 gap-4">
          {allFields.map(field => renderField(field))}
        </div>
      );
    }
      
    if (block.type === 'paragraph') {
      let content: React.ReactNode = block.content;
      
      const rateTextStart = "The rates are provided on a current rate card dated";
      const rateTextEnd = "and will be used to calculate the Client's";

      if (typeof content === 'string' && content.startsWith(rateTextStart) && content.includes(rateTextEnd)) {
          const parts = content.split(rateTextEnd);
          return (
              <p key={index} className="text-muted-foreground my-2 flex items-center flex-wrap">
                  {rateTextStart}
                  <Input type="date" className="inline-block w-40 h-8 mx-2 px-2" />
                  {rateTextEnd}
                  {parts.slice(1).join(rateTextEnd)}
              </p>
          );
      }
      
      const minHoursText = "FirstLight Home Care of Rancho Cucamonga for a minimum of ";
      if (typeof content === 'string' && content.includes(minHoursText)) {
         const parts = content.split(minHoursText);
         content = (
           <>
            {parts[0]}{minHoursText}
            <Input type="number" className="inline-block w-20 h-8 mx-1 px-2" />
            {parts[1]}
          </>
         )
      }
      
      const cancellationText = "If there is same day cancellation, client will be charged for full scheduled hours, except if there is a medical emergency.";
      if (typeof content === 'string' && content.includes(cancellationText)) {
        const parts = content.split(cancellationText);
        content = (
            <>
                {parts[0]}
                <span className="bg-yellow-200 p-1">{cancellationText}</span>
                {parts[1]}
            </>
        );
      }
      
      const servicePlanText = "Frequency and duration of Services to be identified on individualized Client Service Plan";
      if (typeof content === 'string' && content.includes(servicePlanText)) {
        const personalCareCheckboxes = [
            "Provide Alzheimer's care, cognitive impairment",
            "Provide medication reminders",
            "Assist with dressing, grooming",
            "Assist with bathing, hair care",
            "Assist with feeding, special diets",
            "Assist with mobility, ambulation and transfer",
            "Assist with incontinence care",
            "Assist with other:",
        ];
        return (
            <React.Fragment key={index}>
                <p className="text-muted-foreground my-2">{content}</p>
                
                <h2 className="text-xl font-bold text-center my-4 pt-6">Personal Care Services</h2>
                <div className="grid grid-cols-4 gap-4">
                    {personalCareCheckboxes.map((label, i) => {
                        const fieldName = `personalCare_${i}`;
                        return (
                            <FormField
                                key={fieldName}
                                control={form.control}
                                name={fieldName}
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormLabel className="font-normal">{label}</FormLabel>
                                    </FormItem>
                                )}
                            />
                        )
                    })}
                </div>
            </React.Fragment>
        )
      }

      if (typeof content === 'string' && content.includes('Companion Care')) {
        return (
          <React.Fragment key={index}>
             <h2 className="text-xl font-bold text-center my-4 pt-6">Companion Care</h2>
             <p className="text-muted-foreground my-2">{content.replace('Companion Care', '')}</p>
          </React.Fragment>
        )
      }
      
      return (
        <p key={index} className="text-muted-foreground my-2">
            {content}
        </p>
      );
    }
    
    switch (block.type) {
        case 'heading':
            const Tag = `h${block.level || 2}` as keyof JSX.IntrinsicElements;
            return <Tag key={index} className="font-bold text-xl my-4">{block.content}</Tag>;
        case 'paragraph':
            return <p key={index} className="text-muted-foreground my-2">{block.content}</p>;
        case 'html':
             return <div key={index} dangerouslySetInnerHTML={{ __html: block.content }} className="prose prose-sm text-muted-foreground my-2" />;
        case 'fields':
            return (
                <div key={index} className="space-y-6">
                    {block.rows?.map((row, rowIndex) => (
                        <div key={rowIndex} className={`grid gap-6`} style={{ gridTemplateColumns: `repeat(${row.columns.length}, minmax(0, 1fr))` }}>
                            {row.columns.map((column, colIndex) => (
                                <div key={colIndex} className="space-y-6">
                                    {column.fields?.map(field => renderField(field))}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            );
        default:
            return null;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 pt-4"><FileText /> {formDefinition?.formName || 'Client Intake Form'}</CardTitle>
        <CardDescription>
            This form is based on the saved template. Review and fill out the details below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
             <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Client Contact Email</FormLabel>
                        <FormControl><Input placeholder="client@email.com" {...field} /></FormControl>
                         <FormDescription>The signature link will be sent to this email.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />

            {formDefinition.blocks.map((block: FormBlock, index: number) => renderBlock(block, index))}
            
            <div className="pt-6">
                <p className="text-muted-foreground my-2">Firstlight Home Care of Rancho Cucamonga provides Personal Care Services as defined under Cal. Health & Safety Code § 1796.12 and does not provide medical services or function as a home health agency.</p>
                 <FormField
                    control={form.control}
                    name="companionCareClientInitials"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Client Initials</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter initials" {...field} className="w-24" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="border p-4 rounded-md space-y-4 mt-8">
                <h3 className="font-semibold text-lg text-center">For Office Use Only</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <FormField
                        control={form.control}
                        name="todaysDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>TODAY'S DATE</FormLabel>
                                <FormControl><Input type="date" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                     <FormField
                        control={form.control}
                        name="referralDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>REFERRAL DATE</FormLabel>
                                <FormControl><Input type="date" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                     <FormField
                        control={form.control}
                        name="dateOfInitialContact"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>DATE OF INITIAL CLIENT CONTACT</FormLabel>
                                <FormControl><Input type="date" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                </div>
            </div>
            
            <div className="pt-6 text-center">
                <div className="flex justify-center my-6">
                    <Image
                        src="https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc"
                        alt="FirstLight Home Care Logo"
                        width={250}
                        height={40}
                        priority
                        className="object-contain"
                    />
                </div>
                <h2 className="font-bold text-xl my-4">AGREEMENT TO ACCEPT PAYMENT RESPONSIBILITY AND CONSENT FOR USE AND DISCLOSURE OF PERSONAL INFORMATION-PRIVATE PAY</h2>
            </div>
            
             <div className="space-y-4">
                <FormField
                    control={form.control}
                    name="clientNameAgreement"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Client Name:</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter client name" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <p className="text-sm text-muted-foreground">
                    I understand that Firstlight Home Care of Rancho Cucamonga may need to use or disclose my personal information to provide ser­vices to me, to obtain payment for its services and for all of the other reasons more fully described in Firstlight Home Care of Rancho Cucamonga Notice of Privacy Practices.
                </p>
                <p className="text-sm text-muted-foreground">
                    I acknowledge that I have received the Notice of Privacy Practices, and I consent to all of the uses and disclosures of my personal information as described in that document including, if applicable and as is necessary, for Firstlight Home Care of Rancho Cucamonga  provide services to me; to coordinate with my other providers; to determine eligibility for payment, bill, and receive payment for services; and to make all other uses and disclosures described in the Notice of Privacy Practices.
                </p>
                <p className="text-sm text-muted-foreground">
                    My consent will be valid for two (2) years from the date below. I may revoke my consent to share information, in writing, at any time. Revoking my consent does not apply to information that has already been shared or affect my financial responsibility for Ser­ vices. I understand that some uses and sharing of my information are authorized by law and do not require my consent.
                </p>
            </div>
            
            <div className="pt-8 grid grid-cols-2 gap-8 items-end">
                <div className="space-y-1">
                    <FormLabel>Client Signature/Responsible Party</FormLabel>
                    <div className="relative w-full h-24 rounded-md border bg-slate-50">
                        <SignatureCanvas
                            penColor='black'
                            canvasProps={{className: 'w-full h-full'}}
                        />
                    </div>
                </div>
                 <FormField
                    control={form.control}
                    name="signatureDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            
            <div className="pt-8 grid grid-cols-2 gap-8 items-end">
                <div className="space-y-1">
                    <FormLabel>Signature</FormLabel>
                    <div className="relative w-full h-24 rounded-md border bg-slate-50">
                        <SignatureCanvas
                            penColor='black'
                            canvasProps={{className: 'w-full h-full'}}
                        />
                    </div>
                </div>
                 <FormField
                    control={form.control}
                    name="relationshipIfNotClient"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Relationship if not Client</FormLabel>
                            <FormControl><Input placeholder="e.g., Spouse, Child, Guardian" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>


            <div className="flex justify-end gap-4">
                <Button type="button" onClick={() => onSave(form.getValues())} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                    Update Master Template
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
                    Save and Send for Signature
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};


export default function ClientSignupForm() {
  const templateRef = useMemoFirebase(() => doc(firestore, "settings", "clientIntakeFormTemplate"), []);
  const { data: template, isLoading, error } = useDoc<any>(templateRef);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  const handleSaveTemplate = (formData: any) => {
    if (!template) return;

    // Create a plain object to pass to the server action, excluding any Timestamps.
    const plainTemplate: GeneratedForm = {
        formName: template.formName,
        blocks: template.blocks,
    };

    startSavingTransition(async () => {
        const result = await saveFormAsTemplate(plainTemplate);
        if (result.error) {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        } else {
            toast({ title: "Success", description: result.message });
        }
    });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="ml-4 text-muted-foreground">Loading form template...</p>
      </div>
    );
  }

  if (error || !template) {
    return (
      <Card className="text-center py-10">
        <CardHeader>
          <CardTitle>Template Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            A client intake form template has not been saved yet. Please go to Owner Settings, generate a form from a PDF, and save it as a template.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <DynamicFormRenderer formDefinition={template} onSave={handleSaveTemplate} isSaving={isSaving} />;
}
