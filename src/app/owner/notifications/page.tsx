
"use client";

import NotificationsClient from "@/components/notifications-client";
import { HelpDialog } from "@/components/HelpDialog";

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Notifications Sent
          </h1>
          <p className="text-muted-foreground">
            A log of all automated and manual emails sent from the system.
          </p>
        </div>
        <HelpDialog topic="notifications" />
      </div>
      <div className="mt-6">
        <NotificationsClient />
      </div>
    </div>
  );
}
