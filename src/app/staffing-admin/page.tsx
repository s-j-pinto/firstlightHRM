
"use client";

import { useState } from 'react';
import { CareLogGroupAdmin } from '@/components/carelog-group-admin';
import { CareLogTemplateAdmin } from '@/components/carelog-template-admin';
import VATaskTemplateAdmin from '@/components/va-task-template-admin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpDialog } from '@/components/HelpDialog';

export default function StaffingAdminPage() {
  const [activeTab, setActiveTab] = useState("groups");

  const getHelpTopic = () => {
    switch(activeTab) {
        case 'groups': return 'carelogGroups';
        case 'templates': return 'carelogTemplates';
        case 'va_templates': return 'carelogTemplates'; // Reuse template help topic for VA for now
        default: return 'carelogGroups';
    }
  }

  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            CareLog Management
          </h1>
          <p className="text-muted-foreground">
            Manage client-caregiver groups and create structured log templates.
          </p>
        </div>
        <HelpDialog topic={getHelpTopic()} />
      </div>

      <Tabs defaultValue="groups" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="groups">Manage Groups</TabsTrigger>
          <TabsTrigger value="templates">Manage CareLog Templates</TabsTrigger>
          <TabsTrigger value="va_templates">Manage VA Templates</TabsTrigger>
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
        <TabsContent value="va_templates">
          <div className="mt-6">
              <VATaskTemplateAdmin />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
