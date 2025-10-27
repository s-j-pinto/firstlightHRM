
"use client";

import { useState } from 'react';
import { CareLogGroupAdmin } from '@/components/carelog-group-admin';
import { CareLogTemplateAdmin } from '@/components/carelog-template-admin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StaffingAdminPage() {
  return (
    <Tabs defaultValue="groups">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="groups">Manage Groups</TabsTrigger>
        <TabsTrigger value="templates">Manage Templates</TabsTrigger>
      </TabsList>
      <TabsContent value="groups">
        <div className="mt-6">
          <CareLogGroupAdmin />
        </div>
      </TabsContent>
      <TabsContent value="templates">
        <div className="mt-6">
            <CareLogTemplateAdmin />
        </div>
      </TabsContent>
    </Tabs>
  );
}

    