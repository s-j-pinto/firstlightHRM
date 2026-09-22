
"use client";

import { useTransition, useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { saveAdminSettings, generateGoogleAuthUrl } from "@/lib/google-calendar.actions";
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
import { Loader2, Terminal, Copy, Check, AlertTriangle, Edit2, RefreshCw, ExternalLink, KeyRound, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { doc, setDoc } from "firebase/firestore";
import { useFirestore, useFirebase, useMemoFirebase } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
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

    useEffect(() => {
        if (isOpen && sigPadRef.current) {
            sigPadRef.current.clear();
            if (signatureData) {
                sigPadRef.current.fromDataURL(signatureData);
            }
        }
    }, [isOpen, signatureData]);
    
    const handleClear = () => {
        sigPadRef.current?.clear();
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
                        onEnd={() => {}}
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
  const [isAuthPending, startAuthTransition] = useTransition();
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
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

  const handleGenerateAuthUrl = () => {
      startAuthTransition(async () => {
          const result = await generateGoogleAuthUrl();
          if (result.error) {
              toast({ title: "Error", description: result.error, variant: "destructive" });
          } else if (result.authUrl) {
              setAuthUrl(result.authUrl);
              toast({ title: "Success", description: "Authorization link generated below." });
          }
      });
  };

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
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin text-accent h-8 w-8" />
        </div>
    );
  }

  // Calculate the current redirect URI (Origin only for simplified configuration)
  const currentBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  let displayRedirectUri = currentBaseUrl;
  try {
      displayRedirectUri = new URL(currentBaseUrl).origin;
  } catch (e) {}

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

        <Card className="border-orange-500/50">
            <CardHeader className="bg-orange-500/5">
                <CardTitle className="flex items-center gap-2">
                    <KeyRound className="text-orange-600" />
                    Force Re-authorize Google Calendar
                </CardTitle>
                <CardDescription>
                    Use this to switch the integrated calendar to a different Google account (e.g., lpinto@firstlighthomecare.com).
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                    If you already have a token configured but need to change the account, click the button below to generate a new link.
                </p>
                <Button type="button" variant="outline" onClick={handleGenerateAuthUrl} disabled={isAuthPending}>
                    {isAuthPending && <Loader2 className="mr-2 animate-spin h-4 w-4" />}
                    Generate Authorization Link
                </Button>

                {authUrl && (
                    <Alert className="bg-green-50 border-green-200">
                        <ExternalLink className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-800">Authorization Link Ready</AlertTitle>
                        <AlertDescription className="pt-2">
                            <p className="mb-4">Click the button below. <strong>Important:</strong> Log in as <strong>lpinto@firstlighthomecare.com</strong> in the page that opens.</p>
                            <Button asChild>
                                <a href={authUrl} target="_blank" rel="noopener noreferrer">
                                    Authorize lpinto@firstlighthomecare.com
                                </a>
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Google Auth Finalization</CardTitle>
                <CardDescription>
                    After authorizing via the link above, paste the resulting "code" from the browser URL here and save.
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
                            <p>This is a one-time step. Copy this new token and update the `GOOGLE_REFRESH_TOKEN` value in your environment secrets.</p>
                            <pre className="my-2 p-2 bg-muted rounded-md text-xs whitespace-pre-wrap break-all relative pr-10">
                                GOOGLE_REFRESH_TOKEN={refreshToken}
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={copyToClipboard}>
                                    {hasCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </pre>
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Important: Configure Redirect URI</AlertTitle>
          <AlertDescription className="space-y-2">
             <p>Ensure the following origin is whitelisted in your Google Cloud Console under <strong>"Authorized redirect URIs"</strong> (not JavaScript origins):</p>
             <code className="bg-muted px-2 py-1 rounded block w-fit border">{displayRedirectUri}</code>
             <div className="flex items-start gap-2 mt-2 text-xs opacity-80 bg-background/50 p-2 rounded">
                 <Info className="h-3 w-3 shrink-0 mt-0.5" />
                 <p>Note: We are using the base URL without a path to bypass character restrictions in some Google Cloud environments. After authorizing, you will land on the Home Page; please copy the code from the URL bar there.</p>
             </div>
          </AlertDescription>
        </Alert>

        <div className="flex justify-end sticky bottom-4 z-10">
          <Button type="submit" disabled={isPending} className="bg-accent hover:bg-accent/90 shadow-lg">
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
