
"use client";

import CampaignManagementClient from "@/components/campaign-management-client";

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Follow-up Campaigns
      </h1>
      <p className="text-muted-foreground">
        Create and manage automated email templates that are sent to leads after their initial inquiry.
      </p>
      <div className="mt-6">
        <CampaignManagementClient />
      </div>
    </div>
  );
}
