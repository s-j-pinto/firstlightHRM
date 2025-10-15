
"use client";

import { useTransition, useEffect, useState } from "react";
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
import { Loader2, Terminal, Copy, Check, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { doc, setDoc } from "firebase/firestore";
import { useFirestore, useFirebase, useMemoFirebase } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";

type SettingsFormValues = {
  sunday_slots: string;
  monday_slots: string;
  tuesday_slots: string;
  wednesday_slots: string;
  thursday_slots: string;
  friday_slots: string;
  saturday_slots: string;
  googleAuthCode?: string;
};

export default function AdminSettings() {
  const [isPending, startTransition] = useTransition();
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();
  const { register, handleSubmit, reset, getValues, setValue } = useForm<SettingsFormValues>();
  const firestore = useFirestore();
  const { isUserLoading: isUserAuthLoading } = useFirebase();

  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, "settings", "availability") : null),
    [firestore]
  );

  const { data: settingsData, isLoading: isSettingsLoading } = useDoc<SettingsFormValues>(settingsDocRef);

  useEffect(() => {
    if (settingsData) {
      reset(settingsData);
    } else {
      reset({
        sunday_slots: "11:00, 12:00, 13:00, 14:00, 15:00, 16:00",
        monday_slots: "11:00, 12:00, 13:00, 14:00, 15:00, 16:00",
        tuesday_slots: "11:00, 12:00, 13:00, 14:00, 15:00, 16:00",
        wednesday_slots: "11:00, 12:00, 13:00, 14:00, 15:00, 16:00",
        thursday_slots: "",
        friday_slots: "",
        saturday_slots: "",
        googleAuthCode: "",
      });
    }
  }, [settingsData, reset]);

  const onSubmit = (data: SettingsFormValues) => {
    startTransition(async () => {
      if (!firestore) return;
      const { googleAuthCode, ...availability } = data;
      
      try {
        await setDoc(doc(firestore, "settings", "availability"), availability, { merge: true });
        toast({
          title: "Success",
          description: "Availability settings have been saved.",
        });

        if (googleAuthCode) {
          const result = await saveAdminSettings({ googleAuthCode });
          if (result.error) {
            toast({ title: "Google Auth Error", description: result.message, variant: "destructive" });
          } else if (result.refreshToken) {
            setRefreshToken(result.refreshToken);
            toast({ title: "Google Auth Success", description: result.message });
          }
          setValue("googleAuthCode", "");
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

  const copyToClipboard = () => {
    if (refreshToken) {
      navigator.clipboard.writeText(refreshToken);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };
  
  if (isUserAuthLoading || isSettingsLoading) {
    return <p>Loading settings...</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Interview Availability</CardTitle>
            <CardDescription>
              Set the available time slots for each day. Use 24-hour format, separated by commas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="sunday_slots">Sunday</Label>
              <Input id="sunday_slots" {...register("sunday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monday_slots">Monday</Label>
              <Input id="monday_slots" {...register("monday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tuesday_slots">Tuesday</Label>
              <Input id="tuesday_slots" {...register("tuesday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wednesday_slots">Wednesday</Label>
              <Input id="wednesday_slots" {...register("wednesday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thursday_slots">Thursday</Label>
              <Input id="thursday_slots" {...register("thursday_slots")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="friday_slots">Friday</Label>
              <Input id="friday_slots" {...register("friday_slots")} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="saturday_slots">Saturday</Label>
              <Input id="saturday_slots" {...register("saturday_slots")} />
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
                    <Input id="googleAuthCode" {...register("googleAuthCode")} placeholder="Paste the code from the URL here..."/>
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
             For Google OAuth to work, your app must be running on the expected redirect URI. You must also add this exact URI to the "Authorized redirect URIs" list in your Google Cloud project credentials.
             By default, this is `http://localhost:9002/admin/settings`.
          </AlertDescription>
        </Alert>

        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>Google Credentials</AlertTitle>
          <AlertDescription>
            To send calendar invites, your Google credentials must be set in a `.env.local` file in your project's root directory. This file must contain `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the `GOOGLE_REFRESH_TOKEN` you generate here.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="bg-accent hover:bg-accent/90">
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save Settings
          </Button>
        </div>
      </div>
    </form>
  );
}
