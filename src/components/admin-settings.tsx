
"use client";

import { useTransition, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { saveAdminSettings } from "@/lib/actions";
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
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

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
  const { toast } = useToast();
  const { register, handleSubmit, reset } = useForm<SettingsFormValues>();

  useEffect(() => {
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
    });
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
                    To get your Refresh Token, paste the Authorization Code from the Google consent screen URL here and click save. Check your server logs for the token.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Label htmlFor="googleAuthCode">Authorization Code (Temporary)</Label>
                    <Input id="googleAuthCode" {...register("googleAuthCode")} placeholder="Paste the code from the URL here..."/>
                </div>
            </CardContent>
        </Card>

        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>Google Calendar Integration</AlertTitle>
          <AlertDescription>
            To send calendar invites, your Google credentials must be set in a `.env.local` file in your project's root directory. The server logs will provide instructions if credentials are missing.
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
