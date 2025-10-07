
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

type SettingsFormValues = {
  monday_slots: string;
  tuesday_slots: string;
  wednesday_slots: string;
  thursday_slots: string;
  friday_slots: string;
  googleAuthCode?: string;
};

export default function AdminSettings() {
  const [isPending, startTransition] = useTransition();
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();
  const { register, handleSubmit, reset } = useForm<SettingsFormValues>();

  useEffect(() => {
    // In a real app, you would fetch these initial values from a database.
    // For this example, we'll use hardcoded defaults.
    reset({
      monday_slots: "8:30, 9:30, 10:30",
      tuesday_slots: "8:30, 9:30, 10:30",
      wednesday_slots: "8:30, 9:30, 10:30",
      thursday_slots: "13:30, 14:30, 15:30",
      friday_slots: "13:30, 14:30, 15:30",
      googleAuthCode: "",
    });
  }, [reset]);

  const onSubmit = (data: SettingsFormValues) => {
    startTransition(async () => {
      const result = await saveAdminSettings({ 
        availability: {
            monday_slots: data.monday_slots,
            tuesday_slots: data.tuesday_slots,
            wednesday_slots: data.wednesday_slots,
            thursday_slots: data.thursday_slots,
            friday_slots: data.friday_slots,
        },
        googleAuthCode: data.googleAuthCode
      });
      toast({
        title: result.error ? "Error" : "Success",
        description: result.message,
        variant: result.error ? "destructive" : "default",
      });
      // Clear the auth code field after submission
      reset({ ...data, googleAuthCode: "" });

      if(result.refreshToken) {
        setRefreshToken(result.refreshToken);
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
          <CardContent className="grid md:grid-cols-2 gap-6">
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
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Google Calendar Setup</CardTitle>
                <CardDescription>
                    To get your Refresh Token, paste the Authorization Code from the Google consent screen URL here and click save.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Label htmlFor="googleAuthCode">Authorization Code (Temporary)</Label>
                    <Input id="googleAuthCode" {...register("googleAuthCode")} placeholder="Paste the code from the URL here..."/>
                </div>
                {refreshToken && (
                    <Alert className="mt-4">
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Your Refresh Token is Ready!</AlertTitle>
                        <AlertDescription>
                            <p>This is a one-time step. Copy this token and add it to a new file named `.env.local` in your project's root directory.</p>
                            <pre className="my-2 p-2 bg-muted rounded-md text-xs whitespace-pre-wrap break-all relative pr-10">
                                GOOGLE_REFRESH_TOKEN={refreshToken}
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={copyToClipboard}>
                                    {hasCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </pre>
                             <p className="text-xs text-muted-foreground">After adding the token, you must restart your development server.</p>
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Important: Configure Redirect URI</AlertTitle>
          <AlertDescription>
            For Google OAuth to work, your app must be running on the expected redirect URI. For this example, that is `https://9000-firebase-studio-1759770880601.cluster-cxy3ise3prdrmx53pigwexthgs.cloudworkstations.dev/admin/settings`. You must also add this exact URI to the "Authorized redirect URIs" list in your Google Cloud project credentials.
          </AlertDescription>
        </Alert>

        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>Google Credentials</AlertTitle>
          <AlertDescription>
            To send calendar invites, your Google credentials must be set in a `.env.local` file in your project's root directory. This file should contain `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the `GOOGLE_REFRESH_TOKEN` you generate here.
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
