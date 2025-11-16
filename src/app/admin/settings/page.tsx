import AdminSettings from "@/components/admin-settings";
import { HelpDialog } from "@/components/HelpDialog";

export default function AdminSettingsPage() {
  return (
    <div>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Admin Settings</h1>
          <p className="text-muted-foreground">
            Configure interview availability, integration settings, and CareLog groups.
          </p>
        </div>
        <HelpDialog topic="adminSettings" />
      </div>
      <div className="mt-6">
        <AdminSettings />
      </div>
    </div>
  );
}

    