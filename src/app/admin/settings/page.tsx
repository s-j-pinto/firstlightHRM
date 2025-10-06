import AdminSettings from "@/components/admin-settings";

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-headline">Admin Settings</h1>
      <p className="text-muted-foreground">
        Configure interview availability and integration settings.
      </p>
      <div className="mt-6">
        <AdminSettings />
      </div>
    </div>
  );
}
