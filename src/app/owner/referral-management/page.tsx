"use client";

import ReferralManagementClient from "@/components/referral-management-client";
import { HelpDialog } from "@/components/HelpDialog";

export default function ReferralManagementPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Referral Management
          </h1>
          <p className="text-muted-foreground">
            Track client referrals, update their status, and issue rewards for converted clients.
          </p>
        </div>
        <HelpDialog topic="referralManagement" />
      </div>
      <div className="mt-6">
        <ReferralManagementClient />
      </div>
    </div>
  );
}

    