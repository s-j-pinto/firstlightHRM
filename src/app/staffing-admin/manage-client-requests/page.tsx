
"use client";

import ManageClientRequestsClient from '@/components/manage-client-requests-client';
import ManageVideoCheckinsClient from '@/components/manage-video-checkins-client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ManageClientRequestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Manage Client Requests
        </h1>
        <p className="text-muted-foreground">
          Review and process all incoming requests from clients.
        </p>
      </div>

      <Tabs defaultValue="care_requests">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="care_requests">Additional Care Requests</TabsTrigger>
          <TabsTrigger value="video_checkins">Video Check-in Requests</TabsTrigger>
        </TabsList>
        <TabsContent value="care_requests">
          <div className="mt-6">
            <ManageClientRequestsClient />
          </div>
        </TabsContent>
        <TabsContent value="video_checkins">
          <div className="mt-6">
            <ManageVideoCheckinsClient />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
