
"use client";

import * as React from "react";
import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDoc, useMemoFirebase, firestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { doc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Save, BookUser } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendSignatureEmail } from "@/lib/client-signup.actions";
import { useRouter } from "next/navigation";


// Define a basic schema. This will be expanded with all the form fields.
const clientSignupFormSchema = z.object({
  formName: z.string().optional().default("Client Intake Form"),
  clientEmail: z.string().email({ message: "A valid client email is required to send the signature link." }),
});

// This will become the full type for our form data.
type ClientSignupFormData = z.infer<typeof clientSignupFormSchema>;

export default function ClientSignupForm({ signupId }: { signupId: string | null }) {
  const [isSaving, startSavingTransition] = useTransition();
  const [isSending, startSendingTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  // Fetches the existing signup document if an ID is provided
  const signupDocRef = useMemoFirebase(() => signupId ? doc(firestore, "client_signups", signupId) : null, [signupId]);
  const { data: existingSignupData, isLoading: isSignupLoading } = useDoc<any>(signupDocRef);

  const form = useForm<ClientSignupFormData>({
    resolver: zodResolver(clientSignupFormSchema),
    defaultValues: {
      clientEmail: '',
    },
  });

  // When existing data loads, reset the form with those values.
  useEffect(() => {
    if (existingSignupData) {
      form.reset(existingSignupData.formData);
    }
  }, [existingSignupData, form]);


  const handleSave = async (status: "INCOMPLETE" | "PENDING CLIENT SIGNATURES") => {
    const isSendingAction = status === "PENDING CLIENT SIGNATURES";
    const transition = isSendingAction ? startSendingTransition : startSavingTransition;

    // Trigger validation before saving
    const isValid = await form.trigger();
    if (!isValid) {
        toast({
            title: "Validation Error",
            description: "Please fill out all required fields before saving or sending.",
            variant: "destructive",
        });
        return;
    }

    transition(async () => {
      const formData = form.getValues();
      
      const saveData: any = {
        formData: formData,
        clientEmail: formData.clientEmail,
        status: status,
        lastUpdatedAt: serverTimestamp(),
      };

      try {
        let docId = signupId;
        if (docId) {
          // Update existing document
          const docRef = doc(firestore, 'client_signups', docId);
          await updateDoc(docRef, saveData).catch(serverError => {
            errorEmitter.emit("permission-error", new FirestorePermissionError({
              path: docRef.path, operation: "update", requestResourceData: saveData,
            }));
            throw serverError;
          });
        } else {
          // Create new document
          saveData.createdAt = serverTimestamp();
          const colRef = collection(firestore, 'client_signups');
          const newDocRef = await addDoc(colRef, saveData).catch(serverError => {
            errorEmitter.emit("permission-error", new FirestorePermissionError({
                path: colRef.path, operation: "create", requestResourceData: saveData,
            }));
            throw serverError;
          });
          docId = newDocRef.id;
        }

        if (status === 'INCOMPLETE') {
          toast({ title: "Draft Saved", description: "The client intake form has been saved as a draft." });
          if (!signupId) {
            router.push(`/owner/new-client-signup?signupId=${docId}`);
          }
        } else {
          const emailResult = await sendSignatureEmail(docId!, formData.clientEmail);
           if (emailResult.error) {
              toast({ title: "Email Error", description: emailResult.message, variant: "destructive" });
           } else {
              toast({ title: "Success", description: "Form saved and signature link sent to the client." });
           }
          router.push('/owner/dashboard');
        }

      } catch (error: any) {
        if (!error.name?.includes('FirebaseError')) {
           toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
        }
      }
    });
  };

  if (isSignupLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="ml-4 text-muted-foreground">Loading form...</p>
      </div>
    );
  }

  return (
    <Card>
      <Form {...form}>
        <form>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 pt-4"><BookUser /> Client Intake Form</CardTitle>
            <CardDescription>
              Fill out the details below. You can save a draft or send it to the client for their signature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <FormField
              control={form.control}
              name="clientEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Contact Email</FormLabel>
                  <FormControl>
                    <Input placeholder="client@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="text-center text-muted-foreground py-10 border-2 border-dashed rounded-lg">
                <p>Boilerplate language and form fields will be added here.</p>
            </div>

            <div className="flex justify-end gap-4 pt-6">
                <Button type="button" variant="secondary" onClick={() => handleSave("INCOMPLETE")} disabled={isSaving || isSending}>
                    {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                    Save as Incomplete
                </Button>
                <Button type="button" onClick={() => handleSave("PENDING CLIENT SIGNATURES")} disabled={isSaving || isSending}>
                    {isSending ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
                    Save and Send for Signature
                </Button>
            </div>

          </CardContent>
          <CardFooter className="flex justify-center text-xs text-muted-foreground pt-4">
            <p>Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated.</p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
