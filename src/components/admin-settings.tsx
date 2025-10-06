
"use client";

import { useTransition } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

type SettingsFormValues = {
  monday_slots: string;
  tuesday_slots: string;
  wednesday_slots: string;
  thursday_slots: string;
  friday_slots: string;
  google_client_id: string;
  google_client_secret: string;
  google_refresh_token: string;
};

export default function AdminSettings() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { register, handleSubmit } = useForm<SettingsFormValues>({
    defaultValues: {
      monday_slots: "8:30, 9:30, 10:30",
      tuesday_slots: "8:30, 9:30, 10:30",
      wednesday_slots: "8:30, 9:30, 10:30",
      thursday_slots: "13:30, 14:30, 15:30",
      friday_slots: "13:30, 14:30, 15:30",
      google_client_id: "",
      google_client_secret: "",
      google_refresh_token: "",
    },
  });

  const onSubmit = (data: SettingsFormValues) => {
    startTransition(async () => {
      const availability = {
        monday: data.monday_slots,
        tuesday: data.tuesday_slots,
        wednesday: data.wednesday_slots,
        thursday: data.thursday_slots,
        friday: data.friday_slots,
      };
      const googleCalendar = {
        clientId: data.google_client_id,
        clientSecret: data.google_client_secret,
        refreshToken: data.google_refresh_token,
      };
      const result = await saveAdminSettings({ availability, googleCalendar });
      toast({
        title: "Success",
        description: result.message,
      });
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
            <CardTitle>Google Calendar Integration</CardTitle>
            <CardDescription>
              Enter your Google API credentials to enable calendar integration. These are stored securely as environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="google_client_id">Client ID</Label>
              <Input
                id="google_client_id"
                placeholder="Enter your Google Client ID"
                {...register("google_client_id")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google_client_secret">Client Secret</Label>
              <Input
                id="google_client_secret"
                type="password"
                placeholder="Enter your Google Client Secret"
                {...register("google_client_secret")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google_refresh_token">Refresh Token (one-time setup)</Label>
              <Input
                id="google_refresh_token"
                type="password"
                placeholder="Enter your Google Refresh Token"
                {...register("google_refresh_token")}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="bg-accent hover:bg-accent/90">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </div>
    </form>
  );
}
