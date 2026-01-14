"use client";

import ManageActiveCaregiversClient from '@/components/manage-active-caregivers-client';
import ManageCaregiverAvailabilityClient from '@/components/manage-caregiver-availability-client';
import ManageCaregiverPreferencesClient from '@/components/manage-caregiver-preferences-client';
import { HelpDialog } from '@/components/HelpDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ManageActiveCaregiversPage() {
  return (
    <div>
       <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Manage Active Caregivers
          </h1>
          <p className="text-muted-foreground">
            Upload and manage active caregiver information, availability, and preferences.
          </p>
        </div>
        <HelpDialog topic="manageActiveCaregivers" />
      </div>
      <Tabs defaultValue="profiles" className="mt-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profiles">Caregiver Profiles</TabsTrigger>
          <TabsTrigger value="availability">Caregiver Availability</TabsTrigger>
          <TabsTrigger value="preferences">Preferences & Skills</TabsTrigger>
        </TabsList>
        <TabsContent value="profiles">
          <div className="mt-6">
            <ManageActiveCaregiversClient />
          </div>
        </TabsContent>
        <TabsContent value="availability">
           <div className="mt-6">
            <ManageCaregiverAvailabilityClient />
          </div>
        </TabsContent>
        <TabsContent value="preferences">
           <div className="mt-6">
            <ManageCaregiverPreferencesClient />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
