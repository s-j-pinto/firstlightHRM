
"use client";

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
import { type GeneratedForm } from "@/lib/types";
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
      // Add other fields from your dynamic form here if needed for validation
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { clientEmail: '' },
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

  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText /> {formDefinition?.formName || 'Client Intake Form'}</CardTitle>
        <CardDescription>
            This form is based on the saved template. Review and fill out the details below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* The dynamically rendered form content will go here */}
            {/* For now, we simulate the structure based on previous conversations */}
            <div className="flex justify-center mb-6">
                <Image src={logoUrl} alt="FirstLight Home Care Logo" width={250} height={40} priority className="object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-center">CLIENT SERVICE AGREEMENT</h2>
            <p className="text-xs">
                Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated. This Client Service Agreement (the "Agreement") is entered into between the client, or his or her authorized representative, (the "Client") and FirstLight Home Care of Rancho Cucamonga, CA, address 9650 Business Center drive, Suite 132, Rancho Cucamonga CA 91730, phone number 9093214466 ("FirstLight Home Care").
            </p>
            
            {/* Example of a field that would be part of the dynamic form */}
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

            {/* This is a placeholder for the rest of the dynamic form content */}
            <div className="p-8 my-8 text-center border-dashed border-2 rounded-md text-muted-foreground">
                <p>The rest of the form fields based on the saved template would be rendered here.</p>
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
      // In a real scenario, you'd serialize the current state of the form
      // back into the JSX string or a JSON structure to save it.
      // For this prototype, we'll just re-save the existing template data.
      if (!template) return;

      startSavingTransition(async () => {
         const result = await saveFormAsTemplate(template);
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

    