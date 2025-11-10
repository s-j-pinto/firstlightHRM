"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReferralManagementPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Referral Management
      </h1>
      <p className="text-muted-foreground">
        Manage client referrals and issue rewards.
      </p>
      <div className="mt-6">
        <Card className="text-center py-20 border-2 border-dashed">
            <CardHeader>
                <CardTitle className="text-xl text-muted-foreground">Coming Soon</CardTitle>
                <CardDescription>
                    This section will allow you to track new client referrals and issue rewards to your existing clients.
                </CardDescription>
            </CardHeader>
        </Card>
      </div>
    </div>
  );
}