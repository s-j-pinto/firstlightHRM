
"use client";

import { useTransition, useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { saveAdminSettings } from "@/lib/google-calendar.actions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Terminal, Copy, Check, AlertTriangle, Edit2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { doc, setDoc } from "firebase/firestore";
import { useFirestore, useFirebase, useMemoFirebase } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { CareLogGroupAdmin } from "./carelog-group-admin";
import SignatureCanvas from 'react-signature-canvas';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

type SettingsFormValues = {
  sunday_slots: string;
  monday_slots: string;
  tuesday_slots: string;
  wednesday_slots: string;
  thursday_slots: string;
  friday_slots: string;
  saturday_slots: string;
  googleAuthCode?: string;
  adminSignature?: string;
};

type AssessmentAvailabilityFormValues = {
    assessment_sunday_slots: string;
    assessment_monday_slots: string;
    assessment_tuesday_slots: string;
    assessment_wednesday_slots: string;
    assessment_thursday_slots: string;
    assessment_friday_slots: string;
    assessment_saturday_slots: string;
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
    const [isSigned, setIsSigned] = useState(false);

    useEffect(() => {
        if (isOpen && sigPadRef.current) {
            sigPadRef.current.clear();
            if (signatureData) {
                sigPadRef.current.fromDataURL(signatureData);
                setIsSigned(true);
            } else {
                setIsSigned(false);
            }
        }
    }, [isOpen, signatureData]);
    
    const handleClear = () => {
        sigPadRef.current?.clear();
        setIsSigned(false);
    }
    
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
                        onEnd={() => setIsSigned(true)}
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

export default function AdminSettings() {
  const [isPending, startTransition] = useTransition();
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { isUserLoading: isUserAuthLoading } = useFirebase();

  const [activeSignature, setActiveSignature] = useState<{ fieldName: "adminSignature"; title: string; } | null>(null);

  const interviewSettingsForm = useForm<SettingsFormValues>();
  const assessmentSettingsForm = useForm<AssessmentAvailabilityFormValues>();

  const interviewSettingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, "settings", "availability") : null),
    [firestore]
  );
  const assessmentSettingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, "settings", "assessment_availability") : null),
    [firestore]
  );

  const { data: interviewSettingsData, isLoading: isInterviewSettingsLoading } = useDoc<SettingsFormValues>(interviewSettingsDocRef);
  const { data: assessmentSettingsData, isLoading: isAssessmentSettingsLoading } = useDoc<AssessmentAvailabilityFormValues>(assessmentSettingsDocRef);


  useEffect(() => {
    if (interviewSettingsData) {
      interviewSettingsForm.reset(interviewSettingsData);
    } else {
      interviewSettingsForm.reset({
        sunday_slots: "11:00, 12:00, 13:00, 14:00, 15:00, 16:00",
        monday_slots: "11:00, 12:00, 13:00, 14:00, 15:00, 16:00",
        tuesday_slots: "11:00, 12:00, 13:00, 14:00, 15:00, 16:00",
        wednesday_slots: "11:00, 12:00, 13:00, 14:00, 15:00, 16:00",
        thursday_slots: "",
        friday_slots: "",
        saturday_slots: "",
      });
    }
  }, [interviewSettingsData, interviewSettingsForm]);

  useEffect(() => {
    if (assessmentSettingsData) {
      assessmentSettingsForm.reset(assessmentSettingsData);
    } else {
      assessmentSettingsForm.reset({
        assessment_sunday_slots: "10:00, 11:00, 12:00, 14:00, 15:00",
        assessment_monday_slots: "10:00, 11:00, 12:00, 14:00, 15:00",
        assessment_tuesday_slots: "10:00, 11:00, 12:00, 14:00, 15:00",
        assessment_wednesday_slots: "10:00, 11:00, 12:00, 14:00, 15:00",
        assessment_thursday_slots: "10:00, 11:00, 12:00, 14:00, 15:00",
        assessment_friday_slots: "",
        assessment_saturday_slots: "",
      });
    }
  }, [assessmentSettingsData, assessmentSettingsForm]);

  const onSubmit = (data: SettingsFormValues & AssessmentAvailabilityFormValues) => {
    startTransition(async () => {
      if (!firestore) return;
      const { googleAuthCode, ...availability } = interviewSettingsForm.getValues();
      const assessmentAvailability = assessmentSettingsForm.getValues();
      
      try {
        await setDoc(doc(firestore, "settings", "availability"), availability, { merge: true });
        await setDoc(doc(firestore, "settings", "assessment_availability"), assessmentAvailability, { merge: true });

        toast({
          title: "Success",
          description: "All availability settings have been saved.",
        });

        if (googleAuthCode) {
          const result = await saveAdminSettings({ googleAuthCode });
          if (result.error) {
            toast({ title: "Google Auth Error", description: result.message, variant: "destructive" });
          } else if (result.refreshToken) {
            setRefreshToken(result.refreshToken);
            toast({ title: "Google Auth Success", description: result.message });
          }
          interviewSettingsForm.setValue("googleAuthCode", "");
        }

      } catch (e) {
        toast({
          title: "Error",
          description: "Failed to save settings.",
          variant: "destructive",
        });
      }
    });
  };
  
  const handleFormSubmit = () => {
    const interviewData = interviewSettingsForm.getValues();
    const assessmentData = assessmentSettingsForm.getValues();
    onSubmit({ ...interviewData, ...assessmentData });
  };


  const copyToClipboard = () => {
    if (refreshToken) {
      navigator.clipboard.writeText(refreshToken);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  const handleSaveSignature = (dataUrl: string) => {
    if (activeSignature) {
        interviewSettingsForm.setValue(activeSignature.fieldName, dataUrl, { shouldValidate: true, shouldDirty: true });
    }
  };

  const SignatureField = ({ fieldName, title }: { fieldName: "adminSignature"; title: string; }) => {
      const signatureData = interviewSettingsForm.watch(fieldName);
      return (
          <div className="space-y-2">
              <Label>{title}</Label>
              <div className="relative rounded-md border bg-muted/30 h-32 flex items-center justify-center">
                  {signatureData ? (
                      <Image src={signatureData as string} alt="Signature" layout="fill" objectFit="contain" />
                  ) : (
                      <span className="text-muted-foreground">Not Signed</span>
                  )}
                   <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-7 w-7"
                      onClick={() => setActiveSignature({ fieldName, title })}
                  >
                      <Edit2 className="h-4 w-4" />
                  </Button>
              </div>
          </div>
      );
  };
  
  if (isUserAuthLoading || isInterviewSettingsLoading || isAssessmentSettingsLoading) {
    return <p>Loading settings...</p>;
  }

  return (
    <div className="space-y-8">
      <form onSubmit={(e) => { e.preventDefault(); handleFormSubmit(); }} className="space-y-8">
        <Card>
            <CardHeader>
                <CardTitle>Administrator Signature</CardTitle>
                <CardDescription>
                    Provide a signature to be used on official documents.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <SignatureField fieldName="adminSignature" title="Administrator Signature" />
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interview Availability</CardTitle>
            <CardDescription>
              Set the available time slots for caregiver phone screen interviews. Use 24-hour format, separated by commas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="sunday_slots">Sunday</Label>
              <Input id="sunday_slots" {...interviewSettingsForm.register("sunday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monday_slots">Monday</Label>
              <Input id="monday_slots" {...interviewSettingsForm.register("monday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tuesday_slots">Tuesday</Label>
              <Input id="tuesday_slots" {...interviewSettingsForm.register("tuesday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wednesday_slots">Wednesday</Label>
              <Input id="wednesday_slots" {...interviewSettingsForm.register("wednesday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thursday_slots">Thursday</Label>
              <Input id="thursday_slots" {...interviewSettingsForm.register("thursday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="friday_slots">Friday</Label>
              <Input id="friday_slots" {...interviewSettingsForm.register("friday_slots")} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="saturday_slots">Saturday</Label>
              <Input id="saturday_slots" {...interviewSettingsForm.register("saturday_slots")} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>In-Home Assessment Availability</CardTitle>
            <CardDescription>
              Set the available time slots for new client in-home visits. Use 24-hour format, separated by commas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="assessment_sunday_slots">Sunday</Label>
              <Input id="assessment_sunday_slots" {...assessmentSettingsForm.register("assessment_sunday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment_monday_slots">Monday</Label>
              <Input id="assessment_monday_slots" {...assessmentSettingsForm.register("assessment_monday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment_tuesday_slots">Tuesday</Label>
              <Input id="assessment_tuesday_slots" {...assessmentSettingsForm.register("assessment_tuesday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment_wednesday_slots">Wednesday</Label>
              <Input id="assessment_wednesday_slots" {...assessmentSettingsForm.register("assessment_wednesday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment_thursday_slots">Thursday</Label>
              <Input id="assessment_thursday_slots" {...assessmentSettingsForm.register("assessment_thursday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment_friday_slots">Friday</Label>
              <Input id="assessment_friday_slots" {...assessmentSettingsForm.register("assessment_friday_slots")} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="assessment_saturday_slots">Saturday</Label>
              <Input id="assessment_saturday_slots" {...assessmentSettingsForm.register("assessment_saturday_slots")} />
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Google Calendar Setup</CardTitle>
                <CardDescription>
                    To get or refresh your token, paste the Authorization Code from the Google consent screen URL here and click save.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Label htmlFor="googleAuthCode">Authorization Code (One-time use)</Label>
                    <Input id="googleAuthCode" {...interviewSettingsForm.register("googleAuthCode")} placeholder="Paste the code from the URL here..."/>
                </div>
                {refreshToken && (
                    <Alert className="mt-4">
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Your New Refresh Token is Ready!</AlertTitle>
                        <AlertDescription>
                            <p>This is a one-time step. Copy this new token and update the `GOOGLE_REFRESH_TOKEN` value in your `.env.local` file.</p>
                            <pre className="my-2 p-2 bg-muted rounded-md text-xs whitespace-pre-wrap break-all relative pr-10">
                                GOOGLE_REFRESH_TOKEN={refreshToken}
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={copyToClipboard}>
                                    {hasCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </pre>
                             <p className="text-xs text-muted-foreground">After updating the token, you must restart your development server for the change to take effect.</p>
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Important: Configure Redirect URI</AlertTitle>
          <AlertDescription>
             For Google OAuth to work, your app must be running on the expected redirect URI. You must also add this exact URI to the &quot;Authorized redirect URIs&quot; list in your Google Cloud project credentials.
             By default, this is `http://localhost:9002/admin/settings`.
          </AlertDescription>
        </Alert>

        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>Google Credentials</AlertTitle>
          <AlertDescription>
            To send calendar invites, your Google credentials must be set in a `.env.local` file in your project&apos;s root directory. This file must contain `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the `GOOGLE_REFRESH_TOKEN` you generate here.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="bg-accent hover:bg-accent/90">
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save All Settings
          </Button>
        </div>
      </form>
      {activeSignature && (
          <SignaturePadModal
              isOpen={!!activeSignature}
              onClose={() => setActiveSignature(null)}
              onSave={handleSaveSignature}
              signatureData={interviewSettingsForm.getValues(activeSignature.fieldName)}
              title={activeSignature.title}
          />
      )}
    </div>
  );
}
